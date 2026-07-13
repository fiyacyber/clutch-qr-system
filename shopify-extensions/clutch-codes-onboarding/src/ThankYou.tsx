import "@shopify/ui-extensions/checkout/preact";
import "@shopify/ui-extensions/checkout";
import "@shopify/ui-extensions/purchase.thank-you.block.render";
import { render } from "preact";
import { ClutchCodesPanel } from "./Panel";
import { detectExtensionPlan, verifiedManagementUrl } from "./plans";

export default function extension() {
  render(<ThankYouExtension />, document.body);
}

function ThankYouExtension() {
  const api = shopify as any;
  const plan = detectExtensionPlan(api.lines?.value);
  if (!plan) return null;

  const email = String(api.buyerIdentity?.email?.value || "").trim() || null;
  const managementUrl = verifiedManagementUrl(api.settings?.value?.subscription_management_url);
  return <ClutchCodesPanel plan={plan} checkoutEmail={email} managementUrl={managementUrl} />;
}
