# Auth, Session, and Shop-Domain Audit Implementation Plan

## Intent

This guide captures the repository-level auth scan and the implementation plan for hardening login, logout, session revalidation, token handling, and the `.shop` auth experience.

The codebase currently uses `codexchristi.org` and `codexchristi.shop` strings. If the production brand/domain is `codexcuriosity.*`, apply the same findings to the equivalent domain configuration and avoid keeping hard-coded domain literals in components.

The target constraints are:

- Stay inside the current Next.js + Django API architecture.
- Do not add Redis or a separate session service.
- Keep the VPS footprint small.
- Make the `.shop` domain work through the existing Nginx prefixing model.
- Avoid exposing access or refresh tokens to browser JavaScript.

## Scan Summary

Commands run during this audit:

- `rg` scans for auth, signin, signup, logout, session, refresh, token, redirect, cookie, host, and shop-domain usage.
- Direct file reads for middleware, session helpers, auth pages, auth hooks, profile/shop account components, Django fetchers, route handlers, and provider/store hydration.
- `yarn lint`
- `yarn tsc --noEmit`
- `yarn build`

Verification result:

- `yarn lint`: passed.
- `yarn tsc --noEmit`: passed.
- `yarn build`: passed.

Important interpretation: these issues are runtime/security/design issues. The current compiler and lint setup will not catch most of them.

## Edge Proxy Contract

The `.shop` deployment is not a separate Next app route root. Nginx maps public `.shop` requests into the internal `/shop` subtree:

```nginx
location / {
  proxy_pass http://app/shop$request_uri;
  proxy_cache storefront_microcache;
}
```

Expected public-to-internal mapping:

| Public `.shop` URL | Internal Next path |
| --- | --- |
| `/` | `/shop/` |
| `/account-overview` | `/shop/account-overview` |
| `/auth/login` | `/shop/auth/login` |
| `/auth/signup` | `/shop/auth/signup` once implemented |
| `/auth/verify-otp` | `/shop/auth/verify-otp` once implemented |
| `/auth/forgot-password` | `/shop/auth/forgot-password` once implemented |
| `/auth/reset-password` | `/shop/auth/reset-password` once implemented |

This means `/auth/login` on the public `.shop` domain can be valid even though the Next repo only has `/shop/auth/login`.

Required Nginx assumptions:

- Preserve the incoming host, for example `proxy_set_header Host $host;`.
- Preserve the incoming protocol, for example `proxy_set_header X-Forwarded-Proto $scheme;`.
- Do not cache auth, account, checkout, API, or cookie-bearing responses.

If `www.codexchristi.shop` is served and not redirected to the apex, the app's exact host checks will currently miss it.

## Current Runtime Flow

### Login

Files:

- `src/components/UI/Auth/SignIn/SignIn.tsx`
- `src/lib/hooks/authHooks/useLogin.ts`
- `src/actions/login.ts`
- `src/lib/session/main-session.ts`

Current behavior:

- Browser posts email/password directly to Django `/auth/user-login`.
- Django returns `access` and `refresh` tokens to browser JavaScript.
- Browser calls the `createLoginSession` server action with both tokens.
- `createSession` decodes the Django JWTs and creates two cookies:
  - `session`, expiring at access-token expiry.
  - `refreshToken`, expiring at refresh-token expiry.
- The cookie payloads contain the raw Django access and refresh tokens.

### Middleware Protection

Files:

- `src/proxy.ts`
- `src/lib/middlewares/auth-middleware.ts`
- `src/lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector.ts`
- `src/lib/session/request-session.ts`

Current behavior:

- `/profile` and `/shop/account-overview` are protected by checking only the `session` cookie.
- `/shop/auth/login` redirects authenticated users back to account overview.
- If the `session` cookie is expired or invalid, middleware clears cookies only in some redirect paths.
- The `refreshToken` cookie is not used to refresh access before redirecting to login.

### Logout

Files:

