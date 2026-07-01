import { NextRequest, NextResponse } from "next/server";

const RESERVED_CONNECT_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "portal",
  "settings",
  "qr",
  "connect",
  "dashboard",
  "billing",
  "checkout",
  "support",
  "help",
  "terms",
  "privacy",
]);

function getPublicConnectHost() {
  const baseUrl = process.env.NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL;
  if (!baseUrl) return "";

  try {
    return new URL(baseUrl).host.toLowerCase();
  } catch {
    return "";
  }
}

export function proxy(req: NextRequest) {
  if (req.method === "POST" && req.nextUrl.pathname === "/portal") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/qr/update";
    return NextResponse.rewrite(url);
  }

  const publicConnectHost = getPublicConnectHost();
  const requestHost = req.headers.get("host")?.toLowerCase() || "";
  const pathSegments = req.nextUrl.pathname.split("/").filter(Boolean);

  if (
    (req.method === "GET" || req.method === "HEAD") &&
    publicConnectHost &&
    requestHost === publicConnectHost &&
    pathSegments.length === 1
  ) {
    const [slug] = pathSegments;
    if (!RESERVED_CONNECT_SLUGS.has(slug.toLowerCase())) {
      const url = req.nextUrl.clone();
      url.pathname = `/u/${slug}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/portal", "/:path*"],
};
