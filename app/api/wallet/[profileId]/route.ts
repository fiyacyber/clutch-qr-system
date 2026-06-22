import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ profileId: string }> }
) {
  const { profileId } = await context.params;
  return NextResponse.redirect(new URL(`/api/wallet/apple/${profileId}`, req.url));
}
