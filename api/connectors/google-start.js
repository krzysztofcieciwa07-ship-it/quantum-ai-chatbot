import { PROVIDER_SCOPES, getGoogleConfig, buildAuthUrl } from '../lib/google.js';
import { getAdminClient, getUserFromAuthHeader } from '../lib/supabaseAdmin.js';
import { issueOAuthState, setOAuthStateCookie } from '../lib/oauthState.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const provider = (req.query?.provider || 'gmail').toString();
    if (!PROVIDER_SCOPES[provider]) {
      return res.status(400).json({ error: 'Unknown Google connector' });
    }

    const { clientId, clientSecret, appUrl } = getGoogleConfig();
    if (!clientId || !clientSecret || !appUrl) {
      return res.status(500).json({ error: 'Google OAuth is not configured' });
    }

    const redirectUri = `${appUrl}/api/connectors/google-callback`;
    const admin = getAdminClient();
    const state = await issueOAuthState(admin, { userId: user.id, connectorProvider: provider });
    setOAuthStateCookie(res, { provider: 'google', state, appUrl });

    const url = buildAuthUrl({
      clientId,
      redirectUri,
      scopes: PROVIDER_SCOPES[provider],
      state,
    });

    return res.status(200).json({ url });
  } catch (err) {
    console.error('google-start error:', err);
    return res.status(500).json({ error: 'Could not start Google OAuth' });
  }
}