- `src/actions/logout.ts`
- `src/app/api/logout/route.ts`
- `src/components/UI/profile/ProfileSidebar.tsx`
- `src/components/UI/profile/ProfileMobileNav.tsx`

Current behavior:

- Profile UI imports `logoutUser` into client components.
- `logoutUser` retrieves the server refresh token and posts it to Django from the browser-side path.
- Local cookies are deleted only after Django logout succeeds.
- `/api/logout` does the safer thing: it reads the refresh token server-side, attempts Django logout, deletes local cookies even on error, and redirects.
- `/next-api/logout` works because `next.config.mjs` rewrites `/next-api/:path*` to `/api/:path*`.

### Signup and OTP

Files:

- `src/app/auth/signup/page.tsx`
- `src/components/UI/Auth/SignUp/index.tsx`
- `src/components/UI/Auth/SignUp/SignUpForm.tsx`
- `src/lib/hooks/authHooks/useSignUp.ts`
- `src/components/UI/Auth/VerifyOTP/VerifyOTP.tsx`
- `src/lib/hooks/authHooks/useVerifyOTP.ts`

Current behavior:

- Main `.org` signup exists at `/auth/signup`.
- `.shop` login shows a signup link to `https://codexchristi.org/auth/signup?redirect=<current-shop-url>`.
- The signup hook ignores that `redirect` query.
- OTP verification redirects to `/auth/sign-in`.
- Because cookies are host-only, a session created on `.org` does not authenticate `.shop`.

### Profile and Shop Account Data

Files:

- `src/lib/funcs/userProfileFetchers/getUser.ts`
- `src/lib/funcs/user-shop.ts`
- `src/lib/funcs/user-wishlist.ts`
- `src/components/UI/profile/Edit/EditProfileSubmitButton.tsx`
- `src/app/shop/account-overview/shipping-address/_components/shipping-address-modal.tsx`

Current behavior:

- Server fetchers read the `session` cookie and use its access token.
- If Django returns `401`, `403`, or `404`, the fetchers redirect to `/next-api/logout`.
- Client-side profile-edit and shipping-address code asks the server for the access token, then sends browser requests with `Authorization: Bearer <token>`.
- There is no refresh-before-request path.

## Confirmed Findings

### P0: Browser JavaScript Can Receive Raw Tokens

The current design exposes tokens to the browser in multiple paths:

- `useLogin.ts` receives access and refresh tokens directly from Django.
- `actions/logout.ts` can retrieve the refresh token and use it from a client-triggered path.
- `EditProfileSubmitButton.tsx` retrieves the access token and sends a browser PATCH.
- `shipping-address-modal.tsx` retrieves the access token and sends a browser PATCH.

Impact:

- `httpOnly` cookies no longer provide meaningful token secrecy if server actions return token values to client code.
- Any XSS, malicious extension, browser devtools exposure, or accidental client logging can expose live Django tokens.

Implementation direction:

- Browser code should never receive access or refresh tokens.
- Move token-bearing Django calls behind Next route handlers or server actions that return only sanitized data.
- Keep token reads in `server-only` modules.

### P0: Refresh Token Is Stored but Not Used for Revalidation

Files:

- `src/lib/hooks/authHooks/useRefreshToken.ts` is empty.
- `src/lib/session/session-state.ts` computes `expiresSoon`, but no flow consumes it.
- `src/lib/middlewares/auth-middleware.ts` checks only access-session validity.
- Server fetchers logout immediately on backend unauthorized responses.

Impact:

- A user with a valid refresh token is treated as logged out when the access cookie expires.
- "Auto logout" can feel random because access expiry, backend expiry, and Zustand state are not coordinated.

Implementation direction:

- Add a refresh-aware session layer.
- Confirm the Django refresh endpoint path and response shape.
- On protected route access:
  - If access session is valid, continue.
  - If access session is expired but refresh is valid, refresh through Django, set new cookies, and redirect back to the same safe path.
  - If refresh fails, clear local cookies and redirect to the correct login route.

