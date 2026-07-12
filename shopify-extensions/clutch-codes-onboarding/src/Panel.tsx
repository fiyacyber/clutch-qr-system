import type { ExtensionPlan } from "./plans";

const DASHBOARD_URL = "https://qr.clutchprintshop.com/login";
const SUPPORT_EMAIL = "info@clutchprintshop.com";

export function ClutchCodesPanel({
  plan,
  checkoutEmail,
  managementUrl,
}: {
  plan: ExtensionPlan;
  checkoutEmail?: string | null;
  managementUrl?: string | null;
}) {
  return (
    <s-section>
      <s-stack direction="block" gap="base">
        <s-text color="subdued">CLUTCH CODES™</s-text>
        <s-heading>Your dashboard access is ready</s-heading>
        <s-text>
          Your {plan.name} plan includes up to {plan.allowance} active Clutch Codes.
        </s-text>
        <s-stack direction="block" gap="small-200">
          <s-paragraph><s-text type="strong">Plan:</s-text> {plan.name}</s-paragraph>
          <s-paragraph><s-text type="strong">Monthly amount:</s-text> {plan.price}</s-paragraph>
          <s-paragraph><s-text type="strong">Active-code allowance:</s-text> {plan.allowance}</s-paragraph>
          {checkoutEmail ? <s-paragraph><s-text type="strong">Checkout email:</s-text> {checkoutEmail}</s-paragraph> : null}
          <s-paragraph><s-text type="strong">Support:</s-text> {SUPPORT_EMAIL}</s-paragraph>
        </s-stack>
        <s-banner tone="info">
          Access may take a few moments while your paid order finishes provisioning.
        </s-banner>
        <s-stack direction="inline" gap="base">
          <s-button href={DASHBOARD_URL} target="_blank" variant="primary">
            Access Clutch Codes
          </s-button>
          {managementUrl ? (
            <s-button href={managementUrl} target="_blank" variant="secondary">
              Manage Subscription
            </s-button>
          ) : null}
        </s-stack>
      </s-stack>
    </s-section>
  );
}
