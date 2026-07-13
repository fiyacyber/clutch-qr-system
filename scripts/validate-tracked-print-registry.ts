import fs from "node:fs";
import { validatePrintProductRegistry } from "../lib/print-products.ts";

const file = process.argv[2];
const source = file ? fs.readFileSync(file, "utf8") : process.env.TRACKED_PRINT_PRODUCT_REGISTRY_JSON;
if (!source) {
  console.error("Provide a JSON file path or TRACKED_PRINT_PRODUCT_REGISTRY_JSON.");
  process.exit(1);
}

const result = validatePrintProductRegistry(source);
if (result.errors.length) {
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Tracked-print registry is valid (${result.entries.length} entries).`);
