## Summary

<!-- What changed and why? -->

## Scope and risk

- [ ] Browser UI
- [ ] API / serverless function
- [ ] OAuth or connector token lifecycle
- [ ] Supabase schema, RLS, or privileged query
- [ ] Tool execution / external mutation
- [ ] CI/CD or dependency update
- [ ] Documentation only

Describe the affected boundary and expected failure behavior:

## Verification

| Check | Result | Exact run / evidence |
|---|---|---|
| npm test | NOT RUN | |
| npm run build | NOT RUN | |
| OAuth / connector E2E (if applicable) | NOT RUN | |
| Security / dependency review | NOT RUN | |

Candidate commit SHA:

## Safety review

- [ ] No credentials or customer data included.
- [ ] VITE_ variables contain only public values.
- [ ] Server-side queries enforce user/tenant scope.
- [ ] External writes require server-side confirmation.
- [ ] Skipped or unavailable checks are disclosed.

## Deployment and rollback

<!-- Include required environment/schema changes and safe rollback. -->
