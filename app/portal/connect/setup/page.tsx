import { redirect } from "next/navigation";
import Link from "next/link";
import { Palette } from "lucide-react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import ConnectTabs from "@/components/connect/ConnectTabs";
import ConnectSetupWizard from "@/components/connect/ConnectSetupWizard";
import { requireCustomer } from "@/lib/auth";
import {
  buildSetupForgotPasswordPath,
  GUIDED_SETUP_ENTRY_PATH,
} from "@/lib/onboarding-routing";
import { isConnectSetupComplete } from "@/lib/connect";
import { getAdvancedBuilderLockMessage, isAdvancedBuilderUnlocked } from "@/lib/plans";
import { createDefaultBuilderConfig, sanitizeBuilderConfig } from "@/lib/builder-config";
import { createSupabaseAdminClient } from "@/lib/supabase-server";

export default async function ConnectGuidedSetupPage() {
  const { user, customer } = await requireCustomer();
  if (!user) redirect(buildSetupForgotPasswordPath({ nextPath: GUIDED_SETUP_ENTRY_PATH }));
  if (!customer) redirect("/portal");
  if (customer.must_change_password) redirect("/change-password");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("customer_id", customer.id)
    .maybeSingle();

  const { data: links } = profile
    ? await admin
        .from("profile_links")
        .select("id, label, url, platform, description, icon_style, custom_color, is_active, sort_order")
        .eq("profile_id", profile.id)
        .order("sort_order", { ascending: true })
    : { data: [] as Array<Record<string, any>> };

  const currentProfileLinks = links || [];
  const setupComplete = isConnectSetupComplete(customer, profile || null, { links: currentProfileLinks, requirePublished: true });
  const advancedBuilderUnlocked = isAdvancedBuilderUnlocked(customer);
  const advancedBuilderLockMessage = getAdvancedBuilderLockMessage(customer);
  const builderConfig = profile?.builder_config
    ? sanitizeBuilderConfig(profile.builder_config)
    : createDefaultBuilderConfig("#111111");

  return (
    <DashboardShell
      isAdmin={Boolean(customer.is_admin)}
      navVariant="onboarding"
      showGuidedSetup={!setupComplete}
    >
      <main className="container connect-setup-page-shell">
        {advancedBuilderUnlocked ? <ConnectTabs active="profile" showBuilder={advancedBuilderUnlocked} /> : null}

        {advancedBuilderUnlocked ? (
          <div className="connect-setup-top-actions">
            <Link className="btn secondary" href="/portal/connect/build">
              <Palette size={15} />
              Advanced Builder
            </Link>
          </div>
        ) : null}

        <ConnectSetupWizard
          customer={customer}
          profile={profile}
          links={currentProfileLinks}
          builderConfig={builderConfig}
          starterLocked={!advancedBuilderUnlocked}
        />
      </main>
    </DashboardShell>
  );
}