### P0: Logout Does Not Always Clear Local Session

File:

- `src/actions/logout.ts`

Current problem:

- If no refresh token exists, it throws before deleting local cookies.
- If Django logout fails, local cookies are not deleted.
- Profile UI calls this path instead of the safer `/api/logout` route.

Impact:

- User can remain locally authenticated after a failed logout call.
- Zustand profile state can remain stale.

Implementation direction:

- Replace client logout helper with a request to `/api/logout` or an equivalent server action.
- Always delete local `session` and `refreshToken` cookies in a `finally` path.
- Attempt Django token blacklist/revocation, but do not let backend logout failure prevent local logout.

### P1: `.shop` Signup Flow Is Missing

Files:

- `src/app/shop/auth/login/page.tsx`
- `src/components/UI/Auth/SignIn/SignIn.tsx`
- `src/lib/hooks/authHooks/useSignUp.ts`
- `src/lib/hooks/authHooks/useVerifyOTP.ts`
- `src/lib/hooks/authHooks/usePasswordReset.ts`

Current problem:

- `.shop` has `/shop/auth/login`, but not signup, verify OTP, forgot password, or reset password equivalents.
- `.shop` signup link sends users to `.org`.
- `.org` signup does not return to `.shop`, and `.org` cookies do not authenticate `.shop`.

Implementation direction:

- Add shop auth pages under:
  - `src/app/shop/auth/signup/page.tsx`
  - `src/app/shop/auth/verify-otp/page.tsx`
  - `src/app/shop/auth/forgot-password/page.tsx`
  - `src/app/shop/auth/reset-password/page.tsx`
- On the public `.shop` domain, link to `/auth/signup`, `/auth/verify-otp`, `/auth/forgot-password`, and `/auth/reset-password`; Nginx will map those to `/shop/auth/*`.
- Make shared auth components route-aware so `.org` still uses `/auth/sign-in`, while `.shop` uses `/auth/login`.

### P1: Host and Path Logic Is Hard-Coded and Fragile

Files:

- `src/lib/middlewares/auth-middleware.ts`
- `src/lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector.ts`
- `src/components/UI/Auth/SignIn/SignIn.tsx`
- `src/components/UI/Shop/HelperComponents/CustomShopLink.tsx`
- `src/lib/hooks/useShopRouter.ts`

Current problem:

- Host checks use exact `codexchristi.shop` in some places and `.includes('codexchristi.shop')` in others.
- `www.codexchristi.shop` is not consistently handled.
- The public `.shop` `/auth/login` to internal `/shop/auth/login` mapping is implicit in Nginx, not encoded as a shared app contract.
- `getSafeAdminReturnPath` is used by general login logic even though it only permits `/admin` paths.

Impact:

- Redirect behavior differs between apex, `www`, local, and direct-app testing.
- Return-to-login behavior only works correctly for admin paths.

Implementation direction:

- Add a small route/domain helper module.
- Normalize host from `x-forwarded-host` or `host`.
- Treat apex and `www` consistently.
- Add a general safe return-path allowlist for auth flows:
  - `/profile`
  - `/shop/account-overview`
  - `/shop/account-overview/*`
  - public `.shop` equivalents like `/account-overview`
  - `/admin/*` through the existing admin sanitizer

### P1: Protected Route Redirects Do Not Preserve Return Path

File:

- `src/lib/middlewares/auth-middleware.ts`

Current problem:

- `redirectExpSessionToLoginPage` redirects to login with `sessionExp=true`, but no `next` or `returnTo`.
- After login, `useLogin` can only honor `next` if `getSafeAdminReturnPath` accepts it, which currently means admin-only.
- `.shop` login falls back to `document.referrer` or `/`, which is unreliable.

Implementation direction:

- Protected-route middleware should include a sanitized `next`.
- Login should redirect to that safe path after successful session creation.
- For public `.shop`, the external `next` should be `/account-overview` while the internal Next path remains `/shop/account-overview`.

