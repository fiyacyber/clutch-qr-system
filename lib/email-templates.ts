type ClutchTemplateInput = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  detailsHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  helperText?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderEmailLayout({
  preheader,
  eyebrow,
  title,
  intro,
  detailsHtml,
  ctaLabel,
  ctaUrl,
  helperText,
}: ClutchTemplateInput) {
  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;line-height:1px;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #e7edf4;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:linear-gradient(135deg,#384862 0%,#1f2a3b 100%);padding:28px 28px 24px 28px;">
                <p style="margin:0 0 10px 0;color:#ffa665;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${escapeHtml(eyebrow)}</p>
                <p style="margin:0;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:30px;line-height:1.15;font-weight:700;">Clutch Connect</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 12px 0;color:#1f2a3b;font-family:Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 18px 0;color:#4e5f79;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px 0;background:#f9fbff;border:1px solid #dbe7f3;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;color:#24334a;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;">${detailsHtml}</td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="center" style="background:#ffa665;border-radius:999px;">
                      <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;color:#1f2a3b;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;">${escapeHtml(ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                ${helperText ? `<p style="margin:16px 0 0 0;color:#6b7c93;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;">${escapeHtml(helperText)}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#f2f6fb;border-top:1px solid #e0e8f1;">
                <p style="margin:0;color:#6b7c93;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;">Clutch Connect from Clutch Print Shop</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;
}

export function buildOnboardingEmailTemplate({
  email,
  temporaryPassword,
  planName,
  intro,
  loginUrl,
  trialEndsAt,
}: {
  email: string;
  temporaryPassword: string;
  planName: string;
  intro: string;
  loginUrl: string;
  trialEndsAt?: string | null;
}) {
  const safeEmail = escapeHtml(email);
  const safePassword = escapeHtml(temporaryPassword);
  const brandedPlanName = planName.toLowerCase().includes("clutch") ? planName : `Clutch ${planName}`;
  const trialEndLabel = trialEndsAt
    ? new Intl.DateTimeFormat("en", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(new Date(trialEndsAt))
    : null;

  const html = renderEmailLayout({
    preheader: `Your ${brandedPlanName} access is ready.`,
    eyebrow: "Account ready",
    title: `Welcome to ${brandedPlanName}`,
    intro,
    detailsHtml: `
      <p style="margin:0 0 10px 0;"><strong>Portal login:</strong> <a href="${escapeHtml(loginUrl)}" style="color:#2b5c93;text-decoration:underline;">${escapeHtml(loginUrl)}</a></p>
      <p style="margin:0 0 6px 0;"><strong>Email:</strong> ${safeEmail}</p>
      ${trialEndLabel ? `<p style="margin:0 0 6px 0;"><strong>Trial ends:</strong> ${escapeHtml(trialEndLabel)}</p>` : ""}
      <p style="margin:0;"><strong>Temporary password:</strong> ${safePassword}</p>
    `,
    ctaLabel: "Open Clutch Connect",
    ctaUrl: loginUrl,
    helperText: "You will be prompted to create a new password after your first sign in.",
  });

  const text = [
    `Welcome to ${brandedPlanName}!`,
    "",
    intro,
    "",
    `Portal login: ${loginUrl}`,
    `Email: ${email}`,
    ...(trialEndLabel ? [`Trial ends: ${trialEndLabel}`] : []),
    `Temporary password: ${temporaryPassword}`,
    "",
    "You will be prompted to create a new password after your first sign in.",
    "",
    "Clutch Connect from Clutch Print Shop",
  ].join("\n");

  return { html, text };
}