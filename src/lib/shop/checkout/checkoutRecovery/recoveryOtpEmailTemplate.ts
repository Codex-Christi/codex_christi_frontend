type RecoveryOtpEmailTemplateProps = {
  otp: string;
  recipientName?: string;
  expiresInMinutes?: number;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function buildRecoveryOtpEmailHtml({
  otp,
  recipientName,
  expiresInMinutes = 10,
}: RecoveryOtpEmailTemplateProps) {
  const safeOtp = escapeHtml(otp);
  const safeName = recipientName?.trim() ? escapeHtml(recipientName.trim()) : 'there';
  const currentYear = new Date().getFullYear();

  return `<!doctype html>
<html>

<body style="margin:0;padding:0;background:#05070d;color:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#05070d;padding:28px 14px;">
        <tr>
            <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;
                padding-top:10px">
                    <tr>
                        <td align="center" style="padding-bottom:18px;">
                            <img src="https://codexchristi.org/media/img/general/logo-glow-tiny.jpg" width="64" height="64" alt="Codex Christi" style="border-radius:18px;border:1px solid rgba(255,255,255,0.14);" />
                            <div style="font-size:13px;letter-spacing:0.22em;text-transform:uppercase;color:#94a3b8;margin-top:12px;">Codex Christi</div>
                        </td>
                    </tr>
                    <tr>
                        <td style="border:1px solid rgba(148,163,184,0.22);border-radius:24px;background:#0b1020;padding:34px 26px;text-align:center;">
                            <div style="font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#38bdf8;font-weight:700;">Checkout Recovery</div>
                            <h1 style="margin:14px 0 10px;font-size:28px;line-height:1.18;color:#ffffff;">Verify your email</h1>
                            <p style="margin:0 auto 24px;max-width:470px;font-size:15px;line-height:1.65;color:#cbd5e1;">Hi ${safeName}, use this code to view the latest status of your Codex Christi checkout recovery.</p>
                            <div style="margin:0 auto 24px;max-width:360px;border-radius:20px;background:#111827;border:1px solid rgba(56,189,248,0.35);padding:18px 14px;">
                                <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#93c5fd;margin-bottom:10px;">One-time code</div>
                                <div style="font-size:38px;line-height:1;letter-spacing:0.22em;color:#ffffff;font-weight:800;">${safeOtp}</div>
                            </div>
                            <p style="margin:0 auto;max-width:460px;font-size:14px;line-height:1.6;color:#94a3b8;">
                                This code expires in <strong style="color:#e2e8f0;">${expiresInMinutes} minutes</strong>. Do not share it with anyone.
                            </p>
                        </td>



                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <p style="margin:0 auto;max-width:460px;background:#05070d;font-size:14px;line-height:1.6;color:#94a3b8;
    text-align:center">
        Copyright <strong style="color:#e2e8f0;"> &copy; ${currentYear} Codex Christi. All Rights Reserved. </strong>
    </p>
</body>

</html>`;
}
