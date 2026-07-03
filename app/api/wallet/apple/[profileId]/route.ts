import { NextRequest, NextResponse } from "next/server";
import { PKPass } from "passkit-generator";
import QRCode from "qrcode";
import { createSupabaseAdminClient } from "@/lib/supabase-server";
import { buildConnectPublicProfileUrl, clutchConnectProfileUrl } from "@/lib/qr";
import { trackWalletEvent } from "@/lib/wallet-events";

export const runtime = "nodejs";

async function getImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function requiredEnv(key: string): string {
  const value = process.env[key] || "";
  if (!value) {
    throw new Error(`${key} is required for Apple Wallet generation.`);
  }
  return value;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const admin = createSupabaseAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, slug, contact_name, business_name, title, phone, email, website, avatar_url")
    .eq("id", profileId)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profileUrl = clutchConnectProfileUrl(profile.slug);
  const fallbackUrl = new URL(buildConnectPublicProfileUrl(profile.slug));
  fallbackUrl.searchParams.set("wallet", "apple_unavailable");

  try {
    const wwdr = requiredEnv("APPLE_WALLET_WWDR_CERT_BASE64");
    const signerCert = requiredEnv("APPLE_WALLET_SIGNER_CERT_BASE64");
    const signerKey = requiredEnv("APPLE_WALLET_SIGNER_KEY_BASE64");
    const signerKeyPassphrase = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE || "";
    const passTypeIdentifier = requiredEnv("APPLE_WALLET_PASS_TYPE_IDENTIFIER");
    const teamIdentifier = requiredEnv("APPLE_WALLET_TEAM_IDENTIFIER");

    const qrBuffer = await QRCode.toBuffer(profileUrl, {
      type: "png",
      width: 320,
      margin: 1,
      color: {
        dark: "#384862",
        light: "#ffffff",
      },
    });

    const serialNumber = `profile-${profile.id}-${Date.now()}`;
    const passJson = {
      formatVersion: 1,
      passTypeIdentifier,
      teamIdentifier,
      organizationName: "Clutch Connect",
      serialNumber,
      description: "Clutch Connect Digital Business Card",
      logoText: "Clutch Connect",
      foregroundColor: "rgb(255,255,255)",
      backgroundColor: "rgb(56,72,98)",
      labelColor: "rgb(255,166,101)",
      storeCard: {},
    };

    const buffers: Record<string, Buffer> = {
      "pass.json": Buffer.from(JSON.stringify(passJson), "utf8"),
      "icon.png": qrBuffer,
      "icon@2x.png": qrBuffer,
      "logo.png": qrBuffer,
      "logo@2x.png": qrBuffer,
    };

    if (profile.avatar_url) {
      const avatar = await getImageBuffer(profile.avatar_url);
      if (avatar) {
        buffers["thumbnail.png"] = avatar;
      }
    }

    const pass = new PKPass(
      buffers,
      {
        wwdr: Buffer.from(wwdr, "base64"),
        signerCert: Buffer.from(signerCert, "base64"),
        signerKey: Buffer.from(signerKey, "base64"),
        signerKeyPassphrase,
      },
      {}
    ) as any;

    pass.type = "storeCard";
    pass.primaryFields.push({
      key: "name",
      label: "NAME",
      value: profile.contact_name || profile.business_name || "Clutch Connect",
    });

    pass.secondaryFields.push(
      {
        key: "company",
        label: "COMPANY",
        value: profile.business_name || "Clutch Print Shop",
      },
      {
        key: "title",
        label: "TITLE",
        value: profile.title || "Digital Business Card",
      }
    );

    pass.backFields.push(
      { key: "phone", label: "Phone", value: profile.phone || "" },
      { key: "email", label: "Email", value: profile.email || "" },
      { key: "website", label: "Website", value: profile.website || "" },
      { key: "profile", label: "Clutch Connect Profile", value: profileUrl }
    );

    pass.setBarcodes({
      message: profileUrl,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: profileUrl,
    });

    await trackWalletEvent(profile.id, "apple", _req.headers);

    const buffer = pass.getAsBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename=clutch-connect-${profile.slug}.pkpass`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("APPLE WALLET PASS ERROR", error);
    return NextResponse.redirect(fallbackUrl, { status: 302 });
  }
}
