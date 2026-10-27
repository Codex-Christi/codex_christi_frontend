## Codex Christi

### A platform for Christian Creatives

[![Push to main](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml/badge.svg)](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml)

### Authentication

Both shop addresses use the same Next authentication code. Start with the
[authentication implementation guide](Future%20Implementation%20Guides/nextjs-auth-shop-integration-hardening-plan.md)
for routing, server/client boundaries, tests, deployment and remaining proxy work.
The [original audit index](Future%20Implementation%20Guides/auth-session-shop-domain-audit-and-implementation-plan.md)
is historical, not a second implementation plan.

### Storefront CSS

Shop browsing loads a smaller stylesheet instead of downloading every page's styles:

- `globals.css` and `tailwind.storefront.config.ts`: shared UI, shop home, categories and products.
- `route-utilities.css` and `tailwind.route-utilities.config.ts`: extra styles for home, About,
  authentication, profiles, cart, checkout, account pages and wishlist.
- `admin.css`: the existing admin styles.

Keep extra styles imported at their page or layout boundary, not the root layout.
Include new browsing components in the storefront content paths. Tailwind/shadcn classes
still work normally; no CSS Modules migration is required. Next.js may keep a stylesheet
after client-side navigation, so this split primarily reduces the initial browsing download.
Run `node --import tsx --test scripts/storefront-css.test.ts` to check rule coverage,
route imports and the shared CSS size budget. ISR and data caching are unchanged.

### Storefront Maintenance

Start with the [storefront rendering and images guide](Future%20Implementation%20Guides/STOREFRONT_RENDERING_AND_ASSETS_GUIDE.md).
It explains the loading layout, mobile/desktop artwork, safe editing points, tests,
and measurement records. Original images are retained. Authentication and payment
flows are outside this cleanup.