### P1: Signed Session Cookies Are Not Encrypted

Files:

- `src/lib/session/main-session.ts`
- `src/lib/session/request-session.ts`

Current problem:

- `encrypt()` signs a JWS with `HS256`; it does not encrypt payload contents.
- The cookie payload includes raw Django access and refresh tokens.
- If a cookie value leaks, the payload can be decoded even though it cannot be forged.

Implementation direction:

- Either rename the helpers to `signSessionToken`/`verifySessionToken` and stop storing backend tokens in the payload, or switch to real JWE encryption.
- With no Redis/session DB, JWE is the practical low-infrastructure option.
- Use a strong `SESSION_SECRET` and validate it at startup.

### P1: Auth/Account Pages Must Not Be Microcached

Edge context:

- `.shop` uses a broad `location /` with `proxy_cache storefront_microcache`.

Risk:

- If auth/account/API paths or cookie-bearing responses are cached, one user's response can be served to another user.

Implementation direction:

- In Nginx, bypass and avoid storing cache for:
  - `/auth/*`
  - `/account-overview*`
  - `/checkout*`
  - `/api/*`
  - `/next-api/*`
  - any request with `session`, `refreshToken`, or admin-session cookies
- In Next route handlers for auth/session/logout, set `Cache-Control: no-store`.

Suggested Nginx guard:

```nginx
set $skip_cache 0;

if ($request_uri ~* "^/(auth|account-overview|checkout|api|next-api)(/|\\?|$)") {
  set $skip_cache 1;
}

if ($http_cookie ~* "(session|refreshToken|adminSession)") {
  set $skip_cache 1;
}

proxy_cache_bypass $skip_cache;
proxy_no_cache $skip_cache;
add_header X-Cache-Status $upstream_cache_status always;
```

Adjust the admin cookie name to the actual value from `src/lib/admin/admin-config.ts`.

### P2: Client Auth State Can Become Stale

Files:

- `src/stores/authStore.ts`
- `src/components/UI/Providers/LoggedinProvider.tsx`
- `src/components/UI/Shop/Nav/ShopProfileAvatarHydrated.tsx`
- `src/stores/userMainProfileStore.ts`
- `src/stores/shop_stores/use-user-shop-profile.ts`

Current problem:

- Zustand state is synchronized after idle or delayed hydration.
- It is not the source of truth for route protection, but it affects UI state.
- Profile data is persisted with a `NEXT_PUBLIC_*` encryption key, which means encryption is obfuscation, not secrecy.

Implementation direction:

- Treat server cookies/session as the only auth source of truth.
- Use `/api/auth/session` or a server action that returns only `{ isAuthenticated, userId }`.
- Clear all auth-adjacent persisted stores on server-side logout by returning a redirect target that client code can follow and then clearing client stores, or by making logout a client wrapper around a server route plus local store clearing.

### P2: Direct Public Django Base URL Is Used in Server Code

Files:

- `src/lib/funcs/userProfileFetchers/getUser.ts`
- `src/lib/funcs/user-wishlist.ts`
- `src/actions/logout.ts`
- `src/app/api/logout/route.ts`

Current problem:

- Some server code still uses `NEXT_PUBLIC_DJANGO_API_BASE_URL`.
- `src/lib/django/getServerDjangoApiBaseUrl.ts` already exists and supports `DJANGO_INTERNAL_BASE_URL`.

Implementation direction:

- Use `getServerDjangoApiBaseUrl()` in server-only code.
- Keep public Django URL usage only in browser-safe public auth calls if those remain direct.

## Implementation Plan

### Phase 1: Make Domain and Return-Path Routing Explicit

Create a helper, for example:

- `src/lib/auth/domain-routing.ts`

Responsibilities:

- Normalize `host`, `x-forwarded-host`, and optional port.
- Detect shop hosts:
  - `codexchristi.shop`
  - `www.codexchristi.shop`
  - local aliases used for shop testing
