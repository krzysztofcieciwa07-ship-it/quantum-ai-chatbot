# Quantumy

Mobile-first AI workspace built with React, Vite, TypeScript, Vercel serverless functions, and Supabase.

**Repository status: ACTIVE APPLICATION / NOT SECURITY-CERTIFIED**

This repository contains application source and a small automated test suite. Passing CI proves only that the configured tests and build completed on the tested commit. It does not establish the security of OAuth, connector-token storage, tenant isolation, or a production deployment.

## Technology

- React 18, Vite, TypeScript
- Vercel serverless API routes
- Supabase authentication and persistence
- Anthropic API and registered tool execution
- Google connector routes and additional provider integrations
- Node.js 22 or newer

## Repository map

- \`src/\` — browser application and UI.
- \`api/\` — server-side Vercel functions.
- \`api/lib/\` — provider clients, Supabase admin access, rate limiting, and execution policy.
- \`api/connectors/\` — OAuth start, callback, and disconnect handlers.
- \`supabase/\` — SQL setup scripts for application tables and security-related records.
- \`test/\` — Node.js built-in test runner tests.
- \`scripts/inflate-app.cjs\` — regenerates \`src/App.tsx\` from the compressed source payload when present.
- \`.github/workflows/security-gate.yml\` — CI test and build workflow.

**Generated frontend source:** \`predev\` and \`prebuild\` invoke \`scripts/inflate-app.cjs\`. When \`src/App.tsx.zlib.b64\` exists, the script overwrites \`src/App.tsx\`. Check the compressed source before editing the generated file, or your changes may be lost on the next dev/build command.

## Local setup

Use Node.js 22 or newer and npm:

~~~bash
nvm install 22
nvm use 22
npm ci
cp .env.example .env.local
npm run dev
~~~

Fill \`.env.local\` with local development values. Never commit it.

## Required checks

Run the same commands used by CI:

~~~bash
npm test
npm run build
~~~

\`npm test\` uses Node's built-in test runner. \`npm run build\` runs the TypeScript project build and Vite production build.

## Environment variables

The names and safe placeholders are listed in \`.env.example\`.

- \`VITE_*\` values are bundled into browser-facing code. Only public client configuration belongs there.
- Server-only credentials such as \`ANTHROPIC_API_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`, Google client secrets, RISC private keys, cron secrets, and provider API keys must remain server-side.
- Do not copy a service-role key or private signing key into any \`VITE_*\` variable.
- Use Vercel project environment settings or a local secret manager for deployed/server credentials.

## Supabase setup

The \`supabase/\` directory contains SQL scripts. Review each script and its dependencies before applying it to a project. These files are not automatically applied by \`npm ci\`, the build, or the Vercel deployment.

Keep Row Level Security enabled for user-facing tables. Service-role access is server-only and must be scoped in the API layer. Do not assume that an RLS policy alone protects a table from privileged server-side code.

## Deployment

The repository includes \`vercel.json\` with API rewrites, function duration settings, cache headers, and a scheduled notes-reminder function. Verify Vercel project configuration and required environment variables separately; a successful local build is not proof of a successful deployment.

## Security and known limitations

- External write actions are guarded by an execution-confirmation policy and covered by unit tests. The tests cover the listed policy cases, not every application workflow.
- OAuth callback state and connector-token access are being hardened in the separate draft [PR #2](https://github.com/krzysztofcieciwa07-ship-it/quantum-ai-chatbot/pull/2). Until that work is merged and independently verified, do not claim the complete OAuth flow is production-secure.
- The Security Gate currently runs \`npm test\` and \`npm run build\`. It is not a full SAST, dependency-risk, penetration, or runtime assurance program.
- The latest inspected CI install reported four dependency advisories (two moderate and two high). Review and remediate them through tested dependency updates; do not use \`npm audit fix --force\` blindly.
- No LICENSE file is currently present. GitHub visibility does not grant a license to reuse or redistribute the code.

Read [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [docs/ENGINEERING_STANDARD.md](docs/ENGINEERING_STANDARD.md) before changing security-sensitive behavior.
