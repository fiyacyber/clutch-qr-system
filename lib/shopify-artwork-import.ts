import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildPrintFilePath, MAX_PRINT_FILE_BYTES, PRINT_ORDER_FILE_BUCKET } from "./print-operations.ts";

const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const ALLOWED_EXACT_HOSTS = new Set([
  "cdn.shopify.com",
  "cdn.shopifycdn.net",
  "shopify.s3.amazonaws.com",
]);

const MIME_EXTENSIONS = new Map<string, readonly string[]>([
  ["application/pdf", ["pdf"]],
  ["image/png", ["png"]],
  ["image/jpeg", ["jpg", "jpeg"]],
  ["image/tiff", ["tif", "tiff"]],
  ["application/postscript", ["eps"]],
]);

export type DnsLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

export type DownloadedShopifyArtwork = {
  bytes: Buffer;
  mimeType: string;
  extension: string;
  originalFilename: string;
  checksumSha256: string;
  sourceUrl: string;
};

function isAllowedShopifyHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_EXACT_HOSTS.has(host) || host.endsWith(".myshopify.com");
}

export function isPrivateOrReservedIp(address: string): boolean {
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateOrReservedIp(mapped[1]) : false;
  }
  return true;
}

export async function assertSafeShopifyArtworkUrl(value: string, lookup: DnsLookup = async (hostname) => {
  const rows = await dnsLookup(hostname, { all: true, verbatim: true });
  return rows.map((row) => ({ address: row.address, family: row.family }));
}) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("artwork_source_invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !isAllowedShopifyHost(url.hostname)) {
    throw new Error("artwork_source_not_allowed");
  }
  const addresses = await lookup(url.hostname);
  if (!addresses.length || addresses.some((entry) => isPrivateOrReservedIp(entry.address))) {
    throw new Error("artwork_source_not_public");
  }
  return url;
}

function sanitizeFilename(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop() || "artwork";
  return cleaned.replace(/[^a-zA-Z0-9._ -]/g, "-").replace(/\s+/g, " ").trim().slice(0, 180) || "artwork";
}

function filenameFromResponse(response: Response, url: URL) {
  const disposition = response.headers.get("content-disposition") || "";
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basic = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  let candidate = utf8 ? decodeURIComponent(utf8) : basic;
  if (!candidate) candidate = decodeURIComponent(url.pathname.split("/").pop() || "artwork");
  return sanitizeFilename(candidate);
}

function extensionOf(filename: string) {
  return filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
}

function hasExpectedSignature(bytes: Buffer, mimeType: string) {
  const prefix = bytes.subarray(0, 64);
  const text = prefix.toString("utf8").trimStart().toLowerCase();
  if (text.startsWith("<svg") || text.startsWith("<html") || text.startsWith("<!doctype") || text.startsWith("<script") || prefix.subarray(0, 2).toString("ascii") === "MZ" || prefix.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return false;
  if (mimeType === "application/pdf") return prefix.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/png") return prefix.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff;
  if (mimeType === "image/tiff") {
    return prefix.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || prefix.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]));
  }
  if (mimeType === "application/postscript") return prefix.toString("ascii").startsWith("%!PS-Adobe-");
  return false;
}

async function readLimitedBody(response: Response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_PRINT_FILE_BYTES) throw new Error("artwork_file_too_large");
  if (!response.body) throw new Error("artwork_download_empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PRINT_FILE_BYTES) {
      await reader.cancel();
      throw new Error("artwork_file_too_large");
    }
    chunks.push(value);
  }
  if (!total) throw new Error("artwork_download_empty");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export async function downloadShopifyArtwork(input: {
  sourceUrl: string;
  fetchImpl?: typeof fetch;
  lookup?: DnsLookup;
  timeoutMs?: number;
}): Promise<DownloadedShopifyArtwork> {
  const fetchImpl = input.fetchImpl || fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs || REQUEST_TIMEOUT_MS);
  let current = await assertSafeShopifyArtworkUrl(input.sourceUrl, input.lookup);
  try {
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "application/pdf,image/png,image/jpeg,image/tiff,application/postscript" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirect === MAX_REDIRECTS) throw new Error("artwork_redirect_limit");
        const location = response.headers.get("location");
        if (!location) throw new Error("artwork_redirect_invalid");
        current = await assertSafeShopifyArtworkUrl(new URL(location, current).toString(), input.lookup);
        continue;
      }
      if (!response.ok) throw new Error("artwork_download_failed");
      const mimeType = (response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
      const allowedExtensions = MIME_EXTENSIONS.get(mimeType);
      if (!allowedExtensions) throw new Error("artwork_mime_not_allowed");
      const originalFilename = filenameFromResponse(response, current);
      const extension = extensionOf(originalFilename);
      if (!allowedExtensions.includes(extension)) throw new Error("artwork_mime_extension_mismatch");
      const bytes = await readLimitedBody(response);
      if (!hasExpectedSignature(bytes, mimeType)) throw new Error("artwork_signature_invalid");
      return {
        bytes,
        mimeType,
        extension: extension === "jpeg" ? "jpg" : extension === "tif" ? "tiff" : extension,
        originalFilename,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
        sourceUrl: current.toString(),
      };
    }
    throw new Error("artwork_redirect_limit");
  } finally {
    clearTimeout(timeout);
  }
}

export async function importShopifyArtwork(input: {
  admin: SupabaseClient;
  printOrderItemId: string;
  actorAuthUserId: string;
  sourceUrl: string;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
  lookup?: DnsLookup;
}) {
  const existing = await input.admin.from("print_order_files").select("id").eq("idempotency_key", input.idempotencyKey).limit(1).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return { fileId: String(existing.data.id), imported: false };

  const downloaded = await downloadShopifyArtwork({ sourceUrl: input.sourceUrl, fetchImpl: input.fetchImpl, lookup: input.lookup });
  const deterministicId = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 32);
  const storagePath = buildPrintFilePath({
    orderId: input.printOrderItemId,
    kind: "customer_artwork",
    fileId: deterministicId,
    extension: downloaded.extension,
  });
  const bucket = input.admin.storage.from(PRINT_ORDER_FILE_BUCKET);
  const upload = await bucket.upload(storagePath, downloaded.bytes, {
    contentType: downloaded.mimeType,
    cacheControl: "private, max-age=0",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const registration = await input.admin.rpc("register_print_order_file", {
    p_print_order_item_id: input.printOrderItemId,
    p_file_kind: "customer_artwork",
    p_storage_path: storagePath,
    p_original_filename: downloaded.originalFilename,
    p_mime_type: downloaded.mimeType,
    p_size_bytes: downloaded.bytes.length,
    p_checksum_sha256: downloaded.checksumSha256,
    p_actor_type: "customer",
    p_actor_auth_user_id: input.actorAuthUserId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (registration.error) {
    await bucket.remove([storagePath]);
    throw registration.error;
  }
  const row = Array.isArray(registration.data) ? registration.data[0] : registration.data;
  if (!row?.file_id) {
    await bucket.remove([storagePath]);
    throw new Error("artwork_registration_failed");
  }
  return { fileId: String(row.file_id), imported: true };
}
