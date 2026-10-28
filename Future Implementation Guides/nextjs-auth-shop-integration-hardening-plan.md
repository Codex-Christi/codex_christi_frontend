# Authentication And Shop Login Implementation Guide

Updated 2026-10-27. This is the canonical guide; the [original audit index](./auth-session-shop-domain-audit-and-implementation-plan.md) preserves the investigation context. Paths are repository-relative unless absolute.

## Scope And Decisions

- Keep `codexchristi.org/shop` and `codexchristi.shop` working with one Next application.
- Use the existing production Django APIs. No Django edits, new database tables/migrations, Redis or extra container are included. The existing deployment runner now applies the existing Admin Ops migrations. The user reports Nginx has been redeployed; the updated Next image has not. The exact deployed Nginx file and production behavior have not been independently verified.
- Shop Register opens main-site signup: `https://codexchristi.org/auth/signup` in production and `/auth/signup` locally. Direct shop signup routes remain thin wrappers around the same forms, not the Register link destination.
- Shop login/recovery use the corresponding shop routes. Verification/reset do not automatically create a login because the documented endpoints do not return login tokens.
- Automatic sign-in between domains is evaluation only. Its eventual logout must affect this browser's linked login on both domains, not other devices.
- Preserve the independent admin unlock, roles, scopes and session-version checks.
- Leave unrelated storefront, images, CSS, catalog and unfinished account-feature work out of the auth commit.

## Route Contract

| Surface | Login | Register link | Account |
| --- | --- | --- | --- |
| Main site | `/auth/sign-in` | `/auth/signup` | `/profile` |
| Main site's shop / localhost | `/shop/auth/login` | Main-site signup / local `/auth/signup` | `/shop/account-overview` |
| Shop domain, including www | `/auth/login` | Main-site signup | `/account-overview` |

Nginx maps public shop paths into Next's `/shop` subtree. The supplied file also has a `/shop/` passthrough, so prefixed aliases currently work. `/next-api/*` must go to Next unchanged, whose rewrite maps it to `/api/*`. The public `/api` location on the main domain goes to Django and is not a replacement for `/next-api`.

## Code Map

| Responsibility | Source |
| --- | --- |
| Host-aware paths, safe return destinations, encoded auth queries | `src/lib/auth/domain-routing.ts` |
| Shared server auth layout / client route context | `src/components/UI/Auth/AuthFormLayout.tsx`, `AuthRoutesProvider.tsx` |
| Shared email/name/password/code validators | `src/lib/formSchemas/auth-fields.ts`; login/signup/reset/verify schemas compose these |
| Shared editable profile fields and basic photo checks | `src/lib/formSchemas/profile-fields.ts`; `editUserProfileSchema.ts` composes the same rules |
| Login and safe session status | `src/actions/login.ts` |
| Registration, verification and recovery actions | `src/actions/account/registration.ts` |
| Shared registration API requests / password-reset POST and browser cleanup | `src/lib/auth/registration-request.ts`, `src/app/api/auth/password-reset/route.ts`, `src/lib/auth/password-reset-client.ts` |
| Profile/address actions and server-only account service | `src/actions/account/profile.ts`, `src/lib/auth/account-service.ts` |
| Minimal response shapes / multipart and country validation | `src/lib/auth/account-data.ts`, `account-validation.ts`, `profile-limits.ts` |
| Bounded, uncached Django requests and response reading | `src/lib/django/request.ts`, `src/lib/auth/authenticated-django-fetch.ts` |
| Cookie format, read-only session state and refresh | `src/lib/session/session-cookies.ts`, `server-session.ts`, `main-session.ts`, `session-refresh.ts` |
| Shared runtime auth configuration / deployment readiness | `src/lib/session/session-config.ts`, `src/app/api/health/ready/route.ts`; `devScripts/README.md` |
| Admin Lock, unlock and own-password POST handlers | `/next-api/admin/lock`, `/unlock`, `/password`; `src/lib/admin/admin-credentials.ts`, `admin-auth-route.ts`, `admin-auth-client.ts` |
| Admin cookie construction and complete response headers | `src/lib/admin/admin-session-server.ts`, `admin-session-cookies.ts`, `src/lib/session/response-cookies.ts` |
| Own admin password screen | `/admin/security`, `src/components/UI/Admin/AdminPasswordChangeForm.tsx` |
| Shared new-admin-password policy | `src/lib/formSchemas/admin-password.ts`; provisioning, transfer, self-change and `scripts/create_master_admin_user.ts` |
| Production Admin Ops migration step | `scripts/prisma_production_setup.sh`; existing Docker `migrate` service and `devScripts/production.sh` |
| Protected GET/HEAD routes and refresh-cookie forwarding | `src/proxy.ts`, `src/lib/middlewares/auth-middleware.ts`, `src/lib/session/session-redirect.ts` |
| POST logout, origin validation and both admin-cookie Paths | `src/app/api/logout/route.ts`, `src/lib/auth/request-origin.ts`, `logout-cookies.ts` |
| Client logout and private-state cleanup | `src/actions/logout.ts`, `src/lib/auth/client-session.ts` |
| Account identity, stale-request guards and tab checks | `src/stores/authStore.ts`, profile stores, `src/lib/auth/session-generation.ts`, `LoggedinProvider.tsx` |
| Safe client session shape, bounded retry/expiry scheduling | `src/lib/auth/session-snapshot.ts`, `session-monitor.ts` |
| Protected server bootstrap and private-view/draft retention | `ServerAccountBoundary.tsx`, `RequireAccount.tsx`, `AccountAccessContext.tsx` under `src/components/UI/Auth/`; `src/lib/auth/account-view-state.ts` |
| Shared Retry/Logout screen and cold-load outage pages | `src/components/UI/Auth/AuthUnavailable.tsx`, `SessionUnavailablePage.tsx`; `/auth/session-unavailable` and `/shop/auth/session-unavailable` |
| Shared pending/toast behavior | `src/lib/hooks/authHooks/useAuthTask.ts` |
| Safe failure metadata without profile values/tokens | `src/lib/auth/account-diagnostics.ts` |
| Reused production admin database client | `src/lib/prisma/adminOpsLedger/adminOpsLedgerPrisma.ts` |

