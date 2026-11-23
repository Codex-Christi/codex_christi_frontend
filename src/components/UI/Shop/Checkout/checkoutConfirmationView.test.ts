import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

async function checkConfirmation(contents: string, timezone = 'UTC') {
  const bundled = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        const assert = require('node:assert/strict');
        const React = require('react');
        const { renderToStaticMarkup } = require('react-dom/server');
        const { JSDOM } = require('jsdom');
        globalThis.fetch = async () => assert.fail('Confirmation UI tests cannot call a provider');
        const { default: CheckoutConfirmationView } = require('./src/components/UI/Shop/Checkout/CheckoutConfirmationView');
        let actions = 0;
        const state = {
          flowStatus: 'completed',
          steps: [{key:'receiptUpload',label:'Payment recorded',status:'success'},{key:'paymentSave',label:'Receipt prepared',status:'success'},{key:'orderPush',label:'Order details recorded',status:'success'}],
          receiptLink: '/next-api/shop/orders/local-order-1234/receipt',
          receiptFileName: 'receipt.pdf',
          paidAmountLabel: '$25.00',
          supportReference: 'local-order-1234',
          shortSupportReference: 'local-or',
          needsManualReview: false,
          updatedAt: '2026-11-21T14:32:00.000Z',
          orderCustomId: 'internal-django-id-must-stay-private',
        };
        const base = {orderToken:'local-order-1234',state,paid:true,hasData:true,onRefresh:()=>actions++,onDownload:()=>actions++,onCopy:()=>actions++};
        const documents = [];
        const render = (props={}) => {
          const html = renderToStaticMarkup(<CheckoutConfirmationView {...base} {...props} />);
          const dom = new JSDOM(html);
          documents.push(dom);
          return dom.window.document;
        };
        const button = (doc,text) => [...doc.querySelectorAll('button')].find(el=>el.textContent.trim()===text);
        ${contents}
        assert.equal(actions,0,'Rendering a saved order cannot dispatch an action');
        for (const dom of documents) dom.window.close();
        console.log('confirmation view passed');
      `,
    },
    write: false,
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'cjs',
    logLevel: 'silent',
    plugins: [
      {
        name: 'confirmation-routing-boundary',
        setup(builder) {
          builder.onResolve({ filter: /^react(?:\/.*)?$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          builder.onResolve({ filter: /CustomShopLink$/ }, () => ({
            path: 'shop-link',
            namespace: 'confirmation-routing',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'confirmation-routing' }, () => ({
            loader: 'jsx',
            contents:
              "import React from 'react'; export default function ShopLink({href,children,...props}) { return <a href={href} {...props}>{children}</a>; }",
          }));
        },
      },
    ],
  });
  const result = spawnSync(process.execPath, [], {
    cwd: process.cwd(),
    input: bundled.outputFiles[0].text,
    encoding: 'utf8',
    env: { ...process.env, TZ: timezone },
    timeout: 15_000,
    maxBuffer: 100_000,
  });
  assert.equal(
    result.status,
    0,
    `${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stdout, /confirmation view passed/u);
}

test('confirmation shows the same UTC last-update record across browser timezones', async () => {
  for (const timezone of ['UTC', 'America/Los_Angeles'])
    await checkConfirmation(
      `
        const doc = render();
        const time = doc.querySelector('time');
        assert.ok(time);
        assert.equal(time.dateTime,'2026-11-21T14:32:00.000Z');
        assert.equal(time.textContent,'21 Nov 2026, 14:32 UTC');
        assert.equal(time.parentElement.textContent,'Last updated: 21 Nov 2026, 14:32 UTC');
        const secondsOnly = render({state:{...state,updatedAt:'2026-11-21T14:32:00Z'}});
        assert.equal(secondsOnly.querySelector('time').textContent,time.textContent);
        assert.doesNotMatch(doc.body.textContent,/shipped|delivered|in production/iu);
      `,
      timezone,
    );
});

test('the verified order offers the address correction and hides it without access', async () => {
  await checkConfirmation(`
    const { default: CustomerAddressCorrection } = require('./src/components/UI/Shop/Checkout/CustomerAddressCorrection');
    const required = {addressCorrectionState:'required',addressCorrection:<CustomerAddressCorrection orderToken='local-order-1234' state='required' onRefresh={()=>actions++} />};
    const doc = render(required);
    assert.equal(doc.querySelector('h1').textContent,'Check your delivery address');
    assert.ok(button(doc,'Submit corrected address'));
    assert.ok(doc.querySelector('input[name=confirmed]').required);
    assert.ok(doc.querySelector('[role=combobox]'));
    assert.equal(doc.querySelector('input[name=line1]').value,'');
    assert.equal(button(render({...required,accessRequired:true}),'Submit corrected address'),undefined);
    assert.equal(button(render({...required,refunded:true}),'Submit corrected address'),undefined);
    const checking = render({addressCorrectionState:'checking'});
    assert.equal(checking.querySelector('h1').textContent,'Checking your delivery address');
    assert.match(checking.body.textContent,/No action is needed right now/u);
  `);
});

