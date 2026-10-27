# Auth, Session, and Shop-Domain Audit

## Superseded Guide

Use [Authentication and shop login implementation guide](./nextjs-auth-shop-integration-hardening-plan.md) for the current code map, deployment requirements, test commands and remaining work.

This file is an index of the original investigation, not another implementation checklist. The earlier detailed scan remains available in this file's Git history. Its old GET-logout instructions, raw-token helper references, cookie migration assumptions and completed/pending labels must not be used as current guidance.

## Investigation Scope

The audit covered Next auth pages/actions, profile/address/wishlist requests, Proxy redirects, session cookies and refresh, browser stores, admin unlock and Prisma reuse. It also reviewed the supplied production Nginx/Compose configuration and the user-opened production Django Swagger page.

Constraints: keep both `codexchristi.org/shop` and `codexchristi.shop`, use existing Django APIs and Next database, and fit the current Docker VPS without Redis or a new service.

## Findings And Disposition

| Original concern | Current disposition |
| --- | --- |
| Session/token helpers exposed as public actions | Internal helpers are server-only; browser actions return safe account data. |
| Missing/inconsistent access refresh | Shared authenticated requests refresh once where cookie writes are allowed; rendering remains read-only. |
| Logout depended on a working Django request | Same-origin POST expires local cookies even during an upstream failure. GET returns 405. |
| Incomplete shop auth and unsafe destinations | Shared forms and validated return paths; Register deliberately opens main-site signup. |
| Persisted account details and late responses | Memory-only profile stores, account-generation checks and same-origin tab notices. |
| Cookie/Proxy inconsistencies | Versioned token-kind cookies, production Secure flag, profile descendant guards and no page redirects for POST. |
| Country/email/upload/Prisma problems | Country normalization, encoded query values, 900 KiB photo limit and production client reuse. |
| Shop microcache/header gaps | Separate Nginx work remains; no production configuration was changed. |
| Cross-domain automatic login | Existing-database option remains an evaluation, not an implemented feature. |

## Important Corrections

- The supplied Nginx file already routes `/next-api` to Next and includes `/shop/` passthrough. Do not remove those exceptions.
- Signed cookies are not encrypted. Browser JavaScript cannot read HttpOnly cookies, but this implementation is not opaque database-backed sessions or JWE.
- Missing shop profiles, permission denials and temporary outages are not evidence that the login should be revoked.
- Compilation alone does not verify production token rotation, revocation, cache behavior or independent-device logout.

Reviewed and consolidated on 2026-10-27. Continue from the linked guide rather than adding another overlapping auth plan here.
