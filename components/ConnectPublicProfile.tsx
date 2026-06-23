"use client";

import { useMemo } from "react";
import { FaApple, FaGooglePay } from "react-icons/fa6";
import ConnectLinksGrid from "@/components/ConnectLinksGrid";

type LinkLayout = "grid" | "stack" | "buttons";

type PublicLink = {
  id: string;
  label: string;
  url: string;
  icon?: string | null;
  platform?: string | null;
  custom_color?: string | null;
  icon_style?: string | null;
  description?: string | null;
};

type ConnectPublicProfileProps = {
  profileId: string;
  slug: string;
  businessName?: string | null;
  contactName?: string | null;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  themeColor?: string | null;
  links: PublicLink[];
  layout?: LinkLayout;
  showCardShowcase?: boolean;
  showLeadForm?: boolean;
  sent?: boolean;
  rateLimited?: boolean;
  error?: boolean;
};

function iconFor(icon?: string | null) {
  switch ((icon || "").toLowerCase()) {
    case "instagram":
      return "📷";
    case "facebook":
      return "f";
    case "tiktok":
      return "🎵";
    case "youtube":
      return "▶";
    case "linkedin":
      return "in";
    case "twitter":
    case "x":
      return "𝕏";
    case "snapchat":
      return "👻";
    case "pinterest":
      return "P";
    case "yelp":
      return "Y";
    case "google":
      return "G";
    case "globe":
    case "website":
      return "🌐";
    case "phone":
      return "☎";
    case "mail":
    case "email":
      return "✉";
    case "calendar":
    case "booking":
      return "📅";
    case "menu":
      return "☰";
    case "briefcase":
    case "portfolio":
      return "💼";
    case "star":
    case "reviews":
      return "⭐";
    default:
      return "🔗";
  }
}

