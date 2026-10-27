import assert from 'node:assert/strict';
import test from 'node:test';
import { getVariantGalleryImageUrls, resolveProductGalleryImages } from './imageUrls';

const cdn = 'https://d2dytk4tvgwhb4.cloudfront.net';
const legacy = `${cdn}/store/products/product-1/front/thumb.jpg`;

test('supplier gallery images replace rejected legacy previews before options load', () => {
  assert.deepEqual(
    resolveProductGalleryImages({
      metadata: { image: legacy, gallery_uris: ['store/gallery/front', 'store/gallery/back'] },
    }),
    [`${cdn}/store/gallery/front/thumb.jpg`, `${cdn}/store/gallery/back/thumb.jpg`],
  );
});

test('saved default-variant images give live and snapshot data the same initial gallery', () => {
  const variants = [
    { image_uris: ['store/other/front'], is_default: false },
    { image_uris: ['store/default/front', 'store/default/back'], is_default: true },
  ];
  const live = resolveProductGalleryImages({ metadata: { image: legacy }, variants });
  const snapshot = resolveProductGalleryImages({
    metadata: { image: `${cdn}/store/default/front/thumb.jpg` },
    variants,
  });
  assert.deepEqual(live, snapshot);
  assert.deepEqual(live, [
    `${cdn}/store/default/front/thumb.jpg`,
    `${cdn}/store/default/back/thumb.jpg`,
  ]);
});

test('a default variant without usable images does not hide another variant image', () => {
  assert.deepEqual(
    resolveProductGalleryImages({
      variants: [{ image_uris: [legacy], is_default: true }, { image_uris: ['store/valid/front'] }],
    }),
    [`${cdn}/store/valid/front/thumb.jpg`],
  );
});

test('server-provided and known local images stay local through gallery hydration', () => {
  const fallbackImageUrl = '/Jesus_hoodie.png';
  const images = resolveProductGalleryImages({ metadata: { image: legacy }, fallbackImageUrl });
  assert.deepEqual(images, [fallbackImageUrl]);
  assert.deepEqual(
    resolveProductGalleryImages({
      metadata: { image: legacy },
      initialImageUrls: images,
    }),
    images,
  );
});

test('image selection ignores malformed, blank, duplicate and legacy entries', () => {
  assert.deepEqual(
    resolveProductGalleryImages({
      metadata: {
        gallery_uris: [
          null,
          1,
          '',
          ' ',
          legacy,
          '/store/products/id/front',
          'store/valid.jpg',
          'store/valid.jpg',
        ],
      },
    }),
    [`${cdn}/store/valid.jpg`],
  );
  assert.deepEqual(getVariantGalleryImageUrls({ image_uris: 'not-an-array' }), []);
  assert.deepEqual(resolveProductGalleryImages({ metadata: { image: legacy } }), []);
});