- Detect org hosts:
  - `codexchristi.org`
  - `www.codexchristi.org`
- Convert between public shop paths and internal shop paths:
  - public `/account-overview` <-> internal `/shop/account-overview`
  - public `/auth/login` <-> internal `/shop/auth/login`
- Build auth paths:
  - login
  - signup
  - verify OTP
  - forgot password
  - reset password
  - logout
- Sanitize non-admin auth return paths.

Then update:

- `src/lib/middlewares/auth-middleware.ts`
- `src/lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector.ts`
- `src/components/UI/Auth/SignIn/SignIn.tsx`
- `src/lib/hooks/authHooks/useLogin.ts`
- `src/components/UI/Shop/HelperComponents/CustomShopLink.tsx`
- `src/lib/hooks/useShopRouter.ts`

Do this before adding more auth pages. Otherwise the duplicated pages will repeat the current path drift.

### Phase 2: Stop Returning Tokens to Browser Code

Refactor the session/Django boundary:

- Add a server-only Django auth client, for example `src/lib/auth/django-auth-client.ts`.
- Keep all token reads inside server-only code.
- Add server actions or route handlers for:
  - password login
  - logout
  - profile update
  - shop shipping-address update
  - authenticated profile/shop reads if needed

Replace:

- `useLogin.ts` direct Django token call with a server action that returns sanitized `{ success, redirectTo, message }`.
- `actions/logout.ts` client token path with a redirect or fetch to `/api/logout`.
- `EditProfileSubmitButton.tsx` browser bearer PATCH with a server action.
- `shipping-address-modal.tsx` browser bearer PATCH with a server action.

Security rule:

- No client component should import `getServerAccessToken` or `getServerRefreshToken`.
- Those functions should be `server-only` and not callable from browser-triggered server actions that return token values.

### Phase 3: Implement Refresh-Aware Session Revalidation

First confirm the Django refresh endpoint and response shape. This repo does not currently contain a refresh endpoint reference.

Expected shape will likely be one of:

- request: `{ refresh: string }`
- response: `{ access: string }`
- or response: `{ access: string, refresh: string }` if refresh rotation is enabled

Add a pure cookie builder:

- Given access and refresh tokens, return signed/encrypted cookie values and expiry dates.
- It must be usable from:
  - server actions via `cookies().set`
  - route handlers via `response.cookies.set`
  - middleware via `NextResponse.cookies.set`

Middleware behavior for protected routes:

1. If access session is valid: `NextResponse.next()`.
2. If access is missing/expired and refresh is missing/invalid: clear cookies and redirect to correct login with safe `next`.
3. If access is missing/expired and refresh is present:
   - Call Django refresh.
   - Set new cookies.
   - Redirect back to the same safe URL once, so the next request has fresh cookies.
   - If refresh fails, clear cookies and redirect to login.

Use a loop guard query param or response header so a failed refresh cannot redirect endlessly.

Server-side authenticated fetch behavior:

- Try access token once.
- On `401`, call the same refresh helper when the current execution context can set cookies.
- If refresh cannot be performed in that context, redirect to the refresh route or logout route.
- Do not silently return null for auth failures on pages where auth is required.

### Phase 4: Fix Logout End-to-End

Replace client logout with a server-owned path:

- Preferred browser action: `window.location.assign('/api/logout')` or a small `POST /api/logout`.
- Server route:
  - read refresh token server-side
  - attempt Django logout/blacklist
  - always delete local cookies
  - redirect to the correct login page for the current host
  - set `Cache-Control: no-store`

For `.shop`, public redirect should be:

- `/auth/login?from-logout=true`

Nginx will map that to internal `/shop/auth/login`.

For `.org`, redirect should be:

- `/auth/sign-in?from-logout=true`

Client-side stores:

- After route-based logout, clear Zustand persisted stores on the login page when `from-logout=true`, or keep a tiny client logout wrapper that clears stores first and then navigates to `/api/logout`.

