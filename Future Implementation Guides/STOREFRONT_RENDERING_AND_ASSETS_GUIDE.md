# Storefront Rendering and Images

This guide covers storefront search, saved category pages, product-option layout,
About artwork, and shared styles. Display data never authorizes checkout or payments.

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
| Country-aware option loading and retry | [useProductVariants.ts](../src/lib/hooks/shopHooks/products/variants/useProductVariants.ts) |
| Add to Cart and Buy Now checks | [ProductPurchaseActions.tsx](../src/components/UI/Shop/ProductDetails/ProductPurchaseActions.tsx) |
| Radio-button and loading-placeholder appearance | [RadioButtonGroupWithText.tsx](../src/components/UI/Shop/ProductDetails/RadioButtonGroupWithText.tsx) |
| Product-gallery image settings | [galleryShared.tsx](../src/components/UI/Shop/ProductDetails/ProductImageGallery/galleryShared.tsx) |
| Product image source and fallback order | [imageUrls.ts](../src/lib/merchizeStorefront/imageUrls.ts): `resolveProductGalleryImages()` |
| Search suggestions and keyboard controls | [StorefrontSearchForm.tsx](../src/components/UI/Shop/Nav/StorefrontSearchForm.tsx) |
| Local search projection and submitted supplier search | [searchCatalog.ts](../src/lib/merchizeStorefront/searchCatalog.ts) |
| Category deadlines and payload checks | [categoryDetailsSSR.ts](../src/app/shop/category/[id]/categoryDetailsSSR.ts), [listingPayload.ts](../src/lib/merchizeStorefront/listingPayload.ts) |
| Public product visibility and saved-state filtering | [publication.ts](../src/lib/merchizeStorefront/publication.ts), [publicationSnapshot.ts](../src/lib/merchizeStorefront/publicationSnapshot.ts) |
| Shared supplier-read cancellation and queue limits | [providerReads.ts](../src/lib/merchizeCatalog/providerReads.ts) |

`getProductOptionGroups()` groups variant options in one pass for both product
details and the category quick-selection popover. It preserves the original
selection objects, group order, and latest metadata for duplicate values.
`getProductOptionLayout()` turns those groups into display labels for the
server's loading layout. Neither function decides price or availability.

Product details and category quick-add share `useProductVariants()`. Requests include
the selected delivery country and bypass the browser's HTTP cache. Changing country
immediately hides old options and selections; reopening quick-add checks again.
There is no polling: transient failures get one delayed retry, followed by a visible
retry action. Product details keep their deferred loading so options do not compete
with the first image.

`ProductPurchaseActions` owns the selection checks and submission lock for both
buttons. Buy Now adds one selected item to the existing cart, then opens the normal
checkout. Existing cart items remain included. It never submits a payment or treats
browser price/availability as authoritative; checkout still verifies them on the server.
Failed cart saves keep the selection and do not navigate. Selection, country, product,
or account changes during a save prevent an obsolete checkout navigation.

Product pages show not-found only for confirmed supplier 404/410 responses.
Temporary failures use a retry screen, or an existing snapshot when available.
Supplier reads have a 15-second deadline; ISR remains unchanged.

## Search and Category Reads

Desktop search and the mobile search icon lead to `/shop/search`. Typing suggests
products from the existing local SQLite storefront snapshots, not the supplier
production-SKU catalog or metadata manifest. Prefix and typo matching use the
already-installed `didyoumean2` library. The index and matching code load on first
search-field interaction, not on initial page load. No supplier calls run per keystroke.

Suggestions share one SWR key with 60-second request deduplication and focus
throttling. The index response has a 60-second browser cache and no polling. It
contains only product ID, title, image, and listed price, capped at 1,000 saved
rows; truncated coverage is disclosed. Only explicitly published snapshots are
included, and newer completed removal checks exclude products. Missing snapshots
produce an unavailable response, not a claim that the remote catalog is empty.
Normal product/category reads and admin refreshes update the same SQLite data.
Suggestions cannot discover remote products that have never been saved locally.

