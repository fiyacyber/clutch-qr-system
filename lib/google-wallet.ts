import crypto from "node:crypto";

type WalletProfile = {
  id: string;
  slug: string;
  contactName?: string | null;
  businessName?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
};

type GoogleWalletEnv = {
  issuerId: string;
  clientEmail: string;
  privateKey: string;
};

function base64UrlEncode(value: string | Buffer): string {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtRS256(payload: Record<string, unknown>, env: GoogleWalletEnv): string {
  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = signer.sign(env.privateKey);

  return `${data}.${base64UrlEncode(signature)}`;
}

export function readGoogleWalletEnv(): GoogleWalletEnv {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID || "";
  const clientEmail = process.env.GOOGLE_WALLET_CLIENT_EMAIL || "";
  const privateKey = (process.env.GOOGLE_WALLET_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!issuerId || !clientEmail || !privateKey) {
    throw new Error("Google Wallet environment variables are missing.");
  }

  return { issuerId, clientEmail, privateKey };
}

function compactText(value: string | null | undefined, fallback = ""): string {
  return (value || fallback).trim();
}

export function createGoogleWalletUrl(profile: WalletProfile, appUrl: string): string {
  const env = readGoogleWalletEnv();

  const classSuffix = "clutch_connect_profile";
  const classId = `${env.issuerId}.${classSuffix}`;
  const objectSuffix = `profile_${profile.id.replace(/[^a-zA-Z0-9_.-]/g, "")}_${Date.now()}`;
  const objectId = `${env.issuerId}.${objectSuffix}`;
  const profileUrl = `${appUrl.replace(/\/$/, "")}/u/${profile.slug}`;

  const displayName = compactText(profile.contactName, compactText(profile.businessName, "Clutch Connect"));
  const company = compactText(profile.businessName);
  const title = compactText(profile.title);

  const contactLines = [
    profile.phone ? `Phone: ${profile.phone}` : null,
    profile.email ? `Email: ${profile.email}` : null,
    profile.website ? `Website: ${profile.website}` : null,
  ].filter(Boolean) as string[];

  const claims = {
    iss: env.clientEmail,
    aud: "google",
    typ: "savetowallet",
    payload: {
      genericClasses: [
        {
          id: classId,
          issuerName: "Clutch Connect",
          reviewStatus: "UNDER_REVIEW",
        },
      ],
      genericObjects: [
        {
          id: objectId,
          classId,
          cardTitle: {
            defaultValue: {
              language: "en-US",
              value: displayName,
            },
          },
          subheader: {
            defaultValue: {
              language: "en-US",
              value: company || "Clutch Print Shop",
            },
          },
          header: {
            defaultValue: {
              language: "en-US",
              value: title || "Digital Business Card",
            },
          },
          barcode: {
            type: "QR_CODE",
            value: profileUrl,
            alternateText: profileUrl,
          },
          textModulesData: [
            {
              id: "profile_url",
              header: "Profile",
              body: profileUrl,
            },
            {
              id: "contact_details",
              header: "Contact",
              body: contactLines.join("\n") || "Open profile for details",
            },
          ],
          linksModuleData: {
            uris: [
              {
                id: "profile",
                description: "Open Clutch Connect profile",
                uri: profileUrl,
              },
            ],
          },
        },
      ],
    },
  };

  const token = signJwtRS256(claims, env);
  return `https://pay.google.com/gp/v/save/${token}`;
}