### Phase 5: Add Native `.shop` Signup and Recovery Pages

Add pages:

- `src/app/shop/auth/signup/page.tsx`
- `src/app/shop/auth/verify-otp/page.tsx`
- `src/app/shop/auth/forgot-password/page.tsx`
- `src/app/shop/auth/reset-password/page.tsx`

Refactor shared auth components to accept an auth surface:

```ts
type AuthSurface = 'org' | 'shop';
```

Or derive the surface from the current host using the route helper.

Rules:

- On `.org`, login path is `/auth/sign-in`.
- On `.shop`, login path is public `/auth/login`, internal `/shop/auth/login`.
- On `.org`, signup path is `/auth/signup`.
- On `.shop`, signup path is public `/auth/signup`, internal `/shop/auth/signup`.
- OTP verification should return to the matching login path with a safe `next`.
- Forgot/reset password should stay on the same domain.

Change the `.shop` sign-in "Sign Up" link:

- From: `https://codexchristi.org/auth/signup?redirect=<shop-url>`
- To: `/auth/signup?next=<safe-shop-return-path>`

### Phase 6: Harden Session Cookie Format

Improve `src/lib/session/main-session.ts`:

- Validate `SESSION_SECRET` exists and is strong enough.
- Stop calling JWS signing `encrypt`.
- Prefer JWE if raw backend tokens must remain in cookies.
- Add a typed session payload with version:

```ts
type SessionPayloadV1 = {
  version: 1;
  userID: string;
  mainAccessToken: string;
};
```

Refresh payload:

```ts
type RefreshPayloadV1 = {
  version: 1;
  mainRefreshToken: string;
};
```

Keep cookies:

- `httpOnly: true`
- `secure: process.env.NODE_ENV === 'production'` unless a documented HTTPS dev setup requires otherwise
- `sameSite: 'lax'`
- `path: '/'`
- host-only, unless there is a deliberate reason to share across subdomains

Do not set a cookie domain that shares `.org` and `.shop`; browsers cannot share cookies across different registrable domains anyway.

### Phase 7: Update Protected Route Coverage

Current protected routes:

- `/profile`
- `/shop/account-overview`
- `/shop/account-overview/*`
- `/admin/*`

Review intended protection for:

- `/shop/my-wishlist`
- `/shop/account-overview/wishlist`
- `/shop/account-overview/shipping-address`
- `/shop/account-overview/order-history`
- checkout recovery/account-specific paths

The nav currently links the heart icon to `/shop/my-wishlist`, while the protected account wishlist route is `/shop/account-overview/wishlist`. Decide whether `/shop/my-wishlist` is a guest wishlist placeholder or should redirect into the protected account area.

### Phase 8: Add Tests and Manual Verification

No test runner is currently configured. Keep this lightweight unless a runner is added later.

Minimum automated checks:

- `yarn lint`
- `yarn tsc --noEmit`
- `yarn build`

Add route-helper unit checks if a test runner is introduced. Until then, create a tiny script using `tsx` only if needed.

Manual scenarios:

1. `.org` unauthenticated `/profile` redirects to `/auth/sign-in?next=/profile`.
2. `.org` login returns to `/profile`.
3. `.org` authenticated user visiting `/auth/sign-in` redirects to intended profile/admin return path.
4. `.shop` unauthenticated `/account-overview` redirects to `/auth/login?next=/account-overview`.
5. `.shop` login returns to `/account-overview`.
6. `.shop` signup starts at `/auth/signup`, verifies OTP at `/auth/verify-otp`, then returns to `/auth/login`.
7. `.shop` forgot/reset password stays on `.shop`.
8. Expired access token plus valid refresh token refreshes and returns to original route.
9. Expired/invalid refresh token clears cookies and redirects to the correct login route.
10. Logout with a missing refresh token still clears local cookies.
11. Logout with Django logout failure still clears local cookies.
12. `www.codexchristi.shop` either redirects to apex or behaves identically.
13. Nginx returns no cached auth/account response when cookies are present.