Enter or the search button submits a shareable query. Arrow keys and Enter can
open a suggestion; Escape closes suggestions. Submitted search uses the existing
Merchize `/product/products?title=...` endpoint with 15 products per page, a
15-second request deadline, and Next's five-minute fetch cache. Queries are
normalized and capped at 100 characters. Valid published results can populate
the existing display snapshots through awaited writes, never background jobs.
The supplier endpoint was verified against the live store; the public developer
reference documents collection-name search and production-SKU lookup, not a
dedicated customer autocomplete endpoint:
[Merchize API reference](https://seller.merchize.com/a/api-documents).

When submitted search fails temporarily, matching saved results carry an explicit
notice. A confirmed empty supplier search may offer separately labeled similar
products. Search pages are `noindex,follow`; query rendering is dynamic only on
the search page. Product, shop-home, and category ISR settings are unchanged.
Search results and listed prices are not proof of stock, delivery, or checkout price.

Every category supplier hop now has a 15-second deadline, including collection-ID
lookup, metadata, and product listing. A cold lookup followed by a detail read can
therefore take up to two deadlines. Existing fetch revalidation intervals remain.
Responses are checked before mapping products or saving snapshots. Temporary
network/provider failures and malformed payloads may use saved data; confirmed
404/410 or an empty collection search remain not-found. Forced admin refreshes
still fail explicitly rather than silently using saved data.

Saved category pages must have their exact expected positions and row count.
Page freshness uses the oldest row's observation time; refreshing one page does
not renew other pages. Missing pages fetch normally instead of appearing empty.
Saving a page replaces obsolete members in that position range and prunes rows
beyond the supplier total. A confirmed empty listing remains intentionally empty.
No cron, `after()`, schema migration, or checkout-verification change is involved.

## Publication and Cancellation

`publication.ts` separates published, explicitly unpublished, and unknown display
data. Private, inactive, deleted, taken-down, unapproved, and non-active products
are not public listings. Missing legacy flags are unknown, not proof of removal;
checkout still requires its existing complete, fresh publication evidence.

A negative publication observation from strict live verification bypasses the
saved product's normal TTL. A strict live product check can also restore a
republished product. Cached listings cannot immediately override a fresh verified
observation in either direction, and incomplete data cannot clear it.
A confirmed 404/410 on a known saved product leaves a local
removal marker; network failures never create one. These are awaited writes to
the existing SQLite snapshot, not background tasks or a new table.
The publication check and snapshot write share a short SQLite transaction; an older
in-flight positive verification cannot resurrect a newer confirmed removal.

Product display rejects known unpublished records, including during outage
fallback. Homepage previews, category cards, and search omit them too. Metadata
does a small local publication lookup before using the manifest; a known
unpublished product gets noindex metadata without its title, image, or price.
Manifest generation excludes it without recreating a curated fallback, and
includes its route in admin revalidation. Admin metadata diagnostics use the same
rule. Normal published metadata keeps the manifest-first content flow.

Existing ISR lifetimes remain: already-generated HTML is not an instant supplier
webhook. Confirmed state takes effect when the page regenerates or an existing
admin action revalidates it. Display fallback is not purchase authorization.

The product-options route now passes its request abort signal through product,
variant, preset, and catalog verification. Canceled requests return a private,
uncacheable cancellation response and do not record provider-outage failures.
Shared catalog reads track their callers: canceling one caller leaves other
callers running; canceling the last aborts upstream. Four active reads, a queue
cap of 64, the 15-second queue deadline, and genuine-error cooldown are preserved.
Cancellation itself does not trigger cooldown. An already-committed database
write is not rolled back, but cancellation stops subsequent verification stages.

## Product Images and Details

One image resolver serves live data, snapshots, and the gallery. Saved variant
photos and usable API galleries come first. Known local artwork is only a last
resort, never a replacement for usable Merchize model photos. Saved images are
for display only and cannot enable purchases or authorize checkout.

Product details use the supplier description, not example specifications or reviews.
The delivery panel links to the existing shipping and made-to-order policy without
promising fees, arrival dates, security certifications, or a fixed return period.
`productStructuredData.ts` keeps product details and a valid listed price for published
products. It does not claim stock status, ratings, delivery dates, or return terms.
A published listing does not prove that its options are currently available to buy
or ship. This adds no supplier calls or database reads; ISR and checkout checks stay
unchanged.

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

Use Yarn. These checks do not rebuild the app or restart the running dev server:

```sh
yarn lint
yarn tsc --noEmit --pretty false --incremental false
yarn test:storefront
SESSION_SECRET=storefront-integration-fixture-secret-32 \
ADMIN_SESSION_SECRET=storefront-integration-admin-secret-32 \
NEXT_PUBLIC_DJANGO_API_BASE_URL=https://django.example/api/v1 \
node --require next/dist/server/node-environment --conditions=react-server --import tsx --test src/lib/merchizeStorefront/*.integration.test.ts src/lib/merchizeCatalog/*.integration.test.ts
```

For a production check, run `yarn build` (Turbopack) in a clean or isolated checkout,
not against the `.next` directory of a running dev server. Integration tests create
and remove their own temporary SQLite databases; keep these regression tests,
but remove disposable manual harnesses and demo routes after checking a change.

The asset tests check current files against the recorded hashes and quality
evidence. They do **not** launch a browser, remeasure SSIM, or prove today's CLS.
The option tests check ordering, preserved selection data, and layout-only output.
The CSS tests check source coverage, route imports, and the shared stylesheet size.

Check `/shop/search` on desktop and mobile. Confirm typo suggestions, Arrow/Enter
selection, Escape, and search-button submission. Two search fields should share
one index request; typing must not trigger supplier searches. Verify shareable
query/pagination URLs, similar-product labels, no-match and unavailable states,
and API product photos. Search results must retain `noindex,follow`. Check a normal
category and a missing category too. Use the isolated integration tests for timeouts,
provider outages, malformed payloads, incomplete saved pages, and forced-refresh
failures; do not simulate these by purging the working storefront database.
The fixture-only auth values above satisfy the readiness check; they are not
deployment credentials and the tests stub supplier/backend network calls. Check
private-to-public transitions, negative-state precedence, and cancellation with
both one and multiple shared-read callers using the isolated regression tests.
The publication integration test also removes its temporary manifest directory.
Keep these regression tests; they are not demo routes or production data fixtures.

With the browser cache disabled, check About at 412px and 1440px. Confirm one hero
download per page, readable navigation, and unchanged card positions. On a product
page, delay the options response and test success, an unavailable destination, and
failure/retry. Check size/colour selection on both the product page and category
popover. Change the quick-add country, then close and reopen it: old selections
must clear and options must load again for the selected country.

In a disposable guest cart, confirm Buy Now stays disabled until all required
options are selected. Double-click it and confirm one added unit, existing cart
items retained, and navigation only after the save completes. A failed save must
keep the selection and stay on the product page. Do not submit a payment during
these checks or test cart mutations against a signed-in customer's cart.

For performance comparisons, use the same environment and at least three runs per
device. Reject runs with failed HTML, CSS, JavaScript, or hero-image requests.
Localhost results are not production results. A small About body-font swap remains
recorded separately; image compression does not eliminate font-substitution shifts.

## Measurement Records

- [Performance history and remaining work](../reports/storefront/performance-audit.json)
- [Portrait compression and transparency evidence](../reports/storefront/image-compression.json)
- [Hero similarity, framing, and navbar contrast evidence](../reports/storefront/about-hero-compression.json)
