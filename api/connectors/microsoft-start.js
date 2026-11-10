import { MS_PROVIDER_SCOPES, getMicrosoftConfig, buildMicrosoftAuthUrl } from '../lib/microsoft.js';
import { getAdminClient, getUserFromAuthHeader } from '../lib/supabaseAdmin.js';
import { issueOAuthState, setOAuthStateCookie } from '../lib/oauthState.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const provider = (req.query?.provider || 'outlook').toString();
    if (!MS_PROVIDER_SCOPES[provider]) {
      return res.status(400).json({ error: 'Unknown Microsoft connector' });
    }

    const { clientId, clientSecret, appUrl, tenant } = getMicrosoftConfig();
    if (!clientId || !clientSecret || !appUrl) {
      return res.status(500).json({ error: 'Microsoft OAuth is not configured' });
    }

    const redirectUri = `${appUrl}/api/connectors/microsoft-callback`;
    const admin = getAdminClient();
    const state = await issueOAuthState(admin, { userId: user.id, connectorProvider: provider });
    setOAuthStateCookie(res, { provider: 'microsoft', state, appUrl });

    const url = buildMicrosoftAuthUrl({
      clientId,
      redirectUri,
      scopes: MS_PROVIDER_SCOPES[provider],
      state,
      tenant,
    });

    return res.status(200).json({ url });
  } catch (err) {
    console.error('microsoft-start error:', err);
    return res.status(500).json({ error: 'Could not start Microsoft OAuth' });
  }
}
