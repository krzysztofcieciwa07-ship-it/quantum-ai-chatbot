# Repository Engineering Standard

This document defines the minimum change and evidence standard. It is not a security certification.

## Required behavior

1. Validate untrusted input at every API boundary.
2. Enforce identity, authorization, tenant scope, and confirmation on the server. Client state is not an authorization boundary.
3. Keep service-role keys, OAuth secrets, signing keys, and tokens server-side.
4. Apply explicit request/body/history limits, rate limits, provider timeouts, retry bounds, and outbound destination restrictions.
5. Add regression tests whenever authorization, tenant isolation, OAuth state, token storage, or external-write behavior changes.
6. Document SQL changes, environment variables, rollout, and rollback.

## Verification states

- PASS: a named check succeeded on the exact candidate SHA.
- FAIL: a check ran and failed.
- PARTIAL: only some required scenarios were exercised.
- BLOCKED: a required prerequisite was unavailable or failed.
- UNKNOWN: no adequate evidence exists.

Skipped checks are not passes. Mocked provider responses are not live OAuth or live provider proof.

## Supply chain

- Pin third-party GitHub Actions to immutable full commit SHAs.
- Keep Node version consistent between local setup, CI, and deployment.
- Use lockfile-driven npm ci.
- Review Dependabot updates and npm advisories before merging.
- Minimize workflow token permissions.

## Release evidence

A release should identify the exact source SHA, CI run IDs, test and build results, dependency/security review, deployment identity, environment/schema state, runtime health, and rollback procedure.

Do not infer production readiness from a green build alone.
