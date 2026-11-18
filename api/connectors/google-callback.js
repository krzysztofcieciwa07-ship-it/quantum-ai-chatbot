import {
  PROVIDER_SCOPES,
  getGoogleConfig,
  exchangeCode,
  getGoogleEmail,
} from '../lib/google.js';
import { getAdminClient } from '../lib/supabaseAdmin.js';
import {
  consumeOAuthState,
  readOAuthStateCookie,
  clearOAuthStateCookie,
} from '../lib/oauthState.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { clientId, clientSecret, appUrl } = getGoogleConfig();
  const home = appUrl || '/';
  const cookieState = readOAuthStateCookie(req, 'google');
  if (appUrl) clearOAuthStateCookie(res, { provider: 'google', appUrl });

  try {
    const code = req.query?.code;
    const state = req.query?.state;
    const oauthError = req.query?.error;

    if (oauthError) {
      return res.redirect(`${home}?connector_error=google_authorization_denied`);
    }
    if (typeof code !== 'string' || !code || typeof state !== 'string' || !state) {
      return res.redirect(`${home}?connector_error=missing_code_or_state`);
    }
    if (!clientId || !clientSecret || !appUrl) {
      return res.redirect(`${home}?connector_error=oauth_not_configured`);
    }

    const admin = getAdminClient();
    const identity = await consumeOAuthState(admin, { state, cookieState, provider: 'google' });
    if (!identity || !PROVIDER_SCOPES[identity.connectorProvider]) {
      return res.redirect(`${home}?connector_error=invalid_or_replayed_state`);
    }

    const tokens = await exchangeCode({
      clientId,
      clientSecret,
      code,
      redirectUri: `${appUrl}/api/connectors/google-callback`,
    });

    const accountEmail = await getGoogleEmail(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;
    const row = {
      user_id: identity.userId,
      provider: identity.connectorProvider,
      account_email: accountEmail,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt,
      scopes: PROVIDER_SCOPES[identity.connectorProvider],
      status: 'connected',
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await admin
      .from('connectors')
      .select('refresh_token')
      .eq('user_id', identity.userId)
      .eq('provider', identity.connectorProvider)
      .maybeSingle();
    if (lookupError) throw new Error('Could not read existing connector state');
    if (!row.refresh_token && existing?.refresh_token) row.refresh_token = existing.refresh_token;

    const { error } = await admin.from('connectors').upsert(row, {
      onConflict: 'user_id,provider',
    });
    if (error) throw new Error('Could not save Google connector');

    return res.redirect(`${home}?connected=${encodeURIComponent(identity.connectorProvider)}`);
  } catch (err) {
    console.error('google-callback error:', err);
    return res.redirect(`${home}?connector_error=callback_failed`);
  }
}
