"use client";

import Link from "next/link";
import { useState } from "react";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import BrandColorsSettingsPanel from "@/components/settings/BrandColorsSettingsPanel";
import {
  Bell,
  Building2,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Globe,
  HelpCircle,
  Mail,
  Palette,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import styles from "./PortalSettingsCenter.module.css";

type BillingAction = {
  label: string;
  href: string;
  tone: "primary" | "secondary";
};

type SettingsSection =
  | "account"
  | "plan"
  | "profile"
  | "brand"
  | "notifications"
  | "security"
  | "support";

type SettingsSectionDefinition = {
  id: SettingsSection;
  label: string;
  description: string;
  eyebrow: string;
  title: string;
  panelDescription: string;
  icon: LucideIcon;
};

type PortalSettingsCenterProps = {
  accountName: string;
  accountEmail: string | null;
  companyName: string;
  accountType: string;
  memberSince: string;
  lastLogin: string;
  authenticationStatus: string;
  isAdmin: boolean;
  plan: {
    code: string;
    name: string;
    price: string;
    description: string;
    usageLabel: string;
    subscriptionStatus: string;
    trialStatus: string;
  };
  billingActions: BillingAction[];
  qrUsageUsed: number;
  qrUsageLimit: number | null;
  profile: {
    hasProfile: boolean;
    setupComplete: boolean;
    published: boolean;
    slug: string | null;
    publicUrl: string | null;
    publicDisplayUrl: string | null;
    statusLabel: string;
    completionLabel: string;
    guidedSetupHref: string;
    builderHref: string;
    builderLocked: boolean;
  };
  brandColors: string[];
  supportEmail: string;
  helpCenterHref: string;
};

const settingsSections: SettingsSectionDefinition[] = [
  {
    id: "account",
    label: "Account",
    description: "Identity and company",
    eyebrow: "Account",
    title: "Account overview",
    panelDescription: "Review the customer identity and company details associated with this workspace.",
    icon: Settings,
  },
  {
    id: "plan",
    label: "Plan & billing",
    description: "Access and upgrades",
    eyebrow: "Subscription",
    title: "Plan & billing",
    panelDescription: "Review your current access, usage, subscription status, and available upgrade paths.",
    icon: CreditCard,
  },
  {
    id: "profile",
    label: "Connect profile",
    description: "Setup and publishing",
    eyebrow: "Digital profile",
    title: "Clutch Connect profile",
    panelDescription: "Manage guided setup, publishing status, your public URL, and Profile Builder access.",
    icon: UserRound,
  },
  {
    id: "brand",
    label: "Brand colors",
    description: "QR color picker palette",
    eyebrow: "QR color picker",
    title: "Brand colors",
    panelDescription: "Choose reusable business colors that customers can select while creating a Clutch Code.",
    icon: Palette,
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Alerts and summaries",
    eyebrow: "Communication",
    title: "Notification preferences",
    panelDescription: "Notification controls will become available as each preference is connected to persistent account settings.",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security",
    description: "Password and access",
    eyebrow: "Account protection",
    title: "Security & access",
    panelDescription: "Review authentication status, change your password, sign out, or request account deletion.",
    icon: ShieldCheck,
  },
  {
    id: "support",
    label: "Support",
    description: "Help and requests",
    eyebrow: "Customer support",
    title: "Help & support",
    panelDescription: "Contact the Clutch team for account questions, product assistance, or feature requests.",
    icon: CircleHelp,
  },
];

export default function PortalSettingsCenter({
  accountName,
  accountEmail,
  companyName,
  accountType,
  memberSince,
  lastLogin,
  authenticationStatus,
  isAdmin,
  plan,
  billingActions,
  qrUsageUsed,
  qrUsageLimit,
  profile,
  brandColors,
  supportEmail,
  helpCenterHref,
}: PortalSettingsCenterProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account");
  const activeDefinition = settingsSections.find((section) => section.id === activeSection) || settingsSections[0];
  const ActiveIcon = activeDefinition.icon;
  const supportMailTo = `mailto:${supportEmail}`;
  const featureRequestMailTo = `mailto:${supportEmail}?subject=${encodeURIComponent("Feature request for Clutch")}`;
  const deleteRequestMailTo = `mailto:${supportEmail}?subject=${encodeURIComponent("Account deletion request")}`;
  const qrUsageSummary = plan.code === "connect_basic"
    ? "1 / 1"
    : qrUsageLimit
      ? `${qrUsageUsed} / ${qrUsageLimit}`
      : "Unlimited";
  const builderLabel = profile.builderLocked ? "Profile Builder" : "Open Profile Builder";
  const publicProfileSummary = profile.published && profile.publicDisplayUrl
    ? profile.publicDisplayUrl
    : profile.slug
      ? `Reserved URL: ${profile.slug}`
      : "No public profile URL yet";

  return (
    <div className="ca-main">
      <div className={`ca-content ${styles.settingsPage}`}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Account center</p>
            <h1>Account settings</h1>
            <p className={styles.heroDescription}>
              Manage your account, plan, profile, security, and support settings without searching through one long page.
            </p>
          </div>

          <div className={styles.heroStats} aria-label="Account summary">
            <article className={styles.heroStat}>
              <span>Current plan</span>
              <strong>{plan.name}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Profile status</span>
              <strong>{profile.statusLabel}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Member since</span>
              <strong>{memberSince}</strong>
            </article>
          </div>
        </section>

        <div className={styles.workspace}>
          <nav className={styles.sectionNav} aria-label="Account settings sections" role="tablist">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const selected = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  id={`settings-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`settings-panel-${section.id}`}
                  className={`${styles.navButton} ${selected ? styles.navButtonActive : ""}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className={styles.navIcon}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className={styles.navText}>
                    <strong>{section.label}</strong>
                    <small>{section.description}</small>
                  </span>
                  <ChevronRight size={15} className={styles.navChevron} aria-hidden="true" />
                </button>
              );
            })}
          </nav>

          <section
            id={`settings-panel-${activeSection}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${activeSection}`}
            className={styles.contentPanel}
          >
            <header className={styles.panelHeader}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.panelEyebrow}>{activeDefinition.eyebrow}</p>
                <h2>{activeDefinition.title}</h2>
                <p className={styles.panelDescription}>{activeDefinition.panelDescription}</p>
              </div>
              <span className={styles.panelIcon}>
                <ActiveIcon size={20} aria-hidden="true" />
              </span>
            </header>

            {activeSection === "account" ? (
              <div className={styles.sectionBody}>
                <div className={styles.infoGrid}>
                  <article className={styles.infoCard}>
                    <span><Building2 size={14} aria-hidden="true" /> Account name</span>
                    <strong>{accountName || "—"}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span><Mail size={14} aria-hidden="true" /> Email</span>
                    <strong>{accountEmail || "—"}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>Company name</span>
                    <strong>{companyName || "—"}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>Account type</span>
                    <strong>{accountType}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>Member since</span>
                    <strong>{memberSince}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>Last login</span>
                    <strong>{lastLogin}</strong>
                  </article>
                </div>
              </div>
            ) : null}

            {activeSection === "plan" ? (
              <div className={styles.sectionBody}>
                <div className={styles.planLayout}>
                  <CurrentPlanBadge
                    planCode={plan.code}
                    planName={plan.name}
                    priceLabel={plan.price}
                    description={plan.description}
                    usageLabel={plan.usageLabel}
                    subscriptionStatus={plan.subscriptionStatus}
                    trialStatus={plan.trialStatus}
                  />

                  <div className={styles.planSide}>
                    <div className={styles.planGrid}>
                      <article className={styles.planCard}>
                        <span>Current plan</span>
                        <strong>{plan.name}</strong>
                      </article>
                      <article className={styles.planCard}>
                        <span>Subscription</span>
                        <strong>{plan.subscriptionStatus}</strong>
                      </article>
                      <article className={styles.planCard}>
                        <span>Trial status</span>
                        <strong>{plan.trialStatus !== "none" ? plan.trialStatus : "Not in trial"}</strong>
                      </article>
                      <article className={styles.planCard}>
                        <span>QR usage</span>
                        <strong>{qrUsageSummary}</strong>
                      </article>
                    </div>
                  </div>
                </div>

                {isAdmin ? (
                  <div className={styles.notice}>
                    <ShieldCheck size={17} aria-hidden="true" />
                    <div>
                      <strong>Admin checkout actions are hidden</strong>
                      <p>Internal accounts bypass customer checkout flows.</p>
                    </div>
                  </div>
                ) : (
                  <div className={styles.actions}>
                    {billingActions.map((action) => (
                      <a
                        key={action.label}
                        href={action.href}
                        className={action.tone === "primary" ? styles.primaryButton : styles.secondaryButton}
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {activeSection === "profile" ? (
              <div className={styles.sectionBody}>
                <div className={styles.profileSummary}>
                  <article className={styles.infoCard}>
                    <span>Public profile</span>
                    <strong>{profile.statusLabel}</strong>
                  </article>
                  <article className={styles.infoCard}>
                    <span>Completion</span>
                    <strong>{profile.completionLabel}</strong>
                  </article>
                  <article className={`${styles.infoCard} ${styles.wideCard}`}>
                    <span><Globe size={14} aria-hidden="true" /> Public URL</span>
                    <strong>{publicProfileSummary}</strong>
                  </article>
                </div>

                <div className={styles.actions}>
                  <Link href={profile.guidedSetupHref} className={styles.primaryButton}>Guided Setup</Link>
                  <Link href={profile.builderHref} className={styles.secondaryButton}>{builderLabel}</Link>
                  {profile.publicUrl ? (
                    <Link href={profile.publicUrl} target="_blank" className={styles.secondaryButton}>
                      View Public Profile
                    </Link>
                  ) : null}
                </div>

                {profile.builderLocked ? (
                  <div className={styles.notice}>
                    <Palette size={17} aria-hidden="true" />
                    <div>
                      <strong>Profile Builder requires an upgraded plan</strong>
                      <p>Starter accounts use Guided Setup until Connect+ unlocks the full Profile Builder.</p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {activeSection === "brand" ? (
              <div className={styles.sectionBody}>
                <BrandColorsSettingsPanel initialColors={brandColors} />
              </div>
            ) : null}

            {activeSection === "notifications" ? (
              <div className={styles.sectionBody}>
                <div className={styles.notificationList}>
                  {["Lead alerts", "Weekly analytics summary", "Product updates"].map((label) => (
                    <article key={label} className={styles.notificationRow}>
                      <div className={styles.notificationCopy}>
                        <strong>{label}</strong>
                        <p>Coming soon</p>
                      </div>
                      <span className={styles.disabledToggle} aria-hidden="true" />
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {activeSection === "security" ? (
              <div className={styles.sectionBody}>
                <div className={styles.securityGrid}>
                  <article className={styles.securityCard}>
                    <span>Authentication</span>
                    <strong>{authenticationStatus || "Password login active"}</strong>
                  </article>
                  <article className={styles.securityCard}>
                    <span>Last login</span>
                    <strong>{lastLogin}</strong>
                  </article>
                  <article className={styles.securityCard}>
                    <span>Password</span>
                    <strong>Managed with Clutch login</strong>
                  </article>
                  <article className={styles.securityCard}>
                    <span>Two-factor auth</span>
                    <strong>Coming soon</strong>
                  </article>
                </div>

                <div className={styles.actions}>
                  <Link href="/change-password" className={styles.primaryButton}>Change Password</Link>
                  <form action="/auth/signout" method="post" className={styles.formInline}>
                    <button type="submit" className={styles.secondaryButton}>Sign Out</button>
                  </form>
                </div>

                <div className={styles.dangerZone}>
                  <div className={styles.dangerTitle}>
                    <Trash2 size={17} aria-hidden="true" />
                    <h3>Account deletion</h3>
                  </div>
                  <p>Deletion requests are handled through support so account ownership can be verified before records are removed.</p>
                  <div className={styles.actions}>
                    <a href={deleteRequestMailTo} className={styles.dangerButton}>Request Account Deletion</a>
                  </div>
                </div>
              </div>
            ) : null}

            {activeSection === "support" ? (
              <div className={styles.sectionBody}>
                <div className={styles.securitySupportGrid}>
                  <div className={styles.supportCard}>
                    <h3>Contact the Clutch team</h3>
                    <p>Use direct email support for account access, billing questions, product setup, or technical assistance.</p>
                    <div className={styles.actions}>
                      <a href={supportMailTo} className={styles.primaryButton}>Contact Support</a>
                      <a href={featureRequestMailTo} className={styles.secondaryButton}>Request Feature</a>
                    </div>
                    <div className={styles.supportEmail}>
                      <Mail size={16} aria-hidden="true" />
                      <span>{supportEmail}</span>
                    </div>
                  </div>

                  <div className={styles.supportCard}>
                    <h3>Help center</h3>
                    <p>Open the Clutch Print Shop website for product information and general customer resources.</p>
                    <div className={styles.actions}>
                      <a href={helpCenterHref} className={styles.secondaryButton}>Open Help Center</a>
                    </div>
                    <div className={styles.notice}>
                      <HelpCircle size={17} aria-hidden="true" />
                      <div>
                        <strong>Include your account email</strong>
                        <p>This helps support locate your workspace and respond faster.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
