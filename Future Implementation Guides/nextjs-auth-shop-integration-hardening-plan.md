# Authentication And Shop Login Implementation Guide

Updated 2026-10-27. This is the canonical guide; the [original audit index](./auth-session-shop-domain-audit-and-implementation-plan.md) preserves the investigation context. Paths are repository-relative unless absolute.

## Scope And Decisions

- Keep `codexchristi.org/shop` and `codexchristi.shop` working with one Next application.
- Use the existing production Django APIs. No Django edits, Nginx edits, database migrations, Redis or extra container are included.
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
| Profile/address actions and server-only account service | `src/actions/account/profile.ts`, `src/lib/auth/account-service.ts` |
| Minimal response shapes / multipart and country validation | `src/lib/auth/account-data.ts`, `account-validation.ts`, `profile-limits.ts` |
| Bounded, uncached Django requests and response reading | `src/lib/django/request.ts`, `src/lib/auth/authenticated-django-fetch.ts` |
| Cookie format, read-only session state and refresh | `src/lib/session/session-cookies.ts`, `server-session.ts`, `main-session.ts`, `session-refresh.ts` |
| Protected GET/HEAD routes and refresh-cookie forwarding | `src/proxy.ts`, `src/lib/middlewares/auth-middleware.ts`, `src/lib/session/session-redirect.ts` |
| POST logout, origin validation and both admin-cookie Paths | `src/app/api/logout/route.ts`, `src/lib/auth/request-origin.ts`, `logout-cookies.ts` |
| Client logout and private-state cleanup | `src/actions/logout.ts`, `src/lib/auth/client-session.ts` |
| Account identity, stale-request guards and tab checks | `src/stores/authStore.ts`, profile stores, `src/lib/auth/session-generation.ts`, `LoggedinProvider.tsx` |
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
8. Concurrent refreshes share a bounded in-process promise cache. Logout cancels matching in-process refreshes; this does not coordinate multiple processes or eliminate every late Set-Cookie race.

### Logout And Account State

- Logout uses same-origin POST `/next-api/logout`; GET returns 405 and cannot sign someone out. Django revocation has a 3-second deadline and local expiry is unconditional.
- Send separate Set-Cookie expiry headers for `session`, `refreshToken`, and `admin_session` at both `/admin` and legacy `/`. A map keyed only by cookie name would lose one admin Path.
- The old Deactivate tile is now Logout with the Lucide LogOut icon and a disabled pending state. It does not deactivate/delete the Django account.
- Main/shop profiles live in memory, not persisted browser storage. Cleanup removes legacy keys and resets private edit/address/email/verification/payment-recovery state, deliberately keeping guest cart items.
- Account-generation checks ignore late requests from the previous user. Session checks are shared, focus/resume is throttled, and one expiry timer replaces continuous polling. Same-origin tab notices clear/reload private state; they do not notify another domain.
- `refreshAuthState()` is the store's session-check method. Obsolete persist-hydration stubs, an unused initializer and the empty refresh hook were removed. The avatar waits for confirmed identity instead of issuing another session check.

### Forms, Address And Uploads

- Shared validators give field-level errors in login/signup/verification/reset and validate action inputs again. New passwords must match; codes are six digits. Password reset resends through its own endpoint. Pending guards and bounded process-local limits prevent rapid duplicate submissions.
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

Installed Next is 16.3.0. Read its bundled docs before changing these boundaries. Tests use installed Next request stores to enforce cookie-write restrictions, existing node:test/tsx, and synthetic data.

```sh
node --require next/dist/server/node-environment --conditions=react-server --import tsx --test src/lib/auth/auth-hardening.test.ts src/lib/auth/server-boundaries.test.ts src/lib/session/session-hardening.test.ts src/stores/shop_stores/use-wishlist.test.ts src/lib/wishlist/normalize.test.ts
npx tsc --noEmit --incremental false
npm run build:webpack
```

The 46 focused tests cover route/origin validation, plus-addresses, form rules, matching client/server profile validation, upload overhead, DTO filtering, cookie kinds/legacy rejection, refresh classification/coalescing/cancellation, GET logout refusal, both admin-cookie Paths during an outage, independent admin unlock, read-only rendering, stale profile responses, 403/404 behavior and Prisma reuse without database queries. Existing wishlist tests remain included.

Browser checks in the implementation pass verified invalid login/reset submissions, synthetic login/account redirect, the Logout tile, logout returning to shop login, and main-site Register destinations. The user retried their own real account fetch and confirmed it loads. No production credentials, account creation, reset email or profile/address write were submitted by the agent.

Before committing, test the staged tree separately from the unrelated dirty working tree and inspect its action manifest for exposed private helpers. Do not run a verification server against a build directory another task is overwriting. Local tests do not establish production proxy/cache/token behavior or a measured latency improvement.

Commit verification on 2026-10-27: all 46 tests, TypeScript and targeted ESLint passed in an exported staged tree. Its production webpack build also passed after supplying the two existing local storefront CSS files as temporary verification dependencies, not staged changes. Without them, the clean staged build fails because baseline commit `64335359` already imports untracked `src/app/route-utilities.css` from the wishlist page; its `tailwind.route-utilities.config.ts` is also untracked. Complete that separate storefront change before deploying a fresh checkout. Auth-only staging deliberately excludes those files and their unrelated layout imports.

## Deployment Checklist

