import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  if (req.method === "POST" && req.nextUrl.pathname === "/portal") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/qr/update";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/portal",
};
