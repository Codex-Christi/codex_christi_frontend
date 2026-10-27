import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import glob from 'fast-glob';
import postcss, { type Root } from 'postcss';
import tailwindcss, { type Config } from 'tailwindcss';
import ts from 'typescript';
import sharedConfig from '../tailwind.config';
import storefrontConfig from '../tailwind.storefront.config';
import routeConfig from '../tailwind.route-utilities.config';

const projectRoot = process.cwd();
const readSource = (file: string) => readFileSync(file, 'utf8');
const source = postcss.parse(readSource('src/app/globals.css'));
source.walkAtRules('config', (rule) => { rule.remove(); });

// Build each bundle once for both rule coverage and size checks.
const compile = (config: Config, css = source.toString()) =>
  postcss([tailwindcss(config)]).process(css, { from: undefined });
const generatedStyles = Promise.all([
  compile(sharedConfig),
  compile(storefrontConfig),
  compile(routeConfig),
  compile(routeConfig, '@tailwind utilities;'),
  compile(sharedConfig, '@tailwind utilities;'),
]);

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

test('shared, page and admin styles retain the original generated rules', async () => {
  assert.equal(storefrontConfig.theme, sharedConfig.theme);
  assert.equal(storefrontConfig.plugins, sharedConfig.plugins);
  const [original, storefront, routeBaseline, route, admin] = await generatedStyles;
  for (const [extra, expected] of [[route, routeBaseline], [admin, original]]) {
    const available = new Set([...ruleSignatures(storefront.root), ...ruleSignatures(extra.root)]);
    const missing = [...ruleSignatures(expected.root)].filter((rule) => !available.has(rule));
    assert.deepEqual(missing, [], 'The CSS split must not drop existing page or admin rules');
  }
  assert.ok(storefront.css.length < original.css.length, 'Storefront CSS must actually shrink');
});

test('shared storefront CSS covers statically and dynamically imported browsing components', () => {
  const included = new Set(glob.sync(storefrontConfig.content).map((file) => path.resolve(file)));
  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, projectRoot);
  const seen = new Set<string>();
  const queue = [
    'src/app/layout.tsx',
    'src/app/shop/layout.tsx',
    'src/app/shop/page.tsx',
    'src/app/shop/categories/page.tsx',
    'src/app/shop/category/[id]/page.tsx',
    'src/app/shop/product/[id]/page.tsx',
  ].map((file) => path.resolve(file));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = readSource(file);
    if (file.endsWith('.tsx') && /className|\bcn\(/.test(text)) {
      assert.ok(included.has(file), `Missing shared CSS source: ${path.relative(projectRoot, file)}`);
    }
    for (const imported of ts.preProcessFile(text, true, true).importedFiles) {
      const resolved = ts.resolveModuleName(imported.fileName, file, options, ts.sys)
        .resolvedModule?.resolvedFileName;
      if (resolved?.startsWith(`${path.join(projectRoot, 'src')}${path.sep}`)) queue.push(resolved);
    }
  }
});

test('non-browsing route boundaries load their additional utilities', () => {
  for (const file of [
    'src/app/page.tsx',
    'src/app/about-us/page.tsx',
    'src/app/auth/layout.tsx',
    'src/app/profile/layout.tsx',
    'src/app/shop/cart/layout.tsx',
    'src/app/shop/checkout/layout.tsx',
    'src/app/shop/account-overview/layout.tsx',
    'src/app/shop/auth/layout.tsx',
    'src/app/shop/my-wishlist/page.tsx',
  ]) {
    const imports = ts.preProcessFile(readSource(file), true, true).importedFiles;
    assert.ok(imports.some((item) => item.fileName.endsWith('/route-utilities.css')), file);
  }
});

test('shared CSS is at least 20% smaller than the previous all-route bundle', async () => {
  const [, storefront, routeBaseline] = await generatedStyles;
  const originalBytes = gzipSync(routeBaseline.css).length;
  const sharedBytes = gzipSync(storefront.css).length;
  assert.ok(sharedBytes < originalBytes * 0.8, `Shared ${sharedBytes} bytes; all-route ${originalBytes} bytes`);
});
