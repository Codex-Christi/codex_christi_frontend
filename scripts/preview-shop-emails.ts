import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { shopEmailFixtures } from '../src/lib/shop/email/fixtures';

async function preparePreviews() {
  const output = path.resolve(process.argv[2] ?? '/private/tmp/codex-shop-email-previews');
  await mkdir(output, { recursive: true });
  await copyFile('public/media/favicons/brand-192.png', path.join(output, 'brand-192.png'));
  const fixtures = shopEmailFixtures();
  for (const { name, message } of fixtures) {
    const html = message.htmlbody.replace(
      /src="[^"]*\/media\/favicons\/brand-192\.png"/gu,
      'src="brand-192.png"',
    );
    await writeFile(path.join(output, `${name}.html`), html);
    await writeFile(
      path.join(output, `${name}-no-images.html`),
      html.replace(/<img\b[^>]*>/gu, ''),
    );
    await writeFile(
      path.join(output, `${name}.txt`),
      `${message.subject}\n\n${message.textbody}\n`,
    );
  }
  const examples = fixtures
    .map(
      ({ name }) => `<section><h2>${name.replaceAll('-', ' ')}</h2>
      <div class="examples"><div><h3>Desktop · 600px</h3><iframe title="${name} desktop" src="${name}.html" width="600" height="1060"></iframe></div>
      <div><h3>Mobile · 320px</h3><iframe title="${name} mobile" src="${name}.html" width="320" height="1240"></iframe></div></div></section>`,
    )
    .join('');
  await writeFile(
    path.join(output, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shop email previews</title>
  <style>body{margin:0;padding:24px;background:#11151b;color:#fff;font:16px Arial,Helvetica,sans-serif}h1{margin-top:0}h2{text-transform:capitalize}.examples{display:flex;flex-wrap:wrap;gap:24px}iframe{display:block;border:1px solid #39414d;background:#05070d}section{margin-bottom:48px}h3,p{color:#b8c4d3}</style></head><body><h1>Shop transactional email previews</h1><p>Synthetic examples only. No emails are sent. The initial Django checkout template needs its backend source.</p>${examples}</body></html>`,
  );
  console.log(`Prepared ${fixtures.length} synthetic email previews in ${output}`);
}

void preparePreviews();
