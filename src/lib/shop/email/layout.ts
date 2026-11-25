import { getShopSiteUrl } from '@/lib/siteBaseUrls.server';

export type ShopEmailLayoutProps = {
  previewText: string;
  eyebrow: string;
  heading: string;
  greeting?: string;
  paragraphs: readonly string[];
  code?: { value: string; expiresInMinutes: number };
  details?: readonly { label: string; value: string }[];
  action?: { label: string; href: string };
  footerText: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function httpUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Shop email links must use HTTP or HTTPS without embedded credentials.');
  return url.href;
}

const paragraphStyle =
  'margin:0 0 18px;color:#b8c4d3;font-size:16px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;';

/** Renders escaped message content only; sending and recipient selection stay with callers. */
export function buildShopEmailLayout(input: ShopEmailLayoutProps) {
  const shopUrl = httpUrl(getShopSiteUrl('/'));
  const logoUrl = httpUrl(getShopSiteUrl('/media/favicons/brand-192.png'));
  const actionUrl = input.action ? httpUrl(input.action.href) : null;
  if (
    input.code &&
    (!Number.isFinite(input.code.expiresInMinutes) || input.code.expiresInMinutes <= 0)
  )
    throw new Error('A shop verification email needs a positive code expiry.');

  const expiry = input.code
    ? `This code expires in ${input.code.expiresInMinutes} ${input.code.expiresInMinutes === 1 ? 'minute' : 'minutes'}.`
    : '';
  const paragraphs = [input.greeting, ...input.paragraphs]
    .filter((value): value is string => value !== undefined)
    .map((value) => `<p style="${paragraphStyle}">${escapeHtml(value)}</p>`)
    .join('');
  const code = input.code
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border:1px solid #36556e;border-radius:12px;background:#061b2f;" bgcolor="#061b2f">
        <tr><td align="center" style="padding:20px 12px;">
          <p style="margin:0 0 12px;color:#79c6ff;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Verification code</p>
          <p dir="ltr" style="margin:0 0 16px;color:#ffffff;font-family:Consolas,'Courier New',monospace;font-size:32px;font-weight:700;line-height:1.3;letter-spacing:4px;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(input.code.value)}</p>
          <p style="margin:0;color:#b8c4d3;font-size:14px;line-height:1.6;">${escapeHtml(expiry)} Do not share it with anyone.</p>
        </td></tr>
      </table>`
    : '';
  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;border-top:1px solid #39414d;table-layout:fixed;">
        ${input.details
          .map(
            ({ label, value }) => `<tr><td style="padding:14px 0;border-bottom:1px solid #39414d;">
              <p style="margin:0 0 5px;color:#b8c4d3;font-size:12px;font-weight:700;line-height:1.5;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(label)}</p>
              <p style="margin:0;color:#ffffff;font-size:16px;line-height:1.5;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(value)}</p>
            </td></tr>`,
          )
          .join('')}
      </table>`
    : '';
  const action =
    input.action && actionUrl
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
          <tr><td align="center" bgcolor="#0072db" style="background:#0072db;border-radius:10px;mso-padding-alt:14px 20px;">
            <a href="${escapeHtml(actionUrl)}" style="display:block;padding:14px 20px;color:#ffffff;font-size:16px;font-weight:700;line-height:1.5;text-decoration:none;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.action.label)}</a>
          </td></tr>
        </table>
        <p style="${paragraphStyle}font-size:13px;">If the button does not work, open this link:<br><a href="${escapeHtml(actionUrl)}" style="color:#79c6ff;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${escapeHtml(actionUrl)}</a></p>`
      : '';

  const htmlbody = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(input.heading)}</title></head>
<body style="margin:0;padding:0;width:100%;background:#05070d;color:#ffffff;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;" bgcolor="#05070d">
  <div style="display:none!important;visibility:hidden;mso-hide:all;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(input.previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#05070d" style="width:100%;background:#05070d;">
    <tr><td align="center" style="padding:24px 12px;">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;table-layout:fixed;">
        <tr><td style="height:4px;background:#0085ff;font-size:0;line-height:0;" bgcolor="#0085ff">&nbsp;</td></tr>
        <tr><td bgcolor="#061b2f" style="padding:22px 24px;background:#061b2f;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td width="56" valign="middle" style="width:56px;padding-right:12px;">
              <img src="${escapeHtml(logoUrl)}" width="44" height="44" alt="Codex Christi mark" style="display:block;width:44px;height:44px;border:0;">
            </td><td valign="middle" style="color:#ffffff;font-size:16px;line-height:1.4;font-weight:700;overflow-wrap:anywhere;">Codex Christi Shop</td></tr>
          </table>
        </td></tr>
        <tr><td bgcolor="#16191f" style="padding:26px 24px;background:#16191f;border:1px solid #39414d;border-top:0;">
          <p style="margin:0 0 10px;color:#79c6ff;font-size:12px;line-height:1.5;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.eyebrow)}</p>
          <h1 style="margin:0 0 20px;color:#ffffff;font-size:26px;line-height:1.25;font-weight:700;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.heading)}</h1>
          ${paragraphs}${code}${details}${action}
          <p style="margin:0;padding-top:20px;border-top:1px solid #39414d;color:#b8c4d3;font-size:13px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(input.footerText)}</p>
        </td></tr>
        <tr><td align="center" style="padding:20px 12px;color:#b8c4d3;font-size:13px;line-height:1.6;">
          <a href="${escapeHtml(shopUrl)}" style="color:#79c6ff;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">Visit Codex Christi Shop</a>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;

  const textbody = [
    'Codex Christi Shop',
    input.eyebrow,
    input.heading,
    input.greeting,
    ...input.paragraphs,
    input.code
      ? `Verification code: ${input.code.value}\n${expiry} Do not share it with anyone.`
      : null,
    input.details?.map(({ label, value }) => `${label}: ${value}`).join('\n'),
    input.action && actionUrl ? `${input.action.label}: ${actionUrl}` : null,
    input.footerText,
    `Visit Codex Christi Shop: ${shopUrl}`,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join('\n\n');

  return { htmlbody, textbody };
}
