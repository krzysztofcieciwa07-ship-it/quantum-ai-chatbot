import test from 'node:test';
import assert from 'node:assert/strict';
import {
  issueOAuthState,
  consumeOAuthState,
  readOAuthStateCookie,
  setOAuthStateCookie,
  clearOAuthStateCookie,
} from '../api/lib/oauthState.js';

function fakeAdmin(initialRows = []) {
  const state = { rows: initialRows.map((row) => ({ ...row })), fromCalls: 0 };
  const matches = (row, filters) => Object.entries(filters).every(([key, value]) => {
    if (key.endsWith('_lte')) return row[key.slice(0, -4)] <= value;
    return row[key] === value;
  });

  const admin = {
    rpc: async (name, args) => {
      assert.equal(name, 'cleanup_expired_oauth_states');
      const cutoff = args?.p_now;
      const expired = state.rows
        .filter((row) => row.expires_at <= cutoff)
        .sort((left, right) => left.expires_at.localeCompare(right.expires_at))
        .slice(0, 1_000);
      const expiredHashes = new Set(expired.map((row) => row.state_hash));
      state.rows = state.rows.filter((row) => !expiredHashes.has(row.state_hash));
      return { data: expired.length, error: null };
    },
    from(table) {
      assert.equal(table, 'oauth_states');
      state.fromCalls += 1;
      const filters = {};
      return {
        insert: async (row) => {
          state.rows.push({ ...row });
          return { error: null };
        },
        delete() {
          return this;
        },
        eq(column, value) {
          filters[column] = value;
          return this;
        },
        lte(column, value) {
          filters[`${column}_lte`] = value;
          return this;
        },
        select() {
          return this;
        },
        maybeSingle: async () => {
          const index = state.rows.findIndex((row) => matches(row, filters));
          if (index < 0) return { data: null, error: null };
          const [row] = state.rows.splice(index, 1);
          return {
            data: {
              user_id: row.user_id,
              connector_provider: row.connector_provider,
              expires_at: row.expires_at,
            },
            error: null,
          };
        },
        then(resolve, reject) {
          const before = state.rows.length;
          state.rows = state.rows.filter((row) => !matches(row, filters));
          return Promise.resolve({ error: null, count: before - state.rows.length }).then(resolve, reject);
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
  assert.notEqual(state.rows[0].state_hash, token);
  assert.match(state.rows[0].state_hash, /^[0-9a-f]{64}$/);
  assert.equal(state.rows[0].user_id, 'user-123');
  assert.equal(state.rows[0].provider, 'google');
  assert.equal(state.rows[0].connector_provider, 'gmail');
  assert.equal(Date.parse(state.rows[0].expires_at), 601_000);
});

test('issueOAuthState prunes expired rows before inserting a new state', async () => {
  const { admin, state } = fakeAdmin([
    { state_hash: 'a'.repeat(64), expires_at: new Date(500).toISOString() },
    { state_hash: 'b'.repeat(64), expires_at: new Date(2_000).toISOString() },
  ]);

  await issueOAuthState(admin, {
    userId: 'user-123',
    connectorProvider: 'gmail',
    now: 1_000,
  });

  assert.equal(state.rows.length, 2);
  assert.equal(state.rows.some((row) => row.state_hash === 'a'.repeat(64)), false);
  assert.equal(state.rows.some((row) => row.state_hash === 'b'.repeat(64)), true);
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
  assert.equal(state.rows.length, 1);
});

test('OAuth state is provider-bound, one-time and expired state is deleted', async () => {
  const { admin, state } = fakeAdmin();
  const token = await issueOAuthState(admin, {
    userId: 'user-456',
    connectorProvider: 'outlook',
    now: 10_000,
  });

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'google', now: 11_000,
  }), null);
  assert.equal(state.rows.length, 1);

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 700_000,
  }), null);
  assert.equal(state.rows.length, 0);

  assert.equal(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 11_000,
  }), null);
});

test('valid OAuth state is consumed exactly once', async () => {
  const { admin, state } = fakeAdmin();
  const token = await issueOAuthState(admin, {
    userId: 'user-789',
    connectorProvider: 'outlook',
    now: 10_000,
  });

  assert.deepEqual(await consumeOAuthState(admin, {
    state: token, cookieState: token, provider: 'microsoft', now: 11_000,
  }), { userId: 'user-789', connectorProvider: 'outlook' });
  assert.equal(state.rows.length, 0);
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
