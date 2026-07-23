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
  const baseUrl =
    process.env.CLUTCH_CONNECT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_CLUTCH_CONNECT_PUBLIC_BASE_URL;
  if (!baseUrl) return "";

  const normalized = String(baseUrl)
    .trim()
    .replace(/clutchonnect\.link/gi, "clutchconnect.link")
    .replace(/\/+$/, "");

  try {
    const parsed = new URL(/^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`);
    return parsed.host.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeHost(host: string) {
  return host.toLowerCase().replace(/:\d+$/, "").trim();
}

function getAllowedPublicConnectHosts(publicHost: string) {
  const host = normalizeHost(publicHost);
  if (!host) return new Set<string>();

  if (host.startsWith("www.")) {
    return new Set([host, host.slice(4)]);
  }

  return new Set([host, `www.${host}`]);
}

export function proxy(req: NextRequest) {
  if (req.method === "POST" && req.nextUrl.pathname === "/portal") {
    const url = req.nextUrl.clone();
    url.pathname = "/api/qr/update";
    return NextResponse.rewrite(url);
  }

  if (
    (req.method === "GET" || req.method === "HEAD") &&
    req.nextUrl.pathname === "/portal/analytics"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/portal/analytics-hub";
    return NextResponse.rewrite(url);
  }

  const publicConnectHost = getPublicConnectHost();
  const allowedHosts = getAllowedPublicConnectHosts(publicConnectHost);
  const requestHost = normalizeHost(req.headers.get("host") || "");
  const pathSegments = req.nextUrl.pathname.split("/").filter(Boolean);

  if (
    (req.method === "GET" || req.method === "HEAD") &&
    allowedHosts.size > 0 &&
    allowedHosts.has(requestHost) &&
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
