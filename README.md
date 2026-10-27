## Codex Christi

### A platform for Christian Creatives

[![Push to main](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml/badge.svg)](https://github.com/Codex-Christi/codex_christi_frontend/actions/workflows/push-to-main.yml)

### Authentication

Both shop addresses use the same Next authentication code. Start with the
[authentication implementation guide](Future%20Implementation%20Guides/nextjs-auth-shop-integration-hardening-plan.md)
for routing, server/client boundaries, tests, deployment and remaining proxy work.
The [original audit index](Future%20Implementation%20Guides/auth-session-shop-domain-audit-and-implementation-plan.md)
is historical, not a second implementation plan.

### Storefront Rendering

Product metadata and the gallery render before destination-verified options arrive.
`productOptionLayout.ts` derives compact, display-only layout hints from the offline
snapshot during ISR generation. The loading placeholders and live selectors share
the same option ordering and geometry. An invisible, inert sizing layer preserves
space when destination verification returns fewer options or an error. It is not
availability or price evidence and cannot enable purchases.

There is no fixed-height options panel or hidden overflow. A missing snapshot uses
a generic placeholder, and genuinely new options can still increase its height.
The canonical selector is `VariantAttributeSelector`; the server page structure is
`ProductDetailsShell`. Size and colour ordering live in `productOptionLayout.ts`.

### About Hero Assets

Keep `public/media/img/about-hero.svg`: it is the original, not a redundant asset.
`about-hero.optimized.svg` retains its exact drawing instructions, viewBox, rotation,
dimensions, and transparency for mobile. Only its embedded photo changes from JPEG to AVIF.
Compression happens offline, with no client-side detection or runtime encoding.
The existing server-rendered `next/image` keeps the same crop and reserved height.
Its new URL avoids reusing cached bytes from the original asset.
The About page opts into `navAppearance='glass'` on `DefaultPageWrapper` for a dark,
blurred navigation backdrop. Other pages retain the transparent default. A darker
solid backdrop covers browsers without backdrop-filter support; no extra nav
margin, positioning, or client-side appearance switch is introduced.

Desktop selects `about-hero.desktop.svg` through a native media-qualified picture
source. It reveals the full embedded photo rather than enlarging the short mobile
crop. `AboutHero.module.css` bottom-aligns the art and blends it into black through
the open space above the staircase cards. The header's flow height and the cards'
positions remain unchanged. There is no resize effect or extra mobile download.
The larger background planet already extends beyond the source artwork; this
treatment avoids an additional hard bottom edge, not inventing missing pixels.
The full desktop scene deliberately carries more image data than the short mobile
crop. Its full-source SSIM is 0.9967; mobile keeps the smaller asset. The frame is
reserved by CSS before paint, not measured or resized after hydration.

Check rendered similarity when regenerating this asset.
Compare against the original SVG at mobile and desktop sizes and densities, not
only against a rasterized intermediate. Preserve the crop, font positioning, and
transparency, and check that a cold navigation downloads one hero format only.
Encoder settings, hashes, rejected candidates, and eight rendered comparisons are
recorded in the image report. The threshold is SSIM >= 0.995; SSIM is not a claim
that a particular percentage of visual quality is retained. Keep the SVG geometry
when recompressing: rasterizing and resizing it again changed the original framing
and sampling. The embedded AVIF targets the modern browsers supported by Next.js;
do not substitute it for the original in tools requiring a JPEG-only SVG decoder.
Changing generated image bytes requires versioned URLs or purging the exact media
URLs after deployment; ISR invalidation does not purge an external asset cache.

### Verification

Use Yarn and keep the default production build on Turbopack:

```sh
yarn build
yarn lint
yarn tsc --noEmit --pretty false
yarn node --import tsx --test scripts/image-compression.test.ts scripts/storefront*test.ts src/lib/merchizeStorefront/productOptionLayout.test.ts
```

Use isolated standalone build copies for browser comparisons so another build
cannot replace CSS or JS midway through an audit. Reject runs with failed
document, stylesheet, script, or LCP-image requests. Record at least three runs
per device profile and compare medians on the same host. Localhost scores are not
proof of a production improvement. For CLS checks, delay the options response and
test full, filtered, and failed responses before interacting with the page.
The audit also records a separate small About-page font-substitution shift; image
compression and the product-options layout fix do not eliminate global font swaps.

- [Performance measurements and remaining work](reports/storefront/performance-audit.json)
- [Team portrait fidelity evidence](reports/storefront/image-compression.json)
- [About hero fidelity evidence](reports/storefront/about-hero-compression.json)