- [ ] Make a strong SESSION_SECRET of at least 32 bytes available in the Next container; never use a test key.
- [ ] Announce the one-time fresh sign-in: version-2 cookies deliberately reject old cookies from the previous unsafe helper boundary. Do not migrate by trusting their user ID.
- [ ] Build with the real production public-site URL, and the intended internal Django URL. Development normally prefers the public API URL; internal preference is explicit or production-only.
- [ ] Keep `/next-api` routed to Next on both hosts and preserve trusted public Host/protocol headers. Do not disable same-origin checks to work around proxy errors.
- [ ] Apply the Nginx recommendations below separately, run nginx -t in the actual container, reload in a controlled deployment and purge affected old HTML cache entries.
- [ ] With disposable accounts behind HTTPS, verify both shop addresses, recovery, profile/address save past access expiry, invalid refresh, outages, two same-origin tabs and two independent devices.
- [ ] Confirm actual Django lifetimes, refresh rotation, logout scope and password-reset revocation before claiming those behaviors. Verify parallel refresh in every deployed Next process/container.

## Nginx Follow-Up

Reviewed, not edited: `/Users/devsantorz/Desktop/devProjects/codex-nginx/nginx/production.conf` and its adjacent Compose configuration.

1. Disable HTML microcaching temporarily in all three shop locations: exact root, prefixed shop passthrough and catch-all. Keep image/static caches separate.
2. Before re-enabling, apply the main host's existing bypass/no-cache guards to every shop location: login cookies, Authorization, queries, POST, Next component/prefetch requests, allowed public routes and upstream Set-Cookie. Preserve upstream private/no-store and Vary behavior. Missing extra rules alone do not prove a leak; current Nginx defaults already honor upstream cache controls.
3. Correct the main `/api` location's proxy_set_header inheritance: its local Upgrade/Connection overrides replace inherited header overrides. Include the full trusted header set after checking Django's accepted hosts; do not force Connection: close for normal HTTP requests.
4. Set the accepted public X-Forwarded-Host explicitly and reject unknown hosts. Preserve the existing `/next-api` and `/shop/` exceptions.
5. Measure upstream Cache-Control before describing the storefront as a two-second cache: Next's revalidation lifetime can take precedence. Do not ignore Cache-Control globally to force a shorter cache.
6. Check shop OpenGraph/Twitter forwarding; the metadata regex currently forwards unprefixed paths unchanged. Limit immutable caching to hashed/versioned assets and reapply headers where a location defines its own add_header list.
7. If Cloudflare proxies traffic, configure trusted real visitor IPs before relying on IP limits. Redact auth email/code query strings from logs and rotate logs.
8. Do not increase workers, cache zones or buffers as an auth fix. Current cache metadata totals 96 MiB, response buffers can use roughly 512 KiB per active request and upstreams allow 128 idle reused connections per worker. Measure before tuning on the 2 GB VPS.
9. Test upstream resolution/reload after container recreation. The storefront cache is container-local in the supplied Compose file, unlike the persisted image/static cache.

## Automatic Cross-Domain Login Evaluation

No implementation or migration is approved by this guide. Cookies cannot span the unrelated .org and .shop domains. A small Next/database bridge remains the candidate; no Django or major Nginx rewrite is expected, but the independent proxy corrections still apply.

1. Reuse the existing Admin Ops PostgreSQL database, with separate ordinary-user auth helpers. Add AppAuthSession for encrypted Django tokens, expiry/revocation and refresh coordination; add CrossDomainSignIn for hashed one-use codes, target host, browser check, expiry and consumption.
2. Use `/next-api/auth/bridge/start`, `/authorize` and `/callback`. The receiving host sets a short-lived browser-check cookie before a top-level redirect to the source host. If the source has no valid login, return to normal login without a loop.
3. If signed in, issue a roughly 60-second one-use code for an exact allowlisted receiving callback. Atomically consume it after checking browser/host/expiry. Never put Django tokens or reusable session references in URLs; remove the code promptly and keep it out of logs/referrers.
4. Both hosts use one server-side token record. Claim a short database refresh lock with a conditional update, not a transaction held open during Django I/O. Save only while the session remains active and the refresh version matches.
5. Logout revokes only that browser's linked session before the bounded Django call. Clear local cookies; the other host rejects its old reference on its next request. Do not transfer admin unlock or promise immediate erasure of an already-open remote tab.
6. Add admin-schema generate/migrate-deploy to `scripts/prisma_production_setup.sh` before deploying new tables; it currently omits that database. Verify development/production DB separation first. Production Prisma client reuse is already fixed.
7. Measure database dependency/latency and test code replay, wrong browser/host, expiry, database outage, simultaneous refresh, logout during refresh and independent-device logout. Public anonymous pages must not start querying this database. A crash after Django rotation but before token storage can still require sign-in.

## Remaining Work And Resume Notes

- Confirm whether PATCH creates a missing Django shop profile; Next must not invent that backend behavior.
- Saved-address deletion, payment information and order history are separate feature work. The existing Delete control has no implemented action. Do not claim a complete order history from partial Next payment records or match private orders by unverified email.
- Wishlist product UI was developed separately. This auth change only adds safe server authentication/refresh and same-origin mutation checks to its existing handler.
- Process-local limits/caches reset on restart and are not shared across Next processes. Cookie signing is not encryption or database-backed revocation.
- The current checkout also contains unrelated work. Review git status, this guide and AGENTS before resuming. Stage only relevant files/hunks and leave external Nginx/Django changes and new services out unless separately requested.
