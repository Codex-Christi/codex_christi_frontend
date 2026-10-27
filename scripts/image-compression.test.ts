import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import portraits from '../reports/storefront/image-compression.json';
import hero from '../reports/storefront/about-hero-compression.json';

const MIN_SSIM = 0.995;
const desktop = hero.desktopBackdrop;
const assets = [
  ...portraits.images.map((image) => ({
    source: { path: image.sourcePath, bytes: image.sourceBytes, sha256: image.sourceSha256 },
    output: { path: image.outputPath, bytes: image.selected.bytes, sha256: image.outputSha256 },
  })),
  ...[hero, desktop].map((image) => ({
    source: { path: hero.sourcePath, bytes: hero.sourceBytes, sha256: hero.sourceSha256 },
    output: { path: image.outputPath, bytes: image.outputBytes, sha256: image.outputSha256 },
  })),
];

test('originals and compressed assets match the files that were quality-checked', async () => {
  const fingerprints = new Map<string, { bytes: number; sha256: string }>();
  for (const { source, output } of assets) {
    assert.ok(output.bytes < source.bytes, output.path);
    for (const file of [source, output]) {
      let fingerprint = fingerprints.get(file.path);
      if (!fingerprint) {
        const bytes = await readFile(file.path);
        fingerprint = {
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
        fingerprints.set(file.path, fingerprint);
      }
      assert.deepEqual(fingerprint, { bytes: file.bytes, sha256: file.sha256 }, file.path);
    }
  }
});

test('recorded fidelity covers portrait densities and meets the quality policy', () => {
  for (const name of new Set(portraits.images.map((image) => image.name))) {
    const versions = portraits.images.filter((image) => image.name === name);
    assert.deepEqual(versions.map((image) => image.deviceScaleFactor), [1, 2, 3]);
  }
  for (const image of portraits.images) {
    assert.equal(image.rasterSize.width, 72 * image.deviceScaleFactor);
    assert.equal(image.rasterSize.height, image.rasterSize.width);
    assert.ok(image.selected.minSSIM >= MIN_SSIM, image.outputPath);
    assert.equal(image.selected.maxAlphaDifference, 0, image.outputPath);
    assert.deepEqual(image.browserComparisons.map((row) => row.background), ['#000000', '#ffffff']);
    assert.ok(image.browserComparisons.every((row) => row.ssim >= MIN_SSIM), image.outputPath);
  }
  assert.ok(hero.rendering.every((row) => row.ssim >= MIN_SSIM));
  assert.ok(desktop.nativeSSIM >= MIN_SSIM);
  assert.ok(desktop.rendering.every((row) => row.ssim >= MIN_SSIM));
});

test('mobile keeps the original drawing and desktop reveals the full photo', async () => {
  const [original, mobile, full] = await Promise.all(
    [hero.sourcePath, hero.outputPath, desktop.outputPath].map((path) => readFile(path, 'utf8')),
  );
  const bitmap = /xlink:href="data:image\/(?:jpeg|avif);base64,[A-Za-z0-9+/=]+"/;
  assert.ok(bitmap.test(original));
  assert.ok(bitmap.test(mobile));
  assert.equal(original.replace(bitmap, 'BITMAP'), mobile.replace(bitmap, 'BITMAP'));
  assert.ok(full.includes('viewBox="' + desktop.expandedViewBox + '"'));
});
