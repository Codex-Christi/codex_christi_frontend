# Storefront Rendering and Images

This guide covers product-option layout, About artwork, and the shared storefront
styles. It does not change authentication, checkout, payments, or cache policy.

## How It Works

1. **Show the page first.** The server sends product text and the main image
   without waiting for the full, destination-verified options request.
2. **Reserve room for the options.** Saved size/colour labels tell the page how
   much room its loading placeholders need. The placeholders use the same button
   layout as the real controls, so the purchase buttons do not jump down later.
3. **Use verified results for selection.** Live results replace the placeholders.
   Saved labels are only a layout hint: they cannot establish availability or
   authorize a purchase. Missing hints use a generic placeholder; genuinely new
   options may still need more room. A failed request keeps the retry message.
4. **Let the browser choose the artwork.** About uses a native `<picture>`:
   mobile gets the short crop; desktop gets the fuller, bottom-aligned scene.
   CSS fades that scene behind the staircase cards without moving the cards.
   There is no JavaScript screen-size check or post-load hero resize.

CSS builds a stylesheet from the files listed in `tailwind.storefront.config.ts`.
CSS modules hold component-specific rules. Narrowing Tailwind's file list can
save bytes, but missing a component can remove its styling.

- `globals.css` + `tailwind.storefront.config.ts`: shared UI and shop browsing.
- `route-utilities.css` + `tailwind.route-utilities.config.ts`: extra styles for
  home, About, authentication, profiles, cart, checkout, accounts, and wishlist.
- `admin.css`: the existing admin styles.

Keep extra styles at their page/layout boundary, not the root layout. CSS can stay
loaded after client navigation, so this mainly saves the first browsing download.

## Where to Edit

| Change | File or setting |
| --- | --- |
| About heading or hero image paths | [AboutHero.tsx](../src/components/UI/about/AboutHero.tsx) |
| Desktop scene height, bottom framing, or fade | [AboutHero.module.css](../src/components/UI/about/AboutHero.module.css): `.backdrop` and `.image` |
| Introduction text or team names/photos | [AboutUs.tsx](../src/components/UI/about/AboutUs.tsx): `teamMembers` is the single team list |
| Navbar glass colour and blur | [MainNav.module.css](../src/components/UI/general/MainNav/MainNav.module.css) |
| Which page uses glass | `navAppearance='glass'` in [the About page](../src/app/about-us/page.tsx); other pages default to transparent |
| Size/colour/label groups and ordering | [productOptionLayout.ts](../src/lib/merchizeStorefront/productOptionLayout.ts): `OPTION_GROUPS` and `SIZE_ORDER` |
| Option selection behavior | [VariantAttributeSelector.tsx](../src/components/UI/Shop/ProductDetails/VariantAttributeSelector.tsx) |
| Radio-button and loading-placeholder appearance | [RadioButtonGroupWithText.tsx](../src/components/UI/Shop/ProductDetails/RadioButtonGroupWithText.tsx) |
| Product-gallery image settings | [galleryShared.tsx](../src/components/UI/Shop/ProductDetails/ProductImageGallery/galleryShared.tsx) |
| Product image source and fallback order | [imageUrls.ts](../src/lib/merchizeStorefront/imageUrls.ts): `resolveProductGalleryImages()` |

`getProductOptionGroups()` groups variant options in one pass for both product
details and the category quick-selection popover. It preserves the original
selection objects, group order, and latest metadata for duplicate values.
`getProductOptionLayout()` turns those groups into display labels for the
server's loading layout. Neither function decides price or availability.

Product pages show not-found only for confirmed supplier 404/410 responses.
Temporary failures use a retry screen, or an existing snapshot when available.
Supplier reads have a 15-second deadline; ISR remains unchanged.

One image resolver serves live data, snapshots, and the gallery. Saved variant
photos and usable API galleries come first. Known local artwork is only a last
resort, never a replacement for usable Merchize model photos. Saved images are
for display only and cannot enable purchases or authorize checkout.

The About page stays a small composition of hero, content, navigation, and footer.
`AboutHero` is a Server Component, not an extra client-side widget. Its flow height
remains `20rem`; the taller desktop artwork is only a background layer. The
`<picture>` is positioned relatively so Next's fill image uses that same frame.
Keep its framing in the CSS module: an additional `object-center` utility can
override desktop bottom alignment when stylesheet order changes.

## Keep the Originals

These hero files have different purposes, not duplicate contents:

| File in `public/media/img/` | Purpose |
| --- | --- |
| `about-hero.svg` | Unchanged source artwork. Keep it as the original. |
| `about-hero.optimized.svg` | Mobile crop with its embedded JPEG recompressed to AVIF. |
| `about-hero.desktop.svg` | Full-photo desktop scene with an AVIF bitmap. |

The desktop scene contains more artwork, so it is deliberately larger than the
mobile crop. The large background planet already extends beyond the source
canvas; a fade can soften that edge but cannot recover missing pixels.

For product/category images, reserve image space before loading and match `sizes`
to the displayed width. Prioritize only the leading category image. OG metadata
does not control gallery image sizes. A previous blur comparison showed no useful
render-delay saving, so do not remove the glass treatment based on CSS bytes alone.

Team portraits use small WebP files at 72, 144, and 216 pixels for 1x/2x/3x screens.
Keep their source SVGs too. Compression happens offline, not during page visits.
The SVGs containing AVIF target the modern browsers supported by this Next.js version.

When changing an image:

1. Generate a new compressed file from the preserved original, not from an
   already compressed output. Do not change crop or transparency accidentally.
2. Measure similarity and inspect the result at mobile/desktop sizes and higher
   pixel densities. The current SSIM threshold is `0.995`; that is a similarity
   score, not a percentage of visual quality. Inspect faces and small details too.
3. Record the encoder, source/output hashes, sizes, and fresh comparisons in the
   matching report. Do not update hashes merely to make a failing test pass.
4. Use a new URL when deployed bytes change, or purge that exact media URL from
   external caches. Refreshing product snapshots does not purge media caches.

## Check a Change

Use Yarn and keep the normal Turbopack build:

```sh
yarn lint
yarn tsc --noEmit --pretty false
yarn test:storefront
yarn build
```

The asset tests check current files against the recorded hashes and quality
evidence. They do **not** launch a browser, remeasure SSIM, or prove today's CLS.
The option tests check ordering, preserved selection data, and layout-only output.
The CSS tests check source coverage, route imports, and the shared stylesheet size.

With the browser cache disabled, check About at 412px and 1440px. Confirm one hero
download per page, readable navigation, and unchanged card positions. On a product
page, delay the options response and test success, an unavailable destination, and
failure/retry. Check size/colour selection on both the product page and category
popover. Do not submit a payment as part of these display checks.

For performance comparisons, use the same environment and at least three runs per
device. Reject runs with failed HTML, CSS, JavaScript, or hero-image requests.
Localhost results are not production results. A small About body-font swap remains
recorded separately; image compression does not eliminate font-substitution shifts.

## Measurement Records

- [Performance history and remaining work](../reports/storefront/performance-audit.json)
- [Portrait compression and transparency evidence](../reports/storefront/image-compression.json)
- [Hero similarity, framing, and navbar contrast evidence](../reports/storefront/about-hero-compression.json)
