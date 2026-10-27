## Codex Christi

### A platform for Christian Creatives

[![Push to main](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml/badge.svg)](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml)

### Authentication

Both shop addresses use the same Next authentication code. Start with the
[authentication implementation guide](Future%20Implementation%20Guides/nextjs-auth-shop-integration-hardening-plan.md)
for routing, server/client boundaries, tests, deployment and remaining proxy work.
The [original audit index](Future%20Implementation%20Guides/auth-session-shop-domain-audit-and-implementation-plan.md)
is historical, not a second implementation plan.

### Storefront

Start with the [storefront rendering and images guide](Future%20Implementation%20Guides/STOREFRONT_RENDERING_AND_ASSETS_GUIDE.md).
It explains the shared and page-specific CSS, product-option loading layout,
mobile/desktop artwork, safe editing points, and measurement records. Original
images are retained. Run `yarn test:storefront` for the existing regression checks.

### Release Checks

The [deployment guide](devScripts/README.md) covers release verification and
production readiness checks.
