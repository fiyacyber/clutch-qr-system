import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      enabled: false,
      message:
        "Add to Apple Wallet is coming soon. This will be enabled after PassKit certificates and environment variables are configured.",
    },
    { status: 501 }
  );
}
