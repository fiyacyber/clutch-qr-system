import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const fixtureArg = process.argv[2] || "fixtures/shopify/orders-paid.sample.json";
const endpoint = process.env.SHOPIFY_WEBHOOK_TEST_URL || "http://localhost:3000/api/webhooks/shopify/orders-paid";
const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

if (!secret) {
  console.error("Missing SHOPIFY_WEBHOOK_SECRET. Set it before running this test script.");
  process.exit(1);
}

const fixturePath = path.isAbsolute(fixtureArg)
  ? fixtureArg
  : path.resolve(__dirname, "..", fixtureArg);

if (!fs.existsSync(fixturePath)) {
  console.error(`Fixture not found: ${fixturePath}`);
  process.exit(1);
}

const rawBody = fs.readFileSync(fixturePath, "utf8");
const webhookId = process.env.SHOPIFY_WEBHOOK_TEST_ID || `local-orders-paid-${Date.now()}`;

try {
  JSON.parse(rawBody);
} catch {
  console.error(`Fixture is not valid JSON: ${fixturePath}`);
  process.exit(1);
}

const hmac = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
const secretFingerprint = crypto.createHash("sha256").update(secret, "utf8").digest("hex").slice(0, 8);

console.log("Webhook test debug:");
console.log(`Endpoint: ${endpoint}`);
console.log(`Raw body bytes: ${Buffer.byteLength(rawBody, "utf8")}`);
console.log(`Generated HMAC length: ${hmac.length}`);
console.log(`Secret fingerprint (sha256 first 8): ${secretFingerprint}`);
console.log(`Webhook ID: ${webhookId}`);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Shopify-Hmac-SHA256": hmac,
    "X-Shopify-Webhook-Id": webhookId,
    "X-Shopify-Topic": "orders/paid",
    "X-Shopify-Shop-Domain": process.env.SHOPIFY_SHOP_DOMAIN || "clutchprintshop.myshopify.com",
  },
  body: rawBody,
});

const responseText = await response.text();

let responseBody = responseText;
try {
  responseBody = JSON.parse(responseText);
} catch {
  // Keep plain text response when JSON parsing fails.
}

console.log("Webhook test request complete.");
console.log(`Status: ${response.status} ${response.statusText}`);
console.log("Response body:");
console.log(typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody, null, 2));
