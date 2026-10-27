# Authentication And Shop Login Implementation Guide

Updated 2026-10-27. This is the canonical guide; the [original audit index](./auth-session-shop-domain-audit-and-implementation-plan.md) preserves the investigation context. Paths are repository-relative unless absolute.

## Scope And Decisions

- Keep `codexchristi.org/shop` and `codexchristi.shop` working with one Next application.
- Use the existing production Django APIs. No Django edits, database migrations, Redis or extra container are included. The proposed Nginx replacement below is not yet deployed.
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
8. Concurrent refreshes share a bounded in-process promise cache. Logout cancels matching in-process refreshes; this does not coordinate multiple processes or eliminate every late Set-Cookie race.
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
npm run build:webpack
```

Current checks, 2026-10-27:

| Check | Coverage / result |
| --- | --- |
| Auth regression tests | The auth-only copy passes 68 tests, including reset cookie expiry/client cleanup, unchanged sessions on failure, cold-load outage routing and the deployment test gate. The command discovers all auth/session tests automatically and includes existing wishlist checks. Tests use fake data, not a live database. |
| TypeScript and targeted ESLint | Pass for the auth-only copy. The shared checkout has separate, concurrent checkout work; its validation results must be checked independently. |
| Isolated production webpack build | Pass over the committed baseline with only the auth changes. Checked private session helpers are absent from its public action manifest. Public catalog pages remain static. |
| Production-build browser checks | Account loading skips the extra startup session request. During a simulated refresh outage, expiry hides account details and edit drawers. Retry restores the same unsaved address; explicit close/reopen restores the saved address. No console errors/warnings. |
| Reset and outage integration checks | The local fake API confirms successful reset expires four cookie headers and requires login; GET reset returns 405. Opening an account during an outage redirects to an uncached outage page. Browser Retry returns to the saved destination; Logout reaches login even when Django logout fails. |
| Earlier form/login browser checks | Invalid submissions, return destinations, Register links and Logout passed. The user also confirmed their real account page loads. |

The `verify` job in `.github/workflows/push-to-main.yml` now runs `yarn test:auth` before deployment. The deploy job depends on that job succeeding; no production credentials or backend/database access are needed by the auth tests. Keep this test step when changing the workflow.

Keep the regression tests. Temporary browser fixtures and demo data are not application files and must not be committed. No real credentials, account creation, reset email or profile/address write were submitted by the agent.

Before committing, test the staged files in a separate copy and inspect the action manifest for exposed private helpers. Do not share a build directory with another running task. The copy reuses local dependencies; it is not a test of a self-contained container package. These checks do not prove production Nginx behavior or a measured speed increase. Keep the existing route CSS imports described in the [Storefront CSS guide](../README.md#storefront-css).

## Deployment Checklist

- [ ] Make a strong SESSION_SECRET of at least 32 bytes available in the Next container; never use a test key.
- [ ] Announce the one-time fresh sign-in: version-2 cookies deliberately reject old cookies from the previous unsafe helper boundary. Do not migrate by trusting their user ID.
- [ ] Build with the real production public-site URL, and the intended internal Django URL. Development normally prefers the public API URL; internal preference is explicit or production-only.
- [ ] Keep `/next-api` routed to Next on both hosts and preserve trusted public Host/protocol headers. Do not disable same-origin checks to work around proxy errors.
- [ ] Validate the Nginx replacement below inside the actual container before applying it. Recreate only Nginx during a brief maintenance window to read the new file and clear its old HTML cache. Purge affected Cloudflare HTML entries separately if applicable.
- [ ] With disposable accounts behind HTTPS, verify both shop addresses, recovery, profile/address save past access expiry, invalid refresh, outages, two same-origin tabs and two independent devices.
- [ ] During an outage, leave a dirty profile/address drawer open through access expiry: it must disappear while unverified and return unchanged after same-account recovery. Confirm actual logout and switching accounts discard the previous draft. Confirm hidden tabs do not retry continuously and exhausted retries require Retry or a later focus check.
- [ ] Also open an expired session directly during an outage: confirm the temporary redirect preserves the requested destination, both responses prohibit caching, and Retry/Logout work on both shop addresses and the main profile. After a successful password reset, confirm the same browser lands on login, its other same-domain tabs clear private details, and its former admin unlock is gone. Failed resets must leave its current session intact.
- [ ] Confirm actual Django lifetimes, refresh rotation, logout scope and password-reset revocation before claiming those behaviors. Verify parallel refresh in every deployed Next process/container.

## Nginx Configuration

The single proposed replacement is [production.conf](./nginx-auth-hardening/production.conf). It is a complete configuration, not a `conf.d` snippet. It keeps the original filename, certificates, Docker upstreams, ports, upload limit, cache sizes and shop URL mappings. The original `/Users/devsantorz/Desktop/devProjects/codex-nginx/nginx/production.conf` and its Compose file are untouched; nothing has been deployed.

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
- The cache route/config checks passed locally, but their standalone test file is excluded from the commit at the user's request. The existing committed storefront suite passes 113 tests, and the auth suite passes 71 tests; TypeScript and targeted ESLint also pass. Temporary databases, fixture routes, build copies and benchmark scripts are removed after validation.

Performance used the real homepage and product-page code from committed baseline `ddadb9ba` plus this Next header change, with a synthetic product snapshot and no live API/database credentials. Tests alternated ISR-only and selective Nginx caching twice on four URLs across both domains: 400 requests per run, eight concurrent keep-alive clients, localhost HTTPS. Warm-run median response duration ranged from 5.30-6.93 ms with ISR alone to 1.92-2.44 ms with selective caching. All 3,200 measured selective warm requests hit Nginx after priming.

A separate eight-second product-page run crossed several proxy expirations:

| Mode | Requests | Median | 95th Percentile | Requests Reaching Next |
| --- | --- | --- | --- | --- |
| ISR only | 10,257 | 5.27 ms | 10.84 ms | 10,257 |
| Selective proxy cache + ISR | 27,485 | 1.97 ms | 4.01 ms | 12 |

The selective run recorded 27,473 proxy HITs; the remaining requests reached Next during expiry/refill. These are full-response localhost timings, not TTFB, VPS capacity, browser Web Vitals or an SEO ranking prediction. Tests used one Nginx worker and a 512 MiB Node heap limit, not the production Docker memory/CPU limits. Repeat on the VPS with comparable traffic before changing resource limits.

### Apply On The VPS

Run from the **codex-nginx repository on the VPS**. Stage the replacement at `nginx/proposed/production.conf`, leaving the active `nginx/production.conf` untouched until validation succeeds. Keep the existing Nginx image; do not pull an upgrade. Apply Nginx first, then rebuild/redeploy Next with the updated `next.config.mjs` through the existing deployment workflow. The header rules are compiled at build time. Until the Next opt-in header is present, Nginx safely falls back to ISR-only responses instead of storing HTML.

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
6. Add admin-schema generate/migrate-deploy to `scripts/prisma_production_setup.sh` before deploying new tables; it currently omits that database. Verify development/production DB separation first. Production Prisma client reuse is already fixed.
7. Measure database dependency/latency and test code replay, wrong browser/host, expiry, database outage, simultaneous refresh, logout during refresh and independent-device logout. Public anonymous pages must not start querying this database. A crash after Django rotation but before token storage can still require sign-in.

## Remaining Work And Resume Notes

- Confirm whether PATCH creates a missing Django shop profile; Next must not invent that backend behavior.
- Saved-address deletion, payment information and order history are separate feature work. The existing Delete control has no implemented action. Do not claim a complete order history from partial Next payment records or match private orders by unverified email.
- Wishlist product UI was developed separately. This auth change only adds safe server authentication/refresh and same-origin mutation checks to its existing handler.
- Process-local limits/caches reset on restart and are not shared across Next processes. Cookie signing is not encryption or database-backed revocation.
- The current checkout also contains unrelated work. Review git status, this guide and AGENTS before resuming. Stage only relevant files/hunks and leave external Nginx/Django changes and new services out unless separately requested.
