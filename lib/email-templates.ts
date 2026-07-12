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

export function buildSmartCardSetupEmailTemplate({
  setupUrl,
  orderStatusUrl,
  customerName,
  orderNumber,
  productTitle,
  engravingRequested,
  businessName,
  title,
  phone,
  email,
}: {
  setupUrl: string;
  orderStatusUrl?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
  productTitle?: string | null;
  engravingRequested?: boolean | null;
  businessName?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  const greeting = customerName ? `Hi ${customerName},` : "Hi there,";
  const safeSetupUrl = escapeHtml(setupUrl);
  const safeOrderStatusUrl = orderStatusUrl ? escapeHtml(orderStatusUrl) : null;
  const supportEmail =
    String(process.env.CLUTCH_SUPPORT_EMAIL || process.env.SUPPORT_EMAIL || "support@clutchprintshop.com").trim() ||
    "support@clutchprintshop.com";
  const safeSupportEmail = escapeHtml(supportEmail);

  const detailRows = [
    customerName ? `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Customer:</strong> ${escapeHtml(customerName)}</td></tr>` : "",
    orderNumber ? `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Order number:</strong> ${escapeHtml(orderNumber)}</td></tr>` : "",
    `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Product:</strong> ${escapeHtml(productTitle || "Clutch Smart Business Card")}</td></tr>`,
    `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Engraving:</strong> ${engravingRequested ? "Requested" : "Not requested"}</td></tr>`,
    businessName ? `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Business name:</strong> ${escapeHtml(businessName)}</td></tr>` : "",
    title ? `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Title:</strong> ${escapeHtml(title)}</td></tr>` : "",
    phone ? `<tr><td style="padding:0 0 8px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Phone:</strong> ${escapeHtml(phone)}</td></tr>` : "",
    email ? `<tr><td style="padding:0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;"><strong>Email:</strong> ${escapeHtml(email)}</td></tr>` : "",
  ]
    .filter(Boolean)
    .join("");

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Your Clutch Connect setup is ready</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;line-height:1px;color:transparent;">Your Smart Business Card order is confirmed, and your Clutch Connect setup is ready.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;padding:20px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e1eb;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#384862;padding:24px 24px 20px 24px;">
                <p style="margin:0;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:700;">Clutch Connect</p>
                <p style="margin:6px 0 0 0;color:#ffa665;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">Smart Business Card Setup</p>
              </td>
            </tr>
            <tr>
              <td style="padding:22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;background:#ffffff;border:1px solid #d9e1eb;border-radius:14px;">
                  <tr>
                    <td style="padding:18px;">
                      <h1 style="margin:0 0 10px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:30px;line-height:1.2;">Welcome to Clutch Connect</h1>
                      <p style="margin:0 0 12px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">Your Smart Business Card order is confirmed, and your Clutch Connect setup is ready.</p>
                      <p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">Thanks for your order. Your card includes guided setup so you can build your digital profile, add your contact details and socials, and start sharing right away.</p>
                    </td>
                  </tr>
                </table>

                <p style="margin:0 0 14px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;">
                  <tr>
                    <td align="center" style="background:#ffa665;border-radius:999px;">
                      <a href="${safeSetupUrl}" style="display:inline-block;padding:14px 24px;color:#384862;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;">Setup Profile</a>
                    </td>
                  </tr>
                </table>

                ${safeOrderStatusUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;"><tr><td align="center" style="background:#ffffff;border-radius:999px;border:1px solid #c8d3e2;"><a href="${safeOrderStatusUrl}" style="display:inline-block;padding:12px 22px;color:#384862;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.2;font-weight:700;">View Order Details</a></td></tr></table>` : ""}

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;background:#ffffff;border:1px solid #d9e1eb;border-radius:14px;">
                  <tr>
                    <td style="padding:18px;">
                      <p style="margin:0 0 12px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.4;font-weight:700;">What happens next</p>
                      <p style="margin:0 0 8px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>1.</strong> We prepare your card</p>
                      <p style="margin:0 0 8px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>2.</strong> You complete guided setup</p>
                      <p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>3.</strong> Start sharing with Clutch Connect</p>
                    </td>
                  </tr>
                </table>

                ${detailRows ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0;background:#ffffff;border:1px solid #d9e1eb;border-radius:14px;"><tr><td style="padding:18px;"><p style="margin:0 0 12px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.4;font-weight:700;">Order details</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${detailRows}</table></td></tr></table>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 22px;background:#f8fafc;border-top:1px solid #d9e1eb;">
                <p style="margin:0 0 6px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;font-weight:700;">Clutch Print Shop</p>
                <p style="margin:0 0 6px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;">Print Smarter. Track Everything.</p>
                <p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;">Need help? Contact <a href="mailto:${safeSupportEmail}" style="color:#384862;text-decoration:underline;">${safeSupportEmail}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  const text = [
    "Your Clutch Connect setup is ready",
    "",
    "Welcome to Clutch Connect",
    "",
    "Your Smart Business Card order is confirmed, and your Clutch Connect setup is ready.",
    "",
    "Thanks for your order. Your card includes guided setup so you can build your digital profile, add your contact details and socials, and start sharing right away.",
    "",
    greeting,
    "",
    "Setup Profile:",
    setupUrl,
    ...(orderStatusUrl ? ["", "View Order Details:", orderStatusUrl] : []),
    "",
    "What happens next:",
    "1. We prepare your card",
    "2. You complete guided setup",
    "3. Start sharing with Clutch Connect",
    "",
    detailRows ? "Order details:" : "",
    ...(customerName ? [`Customer: ${customerName}`] : []),
    ...(orderNumber ? [`Order number: ${orderNumber}`] : []),
    `Product: ${productTitle || "Clutch Smart Business Card"}`,
    `Engraving: ${engravingRequested ? "Requested" : "Not requested"}`,
    ...(businessName ? [`Business name: ${businessName}`] : []),
    ...(title ? [`Title: ${title}`] : []),
    ...(phone ? [`Phone: ${phone}`] : []),
    ...(email ? [`Email: ${email}`] : []),
    "",
    "Clutch Print Shop",
    "Print Smarter. Track Everything.",
    `Need help? Contact ${supportEmail}.`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function buildClutchCodesSubscriptionAccessEmailTemplate({
  firstName,
  planName,
  monthlyPrice,
  allowance,
  accessUrl,
  manageSubscriptionUrl,
  supportEmail = "info@clutchprintshop.com",
}: {
  firstName?: string | null;
  planName: string;
  monthlyPrice: string;
  allowance: number;
  accessUrl: string;
  manageSubscriptionUrl?: string | null;
  supportEmail?: string;
}) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const safeAccessUrl = escapeHtml(accessUrl);
  const safeManageUrl = manageSubscriptionUrl ? escapeHtml(manageSubscriptionUrl) : null;
  const safeSupportEmail = escapeHtml(supportEmail);
  const preheader = "Access your Clutch Codes dashboard and start creating trackable campaigns.";

  const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Your ${escapeHtml(planName)} dashboard is ready</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f8fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;line-height:1px;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f8fb;padding:20px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e1eb;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="background:#384862;padding:26px 24px 22px 24px;">
                <p style="margin:0;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:28px;line-height:1.2;font-weight:700;">Clutch Codes™</p>
                <p style="margin:6px 0 0 0;color:#FFA665;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;">from Clutch Print Shop</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <p style="margin:0 0 10px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;">${escapeHtml(greeting)}</p>
                <h1 style="margin:0 0 12px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:29px;line-height:1.2;">Your Clutch Codes subscription is active</h1>
                <p style="margin:0 0 18px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">Create dynamic QR campaigns, update destinations after printing, and review scan analytics.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;background:#f8fafc;border:1px solid #d9e1eb;border-radius:14px;">
                  <tr><td style="padding:18px 18px 8px 18px;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.4;font-weight:700;">Plan summary</td></tr>
                  <tr><td style="padding:0 18px 8px 18px;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;"><strong>Plan:</strong> ${escapeHtml(planName)}</td></tr>
                  <tr><td style="padding:0 18px 8px 18px;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;"><strong>Billing:</strong> ${escapeHtml(monthlyPrice)}</td></tr>
                  <tr><td style="padding:0 18px 18px 18px;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;"><strong>Allowance:</strong> ${allowance} active Clutch Codes</td></tr>
                </table>

                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px 0;">
                  <tr>
                    <td align="center" style="background:#FFA665;border-radius:999px;">
                      <a href="${safeAccessUrl}" style="display:inline-block;padding:14px 24px;color:#25334a;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.2;font-weight:700;">Access Clutch Codes</a>
                    </td>
                  </tr>
                </table>
                ${safeManageUrl ? `<p style="margin:0 0 20px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;"><a href="${safeManageUrl}" style="color:#384862;text-decoration:underline;font-weight:700;">Manage your subscription</a></p>` : ""}

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px 0;border-top:1px solid #d9e1eb;border-bottom:1px solid #d9e1eb;">
                  <tr><td style="padding:18px 0 10px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:18px;line-height:1.4;font-weight:700;">Get started</td></tr>
                  <tr><td style="padding:0 0 8px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>1.</strong> Open your secure access link</td></tr>
                  <tr><td style="padding:0 0 8px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>2.</strong> Create your first Clutch Code</td></tr>
                  <tr><td style="padding:0 0 18px 0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;"><strong>3.</strong> Download it and begin tracking</td></tr>
                </table>

                <p style="margin:0 0 16px 0;padding:14px;background:#fff7f0;border-left:4px solid #FFA665;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;"><strong>Important:</strong> Clutch Codes subscriptions provide dynamic QR campaign capacity. Clutch Connect+ is a separate digital-profile upgrade.</p>
                <p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;">Need help? Email <a href="mailto:${safeSupportEmail}" style="color:#384862;text-decoration:underline;">${safeSupportEmail}</a>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;background:#f8fafc;border-top:1px solid #d9e1eb;">
                <p style="margin:0 0 5px 0;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;font-weight:700;">Clutch Print Shop · Clutch Codes™</p>
                <p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;">This transactional email was sent because a Clutch Codes subscription was purchased using this address.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    preheader,
    "",
    greeting,
    "",
    "Your Clutch Codes subscription is active",
    "",
    `Plan: ${planName}`,
    `Billing: ${monthlyPrice}`,
    `Allowance: ${allowance} active Clutch Codes`,
    "",
    "Create dynamic QR campaigns, update destinations after printing, and review scan analytics.",
    "",
    "Access Clutch Codes:",
    accessUrl,
    ...(manageSubscriptionUrl ? ["", "Manage your subscription:", manageSubscriptionUrl] : []),
    "",
    "Get started:",
    "1. Open your secure access link",
    "2. Create your first Clutch Code",
    "3. Download it and begin tracking",
    "",
    "Clutch Codes subscriptions provide dynamic QR campaign capacity. Clutch Connect+ is a separate digital-profile upgrade.",
    "",
    `Need help? ${supportEmail}`,
    "",
    "Clutch Print Shop · Clutch Codes™",
    "This transactional email was sent because a Clutch Codes subscription was purchased using this address.",
  ].join("\n");

  return { html, text, preheader };
}

export function buildClutchCodesLifecycleEmailTemplate({
  event,
  planName,
  allowance,
  dashboardUrl = "https://qr.clutchprintshop.com/login",
  supportEmail = "info@clutchprintshop.com",
}: {
  event: "plan_changed" | "subscription_canceled" | "payment_problem";
  planName?: string | null;
  allowance?: number | null;
  dashboardUrl?: string;
  supportEmail?: string;
}) {
  const content = {
    plan_changed: {
      subject: "Your Clutch Codes plan has changed",
      heading: "Your Clutch Codes plan has changed",
      body: `${planName || "Your plan"}${allowance != null ? ` now includes up to ${allowance} active Clutch Codes` : " has been updated"}.`,
    },
    subscription_canceled: {
      subject: "Your Clutch Codes subscription was canceled",
      heading: "Your Clutch Codes subscription was canceled",
      body: "Subscription capacity has been removed. Any included print allowance and existing Clutch Code records remain available.",
    },
    payment_problem: {
      subject: "There is a payment problem with your Clutch Codes subscription",
      heading: "Your Clutch Codes subscription needs attention",
      body: "Shopify reported a billing problem. Review your subscription payment details or contact support for help.",
    },
  }[event];
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const safeSupportEmail = escapeHtml(supportEmail);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(content.subject)}</title></head><body style="margin:0;background:#f6f8fb;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:20px 10px;background:#f6f8fb;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border:1px solid #d9e1eb;border-radius:16px;overflow:hidden;"><tr><td style="padding:24px;background:#384862;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;">Clutch Codes™</td></tr><tr><td style="padding:24px;"><h1 style="margin:0 0 12px;color:#384862;font-family:Helvetica,Arial,sans-serif;font-size:27px;line-height:1.2;">${escapeHtml(content.heading)}</h1><p style="margin:0 0 18px;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;">${escapeHtml(content.body)}</p><p style="margin:0 0 18px;"><a href="${safeDashboardUrl}" style="display:inline-block;padding:13px 22px;border-radius:999px;background:#FFA665;color:#25334a;text-decoration:none;font-family:Helvetica,Arial,sans-serif;font-weight:700;">Access Clutch Codes</a></p><p style="margin:0;color:#4f5f76;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;">Need help? <a href="mailto:${safeSupportEmail}" style="color:#384862;">${safeSupportEmail}</a></p></td></tr></table></td></tr></table></body></html>`;
  const text = [content.heading, "", content.body, "", `Access Clutch Codes: ${dashboardUrl}`, `Support: ${supportEmail}`].join("\n");
  return { subject: content.subject, html, text };
}
