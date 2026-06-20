export function buildAdminMasterTransferOtpEmailHtml({
  otp,
  expiresInMinutes,
}: {
  otp: string;
  expiresInMinutes: number;
}) {
  return `
    <div style="margin:0;padding:0;background:#020617;color:#e5e7eb;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#020617;padding:32px 16px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border:1px solid rgba(255,255,255,0.14);border-radius:12px;background:#0f172a;">
              <tr>
                <td style="padding:28px;">
                  <p style="margin:0 0 10px;color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Codex Christi Admin</p>
                  <h1 style="margin:0 0 12px;color:#ffffff;font-size:24px;line-height:1.2;">Master admin transfer code</h1>
                  <p style="margin:0 0 20px;color:#cbd5e1;font-size:14px;line-height:1.7;">Use this code to complete the master admin transfer. It expires in ${expiresInMinutes} minutes.</p>
                  <div style="margin:0 0 22px;padding:16px;border-radius:10px;background:#020617;border:1px solid rgba(103,232,249,0.35);color:#ffffff;font-size:30px;font-weight:700;letter-spacing:0.22em;text-align:center;">${otp}</div>
                  <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">If you did not expect this code, do not share it.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}
