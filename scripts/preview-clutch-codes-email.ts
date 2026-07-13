import fs from "node:fs";
import path from "node:path";
import { buildClutchCodesSubscriptionAccessEmailTemplate } from "../lib/email-templates.ts";

const destination = path.resolve(process.argv[2] || "work/clutch-codes-subscription-email.html");
fs.mkdirSync(path.dirname(destination), { recursive: true });

const template = buildClutchCodesSubscriptionAccessEmailTemplate({
  firstName: "Casey",
  planName: "Clutch Codes Growth",
  monthlyPrice: "$6.99/month",
  allowance: 30,
  accessUrl: "https://qr.clutchprintshop.com/login",
  supportEmail: "info@clutchprintshop.com",
});

fs.writeFileSync(destination, template.html, "utf8");
console.log(destination);
