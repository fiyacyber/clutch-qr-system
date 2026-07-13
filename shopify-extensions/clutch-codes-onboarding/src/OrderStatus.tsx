import "@shopify/ui-extensions/customer-account/preact";
import "@shopify/ui-extensions/customer-account";
import "@shopify/ui-extensions/customer-account.order-status.block.render";
import { render } from "preact";
import { ClutchCodesPanel } from "./Panel";
import { detectExtensionPlan, verifiedManagementUrl } from "./plans";

export default function extension() {
  render(<OrderStatusExtension />, document.body);
}

function OrderStatusExtension() {
  const api = shopify as any;
  const plan = detectExtensionPlan(api.lines?.value);
  if (!plan) return null;

  const customer = api.buyerIdentity?.customer?.value || api.buyerIdentity?.customer;
  const email = String(customer?.email || api.buyerIdentity?.email?.value || "").trim() || null;
  const managementUrl = verifiedManagementUrl(api.settings?.value?.subscription_management_url);
  return <ClutchCodesPanel plan={plan} checkoutEmail={email} managementUrl={managementUrl} />;
}
