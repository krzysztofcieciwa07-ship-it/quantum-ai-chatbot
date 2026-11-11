# Contributing to Quantumy

## Before changing code

1. Read README.md, SECURITY.md, and docs/ENGINEERING_STANDARD.md.
2. Identify the API route, data boundary, and account/tenant scope affected.
3. Keep changes focused and add regression tests for defects.
4. Do not commit credentials, OAuth tokens, private keys, customer data, or local environment files.

## Setup

Use Node.js 22 or newer:

~~~bash
nvm install 22
nvm use 22
npm ci
cp .env.example .env.local
~~~

Populate local credentials through a safe local secret store. Never commit .env.local.

## Required checks

~~~bash
npm test
npm run build
~~~

These checks are required for the current repository CI contract. Add focused tests for authorization, tenant isolation, OAuth state, token lifecycle, rate limits, and execution policy when changing those boundaries.

## Pull requests

- Describe behavior changed, security impact, and rollback.
- Include the exact candidate commit SHA and actual CI run links.
- Distinguish deterministic tests from live OAuth/provider checks.
- Identify schema/SQL changes and deployment environment changes.
- Report skipped, unavailable, and failed checks honestly.
- Do not merge a security-sensitive change while required checks are missing or failing.
