import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import postcss, { type Root } from 'postcss';
import tailwindcss from 'tailwindcss';
import sharedConfig from '../tailwind.config';
import storefrontConfig from '../tailwind.storefront.config';

function ruleSignatures(root: Root) {
  const signatures = new Set<string>();
  root.walkRules((rule) => {
    const ancestors: string[] = [];
    let parent = rule.parent;
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule') ancestors.unshift(`@${parent.name} ${parent.params}`);
      parent = parent.parent;
    }
    const declarations: unknown[] = [];
    rule.walkDecls((decl) => {
      declarations.push([decl.prop, decl.value, Boolean(decl.important)]);
    });
    signatures.add(JSON.stringify([ancestors, rule.selector, declarations]));
  });
  return signatures;
}

test('shared styles plus admin utilities retain the original generated rules', async () => {
  assert.equal(storefrontConfig.theme, sharedConfig.theme);
  assert.equal(storefrontConfig.plugins, sharedConfig.plugins);
  const source = (await readFile('src/app/globals.css', 'utf8')).replace(/^@config .*;\n/m, '');
  const [original, storefront, admin] = await Promise.all([
    postcss([tailwindcss(sharedConfig)]).process(source, { from: undefined }),
    postcss([tailwindcss(storefrontConfig)]).process(source, { from: undefined }),
    postcss([tailwindcss(sharedConfig)]).process('@tailwind utilities;', { from: undefined }),
  ]);
  const available = new Set([...ruleSignatures(storefront.root), ...ruleSignatures(admin.root)]);
  const missing = [...ruleSignatures(original.root)].filter((rule) => !available.has(rule));
  assert.deepEqual(missing, [], 'The CSS split must not drop existing admin or shared rules');
  assert.ok(storefront.css.length < original.css.length, 'Storefront CSS must actually shrink');
});
