import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const STATE_TTL_MS = 10 * 60 * 1000;
const PROVIDER_GROUPS = {
  google: new Set(['gmail', 'google_drive', 'google_docs', 'google_sheets', 'google_calendar']),
  microsoft: new Set(['outlook', 'excel']),
};
const COOKIE_CONFIG = {
  google: { name: 'ola_oauth_state_google', path: '/api/connectors/google-callback' },
  microsoft: { name: 'ola_oauth_state_microsoft', path: '/api/connectors/microsoft-callback' },
};
const STATE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

function providerGroup(connectorProvider) {
  for (const [group, providers] of Object.entries(PROVIDER_GROUPS)) {
    if (providers.has(connectorProvider)) return group;
  }
  return null;
}

function hashState(state) {
  if (typeof state !== 'string' || !STATE_TOKEN_RE.test(state)) {
    throw new TypeError('OAuth state token is invalid');
  }
  return createHash('sha256').update(state, 'utf8').digest('hex');
}

export async function issueOAuthState(admin, { userId, connectorProvider, now = Date.now() }) {
  const group = providerGroup(connectorProvider);
  if (!group || typeof userId !== 'string' || !userId.trim()) {
    throw new TypeError('OAuth state identity or provider is invalid');
  }

  const state = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now + STATE_TTL_MS).toISOString();
  const { error } = await admin.from('oauth_states').insert({
    state_hash: hashState(state),
    user_id: userId,
    provider: group,
    connector_provider: connectorProvider,
    expires_at: expiresAt,
  });
  if (error) throw new Error('Could not persist OAuth state');

  return state;
}

export async function consumeOAuthState(
  admin,
  { state, cookieState, provider, now = Date.now() }
) {
  if (!Object.hasOwn(PROVIDER_GROUPS, provider)) return null;
  if (typeof state !== 'string' || typeof cookieState !== 'string') return null;
  if (!STATE_TOKEN_RE.test(state) || !STATE_TOKEN_RE.test(cookieState)) return null;

  const stateBytes = Buffer.from(state, 'ascii');
  const cookieBytes = Buffer.from(cookieState, 'ascii');
  if (stateBytes.length !== cookieBytes.length || !timingSafeEqual(stateBytes, cookieBytes)) {
    return null;
  }

  const { data, error } = await admin
    .from('oauth_states')
    .delete()
    .eq('state_hash', hashState(state))
    .eq('provider', provider)
    .gt('expires_at', new Date(now).toISOString())
    .select('user_id, connector_provider')
    .maybeSingle();

  if (error) throw new Error('Could not consume OAuth state');
  if (!data?.user_id || providerGroup(data.connector_provider) !== provider) return null;

  return { userId: data.user_id, connectorProvider: data.connector_provider };
}

function cookieName(provider) {
  const config = COOKIE_CONFIG[provider];
  if (!config) throw new TypeError('OAuth provider is invalid');
  return config.name;
}

function cookieAttributes(provider, appUrl, maxAge) {
  const config = COOKIE_CONFIG[provider];
  if (!config) throw new TypeError('OAuth provider is invalid');
  let secure = '';
  try {
    const url = new URL(appUrl);
    if (url.protocol === 'https:') secure = '; Secure';
    else if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error('APP_URL must use HTTPS outside localhost');
    }
  } catch (error) {
    throw new Error('APP_URL is invalid or not secure');
  }
  return `Path=${config.path}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function readOAuthStateCookie(req, provider) {
  const name = cookieName(provider);
  const header = req.headers?.cookie;
  if (typeof header !== 'string') return null;

  for (const item of header.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export function setOAuthStateCookie(res, { provider, state, appUrl }) {
  if (typeof state !== 'string' || !STATE_TOKEN_RE.test(state)) {
    throw new TypeError('OAuth state token is invalid');
  }
  const cookie = `${cookieName(provider)}=${encodeURIComponent(state)}; ${cookieAttributes(provider, appUrl, 600)}`;
  res.setHeader('Set-Cookie', cookie);
}

export function clearOAuthStateCookie(res, { provider, appUrl }) {
  const cookie = `${cookieName(provider)}=; ${cookieAttributes(provider, appUrl, 0)}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  res.setHeader('Set-Cookie', cookie);
}
