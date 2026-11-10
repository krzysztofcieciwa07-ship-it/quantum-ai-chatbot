import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConnectorOAuthState,
  verifyConnectorOAuthState,
} from '../api/lib/oauthState.js';

const SECRET = 'test-only-connector-state-secret-32-bytes-minimum';
const USER_ID = 'user-123';
const NOW = 1_800_000_000_000;

function create(provider = 'google') {
  return createConnectorOAuthState({
    userId: USER_ID,
    provider,
    secret: SECRET,
    now: NOW,
  });
}

test('signed OAuth state is bound to its HttpOnly browser nonce and expected provider', () => {
  const created = create('google');
  const verified = verifyConnectorOAuthState({
    state: created.state,
    cookieNonce: created.nonce,
    expectedProvider: 'google',
    secret: SECRET,
    now: NOW + 1_000,
  });

  assert.equal(verified.userId, USER_ID);
  assert.equal(verified.provider, 'google');
  assert.equal(verified.issuedAt, NOW);
});

test('tampered state is rejected', () => {
  const created = create();
  const [payload, signature] = created.state.split('.');
  const tampered = `${payload.slice(0, -1)}A.${signature}`;

  assert.throws(
    () => verifyConnectorOAuthState({
      state: tampered,
      cookieNonce: created.nonce,
      expectedProvider: 'google',
      secret: SECRET,
      now: NOW,
    }),
    { code: 'OAUTH_STATE_INVALID' },
  );
});

test('missing or mismatched browser nonce is rejected', () => {
  const created = create();

  for (const cookieNonce of [undefined, '', '0'.repeat(64)]) {
    assert.throws(
      () => verifyConnectorOAuthState({
        state: created.state,
        cookieNonce,
        expectedProvider: 'google',
        secret: SECRET,
        now: NOW,
      }),
      { code: 'OAUTH_STATE_INVALID' },
    );
  }
});

test('state cannot be replayed across providers', () => {
  const created = create('google');
  assert.throws(
    () => verifyConnectorOAuthState({
      state: created.state,
      cookieNonce: created.nonce,
      expectedProvider: 'microsoft',
      secret: SECRET,
      now: NOW,
    }),
    { code: 'OAUTH_STATE_INVALID' },
  );
});

test('expired and future-dated states are rejected', () => {
  const created = create();
  assert.throws(
    () => verifyConnectorOAuthState({
      state: created.state,
      cookieNonce: created.nonce,
      expectedProvider: 'google',
      secret: SECRET,
      now: NOW + 10 * 60_000 + 1,
    }),
    { code: 'OAUTH_STATE_INVALID' },
  );

  const future = createConnectorOAuthState({
    userId: USER_ID,
    provider: 'google',
    secret: SECRET,
    now: NOW + 60_000,
  });
  assert.throws(
    () => verifyConnectorOAuthState({
      state: future.state,
      cookieNonce: future.nonce,
      expectedProvider: 'google',
      secret: SECRET,
      now: NOW,
    }),
    { code: 'OAUTH_STATE_INVALID' },
  );
});

test('state signing fails closed without a strong configured secret', () => {
  assert.throws(
    () => createConnectorOAuthState({
      userId: USER_ID,
      provider: 'google',
      secret: 'short',
      now: NOW,
    }),
    /CONNECTOR_STATE_SECRET must be at least 32 bytes/,
  );
});
