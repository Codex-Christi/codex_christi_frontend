import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

type PortraitEvidence = {
  name: string;
  sourcePath: string;
  sourceSha256: string;
  outputPath: string;
  outputSha256: string;
  deviceScaleFactor: number;
  rasterSize: { width: number; height: number };
  selected: { bytes: number; minSSIM: number; maxAlphaDifference: number };
  browserComparisons: { ssim: number }[];
};

const reportPromise = readFile('reports/storefront/image-compression.json', 'utf8').then(
  (source) => JSON.parse(source) as { images: PortraitEvidence[] },
);

test('portraits have independently verified 1x, 2x, and 3x versions', async () => {
  const report = await reportPromise;
  assert.equal(report.images.length, 12);
  for (const name of new Set(report.images.map((image) => image.name))) {
    assert.deepEqual(
      report.images.filter((image) => image.name === name).map((image) => image.deviceScaleFactor),
      [1, 2, 3],
    );
  }
  for (const image of report.images) {
    assert.equal(image.rasterSize.width, 72 * image.deviceScaleFactor);
    assert.equal(image.rasterSize.height, image.rasterSize.width);
    assert.ok(image.selected.minSSIM >= 0.995, image.outputPath);
    assert.equal(image.selected.maxAlphaDifference, 0, image.outputPath);
    assert.equal(image.browserComparisons.length, 2, image.outputPath);
    assert.ok(image.browserComparisons.every((score) => score.ssim >= 0.995), image.outputPath);
  }
});

test('originals are preserved and quality evidence matches the shipped files', async () => {
  const report = await reportPromise;
  for (const image of report.images) {
    const original = await readFile(image.sourcePath);
    const output = await readFile(image.outputPath);
    assert.equal(createHash('sha256').update(original).digest('hex'), image.sourceSha256);
    assert.equal(createHash('sha256').update(output).digest('hex'), image.outputSha256);
    assert.equal(output.length, image.selected.bytes);
    assert.equal(output.toString('ascii', 0, 4), 'RIFF');
    assert.equal(output.toString('ascii', 8, 12), 'WEBP');
  }
});

test('About hero preserves its drawing instructions and verified image quality', async () => {
  const report = JSON.parse(await readFile('reports/storefront/about-hero-compression.json', 'utf8'));
  const original = await readFile(report.sourcePath);
  const output = await readFile(report.outputPath);
  assert.equal(createHash('sha256').update(original).digest('hex'), report.sourceSha256);
  assert.equal(createHash('sha256').update(output).digest('hex'), report.outputSha256);
  assert.equal(output.length, report.outputBytes);
  assert.ok(output.length < original.length);
  const bitmap = /xlink:href="data:image\/(?:jpeg|avif);base64,[A-Za-z0-9+/=]+"/;
  assert.ok(bitmap.test(original.toString()));
  assert.ok(bitmap.test(output.toString()));
  assert.equal(original.toString().replace(bitmap, 'BITMAP'), output.toString().replace(bitmap, 'BITMAP'));
  assert.equal(report.rendering.length, 8);
  assert.ok(report.rendering.every((row: { ssim: number }) => row.ssim >= 0.995));
  assert.ok(report.selected.minRenderedSSIM >= 0.995);
});