## Implemented Behavior

### Authentication And Refresh

1. Login validates on the server, uses the configured Django base URL and sets HttpOnly cookies. The client receives identity/expiry/status only. Existing passwords are not trimmed or subjected to signup complexity rules.
2. Session creation, raw-token readers and checkout signature helpers are server-only modules, not public server actions. Django token claims are checked before wrapping; this is not local verification of Django's JWT signature.
3. Cookies require version 2, the correct token kind, identity and expiry. Access/refresh must identify the same user. Production always sets Secure; cookie size is bounded.
4. Protected page GET/HEAD requests may refresh in Proxy and forward fresh request cookies to rendering without a second redirect. Action POSTs are authenticated inside their actions/handlers, not replayed by a page redirect.
5. Authenticated actions/handlers can refresh once after genuine 401. Retry only reads or explicitly allowed profile/address/wishlist changes. Never use this retry policy for uncertain payment, registration, email delivery or fulfillment results.
6. Confirmed invalid refresh clears cookies. Timeout, 429, 5xx, 403 and malformed refresh responses preserve the refresh cookie and return a retry state. A proactive-refresh outage does not discard still-valid access.
7. `getUser()` and `fetchUserShopProfile()` are read-only rendering helpers. Only browser-invoked actions opt into cookie writes. Their account parsing/error handling is shared with the server actions.
8. Concurrent refreshes share bounded process state across Node Proxy and handlers. Logout/reset also cancel work using a rotated token; cookie writes recheck after the last await. Timing, capacity and limits are documented below.
9. A transient session-check failure schedules three additional automatic attempts, after 2, 5 and 15 seconds. Exhausting this budget stops retries; Retry or a throttled focus/resume check can start a new budget. There is no continuous polling. Still-valid access remains usable after a proactive-refresh failure, but its actual expiry independently hides private UI even if another check is pending.
10. Only the protected `/profile` and shop account layouts bootstrap the browser from `getServerAuthSnapshot()`. The read-only projection includes identity, expiry and status, never tokens. It removes the redundant startup session action on a cold protected-page load. Public catalog/root layouts do not gain cookie reads. A stale prefetched snapshot cannot overwrite a known logout or different login, and rendering does not seed a shared server-side Zustand store.
11. Both opening an account page and leaving one open through an outage offer Retry and Logout. When opening a page, Proxy uses a temporary, uncached redirect (307) and saves the validated destination in `next`; cookies stay intact. Retry returns there, with no automatic redirect loop. On an already-open page, Retry checks the session without discarding the hidden draft. Logout uses the existing POST endpoint even during a pending retry. The redirect is intentional: this Next version changes a rewritten page's 503 status to 200.

### Logout And Account State

- Logout uses same-origin POST `/next-api/logout`; GET returns 405 and cannot sign someone out. Django revocation has a 3-second deadline and local expiry is unconditional.
- Send separate Set-Cookie expiry headers for `session`, `refreshToken`, and `admin_session` at both `/admin` and legacy `/`. A map keyed only by cookie name would lose one admin Path.
- The old Deactivate tile is now Logout with the Lucide LogOut icon and a disabled pending state. It does not deactivate/delete the Django account.
- Main/shop profiles live in memory, not persisted browser storage. Cleanup removes legacy keys and resets private edit/address/email/verification/payment-recovery state, deliberately keeping guest cart items.
- Late responses cannot restore the previous account after logout or an account switch. Tabs on the same domain notify each other about login/logout; this does not notify the other domain.
- `refreshAuthState()` is the store's session-check method. Obsolete persist-hydration stubs, an unused initializer and the empty refresh hook were removed. The avatar waits for confirmed identity instead of issuing another session check.
- If a check fails temporarily, hide account details and keep unsaved edits in this tab. A successful check for the same person restores them. Confirmed logout or a different account discards them. `accountOwnerId` remembers whose hidden draft it is; it never grants access. Drafts do not survive a full reload.
- Edit drawers and discard dialogs also hide during that outage, including those rendered outside the page container. Address forms fill saved values once per open, so a background reload cannot replace an unsaved draft. Explicit close discards the address draft. The avatar shows cached personal details only while sign-in is verified.

### Refresh Cancellation And Readiness

