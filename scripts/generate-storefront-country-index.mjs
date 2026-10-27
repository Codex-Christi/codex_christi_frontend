import { readFile, writeFile } from 'node:fs/promises';
import { countries } from 'country-data-list';

const destination = new URL('../src/datasets/storefront-country-index.json', import.meta.url);
if (!countries.all.length) throw new Error('Country data is empty; refusing to replace the index.');
const rows = countries.all.map(({ alpha2, alpha3, name, emoji, status, ioc }) => ({
  alpha2,
  alpha3,
  name,
  selectable: Boolean(emoji && status !== 'deleted' && ioc !== 'PRK'),
}));
const json = `${JSON.stringify(rows, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if ((await readFile(destination, 'utf8')) !== json) {
    throw new Error(
      'Country data changed. Run yarn node scripts/generate-storefront-country-index.mjs',
    );
  }
  console.log('Storefront country index matches the installed country data.');
} else {
  await writeFile(destination, json);
  console.log(
    `Generated ${rows.length} country identities (${rows.filter((row) => row.selectable).length} selectable).`,
  );
}
