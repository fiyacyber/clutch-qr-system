import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Preflight failed: missing required environment variables.");
  if (!supabaseUrl) {
    console.error("- Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    console.error("- Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const requiredTables = [
  {
    tableName: "shopify_webhooks",
    query: (client) => client.from("shopify_webhooks").select("webhook_id").eq("webhook_id", "__preflight__").maybeSingle(),
  },
  {
    tableName: "shopify_orders",
    query: (client) => client.from("shopify_orders").select("shopify_order_id").limit(1),
  },
  {
    tableName: "card_orders",
    query: (client) => client.from("card_orders").select("id").limit(1),
  },
];

async function tableExists(tableCheck) {
  const { error } = await tableCheck.query(supabase);

  if (!error) {
    return { exists: true, reason: null };
  }

  const details = [error.code, error.message, error.details].filter(Boolean).join(" | ");

  if (String(error.message || "").toLowerCase().includes("could not find the table")) {
    return { exists: false, reason: details };
  }

  if (String(error.code || "") === "PGRST205") {
    return { exists: false, reason: details };
  }

  return { exists: false, reason: `unexpected error: ${details}` };
}

(async () => {
  const missing = [];

  console.log("Supabase webhook preflight check");
  console.log(`Project URL: ${supabaseUrl}`);

  for (const tableCheck of requiredTables) {
    const result = await tableExists(tableCheck);
    if (result.exists) {
      console.log(`PASS public.${tableCheck.tableName}`);
      continue;
    }

    missing.push({ tableName: tableCheck.tableName, reason: result.reason });
    console.log(`FAIL public.${tableCheck.tableName}`);
    if (result.reason) {
      console.log(`  reason: ${result.reason}`);
    }
  }

  if (missing.length === 0) {
    console.log("Preflight result: PASS. All required webhook tables exist.");
    process.exit(0);
  }

  console.log("Preflight result: FAIL. One or more required webhook tables are missing.");
  console.log("Run migration command:");
  console.log("npx supabase db push");
  process.exit(1);
})();