- Fixed a reproduced gap: refresh A could return rotated token B, then Logout with B would leave A's cached result usable. Successful results remain reusable for two seconds; old/new tokens share a cancellation group for 30 seconds, including successive rotations and cancellation before the new token is discovered. Tokens are indexed by hashes; completed results keep an internal cancellation guard without adding API response fields.
- Tracking is capped at 256 token hashes, including reserved space for pending rotations. Full capacity refuses new refresh calls before contacting Django. If an unknown logout cannot be recorded, a temporary process-wide refresh pause prevents existing work from writing fresh cookies. This rare fallback preserves browser cookies for Retry rather than forcing every user to log out.
- Expired result references cannot write cookies. Pending requests keep their cancellation links until settled; cleanup does not discard those links while awaiting Django. The existing five-second upstream timeout remains.
- This is not lasting revocation. State is local to one Node process, resets on restart and does not coordinate other workers/containers or isolated runtimes. It cannot retract Set-Cookie headers already sent, erase a valid access token on another device, or replace Django's logout/password-reset policy. The single-process production HTTP check below covers the installed Node Proxy runtime, not every hosting model.
- Readiness checks both signing keys with the same 32-byte rule used by their signers, the selected Django HTTP(S) URL and the optional refresh-path override, before the existing local SQL check. Missing/invalid configuration returns an uncached generic 503. Logs name only the failed check. Validation runs at request time, not during import/build. Internal Docker HTTP URLs still work.
- The probe makes no Django call and proves neither backend reachability nor token revocation. It adds no database table, remote service or public-layout cookie read. Existing Docker/deploy readiness polling automatically uses these new checks. Details are in [deployment readiness](../devScripts/README.md#readiness).

### Admin Lock And Password Changes

- Lock is a same-origin POST to `/next-api/admin/lock`. The top-bar button has a pending state and performs a full navigation to unlock only after confirmed success. The old `/admin/logout` address remains a POST alias; GET returns 405 and does not lock an account. Stale admin sessions go directly to the unlock form, not a mutating GET redirect.
- Lock clears only `admin_session` at `/admin` and legacy `/`. Ordinary access/refresh cookies and checkout state stay intact. Proxy cleanup and successful unlock also preserve both required cookie headers. A shared response writer replaces the name-keyed cookie writes that silently lost one Path.
- Unlock now uses a bounded, same-origin POST handler; its old server action and mutable admin-cookie helpers are removed. It expires the legacy root cookie and sets the canonical `/admin` cookie in one response. Return paths remain under `/admin`; unlock/logout cannot be their own return destination.
- `/admin/security` is available to every active, unlocked admin through **My Admin Password**. Current unlock password, a different 12-128-character new password and confirmation are required. Validation runs in browser and server; password text is never trimmed. Request bodies are limited to 8 KiB.
- All newly set admin passwords share that 12-128-character policy: self-change, operational-admin provisioning, ownership transfer and the master-admin CLI. Forms use the same length constants; server write helpers and the CLI validate before hashing. Provisioning leaves the old password unchanged only for a missing or exactly empty field; whitespace is not silently discarded. A new admin still requires a password. Invalid non-text input is rejected. Existing-password unlock/proof checks and ordinary site login are unchanged.
- Unlock/password POSTs share the existing database-backed failed-attempt lockout. At most two of these requests run concurrently per Node process; additional requests return a retryable 429 instead of queuing password work on the 2 GB VPS. Lock remains available while that budget is full; the older transfer-start action still needs equivalent limits.
- Password changes update only the signed-in admin. Argon2id hashing runs before a short transaction, which conditionally updates the still-current account/version, increments `sessionVersion`, consumes that admin's pending ownership transfers and records a password-free audit event. A conflict or failed audit rolls back the change. Other accounts, roles, scopes, primary login and Django passwords are unchanged.
- After success, both local admin-cookie Paths expire and the browser asks for a fresh admin unlock. Existing unlocks for this admin on other browsers are rejected by their next live authorization check because their version is old; their ordinary site login remains active. No automatic resubmission occurs after an uncertain network result: try the new unlock password before submitting another change.
- This is not instant removal of an already-open remote tab or server-side revocation of a copied cookie on Lock. Ordinary Lock clears this browser's cookies; password change revokes prior admin versions. Existing primary-session and live role/status/version checks remain mandatory.
- Master transfer still requires its existing password/OTP checks. Starting a challenge now checks and locks the current source master/version before creating it. Completion conditionally disables that same source version, claims an unconsumed/unexpired code, updates the target and audits in one transaction. Replayed codes, changed passwords/roles or failed audit cannot partially hand over access. Source-row-before-challenge locking matches password changes. After confirmed transfer, the client uses normal POST Logout; a failed logout can be retried without replaying the handoff. Already-running unrelated admin operations are not cancelled by a password change.

### Email And Admin Recovery

- Admin access is matched by immutable Django `codexUserId`, not email. Changing email on the **same Django account** does not change the Next admin password or role. Creating another Django account produces a different ID and does not inherit admin access.
- The user confirmed they can still sign in and unlock admin. Routine unlock-password changes can therefore use `/admin/security` without the expired inbox or the bootstrap script. `ADMIN_SESSION_SECRET` is a server signing key, not the password entered into that screen.
- Next admin recovery cannot restore a Django account whose primary login is unavailable. Resetting a Next unlock password does not change the Django password or bypass Django email verification/recovery requirements.
- The existing profile form can submit `email` through authenticated profile PATCH. There is no separate old-email verification flow in this Next code; Django's actual acceptance/verification requirements are not confirmed here. Do not bypass them or claim the mailbox was changed. Next's optional `AdminUser.email` and notification routing do not automatically synchronize with a Django profile edit.
- Operational-admin management and master transfer already have dashboard forms. Safer emergency-script and ownership changes remain the follow-up below; no real passwords, email addresses or ownership were changed by this implementation.

### Forms, Address And Uploads

- Shared validators give field-level errors in login/signup/verification/reset and validate action inputs again. New passwords must match; codes are six digits. Password reset resends through its own endpoint. Pending guards and bounded process-local limits prevent rapid duplicate submissions.
- Password changes use POST `/next-api/auth/password-reset`. Same-origin checks, an 8 KiB body limit, shared validators and existing request limits run before Django; the old reset server action is removed.
- Only a confirmed successful reset expires this browser's access, refresh and both admin-cookie Paths in that response, and cancels matching in-process refresh. The browser clears private details, notifies same-domain tabs and fully reloads login with the validated return path and a password-changed notice. Other-device revocation still depends on Django.
- Failed resets leave the login alone. If the network result is uncertain, do not resubmit automatically; ask the user to try their new password before requesting another reset.
- Query values use URLSearchParams, preserving emails containing `+`. A missing verification/reset email has an editable validated field.
- Saved country names/ISO2/ISO3 values normalize through the existing country helpers. Unknown values are rejected, never silently replaced with USA. A successful address save updates an initially empty store.
- The 900 KiB photo limit leaves room for multipart overhead under the existing 1 MiB proxy limit. Server checks include size, extension, MIME and file signature. Client/server profile fields share one strict schema; read-only fields are rejected.
- Safe account responses exclude unused payment/favorites fields. During testing, real `payment_methods` data differed from the old string type and initially triggered the retry message. The unused fields are now excluded rather than breaking account loading or exposing extra data. The user confirmed the real account page loads after this correction.
- Permission errors, missing shop profiles and temporary failures show honest errors/retry without forcing logout. No empty social-login controls pretend that an unimplemented provider works.

## Verified Django Contract

Read-only source: [production Swagger supplied by the user](http://5.78.101.86:8282/swagger), base `/api/v1`. The user confirmed its production version. Do not enter credentials/tokens into that HTTP page.

| Operation | Request / important response |
| --- | --- |
| POST `/auth/user-login` | email/password; 200 success envelope with access/refresh |
| POST `/auth/token/refresh` | refresh; 201 documents access/refresh; access-only responses are also supported |
| POST `/auth/user-logout` | refresh; 200 or 401 invalid refresh |
| POST `/account/user-registration` | first_name/last_name/email/password; 201 user data, not login tokens |
| POST `/account/otp/verify`, `/otp/resend` | email/code or email; registration-code operations |
| POST `/account/password-reset-otp` | email; send/resend reset code |
| POST `/account/forgotten-password-reset` | email/code/password; no documented auto-login |
| GET `/account/my-profile` | bearer token; validate returned profile identity |
| PATCH `/account/my-profile-update` | multipart, including profile_pic; only documented writable fields |
| GET `/shop/my-shop-profile` | 404 can mean missing shop profile, not invalid login |
| PATCH `/shop/shop-profile-update` | address fields; nullable fields are documented, but missing-profile creation is unverified |

## Verification

Read the installed Next documentation in `node_modules/next/dist/docs/` before changing these boundaries. Tests use its real request stores to enforce cookie-write restrictions, existing node:test/tsx, and fake data.

```sh
yarn test:auth
npx tsc --noEmit --incremental false
yarn build
npm run build:webpack
```

Current checks, 2026-10-27:

| Check | Coverage / result |
| --- | --- |
| Auth regression tests | The auth-only copy passes 71 existing tests, including reset cookie expiry/client cleanup, unchanged sessions on failure, cold-load outage routing and the deployment test gate. The command discovers all auth/session tests automatically and includes existing wishlist checks. Tests use fake data, not a live database. |
| Admin deployment/password policy, latest pass | 33 temporary checks pass for length boundaries, exact password text, blank-update preservation, non-text rejection, provisioning actions/write helpers, transfer validation, self-change and fake CLI create/update. Stubbed deployment commands verify production/URL preflight, direct/pooled selection, Admin Ops migration order and immediate stop on failure. No real migration or account operation was run. |
| Latest build and form checks | An isolated Turbopack build over `ce650677` plus these changes passes without signing keys. Public shop pages remain static/ISR; private password/admin write helpers are absent from the action manifest. Browser checks confirm native bounds and empty/short input handling on all three password forms. The isolated copy passes all 71 existing auth tests and TypeScript; targeted runtime ESLint and shell syntax checks pass. This is not a Docker packaging, production-database or VPS performance test. |
| Earlier admin Lock/password checks | 22 temporary checks passed for both cookie Paths, unchanged main login, email-independent identity, weak admin keys/readiness, body/origin checks, password validation/lockout, concurrent-update protection, bounded password work, transactional audit rollback and ownership-code replay/stale-source guards. These used fake data, not live PostgreSQL concurrency. The isolated Turbopack build over `5a0396fe` passed without either signing key; public catalog routes stayed static/ISR and private helpers were absent from the action manifest. |
| Earlier admin HTTP/browser checks | 17 checks passed against the isolated production build with a fake admin database: readiness 200/503, GET refusal even without login, cross-origin refusal, real Proxy cleanup, desktop/mobile form layout and mismatch validation, password change, old-version rejection, fresh unlock and Lock. Ordinary access/refresh cookie values remained unchanged. No live Django, PostgreSQL, email or ownership operation was performed. |
| Refresh/readiness regressions | 17 temporary checks pass: rotation chains, cancellation before token discovery, two-second reuse versus longer tracking, delayed/expired results, separate-bundle sharing, final server/Proxy cookie guards, capacity, retry and runtime configuration/database failures. No live credentials or services. These extra test files are outside the repository and removed after validation, not committed, as requested. |
| Production HTTP refresh/readiness checks | 11 checks pass against each isolated webpack/Turbopack Next server and fake Django API: actual Proxy/handler sharing, two parallel requests cancelled by Logout, old-token reuse blocked after rotated-token Logout/reset, four expiry headers, independent-browser refresh and readiness 200/503/revision. No real backend contact. |
| Existing storefront/checkout suites | The auth-only copy passes 119 storefront and 209 checkout tests over the current committed baseline. No changes to those suites are included here. |
| TypeScript and targeted ESLint | Pass for the auth-only build; the shared checkout also passes TypeScript and the changed runtime files pass targeted ESLint. Unrelated changes remain independently owned. |
| Isolated production builds | Webpack and default Turbopack pass over committed baseline `5ea9dfc5` with only these auth changes and no SESSION_SECRET during build. Checked private session/config helpers are absent from both public action manifests; catalog pages retain static/ISR rendering. Turbopack's temporary filesystem root was widened for symlinked dependencies; repository config is unchanged. The webpack standalone tracing warning and shared dependencies mean these are not Docker packaging/VPS resource checks. |
| Production-build browser checks | Account loading skips the extra startup session request. During a simulated refresh outage, expiry hides account details and edit drawers. Retry restores the same unsaved address; explicit close/reopen restores the saved address. No console errors/warnings. |
| Reset and outage integration checks | The local fake API confirms successful reset expires four cookie headers and requires login; GET reset returns 405. Opening an account during an outage redirects to an uncached outage page. Browser Retry returns to the saved destination; Logout reaches login even when Django logout fails. |
| Earlier form/login browser checks | Invalid submissions, return destinations, Register links and Logout passed. The user also confirmed their real account page loads. |

The `verify` job in `.github/workflows/push-to-main.yml` now runs `yarn test:auth` before deployment. The deploy job depends on that job succeeding; no production credentials or backend/database access are needed by the auth tests. Keep this test step when changing the workflow.

Keep the existing committed regression tests. No test files are staged or committed for this change. The additional admin tests are temporary and are not part of the existing 71-test CI suite; CI success alone does not verify these new flows. Temporary fixtures/build copies are removed after validation. No real credentials, account creation, reset email, password change, ownership transfer or profile/address write were submitted by the agent.

Before committing, test the staged files in a separate copy and inspect the action manifest for exposed private helpers. Do not share a build directory with another running task. The copy reuses local dependencies; it is not a test of a self-contained container package. These checks do not prove production Nginx behavior or a measured speed increase. Keep the existing route CSS imports described in the [Storefront CSS guide](../README.md#storefront-css).

## Deployment Checklist

- [ ] Make a strong SESSION_SECRET of at least 32 bytes available in the Next container; never use a test key.
- [ ] Configure a separate random ADMIN_SESSION_SECRET of at least 32 UTF-8 bytes before deployment. Short/missing admin keys now fail readiness and signing. Rotating only this key requires fresh admin unlocks and invalidates pending transfer codes, not normal site login. Neither key is needed for the image build.
- [ ] Confirm `.env.production` has the intended Admin Ops database URLs. Both variables are present according to the user: `NEON_ADMIN_OPS_LEDGER_URL` is used for migrations; runtime prefers `NEON_ADMIN_OPS_LEDGER_POOLED_URL`. Verify they address the same production database. The migration preflight checks production mode and URL syntax without printing the URL; it cannot identify the correct remote branch.
- [ ] Let the existing migrate service generate the Admin Ops client and apply its existing migrations before catalog/PayPal setup and the app restart. Confirm it exits successfully. A missing/invalid URL or failed migration now stops deployment. No new tables or SQL are introduced. If the database was initialized without migration history, stop and review a backup, schema and history rather than resetting it or blindly baselining migrations. See [database setup](../devScripts/README.md#database-setup).
- [ ] Rebuild/redeploy Next through the existing verified workflow. Nginx alone is already redeployed according to the user; it does not deploy these auth/readiness fixes or Next's compiled cache headers. Do not repeat the Nginx replacement blindly.
- [ ] Confirm `/next-api/health/ready` returns 200 and the expected release revision. A 503 log identifies either authentication configuration or the local catalog; correct that runtime configuration/schema instead of bypassing the probe. Docker becoming unhealthy does not automatically roll back the release.
- [ ] Announce the one-time fresh sign-in: version-2 cookies deliberately reject old cookies from the previous unsafe helper boundary. Do not migrate by trusting their user ID.
- [ ] Build with the real production public-site URL, and the intended internal Django URL. Development normally prefers the public API URL; internal preference is explicit or production-only.
- [ ] Keep `/next-api` routed to Next on both hosts and preserve trusted public Host/protocol headers. Do not disable same-origin checks to work around proxy errors.
- [ ] Verify the already-deployed Nginx file matches the intended selective-cache policy and passes `nginx -t`. Use the replacement procedure below only if another configuration update is needed. Purge old Cloudflare HTML entries separately if applicable.
- [ ] With disposable accounts behind HTTPS, verify both shop addresses, recovery, profile/address save past access expiry, invalid refresh, outages, two same-origin tabs and two independent devices.
- [ ] During an outage, leave a dirty profile/address drawer open through access expiry: it must disappear while unverified and return unchanged after same-account recovery. Confirm actual logout and switching accounts discard the previous draft. Confirm hidden tabs do not retry continuously and exhausted retries require Retry or a later focus check.
- [ ] Also open an expired session directly during an outage: confirm the temporary redirect preserves the requested destination, both responses prohibit caching, and Retry/Logout work on both shop addresses and the main profile. After a successful password reset, confirm the same browser lands on login, its other same-domain tabs clear private details, and its former admin unlock is gone. Failed resets must leave its current session intact.
- [ ] Confirm actual Django lifetimes, refresh rotation, logout scope and password-reset revocation before claiming those behaviors. Verify parallel refresh in every deployed Next process/container.
- [ ] With a disposable account, test Logout and successful reset just after a token refresh, plus Logout during a delayed refresh. The cancelled request must not set a new access/refresh cookie. Confirm another browser/device stays signed in. Repeat for both shop addresses and main profile; do not claim cross-domain logout before the bridge exists.
- [ ] Verify admin Lock clears both cookie Paths but leaves `/profile` signed in; GET and cross-origin POST must not lock. Unlock, change the admin password, confirm old unlocks fail on another browser, and confirm normal login stays active. Test a stale/malformed admin cookie without a redirect loop. Use disposable admin records, never bootstrap/transfer scripts as a smoke test.
- [ ] With disposable admins, confirm new passwords of 11 or 129 characters are rejected and 12-128 are accepted in provisioning, transfer and self-change. Check that spaces are preserved, an empty existing-user password field keeps its password, and a shorter pre-existing password still unlocks normally. Do not run the master-admin script against a real account just to test validation.

## Nginx Configuration

The single replacement is [production.conf](./nginx-auth-hardening/production.conf). It is a complete configuration, not a `conf.d` snippet. It keeps the original filename, certificates, Docker upstreams, ports, upload limit, cache sizes and shop URL mappings. This auth change does not edit that file or the external Nginx repository. The user reports deploying Nginx only; the actual VPS file has not been inspected.

### Changes

| Original Audit Lines | Fix |
| --- | --- |
| 329, 344, 360 | Both domains selectively cache anonymous catalogue HTML. Private routes remain uncached; image/static policies stay separate. |
| 84, 249 | Shared guards bypass session/admin/draft cookies, Authorization, queries, non-GET, Next page-data/prefetch, Range and action requests. Response guards reject private responses, cookies, errors and stale ISR output. |
| 143, 224 | Next receives the accepted public host/protocol. Django keeps its internal Host with the full forwarding-header list. Normal requests can reuse connections. |
| 16, 20 | Access-log queries and referrer values are omitted. |
| New guards | Unknown TLS names and HTTP hosts are rejected. |

Repeated TLS, upload and cache settings are shared in this file, with no extra Docker mounts. Django's explicit header list is intentional: a local list replaces the parent list under [Nginx's header inheritance rules](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_set_header).

### Page Caching And Updates

- Next's existing hourly ISR stays unchanged. The homepage and product/category output remain reusable inside Next; bypassing Nginx does not force a fresh page render.
- `next.config.mjs` adds `X-Accel-Expires: 2` only to catalogue routes under `/shop`: home, product listing/detail, category listing/detail and numbered category pages. Nginx maps both public addresses into these routes.
- Nginx stores only GET, query-free, successful HTML on that allowlist. It also requires the exact lifetime header, a single positive `s-maxage`, and Next cache state HIT, MISS or REVALIDATED. Missing/malformed/conflicting headers, private/no-store/no-cache, Set-Cookie and STALE responses do not enter the page cache. Existing entries are also bypassed for authenticated/draft and Next navigation requests.
- The four HTML locations ignore Cache-Control/Expires **only for Nginx's cache timing**. Their explicit privacy guards remain mandatory, and the original headers still reach browsers. This prevents Next's long stale-while-revalidate window from extending Nginx's copy. Do not apply this override to the asset locations or remove the response guards.
- HTML has no Nginx background refresh or stale-on-error fallback. The `isr-html-v2` key prevents reuse of older-policy HTML entries. Asset cache keys, lifetimes and stale behavior are unchanged.
- Existing `revalidatePath` calls still invalidate Next, not Nginx. An existing proxy copy expires after nominally two seconds; Nginx's whole-second clock can make that nearly three. Next may then serve one STALE response while regenerating, but Nginx will not store it. Fresh output can be cached on a later request. In-flight fills and failed regeneration prevent a strict end-to-end freshness guarantee: this is a short-lived proxy cache, **not instant purge**. Next can retain its own older ISR output after a regeneration failure.
- Invalidation must target the changed route. `revalidatePath('/shop')` alone does not invalidate every product/category descendant. The existing admin snapshot/SEO refresh flows invalidate their affected paths; this change does not broaden unrelated catalogue jobs.

The external Nginx checkout now contains the earlier shop-cache-off proposal (SHA-256 `a236d45d903e61c51fd0804b9f71aa2c37362f559b685a92583dac376255d7da`), rather than the first audit's source. The table uses that first audit's line numbers. This update preserves the external copy's unrelated settings and does not modify that repository. Confirm the actual VPS version and review any newer edits before replacement.

### Verification And Performance

Local checks on 2026-10-27 use Nginx 1.30.6 and Next 16.4.3. The isolated webpack production build reuses local dependencies; its standalone tracing warning is not proof of a complete Docker package. Public pages remain static/ISR. No production requests, account writes or reloads were performed. Docker is not running locally, so the real container validation below is still required.

- 108 local Nginx safety checks passed, including warm-cache private-route bypass, all four hosts, both shop mappings, four logout cookie headers, malformed/conflicting/multiple Cache-Control values, STALE rejection, expiry during a 500 response, forwarding headers and unchanged asset caching.
- A real product page, backed by a disposable SQLite snapshot, showed the updated product title after Next path invalidation and the deliberate 3.1-second wait. The new response then produced a proxy HIT. This tests Next regeneration plus the proxy, not merely a fake TTL timer.
- At the earlier cache-policy check, the standalone route/config tests passed locally but were excluded from the commit at the user's request; the committed storefront suite passed 113 tests and auth passed 71. TypeScript and targeted ESLint passed. Current auth-check results are in Verification above. Temporary databases, fixture routes, build copies and benchmark scripts are removed after validation.

Performance used the real homepage and product-page code from committed baseline `ddadb9ba` plus this Next header change, with a synthetic product snapshot and no live API/database credentials. Tests alternated ISR-only and selective Nginx caching twice on four URLs across both domains: 400 requests per run, eight concurrent keep-alive clients, localhost HTTPS. Warm-run median response duration ranged from 5.30-6.93 ms with ISR alone to 1.92-2.44 ms with selective caching. All 3,200 measured selective warm requests hit Nginx after priming.

A separate eight-second product-page run crossed several proxy expirations:

| Mode | Requests | Median | 95th Percentile | Requests Reaching Next |
| --- | --- | --- | --- | --- |
| ISR only | 10,257 | 5.27 ms | 10.84 ms | 10,257 |
| Selective proxy cache + ISR | 27,485 | 1.97 ms | 4.01 ms | 12 |

The selective run recorded 27,473 proxy HITs; the remaining requests reached Next during expiry/refill. These are full-response localhost timings, not TTFB, VPS capacity, browser Web Vitals or an SEO ranking prediction. Tests used one Nginx worker and a 512 MiB Node heap limit, not the production Docker memory/CPU limits. Repeat on the VPS with comparable traffic before changing resource limits.

### Apply On The VPS

Nginx is already redeployed according to the user. Next is the pending deployment. With the selective policy, an old Next image without `X-Accel-Expires: 2` does not enter the Nginx HTML cache; Next's own ISR remains available. Header rules are compiled at build time.

The following procedure is retained for future Nginx updates, not an instruction to repeat the reported deployment. Run from the **codex-nginx repository on the VPS**. Stage the replacement at `nginx/proposed/production.conf`, leaving the active `nginx/production.conf` untouched until validation succeeds. Keep the existing Nginx image; do not pull an upgrade. Apply Nginx before Next when changing this cache contract.

1. Validate using the container's real certificates and Docker network. Stop on failure:

```sh
docker cp nginx/proposed/production.conf codex-con-nginxx:/tmp/production.conf
docker exec codex-con-nginxx nginx -t -c /tmp/production.conf
```

2. After validation succeeds, back up and activate during a brief maintenance window. Stop if any command fails; keep the printed backup path:

```sh
backup="nginx/production.conf.before-auth-$(date +%Y%m%d%H%M%S)"
cp nginx/production.conf "$backup"
printf 'Backup: %s\n' "$backup"
cp nginx/proposed/production.conf nginx/production.conf
docker compose up -d --no-deps --force-recreate --pull never nginx
docker compose exec -T nginx nginx -t
docker compose ps nginx
```

Recreating only Nginx briefly interrupts traffic, reads the replacement through the existing bind mount and clears its container-local HTML cache. The named image/static cache volume and app/Django containers stay intact. A reload alone can miss a host file that an editor replaced atomically.

3. Rebuild/redeploy Next, then test login, account redirects, reset and Logout at both shop addresses. Also check an existing read-only `/api/v1` endpoint. Account/auth pages and `/next-api` must never show an Nginx cache HIT. Logout cookie headers, private/no-store and Next Vary headers must pass through. Anonymous public HTML should MISS then HIT on quick repeat requests; after a few seconds it must reach Next again. Use a normal request without browser DevTools' Disable Cache, which intentionally bypasses the proxy cache.

4. Refresh a product/category through its existing admin flow. Verify its HTML/metadata update after regeneration and the short proxy window. Inspect X-Cache-Status separately from X-Nextjs-Cache: a proxy HIT can retain Next's earlier MISS label. Check both domains and prefixed shop aliases. Do not add an unauthenticated purge endpoint to production.

### Rollback

For a quick rollback, keep the revised safeguards and change the shared `proxy_cache storefront_microcache;` line in deployed `nginx/production.conf` to `proxy_cache off;`. Image/static locations still explicitly enable their own cache. The ISR-only benchmark used this same switch.

Validate the edited file before recreating Nginx; stop if validation fails:

```sh
docker cp nginx/production.conf codex-con-nginxx:/tmp/production.conf
docker exec codex-con-nginxx nginx -t -c /tmp/production.conf
docker compose up -d --no-deps --force-recreate --pull never nginx
docker compose exec -T nginx nginx -t
```

Do not restore the older `$backup` while Next still emits `X-Accel-Expires`: older cache rules do not have the new explicit privacy/draft guards. For a complete rollback, first rebuild/redeploy Next without the new header rules, then validate and restore the recorded Nginx backup. Next's hourly ISR remains available in either rollback mode.

### Remaining Checks

- Verify private/page-data bypass and a real admin refresh behind production HTTPS before treating the local results as production validation. Missing guards in the original file did not demonstrate a private-data leak.
- Measure response time, CPU and memory on the 2 GB VPS before tuning limits: cache metadata remains 96 MiB, response buffers can use roughly 512 KiB per active request and each upstream allows 128 idle connections per worker.
- If Cloudflare proxies traffic, configure trusted visitor-IP ranges before relying on IP limits. Bypass **HTML** in custom edge-cache rules unless edge purging is separately integrated; otherwise the forwarded ISR headers can let Cloudflare retain pages longer than Nginx. Purge old edge HTML separately and keep edge asset caching.
- Review log rotation and error/application/Cloudflare logs separately; error logs can still contain queries. Access-log cleanup does not cover those logs.
- Review unprefixed shop OpenGraph/Twitter paths, long-lived caching of non-versioned assets and headers overridden by location-specific `add_header` lists. Those behaviors are unchanged.
- Recheck upstream name resolution after app or Django container replacements.

## Automatic Cross-Domain Login Evaluation

No implementation or migration is approved by this guide. Cookies cannot span the unrelated .org and .shop domains. A small Next/database bridge remains the candidate; no Django or major Nginx rewrite is expected, but the independent proxy corrections still apply.

1. Reuse the existing Admin Ops PostgreSQL database, with separate ordinary-user auth helpers. Add AppAuthSession for encrypted Django tokens, expiry/revocation and refresh coordination; add CrossDomainSignIn for hashed one-use codes, target host, browser check, expiry and consumption.
2. Use `/next-api/auth/bridge/start`, `/authorize` and `/callback`. The receiving host sets a short-lived browser-check cookie before a top-level redirect to the source host. If the source has no valid login, return to normal login without a loop.
3. If signed in, issue a roughly 60-second one-use code for an exact allowlisted receiving callback. Atomically consume it after checking browser/host/expiry. Never put Django tokens or reusable session references in URLs; remove the code promptly and keep it out of logs/referrers.
4. Both hosts use one server-side token record. Claim a short database refresh lock with a conditional update, not a transaction held open during Django I/O. Save only while the session remains active and the refresh version matches.
5. Logout revokes only that browser's linked session before the bounded Django call. Clear local cookies; the other host rejects its old reference on its next request. Do not transfer admin unlock or promise immediate erasure of an already-open remote tab.
6. The existing deployment runner now generates/migrates the Admin Ops schema. If the bridge is approved later, add reviewed migrations for its new tables through that same runner; this guide does not authorize them. Confirm development/production separation first. Production Prisma client reuse is already fixed.
7. Measure database dependency/latency and test code replay, wrong browser/host, expiry, database outage, simultaneous refresh, logout during refresh and independent-device logout. Public anonymous pages must not start querying this database. A crash after Django rotation but before token storage can still require sign-in.

## Remaining Work And Resume Notes

- Next action: deploy the rebuilt Next image, verify readiness/release revision, then run the disposable-account checks above behind production HTTPS. Only Nginx has been redeployed; local results do not close production verification.
- Admin script follow-up: replace routine use of `scripts/create_master_admin_user.ts` with explicit create/reset modes. The shared new-password policy is now enforced, but the script still accepts secrets in command arguments, loads `.env.local`/`.env`, and upserts master role/scopes/status even when only a password reset is intended. Add hidden terminal/STDIN secret input, explicit environment/database selection, a non-mutating target preview and confirmation. Reset should preserve identity/role/scopes/status, increment the session version, cancel pending transfers and audit atomically. Keep emergency recovery behind VPS access and its protected creation/recovery token; do not expose that token in a browser or allow public self-promotion.
- Ownership follow-up: extend the failed-password/concurrency limits to the existing transfer-start flow and bind recipient confirmation to the intended target account. The flow currently sends OTP to the entered target email after a public user-ID preview; it does not establish that this is the target account's verified Django email. Atomic code/source guards are implemented, but real-database parallel confirmations, wrong recipient and email-send failures still need release checks. Do not remove proof requirements to work around the expired old inbox.
- Confirm whether PATCH creates a missing Django shop profile; Next must not invent that backend behavior.
- Saved-address deletion, payment information and order history are separate feature work. The existing Delete control has no implemented action. Do not claim a complete order history from partial Next payment records or match private orders by unverified email.
- Wishlist product UI was developed separately. This auth change only adds safe server authentication/refresh and same-origin mutation checks to its existing handler.
- Process-local limits/caches reset on restart and are not shared across Next processes. Cookie signing is not encryption or database-backed revocation.
- The current checkout also contains unrelated work. Review git status, this guide and AGENTS before resuming. Stage only relevant files/hunks and leave external Nginx/Django changes and new services out unless separately requested.