Useful curl checks behind the proxy:

```bash
curl -I https://codexchristi.shop/account-overview
curl -I https://codexchristi.shop/auth/login
curl -I https://codexchristi.shop/auth/signup
curl -I https://codexchristi.org/auth/sign-in
```

Check for:

- expected `Location`
- `Cache-Control: no-store` on auth/logout/session endpoints
- no `X-Cache-Status: HIT` on auth/account responses

## Suggested Implementation Order

1. Add route/domain helper and safe return-path helper.
2. Update middleware to use helper and preserve `next`.
3. Fix logout to be server-owned and always clear cookies.
4. Move profile edit and shipping-address update behind server actions.
5. Move login behind a server action so tokens never return to client code.
6. Add refresh-aware session handling.
7. Add `.shop` signup/OTP/password-reset pages.
8. Convert signed token cookies to JWE or remove raw backend tokens from cookie payloads.
9. Add Nginx cache bypass rules for auth/account/API/cookie requests.
10. Run the manual verification matrix.

## Open Questions Before Coding

- What is the Django refresh endpoint path and response body?
- Does Nginx currently set `Host` and `X-Forwarded-Proto` headers?
- Does `www.codexchristi.shop` redirect to apex, or should the app support both?
- Are `/shop/my-wishlist` and `/shop/account-overview/wishlist` both intentional?
- Should successful `.shop` signup automatically send users to login, or should it continue to the originally requested protected path after login?

## Files Most Likely To Change

Core:

- `src/lib/session/main-session.ts`
- `src/lib/session/request-session.ts`
- `src/lib/session/server-session.ts`
- `src/lib/session/session-state.ts`
- `src/lib/middlewares/auth-middleware.ts`
- `src/lib/middlewares/codexchristi.shop/authVerifierAndRouteProtector.ts`
- `src/proxy.ts`

New helper candidates:

- `src/lib/auth/domain-routing.ts`
- `src/lib/auth/safe-return-path.ts`
- `src/lib/auth/django-auth-client.ts`
- `src/lib/auth/session-cookie-writer.ts`

Auth UI:

- `src/components/UI/Auth/SignIn/SignIn.tsx`
- `src/components/UI/Auth/SignUp/index.tsx`
- `src/components/UI/Auth/SignUp/SignUpForm.tsx`
- `src/components/UI/Auth/VerifyOTP/VerifyOTP.tsx`
- `src/components/UI/Auth/ForgotPassword/ForgotPassword.tsx`
- `src/components/UI/Auth/ResetPassword/ResetPassword.tsx`
- `src/lib/hooks/authHooks/useLogin.ts`
- `src/lib/hooks/authHooks/useSignUp.ts`
- `src/lib/hooks/authHooks/useVerifyOTP.ts`
- `src/lib/hooks/authHooks/usePasswordReset.ts`

Shop auth pages to add:

- `src/app/shop/auth/signup/page.tsx`
- `src/app/shop/auth/verify-otp/page.tsx`
- `src/app/shop/auth/forgot-password/page.tsx`
- `src/app/shop/auth/reset-password/page.tsx`

Authenticated mutations:

- `src/components/UI/profile/Edit/EditProfileSubmitButton.tsx`
- `src/app/shop/account-overview/shipping-address/_components/shipping-address-modal.tsx`
- `src/lib/funcs/userProfileFetchers/getUser.ts`
- `src/lib/funcs/user-shop.ts`
- `src/lib/funcs/user-wishlist.ts`

Logout:

- `src/actions/logout.ts`
- `src/app/api/logout/route.ts`
- `src/components/UI/profile/ProfileSidebar.tsx`
- `src/components/UI/profile/ProfileMobileNav.tsx`

Edge config:

- Nginx site config for `codexchristi.shop`
- `next.config.mjs` only if rewrites need to become more explicit
