import test from 'node:test';
import assert from 'node:assert/strict';
import {
  issueOAuthState,
  consumeOAuthState,
  readOAuthStateCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
} from '../api/lib/oauthState.js';

function fakeAdmin(initialRow = null) {
  const state = { row: initialRow, fromCalls: 0 };
  const admin = {
    from(table) {
      assert.equal(table, 'oauth_states');
      state.fromCalls += 1;
      const filters = {};
      return {
        insert: async (row) => {
          state.row = row;
          return { error: null };
        },
        delete() {
          return this;
        },
        eq(column, value) {
          filters[column] = value;
          return this;
        },
        gt(column, value) {
          filters[`${column}_gt`] = value;
          return this;
        },
        select() {
          return this;
        },
        maybeSingle: async () => {
          const row = state.row;
          const valid = row
            && row.state_hash === filters.state_hash
            && row.provider === filters.provider
            && row.expires_at > filters.expires_at_gt;
          if (!valid) return { data: null, error: null };
          state.row = null;
          return {
            data: { user_id: row.user_id, connector_provider: row.connector_provider },
            error: null,
          };
        },
      };
    },
  };
  return { admin, state };
}

function responseRecorder() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; } };
}

test('issueOAuthState persists only a SHA-256 digest and binds provider identity', async () => {
  const { admin, state } = fakeAdmin();
  const token = await issueOAuthState(admin, {
    userId: 'user-123',
    connectorProvider: 'gmail',
    now: 1_000,
  });

  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(state.row.state_hash, token);
  assert.match(state.row.state_hash, /^[0-9a-f]{64}$/);
  assert.equal(state.row.user_id, 'user-123');
  assert.equal(state.row.provider, 'google');
  assert.equal(state.row.connector_provider, 'gmail');
  assert.equal(Date.parse(state.row.expires_at), 601_000);
});

test('OAuth state is rejected when callback browser cookie does not match', async () => {
  const { admin, state } = fakeAdmin();
  const token = await issueOAuthState(admin, {
    userId: 'victim-user',
    connectorProvider: 'gmail',
    now: 1_000,
  });
  const consumed = await consumeOAuthState(admin, {
    state: token,
    cookieState: 'A'.repeat(43),
    provider: 'google',
    now: 2_000,
  });

  assert.equal(consumed, null);
  assert.notEqual(state.row, null);
  assert.equal(state.fromCalls, 1);
});

test('OAuth state is one-time, provider-bound and expires', async () => {
  const { admin, state } = fakeAdmin();
  const token = await issueOAuthState(admin, {
    userId: 'user-456',
    connectorProvider: 'outlook',
    now: 10_000,
  });

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'google', now: 11_000,
  }), null);
  assert.notEqual(state.row, null);

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 700_000,
  }), null);
  assert.notEqual(state.row, null);

  assert.deepEqual(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 11_000,
  }), { userId: 'user-456', connectorProvider: 'outlook' });
  assert.equal(state.row, null);

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 12_000,
  }), null);
});

test('OAuth state cookie is HttpOnly, SameSite=Lax and Secure on HTTPS', () => {
  const token = 'A'.repeat(43);
  const res = responseRecorder();
  setOAuthStateCookie(res, { provider: 'google', state: token, appUrl: 'https://app.example' });
  assert.match(res.headers['Set-Cookie'], /HttpOnly/);
  assert.match(res.headers['Set-Cookie'], /SameSite=Lax/);
  assert.match(res.headers['Set-Cookie'], /; Secure/);
  assert.match(res.headers['Set-Cookie'], /Path=\/api\/connectors\/google-callback/);

  clearOAuthStateCookie(res, { provider: 'google', appUrl: 'https://app.example' });
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/);
});

test('OAuth state cookie parser reads only the expected provider cookie', () => {
  const token = 'B'.repeat(43);
  const req = { headers: { cookie: `other=value; ola_oauth_state_microsoft=${token}` } };
  assert.equal(readOAuthStateCookie(req, 'microsoft'), token);
  assert.equal(readOAuthStateCookie(req, 'google'), null);
});
