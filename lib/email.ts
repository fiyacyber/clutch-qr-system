type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  fromName?: string;
};

function getResendApiKey() {
  return process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "";
}

function getEmailFromAddress(fromName = "Clutch Connect") {
  const configuredFrom = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "welcome@clutchprintshop.com";
  if (!configuredFrom.includes("<")) return `${fromName} <${configuredFrom}>`;

  const address = configuredFrom.match(/<([^>]+)>/)?.[1]?.trim();
  return address ? `${fromName} <${address}>` : configuredFrom;
}

export function isEmailConfigured() {
  return Boolean(getResendApiKey());
}

export async function sendTransactionalEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey,
  fromName,
}: SendEmailInput) {
  const apiKey = getResendApiKey();

  if (!apiKey) {
    throw new Error("Resend API key is missing.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: getEmailFromAddress(fromName),
      to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${body}`);
  }

  return response.json();
}
