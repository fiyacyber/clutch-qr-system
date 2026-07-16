import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { getQrContrastRatio, parsePrintQrDestination, renderPrintQrSvg, sanitizePrintQrDesign } from "../lib/print-qr-artwork.ts";

const validDesign = {
  codeName: "Door hanger offer",
  campaignName: "Summer service",
  destinationUrl: "https://example.com/offer",
  foregroundColor: "#384862",
  backgroundColor: "#ffffff",
  dotStyle: "rounded",
  cornerStyle: "extra-rounded",
  frameStyle: "label",
  frameColor: "#384862",
  frameLabel: "SCAN FOR OFFER",
  logoSize: 18,
};

test("print QR destination validation accepts only credential-free HTTP(S)", () => {
  assert.equal(parsePrintQrDestination("https://example.com/path"), "https://example.com/path");
  assert.equal(parsePrintQrDestination("http://example.com"), "http://example.com/");
  for (const value of ["javascript:alert(1)", "data:text/html,bad", "ftp://example.com", "https://user:pass@example.com", "not a url", ""]) {
    assert.equal(parsePrintQrDestination(value), null);
  }
});

test("draft sanitizer keeps only approved styles, bounds text/logo size, and enforces scan contrast", () => {
  const design = sanitizePrintQrDesign({ ...validDesign, codeName: "x".repeat(200), logoSize: 99 });
  assert.equal(design.codeName.length, 80);
  assert.equal(design.logoSize, 24);
  assert.equal(design.dotStyle, "rounded");
  assert.equal(design.cornerStyle, "extra-rounded");
  assert.ok(getQrContrastRatio(design.foregroundColor, design.backgroundColor) >= 4.5);
  assert.throws(() => sanitizePrintQrDesign({ ...validDesign, foregroundColor: "#eeeeee", backgroundColor: "#ffffff" }), /stronger contrast/);
});

test("submitted SVG is deterministic, print-sized, high-contrast, and tied to the immutable short URL", () => {
  const design = sanitizePrintQrDesign(validDesign);
  const first = renderPrintQrSvg("https://qr.clutchprintshop.com/qr/immutable-slug", design);
  const second = renderPrintQrSvg("https://qr.clutchprintshop.com/qr/immutable-slug", design);
  assert.equal(first, second);
  assert.match(first, /width="2400"/);
  assert.match(first, /immutable-slug/);
  assert.match(first, /SCAN FOR OFFER/);
  assert.doesNotMatch(first, /example\.com\/offer/);
});

test("migration separates QR artwork from primary artwork and makes revisions append-only and service-only", () => {
  const migration = fs.readFileSync(new URL("../supabase/migrations/20260715213000_add_print_qr_artwork_submissions.sql", import.meta.url), "utf8");
  assert.match(migration, /'qr_artwork_asset'/);
  assert.match(migration, /unique \(print_order_item_id, revision\)/);
  assert.match(migration, /where print_order_item_id = p_print_order_item_id and is_current for update/);
  assert.match(migration, /QR revisions are locked after proof approval/);
  assert.match(migration, /service role required/);
  assert.match(migration, /revoke all on function public\.register_print_qr_artwork_submission/);
  assert.match(migration, /enable row level security/);
});

test("submission route binds order, customer, QR, and immutable slug and never treats QR as customer artwork", () => {
  const route = fs.readFileSync(new URL("../app/api/print-orders/[id]/qr-artwork/route.ts", import.meta.url), "utf8");
  assert.match(route, /\.eq\("id", id\)\.eq\("customer_id", customer\.id\)/);
  assert.match(route, /\.eq\("print_order_item_id", id\)/);
  assert.match(route, /loadOrderLinkedQrAccess/);
  assert.match(route, /getExportShortUrl\(code\.slug\)/);
  assert.doesNotMatch(route, /file_kind:\s*["']customer_artwork/);
  assert.match(route, /qr_artwork_submitted|register_print_qr_artwork_submission/);
});

test("unified portal has exactly five primary destinations and mobile bottom navigation", () => {
  const nav = fs.readFileSync(new URL("../components/dashboard/SidebarNav.tsx", import.meta.url), "utf8");
  const keys = [...nav.matchAll(/\{ key: "(dashboard|marketing|contacts|orders|account)"/g)].map((match) => match[1]);
  assert.deepEqual(keys, ["dashboard", "marketing", "contacts", "orders", "account"]);
  assert.match(nav, /ds-bottom-nav/);
  assert.doesNotMatch(nav, /label: "QR Codes"|label: "Analytics"|label: "Business Kits"|label: "Print Orders"/);
});
