import {
  MS_PROVIDER_SCOPES,
  getMicrosoftConfig,
  exchangeMicrosoftCode,
  getMicrosoftEmail,
} from '../lib/microsoft.js';
import { getAdminClient } from '../lib/supabaseAdmin.js';
import {
  consumeOAuthState,
  readOAuthStateCookie,
  clearOAuthStateCookie,
} from '../lib/oauthState.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const { appUrl, clientId, clientSecret, tenant } = getMicrosoftConfig();
  const home = appUrl || '/';
  const cookieState = readOAuthStateCookie(req, 'microsoft');
  if (appUrl) clearOAuthStateCookie(res, { provider: 'microsoft', appUrl });

  try {
    const code = req.query?.code;
    const state = req.query?.state;
    const oauthError = req.query?.error;
    if (oauthError) return res.redirect(`${home}?connector_error=microsoft_authorization_denied`);
    if (typeof code !== 'string' || !code || typeof state !== 'string' || !state) {
      return res.redirect(`${home}?connector_error=missing_code_or_state`);
    }
    if (!appUrl || !clientId || !clientSecret) {
      return res.redirect(`${home}?connector_error=oauth_not_configured`);
    }

    const admin = getAdminClient();
    const identity = await consumeOAuthState(admin, { state, cookieState, provider: 'microsoft' });
    if (!identity || !MS_PROVIDER_SCOPES[identity.connectorProvider]) {
      return res.redirect(`${home}?connector_error=invalid_or_replayed_state`);
    }

    const tokens = await exchangeMicrosoftCode({
      clientId,
      clientSecret,
      code,
      redirectUri: `${appUrl}/api/connectors/microsoft-callback`,
      tenant,
    });

    const email = await getMicrosoftEmail(tokens.access_token);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    const { data: existing, error: lookupError } = await admin
      .from('connectors')
      .select('refresh_token')
      .eq('user_id', identity.userId)
      .eq('provider', identity.connectorProvider)
      .maybeSingle();
    if (lookupError) throw new Error('Could not read existing connector state');

    const { error } = await admin.from('connectors').upsert(
      {
        user_id: identity.userId,
        provider: identity.connectorProvider,
        account_email: email,
        status: 'connected',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || existing?.refresh_token || null,
        token_expires_at: expiresAt,
        scopes: MS_PROVIDER_SCOPES[identity.connectorProvider],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider' }
    );
    if (error) throw new Error('Could not save Microsoft connector');

    return res.redirect(`${home}?connected=${encodeURIComponent(identity.connectorProvider)}`);
  } catch (err) {
    console.error('microsoft-callback error:', err);
    return res.redirect(`${home}?connector_error=callback_failed`);
  }
}
