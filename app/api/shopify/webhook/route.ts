import { NextRequest } from "next/server";
import { handleShopifyWebhook } from "@/lib/shopify-webhook";

export async function POST(req: NextRequest) {
  return handleShopifyWebhook(req);
}
