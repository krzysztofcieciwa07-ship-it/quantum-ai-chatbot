# Security Policy

## Project status

Quantumy is an active application repository. It is **not security-certified or production-verified** by the presence of a Security Gate or by passing unit tests.

## Reporting

Use GitHub private vulnerability reporting for this repository when enabled. Otherwise contact the repository maintainer privately through GitHub. Do not publish API keys, access/refresh tokens, private keys, customer data, or a working exploit in a public issue.

Include the affected commit SHA, impact, sanitized reproduction, and relevant workflow run.

## Security invariants

- Server credentials must never be exposed through VITE_ variables or browser bundles.
- Service-role access remains server-side and must enforce user and tenant scoping in privileged queries.
- OAuth callbacks must be bound to a validated, one-time state value and the expected initiating identity.
- Connector access and refresh tokens must not be returned to browser clients or logs.
- External writes and destructive actions require explicit user confirmation at the server-side execution boundary.
- Rate limits, input limits, provider timeouts, and outbound destination restrictions must be explicit.
- Unknown, invalid, or missing authorization state fails closed.
- CI success proves only the commands and scenarios that actually ran.

## Known gaps

- OAuth state binding and connector-token column access are under review in draft PR #2. Treat this boundary as incomplete until the PR is merged and its end-to-end checks pass.
- The current automated gate runs the Node test suite and TypeScript/Vite build; it does not perform a complete security assessment.
- The last inspected dependency installation reported four npm advisories (two moderate, two high). These require triage and verified remediation.

## Secrets and data

Never commit .env.local, API keys, OAuth secrets, service-role keys, private signing keys, tokens, or customer data. Rotate secrets after suspected exposure. Keep production credentials in Vercel's encrypted environment configuration or an approved secret manager.

## Release evidence

For a release decision, retain the exact source SHA, workflow run IDs, test results, dependency/security review, deployment identity, runtime health, OAuth end-to-end evidence, and rollback record. Record unavailable controls as UNKNOWN.
