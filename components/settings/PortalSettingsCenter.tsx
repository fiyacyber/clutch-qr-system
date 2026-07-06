import Link from "next/link";
import CurrentPlanBadge from "@/components/plans/CurrentPlanBadge";
import {
  Bell,
  Building2,
  Globe,
  HelpCircle,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

type BillingAction = {
  label: string;
  href: string;
  tone: "primary" | "secondary";
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
  qrDefaults: {
    foreground: string;
    background: string;
    exportSizeLabel: string;
  };
  supportEmail: string;
  helpCenterHref: string;
};

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
  qrDefaults,
  supportEmail,
  helpCenterHref,
}: PortalSettingsCenterProps) {
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
      <div className="ca-content ca-settings-content">
        <section className="ca-card ca-settings-hero-card">
          <div className="ca-settings-hero-copy">
            <p className="ca-settings-kicker"><Sparkles size={14} /> Premium Account Center</p>
            <h2>{accountName || "Your account"}</h2>
            <p>
              Manage billing, profile controls, QR defaults, security, and support for Clutch Connect and Clutch QR from one place.
            </p>
          </div>

          <div className="ca-settings-hero-meta">
            <article>
              <span>Current Plan</span>
              <strong>{plan.name}</strong>
            </article>
            <article>
              <span>Profile Status</span>
              <strong>{profile.statusLabel}</strong>
            </article>
            <article>
              <span>Member Since</span>
              <strong>{memberSince}</strong>
            </article>
          </div>
        </section>

        <div className="ca-settings-stack">
          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Account Overview</h2>
                <p className="ca-title-sub">Core account and customer identity details.</p>
              </div>
            </div>

            <div className="ca-settings-info-grid">
              <article>
                <span><Building2 size={14} /> Account name</span>
                <strong>{accountName || "—"}</strong>
              </article>
              <article>
                <span><Mail size={14} /> Email</span>
                <strong>{accountEmail || "—"}</strong>
              </article>
              <article>
                <span>Company name</span>
                <strong>{companyName || "—"}</strong>
              </article>
              <article>
                <span>Account type</span>
                <strong>{accountType}</strong>
              </article>
              <article>
                <span>Member since</span>
                <strong>{memberSince}</strong>
              </article>
              <article>
                <span>Last login</span>
                <strong>{lastLogin}</strong>
              </article>
            </div>
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Plan & Billing</h2>
                <p className="ca-title-sub">Subscription status, trial details, and upgrade paths.</p>
              </div>
              <div className="ca-settings-badge">{isAdmin ? "Admin" : plan.name}</div>
            </div>

            <CurrentPlanBadge
              planCode={plan.code}
              planName={plan.name}
              priceLabel={plan.price}
              description={plan.description}
              usageLabel={plan.usageLabel}
              subscriptionStatus={plan.subscriptionStatus}
              trialStatus={plan.trialStatus}
            />

            <div className="ca-settings-plan-summary">
              <article>
                <span>Current plan</span>
                <strong>{plan.name}</strong>
              </article>
              <article>
                <span>Subscription status</span>
                <strong>{plan.subscriptionStatus}</strong>
              </article>
              <article>
                <span>Trial status</span>
                <strong>{plan.trialStatus !== "none" ? plan.trialStatus : "Not in trial"}</strong>
              </article>
              <article>
                <span>QR usage</span>
                <strong>{qrUsageSummary}</strong>
              </article>
            </div>

            {isAdmin ? (
              <div className="ca-settings-soon">
                <ShieldCheck size={15} />
                <div>
                  <strong>Admin checkout actions are hidden</strong>
                  <p>Internal accounts bypass customer checkout flows.</p>
                </div>
              </div>
            ) : (
              <div className="ca-settings-actions-row">
                {billingActions.map((action) => (
                  <a key={action.label} href={action.href} className={action.tone === "primary" ? "ca-primary-link-btn" : "ca-secondary-link-btn"}>
                    {action.label}
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Clutch Connect Profile</h2>
                <p className="ca-title-sub">Publishing status, guided setup access, and builder shortcuts.</p>
              </div>
              <Globe size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-info-grid">
              <article>
                <span>Public profile</span>
                <strong>{profile.statusLabel}</strong>
              </article>
              <article>
                <span>Completion</span>
                <strong>{profile.completionLabel}</strong>
              </article>
              <article className="ca-settings-info-wide">
                <span>Public URL</span>
                <strong>{publicProfileSummary}</strong>
              </article>
            </div>

            <div className="ca-settings-actions-row">
              <Link href={profile.guidedSetupHref} className="ca-primary-link-btn">Guided Setup</Link>
              <Link href={profile.builderHref} className="ca-secondary-link-btn">{builderLabel}</Link>
              {profile.publicUrl ? <Link href={profile.publicUrl} target="_blank" className="ca-secondary-link-btn">View Public Profile</Link> : null}
            </div>

            {profile.builderLocked ? (
              <div className="ca-settings-soon">
                <Palette size={15} />
                <div>
                  <strong>Advanced Builder requires an upgraded plan</strong>
                  <p>Starter accounts stay on Guided Setup until Connect+ unlocks the full builder.</p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">QR Defaults</h2>
                <p className="ca-title-sub">Latest QR palette preview and default export settings.</p>
              </div>
              <Palette size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-brand-grid">
              <article className="ca-settings-brand-option">
                <span>Foreground color</span>
                <div className="ca-settings-color-row">
                  <span className="ca-settings-color-swatch" style={{ background: qrDefaults.foreground }} />
                  <strong>{qrDefaults.foreground}</strong>
                </div>
              </article>

              <article className="ca-settings-brand-option">
                <span>Background color</span>
                <div className="ca-settings-color-row">
                  <span className="ca-settings-color-swatch" style={{ background: qrDefaults.background, border: "1px solid #d8dde8" }} />
                  <strong>{qrDefaults.background}</strong>
                </div>
              </article>

              <article className="ca-settings-brand-option">
                <span>Default export size</span>
                <strong>{qrDefaults.exportSizeLabel}</strong>
                <p>Editable default export controls are coming soon.</p>
              </article>
            </div>
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Notifications</h2>
                <p className="ca-title-sub">Notification preferences are visible here once persistence is available.</p>
              </div>
              <Bell size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-toggle-list">
              {[
                "Lead alerts",
                "Weekly analytics summary",
                "Product updates",
              ].map((label) => (
                <article key={label} className="ca-settings-toggle-item">
                  <div>
                    <strong>{label}</strong>
                    <p>Coming soon</p>
                  </div>
                  <span className="ca-settings-toggle-shell ca-settings-toggle-shell-disabled" aria-hidden="true"><span /></span>
                </article>
              ))}
            </div>
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Security</h2>
                <p className="ca-title-sub">Password controls, session access, and authentication status.</p>
              </div>
              <ShieldCheck size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-security-grid">
              <article>
                <span>Authentication</span>
                <strong>{authenticationStatus || "Password login active"}</strong>
              </article>
              <article>
                <span>Last login</span>
                <strong>{lastLogin}</strong>
              </article>
              <article>
                <span>Password</span>
                <strong>Managed with Clutch login</strong>
              </article>
              <article>
                <span>Two-factor auth</span>
                <strong>Coming soon</strong>
              </article>
            </div>

            <div className="ca-settings-actions-row">
              <Link href="/change-password" className="ca-primary-link-btn">Change Password</Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="ca-secondary-link-btn">Sign Out</button>
              </form>
            </div>
          </section>

          <section className="ca-card ca-settings-panel">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Support</h2>
                <p className="ca-title-sub">Reach the Clutch team for help, features, or account questions.</p>
              </div>
              <HelpCircle size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-support-grid">
              <a href={supportMailTo} className="ca-primary-link-btn">Contact Support</a>
              <a href={featureRequestMailTo} className="ca-secondary-link-btn">Request Feature</a>
              <a href={helpCenterHref} className="ca-secondary-link-btn">Help Center</a>
            </div>

            <div className="ca-settings-support-email">
              <Mail size={15} />
              <span>{supportEmail}</span>
            </div>
          </section>

          <section className="ca-card ca-settings-danger-card">
            <div className="ca-card-head">
              <div>
                <h2 className="ca-card-title">Account Actions</h2>
                <p className="ca-title-sub">Destructive actions are separated from the rest of your account controls.</p>
              </div>
              <Trash2 size={15} className="ca-section-icon" />
            </div>

            <div className="ca-settings-danger-actions">
              <form action="/auth/signout" method="post">
                <button type="submit" className="ca-secondary-link-btn">Sign Out</button>
              </form>
              <a href={deleteRequestMailTo} className="ca-danger-link-btn">Request Account Deletion</a>
            </div>

            <div className="ca-settings-soon">
              <HelpCircle size={15} />
              <div>
                <strong>Account deletion is handled through support only</strong>
                <p>Support verifies ownership before any records are removed.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
