import PDFDocument from 'pdfkit';
import fsSync from 'node:fs';
import path from 'node:path';
import { OrderResponseBody } from '@paypal/paypal-js';

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

// Main Func
export const createPaypalShopInvoicePDF = async (authData: OrderResponseBody) => {
  ensureHelveticaAFM();

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

    // Billing information
    const payer = authData.payer;
    if (payer) {
      doc
        .fontSize(12)
        .text('Bill To:', 50, 150)
        .text(getPayerName(payer), 50, 165)
        .text(getPayerEmail(payer), 50, 180)
        .moveDown(2);
    }

    const purchaseUnit = getPurchaseUnit(authData);

    // Shipping information
    const shipping = (purchaseUnit as {
      shipping?: {
        name?: { fullName?: string; full_name?: string };
        address?: {
          addressLine1?: string;
          addressLine2?: string;
          adminArea1?: string;
          adminArea2?: string;
          postalCode?: string;
          address_line_1?: string;
          address_line_2?: string;
          admin_area_1?: string;
          admin_area_2?: string;
          postal_code?: string;
        };
      };
    } | null)?.shipping;
    if (shipping) {
      const address = shipping.address;
      doc
        .text('Ship To:', 400, 150)
        .text(shipping.name?.fullName ?? shipping.name?.full_name ?? '', 400, 165)
        .text(address?.addressLine1 ?? address?.address_line_1 ?? '', 400, 180)
        .text(
          `${address?.adminArea2 ?? address?.admin_area_2 ?? ''}, ${address?.adminArea1 ?? address?.admin_area_1 ?? ''} ${address?.postalCode ?? address?.postal_code ?? ''}`,
        )
        .moveDown(1);
    }

    // Line items table
    const items =
      ((purchaseUnit as {
        items?: Array<{
          name?: string;
          sku?: string;
          quantity?: string;
          unitAmount?: { value?: string; currencyCode?: string };
          unit_amount?: { value?: string; currency_code?: string };
        }>;
      } | null)?.items ??
        []) as Array<{
        name?: string;
        sku?: string;
        quantity?: string;
        unitAmount?: { value?: string; currencyCode?: string };
        unit_amount?: { value?: string; currency_code?: string };
      }>;
    const startY = 270;

    // Table header
    doc
      .fontSize(10)
      .fillColor('#333')
      .text('Description', 50, startY)
      .text('SKU', 210, startY)
      .text('Qty', 350, startY, { width: 50, align: 'right' })
      .text('Price', 400, startY, { width: 70, align: 'right' })
      .text('Total', 470, startY, { width: 80, align: 'right' })
      .moveTo(50, startY + 15)
      .lineTo(550, startY + 15)
      .stroke();

    // Table rows
    let y = startY + 25;
    items.forEach((item) => {
      const unitAmount = item.unitAmount ?? item.unit_amount;
      const currencyCode = unitAmount?.currencyCode ?? unitAmount?.currency_code ?? '';
      const quantity = parseInt(item.quantity || '0');
      const price = parseFloat(unitAmount?.value || '0');
      const total = quantity * price;

      doc
        .fillColor('#333')
        .text(item.name || '', 50, y, { width: 145, lineBreak: true })
        .text(item.sku || '', 210, y, { width: 150, lineBreak: true })
        .text(quantity.toString(), 350, y, { width: 50, align: 'right' })
        .text(`${price} ${currencyCode}`, 400, y, { width: 70, align: 'right' })
        .text(`${total.toFixed(2)} ${currencyCode}`, 470, y, { width: 80, align: 'right' });

      y += 30;
    });

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
    if (amount) {
      const currencyCode = amount.currencyCode ?? amount.currency_code ?? '';
      const breakdown = amount.breakdown;
      const subtotal = parseFloat(breakdown?.itemTotal?.value ?? breakdown?.item_total?.value ?? '0');
      const shippingCost = parseFloat(breakdown?.shipping?.value || '0');
      const total = parseFloat(amount.value || '0');

      doc
        .moveTo(400, y + 20)
        .lineTo(550, y + 20)
        .stroke()
        .text('Subtotal:', 400, y + 30, { width: 70, align: 'right' })
        .text(`${subtotal.toFixed(2)} ${currencyCode}`, 470, y + 30, {
          width: 80,
          align: 'right',
        })
        .text('Shipping:', 400, y + 50, { width: 70, align: 'right' })
        .text(`${shippingCost.toFixed(2)} ${currencyCode}`, 470, y + 50, {
          width: 80,
          align: 'right',
        })
        .moveTo(400, y + 70)
        .lineTo(550, y + 70)
        .stroke()
        .font('Helvetica-Bold')
        .text('Total:', 400, y + 80, { width: 70, align: 'right' })
        .text(`${total.toFixed(2)} ${currencyCode}`, 470, y + 80, { width: 80, align: 'right' })
        .font('Helvetica');
    }

    // Footer
    doc
      .fontSize(10)
      .text('Thank you for your purchase!', 50, 750, { align: 'center' })
      .text('Questions? contact@codexchristi.shop', 50, 765, { align: 'center' });

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
