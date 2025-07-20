import PDFDocument from 'pdfkit';
import fsSync from 'node:fs';
import path from 'node:path';
import { OrderResponseBody } from '@paypal/paypal-js';

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
      .text(`Date: ${new Date(authData.create_time || '').toLocaleDateString()}`, {
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
        .text(`${payer.name?.given_name || ''} ${payer.name?.surname || ''}`, 50, 165)
        .text(payer.email_address || '', 50, 180)
        .moveDown(2);
    }

    // Shipping information
    const shipping = authData.purchase_units?.[0]?.shipping;
    if (shipping) {
      const address = shipping.address;
      doc
        .text('Ship To:', 400, 150)
        .text(shipping.name?.full_name || '', 400, 165)
        .text(address?.address_line_1 || '', 400, 180)
        .text(
          `${address?.admin_area_2 || ''}, ${address?.admin_area_1 || ''} ${address?.postal_code || ''}`,
        )
        .moveDown(1);
    }

    // Line items table
    const items = authData.purchase_units?.[0]?.items || [];
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
      const {
        unit_amount: { currency_code },
      } = item;
      const quantity = parseInt(item.quantity || '0');
      const price = parseFloat(item.unit_amount?.value || '0');
      const total = quantity * price;

      doc
        .fillColor('#333')
        .text(item.name || '', 50, y, { width: 145, lineBreak: true })
        .text(item.sku || '', 210, y, { width: 150, lineBreak: true })
        .text(quantity.toString(), 350, y, { width: 50, align: 'right' })
        .text(`${price} ${currency_code}`, 400, y, { width: 70, align: 'right' })
        .text(`${total.toFixed(2)} ${currency_code}`, 470, y, { width: 80, align: 'right' });

      y += 30;
    });

    // Summary
    const amount = authData.purchase_units?.[0]?.amount;
    if (amount) {
      const { currency_code } = amount;
      const breakdown = amount.breakdown;
      const subtotal = parseFloat(breakdown?.item_total?.value || '0');
      const shippingCost = parseFloat(breakdown?.shipping?.value || '0');
      const total = parseFloat(amount.value || '0');

      doc
        .moveTo(400, y + 20)
        .lineTo(550, y + 20)
        .stroke()
        .text('Subtotal:', 400, y + 30, { width: 70, align: 'right' })
        .text(`${subtotal.toFixed(2)} ${currency_code}`, 470, y + 30, {
          width: 80,
          align: 'right',
        })
        .text('Shipping:', 400, y + 50, { width: 70, align: 'right' })
        .text(`${shippingCost.toFixed(2)} ${currency_code}`, 470, y + 50, {
          width: 80,
          align: 'right',
        })
        .moveTo(400, y + 70)
        .lineTo(550, y + 70)
        .stroke()
        .font('Helvetica-Bold')
        .text('Total:', 400, y + 80, { width: 70, align: 'right' })
        .text(`${total.toFixed(2)} ${currency_code}`, 470, y + 80, { width: 80, align: 'right' })
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
