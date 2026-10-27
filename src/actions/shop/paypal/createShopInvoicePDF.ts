import PDFDocument from 'pdfkit';
import fsSync from 'node:fs';
import path from 'node:path';
import { OrderResponseBody } from '@paypal/paypal-js';
import type { CartVariant } from '@/stores/shop_stores/cartStore';
import type { CanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/types';
import { parseCanonicalOrderSnapshot } from '@/lib/paypal/orderSnapshot/canonicalize';
import { getCanonicalInvoicePricing } from '@/lib/paypal/orderSnapshot/consumerData';

type InvoiceLineItem = {
  name: string;
  sku: string;
  quantity: string;
  unitAmount: {
    value: string;
    currencyCode: string;
  };
  lineAmount?: string;
};

type InvoiceShippingAddressOverride = {
  shipping_address_line_1: string;
  shipping_address_line_2?: string;
  shipping_city: string;
  shipping_state: string;
  zip_code: string;
  shipping_country: string;
};

function getCreateTime(authData: OrderResponseBody) {
  return (
    (authData as OrderResponseBody & { createTime?: string }).createTime ??
    authData.create_time ??
    ''
  );
}

function getPayerEmail(payer: OrderResponseBody['payer'] | null | undefined) {
  return (
    (payer as { emailAddress?: string; email_address?: string } | null | undefined)?.emailAddress ??
    (payer as { emailAddress?: string; email_address?: string } | null | undefined)?.email_address ??
    ''
  );
}

function getPayerName(payer: OrderResponseBody['payer'] | null | undefined) {
  const name =
    (payer as {
      name?: { givenName?: string; given_name?: string; surname?: string };
    } | null | undefined)?.name ?? null;

  return `${name?.givenName ?? name?.given_name ?? ''} ${name?.surname ?? ''}`.trim();
}

function getPurchaseUnit(authData: OrderResponseBody) {
  return (
    (authData as OrderResponseBody & { purchaseUnits?: unknown[] }).purchaseUnits?.[0] ??
    (authData as OrderResponseBody & { purchase_units?: unknown[] }).purchase_units?.[0] ??
    null
  );
}

function getCurrencyCodeFromPurchaseUnit(purchaseUnit: unknown) {
  return (
    (purchaseUnit as {
      amount?: {
        currencyCode?: string;
        currency_code?: string;
      };
    } | null)?.amount?.currencyCode ??
    (purchaseUnit as {
      amount?: {
        currency_code?: string;
      };
    } | null)?.amount?.currency_code ??
    'USD'
  );
}

function getPaypalLineItems(purchaseUnit: unknown) {
  return (((purchaseUnit as {
    items?: Array<{
      name?: string;
      sku?: string;
      quantity?: string;
      unitAmount?: { value?: string; currencyCode?: string };
      unit_amount?: { value?: string; currency_code?: string };
    }>;
  } | null)?.items ?? []) as Array<{
    name?: string;
    sku?: string;
    quantity?: string;
    unitAmount?: { value?: string; currencyCode?: string };
    unit_amount?: { value?: string; currency_code?: string };
  }>).map((item) => {
    const unitAmount = item.unitAmount ?? item.unit_amount ?? null;
    return {
      name: item.name ?? '',
      sku: item.sku ?? '',
      quantity: item.quantity ?? '0',
      unitAmount: {
        value: unitAmount?.value ?? '0',
        currencyCode: item.unitAmount?.currencyCode ?? item.unit_amount?.currency_code ?? '',
      },
    } satisfies InvoiceLineItem;
  });
}

function getCartLineItems(cart: CartVariant[] | undefined, currencyCode: string) {
  return (cart ?? []).map((item) => ({
    name: item.title || item.itemDetail.title || item.variantId,
    sku: item.itemDetail.sku_seller || item.itemDetail.sku || item.variantId,
    quantity: String(item.quantity),
    unitAmount: {
      value: String(item.itemDetail.retail_price ?? 0),
      currencyCode,
    },
  })) satisfies InvoiceLineItem[];
}

// Main Func
export const createPaypalShopInvoicePDF = async (
  authData: OrderResponseBody,
  cart?: CartVariant[],
  shippingAddressOverride?: InvoiceShippingAddressOverride | null,
  canonicalOrderSnapshot?: CanonicalOrderSnapshot | null,
  customer?: { name: string; email: string },
) => {
  ensureHelveticaAFM();

  // A canonical receipt never mixes its lines or totals with mutable PayPal/browser data.
  // Parsing here gives this direct consumer its own integrity check in addition to the ledger gate.
  const canonicalPricing = canonicalOrderSnapshot
    ? getCanonicalInvoicePricing(parseCanonicalOrderSnapshot(canonicalOrderSnapshot))
    : null;

  // Generate PDF
  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const imagePath =
      process.env.NODE_ENV === 'production'
        ? path.resolve('./public/media/img/general/logo-glow-tiny.jpg')
        : 'public/media/img/general/logo-glow-tiny.jpg';

    // Header
    doc
      .image(imagePath, 50, 45, { width: 100 })
      .fillColor('#333')
      .fontSize(20)
      .text('PAYMENT RECEIPT', { align: 'right' })
      .moveDown(0.5);

    // Invoice details
    doc
      .fontSize(10)
      .text(`Invoice #: ${authData.id || ''}`, { align: 'right' })
      .text(`Date: ${new Date(getCreateTime(authData)).toLocaleDateString()}`, {
        align: 'right',
      })
      .text(`Status: ${authData.status || ''}`, { align: 'right' })
      .moveDown(1);

    const drawContactDetails = (label: string, lines: string[], x: number, width: number) => {
      doc.fontSize(12).text(label, x, 150, { width });
      let y = 165;
      for (const line of lines.filter((line) => line.trim())) {
        const height = doc.heightOfString(line, { width });
        doc.text(line, x, y, { width });
        y += Math.max(15, height + 2);
      }
      return y;
    };
    let contactBottom = 150;

    // Billing information
    const payer = authData.payer;
    const billingName = getPayerName(payer) || customer?.name || '';
    const billingEmail = getPayerEmail(payer) || customer?.email || '';
    if (billingName || billingEmail) {
      contactBottom = drawContactDetails('Bill To:', [billingName, billingEmail], 50, 300);
    }

    const purchaseUnit = getPurchaseUnit(authData);

    // Shipping information
    const shipping = (
      purchaseUnit as {
        shipping?: {
          name?: { fullName?: string; full_name?: string };
          address?: {
            addressLine1?: string;
            addressLine2?: string;
            adminArea1?: string;
            adminArea2?: string;
            postalCode?: string;
            countryCode?: string;
            country_code?: string;
            address_line_1?: string;
            address_line_2?: string;
            admin_area_1?: string;
            admin_area_2?: string;
            postal_code?: string;
          };
        };
      } | null
    )?.shipping;
    if (shipping || shippingAddressOverride) {
      const address = shipping?.address;
      const addressLine1 =
        shippingAddressOverride?.shipping_address_line_1 ??
        address?.addressLine1 ??
        address?.address_line_1 ??
        '';
      const addressLine2 =
        shippingAddressOverride?.shipping_address_line_2 ??
        address?.addressLine2 ??
        address?.address_line_2 ??
        '';
      const city =
        shippingAddressOverride?.shipping_city ??
        address?.adminArea2 ??
        address?.admin_area_2 ??
        '';
      const state =
        shippingAddressOverride?.shipping_state ??
        address?.adminArea1 ??
        address?.admin_area_1 ??
        '';
      const postalCode =
        shippingAddressOverride?.zip_code ?? address?.postalCode ?? address?.postal_code ?? '';
      const locality = [[city, state].filter(Boolean).join(', '), postalCode]
        .filter(Boolean)
        .join(' ');
      contactBottom = Math.max(
        contactBottom,
        drawContactDetails(
          'Ship To:',
          [
            shipping?.name?.fullName ?? shipping?.name?.full_name ?? billingName,
            addressLine1,
            addressLine2,
            locality,
            shippingAddressOverride?.shipping_country ??
              address?.countryCode ??
              address?.country_code ??
              '',
          ],
          400,
          145,
        ),
      );
    }

    // Legacy rows retain their PayPal/cart fallback. New rows render only the sealed snapshot.
    const currencyCode =
      canonicalPricing?.currencyCode ?? getCurrencyCodeFromPurchaseUnit(purchaseUnit);
    const paypalItems = canonicalPricing ? [] : getPaypalLineItems(purchaseUnit);
    const items: InvoiceLineItem[] =
      canonicalPricing?.items ??
      (paypalItems.length ? paypalItems : getCartLineItems(cart, currencyCode));
    const startY = Math.max(270, contactBottom + 20);

    const contentBottom = 730;
    const drawFooter = () => {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333')
        .text('Thank you for your purchase!', 50, 750, { align: 'center' })
        .text('Questions? contact@codexchristi.shop', 50, 765, { align: 'center' });
    };
    const drawTableHeader = (top: number) => {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#333')
        .text('Description', 50, top)
        .text('SKU', 210, top)
        .text('Qty', 350, top, { width: 50, align: 'right' })
        .text('Price', 400, top, { width: 70, align: 'right' })
        .text('Total', 470, top, { width: 80, align: 'right' })
        .moveTo(50, top + 15)
        .lineTo(550, top + 15)
        .stroke();
      return top + 25;
    };
    const nextPage = () => {
      drawFooter();
      doc.addPage();
      return drawTableHeader(50);
    };

    let y = drawTableHeader(startY);
    for (const item of items) {
      const unitAmount = item.unitAmount;
      const itemCurrencyCode = unitAmount.currencyCode || currencyCode;
      const quantity = parseInt(item.quantity || '0');
      const priceText = canonicalPricing
        ? unitAmount.value
        : parseFloat(unitAmount?.value || '0').toFixed(2);
      const totalText = canonicalPricing
        ? (item.lineAmount ?? '0')
        : (quantity * parseFloat(unitAmount?.value || '0')).toFixed(2);
      const cells = [
        { text: item.name || '', x: 50, width: 145 },
        { text: item.sku || '', x: 210, width: 135 },
        { text: quantity.toString(), x: 350, width: 50, align: 'right' as const },
        { text: `${priceText} ${itemCurrencyCode}`, x: 400, width: 70, align: 'right' as const },
        { text: `${totalText} ${itemCurrencyCode}`, x: 470, width: 80, align: 'right' as const },
      ];
      const rowHeight = Math.max(
        30,
        ...cells.map((cell) => doc.heightOfString(cell.text, cell) + 10),
      );
      if (rowHeight > contentBottom - 75) {
        throw new Error('Receipt line is too long to fit on one page.');
      }
      if (y + rowHeight > contentBottom) y = nextPage();

      for (const cell of cells) {
        doc.fillColor('#333').text(cell.text, cell.x, y, cell);
      }
      y += rowHeight;
    }

    // Summary
    const amount = (purchaseUnit as {
      amount?: {
        currencyCode?: string;
        currency_code?: string;
        value?: string;
        breakdown?: {
          itemTotal?: { value?: string };
          item_total?: { value?: string };
          shipping?: { value?: string };
        };
      };
    } | null)?.amount;
    if (amount || canonicalPricing) {
      if (y + 100 > contentBottom) y = nextPage();
      const summaryCurrencyCode =
        canonicalPricing?.currencyCode ?? amount?.currencyCode ?? amount?.currency_code ?? '';
      const breakdown = amount?.breakdown;
      const subtotalText =
        canonicalPricing?.subtotal ??
        parseFloat(
          breakdown?.itemTotal?.value ?? breakdown?.item_total?.value ?? '0',
        ).toFixed(2);
      const shippingText =
        canonicalPricing?.shipping ?? parseFloat(breakdown?.shipping?.value || '0').toFixed(2);
      const totalText =
        canonicalPricing?.total ?? parseFloat(amount?.value || '0').toFixed(2);

      doc
        .moveTo(400, y + 20)
        .lineTo(550, y + 20)
        .stroke()
        .text('Subtotal:', 400, y + 30, { width: 70, align: 'right' })
        .text(`${subtotalText} ${summaryCurrencyCode}`, 470, y + 30, {
          width: 80,
          align: 'right',
        })
        .text('Shipping:', 400, y + 50, { width: 70, align: 'right' })
        .text(`${shippingText} ${summaryCurrencyCode}`, 470, y + 50, {
          width: 80,
          align: 'right',
        })
        .moveTo(400, y + 70)
        .lineTo(550, y + 70)
        .stroke()
        .font('Helvetica-Bold')
        .text('Total:', 400, y + 80, { width: 70, align: 'right' })
        .text(`${totalText} ${summaryCurrencyCode}`, 470, y + 80, {
          width: 80,
          align: 'right',
        })
        .font('Helvetica');
    }

    drawFooter();

    doc.end();
  });
  return pdfBuffer;
};

function ensureHelveticaAFM() {
  const sourcePath = path.resolve('node_modules/pdfkit/js/data/Helvetica.afm');
  const destDir = path.resolve('.next/server/vendor-chunks/data');
  const destPath = path.join(destDir, 'Helvetica.afm');
  if (!fsSync.existsSync(destDir)) {
    fsSync.mkdirSync(destDir, { recursive: true });
  }

  if (!fsSync.existsSync(destPath)) {
    fsSync.copyFileSync(sourcePath, destPath);
  }
}