test('confirmation omits missing, invalid, or unauthorized update timestamps', async () => {
  await checkConfirmation(`
    for (const updatedAt of [undefined,null,'','not-a-date','2026-11-21','2026-11-21T14:32:00','2026-02-30T14:32:00.000Z','2026-11-21T25:32:00.000Z']) {
      const doc = render({state:{...state,updatedAt}});
      assert.equal(doc.querySelector('time'),null,String(updatedAt));
      assert.doesNotMatch(doc.body.textContent,/Last updated|UTC/u);
    }
    for (const props of [{accessRequired:true},{hasData:false},{accessRequired:true,hasData:false}]) {
      const doc = render(props);
      assert.equal(doc.querySelector('time'),null);
      assert.doesNotMatch(doc.body.textContent,/Last updated|14:32 UTC/u);
    }
  `);
});

test('confirmation separates paid, delayed, under-review, refunded, and access-required views', async () => {
  await checkConfirmation(`
    let doc = render();
    assert.equal(doc.querySelector('h1').textContent,'Thank you for your purchase');
    assert.match(doc.body.textContent,/payment and order details are recorded/u);
    assert.match(doc.body.textContent,/Keep reference local-or for updates/u);
    assert.doesNotMatch(doc.body.textContent,/internal-django|shipped|delivered|in production|preparing your order/iu);
    doc = render({state:{...state,flowStatus:'processing'}});
    assert.equal(doc.querySelector('h1').textContent,'Payment received');
    assert.match(doc.body.textContent,/remaining order steps/u);
    doc = render({state:{...state,flowStatus:'error'}});
    assert.equal(doc.querySelector('h1').textContent,'Payment received — order delayed');
    assert.match(doc.body.textContent,/before trying another payment/u);
    doc = render({state:{...state,flowStatus:'error',needsManualReview:true}});
    assert.equal(doc.querySelector('h1').textContent,'Payment received — order under review');
    assert.match(doc.body.textContent,/Our team needs to check the order/u);
    doc = render({refunded:true});
    assert.equal(doc.querySelector('h1').textContent,'Payment refunded');
    assert.match(doc.body.textContent,/This payment has been refunded/u);
    assert.doesNotMatch(doc.body.textContent,/order details are recorded/u);
    doc = render({paid:false,state:{...state,flowStatus:'error',paidAmountLabel:undefined}});
    assert.equal(doc.querySelector('h1').textContent,'Payment not confirmed yet');
    assert.match(doc.body.textContent,/check its status before paying again/u);
    doc = render({accessRequired:true,recovery:<div>Verify order access</div>});
    assert.equal(doc.querySelector('h1').textContent,'View your order');
    assert.match(doc.body.textContent,/Verify the checkout email/u);
    assert.match(doc.body.textContent,/Verify order access/u);
    assert.equal(button(doc,'Check order status'),undefined);
    assert.equal(button(doc,'Download receipt'),undefined);
  `);
});

test('confirmation keeps its local support reference, receipt route, and action controls', async () => {
  await checkConfirmation(`
    let doc = render();
    assert.match(doc.body.textContent,/local-order-1234/u);
    assert.doesNotMatch(doc.body.textContent,/internal-django-id/u);
    assert.equal(button(doc,'Check order status').disabled,false);
    assert.equal(button(doc,'Download receipt').disabled,false);
    assert.ok(doc.querySelector('button[aria-label="Copy order reference"]'));
    assert.equal(doc.querySelector('a').getAttribute('href'),'/shop');
    doc = render({actionsDisabled:true});
    assert.equal(button(doc,'Check order status').disabled,true);
    assert.equal(button(doc,'Download receipt').disabled,true);
    assert.equal(doc.querySelector('button[aria-label="Copy order reference"]').disabled,true);
    doc = render({state:{...state,receiptLink:undefined,receiptFileName:undefined}});
    assert.equal(button(doc,'Receipt not ready yet').disabled,true);
    doc = render({state:{...state,shortSupportReference:''}});
    assert.match(doc.body.textContent,/Keep reference local-or for updates/u);
  `);
});

test('a verified hold remains paid, is private, and clears on resume', async () => {
  await checkConfirmation(`
    const held = {...state,fulfillmentOnHold:true,fulfillmentCheckedAt:'2026-11-22T12:05:00.000Z'};
    const doc = render({state:held});
    assert.equal(doc.querySelector('h1').textContent,'Order on hold');
    assert.match(doc.body.textContent,/Your payment was received. No action is needed right now./u);
    assert.match(doc.body.textContent,/Fulfillment last checked: 22 Nov 2026, 12:05 UTC/u);
    assert.doesNotMatch(render({state:held,accessRequired:true}).body.textContent,/Order on hold/u);
    assert.doesNotMatch(render({state:{...held,fulfillmentOnHold:false}}).body.textContent,/Order on hold/u);
  `);
});