async function trackEvent(
  profileId: string,
  eventType: string,
  metadata?: Record<string, string | number | boolean | null | undefined>,
  profileLinkId?: string
) {
  const payload = {
    profile_id: profileId,
    event_type: eventType,
    profile_link_id: profileLinkId,
    metadata,
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/connect/events", blob);
    return;
  }

  void fetch("/api/connect/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export default function ConnectPublicProfile({
  profileId,
  slug,
  businessName,
  contactName,
  title,
  phone,
  email,
  website,
  bio,
  avatarUrl,
  coverUrl,
  themeColor,
  links,
  layout = "grid",
  showCardShowcase = true,
  showLeadForm = true,
  sent,
  rateLimited,
  error,
}: ConnectPublicProfileProps) {
  const colors = useMemo(
    () => ({
      accent: themeColor || "#FFA665",
      navy: "#384862",
    }),
    [themeColor]
  );

  const callHref = phone ? `tel:${phone}` : "";
  const textHref = phone ? `sms:${phone}` : "";
  const emailHref = email ? `mailto:${email}` : "";
  const webHref = website || "";

  return (
    <main className="connect-public-shell" style={{ ["--connect-accent" as string]: colors.accent }}>
      <section
        className="connect-hero"
        style={
          coverUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(56,72,98,0.7), rgba(56,72,98,0.85)), url(${coverUrl})`,
              }
            : { background: `linear-gradient(135deg, ${colors.navy} 0%, #2f3e5a 100%)` }
        }
      >
        {avatarUrl ? (
          <img className="connect-avatar" src={avatarUrl} alt={contactName || businessName || "Profile"} />
        ) : (
          <div className="connect-avatar-fallback">
            {(contactName || businessName || "?")
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
        )}

        <p className="connect-eyebrow">Clutch Connect</p>
        <h1 className="connect-name">{contactName || businessName || "Profile"}</h1>
        {title ? <p className="connect-title">{title}</p> : null}
        {businessName && contactName ? <p className="connect-company">{businessName}</p> : null}
        {bio ? <p className="connect-bio">{bio}</p> : null}
      </section>

      {showCardShowcase ? (
        <section className="connect-card-showcase-section" aria-label="Smart card showcase">
          <div className="connect-card-showcase" aria-hidden="true">
            <div className="connect-card-showcase-headings">
              <p>Solid Steel</p>
              <p>Dynamic Clutch QR</p>
            </div>

            <div className="connect-card-showcase-stage">
              <div className="connect-card-grid">
                <div className="connect-card connect-card-black connect-card-front">
                  <span className="connect-card-logo">C</span>
                </div>
                <div className="connect-card connect-card-black connect-card-back">
                  <div className="connect-card-qr">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <i key={`black-${i}`}></i>
                    ))}
                  </div>
                </div>
                <div className="connect-card connect-card-pearl connect-card-front">
                  <span className="connect-card-logo connect-card-logo-dark">C</span>
                </div>
                <div className="connect-card connect-card-pearl connect-card-back">
                  <div className="connect-card-qr">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <i key={`pearl-${i}`}></i>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="connect-card-finish-lines">
              <p>Matte Black - Silver Engraving</p>
              <p>Silver Pearl - Black Engraving</p>
            </div>
          </div>
        </section>
      ) : null}
      <section className="connect-actions-section">
        <div className="connect-actions-grid">
          <a
            href={`/api/vcard/${profileId}`}
            className="connect-action connect-action-secondary"
            onClick={() => trackEvent(profileId, "vcard_download", { slug })}
          >
            <span className="connect-action-icon">📇</span>
            <span className="connect-action-text">Save Contact</span>
          </a>
          <a
            href={`/api/wallet/apple/${profileId}`}
            className="connect-action connect-action-secondary connect-action-wallet"
            onClick={() => trackEvent(profileId, "apple_wallet_download", { slug })}
          >
            <span className="connect-action-icon connect-action-icon-svg" aria-hidden="true">
              <FaApple />
            </span>
            <span className="connect-action-wallet-copy">
              <span className="connect-action-wallet-top">Add to</span>
              <span className="connect-action-wallet-bottom">Apple Wallet</span>
            </span>
          </a>
          <a
            href={`/api/wallet/google/${profileId}`}
            className="connect-action connect-action-secondary connect-action-wallet"
            onClick={() => trackEvent(profileId, "google_wallet_add", { slug })}
          >
            <span className="connect-action-icon connect-action-icon-svg" aria-hidden="true">
              <FaGooglePay />
            </span>
            <span className="connect-action-wallet-copy">
              <span className="connect-action-wallet-top">Add to</span>
              <span className="connect-action-wallet-bottom">Google Wallet</span>
            </span>
          </a>
          {callHref ? (
            <a
              href={callHref}
              className="connect-action connect-action-primary"
              onClick={() => trackEvent(profileId, "call_click", { slug })}
            >
              <span className="connect-action-icon">☎️</span>
              <span className="connect-action-text">Call</span>
            </a>
          ) : null}
          {textHref ? (
            <a
              href={textHref}
              className="connect-action connect-action-primary"
              onClick={() => trackEvent(profileId, "text_click", { slug })}
            >
              <span className="connect-action-icon">💬</span>
              <span className="connect-action-text">Text</span>
            </a>
          ) : null}
          {emailHref ? (
            <a
              href={emailHref}
              className="connect-action connect-action-primary"
              onClick={() => trackEvent(profileId, "email_click", { slug })}
            >
              <span className="connect-action-icon">✉️</span>
              <span className="connect-action-text">Email</span>
            </a>
          ) : null}
          {webHref ? (
            <a
              href={webHref}
              className="connect-action connect-action-primary"
              target="_blank"
              rel="noreferrer"
              onClick={() => trackEvent(profileId, "website_click", { slug })}
            >
              <span className="connect-action-icon">🌐</span>
              <span className="connect-action-text">Website</span>
            </a>
          ) : null}
          <a
            href="#lead-form"
            className="connect-action connect-action-accent"
            onClick={() => trackEvent(profileId, "quote_cta_click", { slug })}
          >
            <span className="connect-action-icon">✨</span>
            <span className="connect-action-text">Get Quote</span>
          </a>
        </div>
      </section>

      <ConnectLinksGrid
        links={links as any}
        layout={layout}
        profileId={profileId}
        onLinkClick={(linkId) =>
          trackEvent(
            profileId,
            "link_click",
            { slug },
            linkId
          )
        }
      />

      {showLeadForm ? (
        <section className="connect-lead-section" id="lead-form">
          <div className="connect-lead-card">
            <h2>Request a Quote</h2>
            <p className="connect-lead-description">Tell us what you need and we will follow up quickly.</p>

            {sent ? <div className="connect-success">Thanks! Your request was sent.</div> : null}
            {rateLimited ? (
              <div className="connect-error">Too many requests. Please wait one minute and try again.</div>
            ) : null}
            {error ? <div className="connect-error">Something went wrong. Please try again.</div> : null}

            <form action="/api/connect/leads" method="post" className="connect-lead-form">
              <input type="hidden" name="profile_id" value={profileId} />
              <input type="hidden" name="slug" value={slug} />

              <input name="name" placeholder="Your name" className="connect-input" required />
              <input name="email" type="email" placeholder="Your email" className="connect-input" />
              <input name="phone" placeholder="Your phone" className="connect-input" />
              <textarea name="message" placeholder="How can we help?" className="connect-input" rows={3} />

              <input
                name="company_website"
                className="connect-honeypot"
                autoComplete="off"
                tabIndex={-1}
                aria-hidden="true"
              />

              <button className="connect-submit" type="submit">
                Send Request
              </button>
            </form>
          </div>
        </section>
      ) : null}

      <footer className="connect-footer">
        <p>
          Powered by <strong>Clutch Connect</strong>
        </p>
        <p>A smart business card platform by Clutch Print Shop</p>
        <a href="https://clutchprintshop.com" target="_blank" rel="noreferrer">
          clutchprintshop.com
        </a>
      </footer>
    </main>
  );
}
