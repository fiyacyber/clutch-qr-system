"use client";

import { useMemo } from "react";

type PublicLink = {
  id: string;
  label: string;
  url: string;
  icon?: string | null;
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
  sent?: boolean;
  rateLimited?: boolean;
  error?: boolean;
};

function iconFor(icon?: string | null) {
  switch ((icon || "").toLowerCase()) {
    case "instagram":
      return "Instagram";
    case "facebook":
      return "Facebook";
    case "linkedin":
      return "LinkedIn";
    case "youtube":
      return "YouTube";
    case "calendar":
      return "Calendar";
    default:
      return "Link";
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
  sent,
  rateLimited,
  error,
}: ConnectPublicProfileProps) {
  const colors = useMemo(() => ({
    accent: themeColor || "#FFA665",
    navy: "#384862",
  }), [themeColor]);

  const callHref = phone ? `tel:${phone}` : "";
  const textHref = phone ? `sms:${phone}` : "";
  const emailHref = email ? `mailto:${email}` : "";
  const webHref = website || "";

  return (
    <main className="connect-public-shell" style={{ ["--connect-accent" as string]: colors.accent }}>
      <section className="connect-hero" style={coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(56,72,98,0.8), rgba(56,72,98,0.92)), url(${coverUrl})` } : undefined}>
        {avatarUrl ? <img className="connect-avatar" src={avatarUrl} alt={contactName || businessName || "Profile"} /> : null}
        <p className="connect-eyebrow">Clutch Connect</p>
        <h1>{contactName || businessName || "Clutch Profile"}</h1>
        {title ? <p className="connect-title">{title}</p> : null}
        {businessName && contactName ? <p className="connect-company">{businessName}</p> : null}
        {bio ? <p className="connect-bio">{bio}</p> : null}
      </section>

      <section className="connect-actions-card">
        <div className="connect-actions-grid">
          {callHref ? (
            <a href={callHref} className="connect-action" onClick={() => trackEvent(profileId, "call_click", { slug })}>Call</a>
          ) : null}
          {textHref ? (
            <a href={textHref} className="connect-action" onClick={() => trackEvent(profileId, "text_click", { slug })}>Text</a>
          ) : null}
          {emailHref ? (
            <a href={emailHref} className="connect-action" onClick={() => trackEvent(profileId, "email_click", { slug })}>Email</a>
          ) : null}
          {webHref ? (
            <a href={webHref} className="connect-action" target="_blank" rel="noreferrer" onClick={() => trackEvent(profileId, "website_click", { slug })}>Website</a>
          ) : null}
          <a href={`/api/vcard/${profileId}`} className="connect-action">Save Contact</a>
          <a href="#lead-form" className="connect-action connect-action-accent">Request Quote</a>
        </div>
      </section>

      {links.length ? (
        <section className="connect-links-card">
          <h2>Custom Links</h2>
          <div className="connect-links-grid">
            {links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="connect-link-button"
                onClick={() =>
                  trackEvent(
                    profileId,
                    "link_click",
                    { slug, label: link.label, icon: link.icon || null },
                    link.id
                  )
                }
              >
                <span>{iconFor(link.icon)}</span>
                <strong>{link.label}</strong>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="connect-wallet-card">
        <button type="button" className="connect-wallet-button" disabled>
          Add to Apple Wallet (Coming Soon)
        </button>
      </section>

      <section className="connect-lead-card" id="lead-form">
        <h2>Request a Quote</h2>
        <p>Tell us what you need and we will follow up quickly.</p>

        {sent ? <p className="connect-success">Thanks. Your request was sent.</p> : null}
        {rateLimited ? <p className="connect-error">Too many requests. Please wait one minute and try again.</p> : null}
        {error ? <p className="connect-error">Something went wrong. Please try again.</p> : null}

        <form action="/api/connect/leads" method="post" className="connect-lead-form">
          <input type="hidden" name="profile_id" value={profileId} />
          <input type="hidden" name="slug" value={slug} />

          <input name="name" placeholder="Your name" className="connect-input" required />
          <input name="email" type="email" placeholder="Your email" className="connect-input" />
          <input name="phone" placeholder="Your phone" className="connect-input" />
          <textarea name="message" placeholder="How can we help?" className="connect-input" rows={4} />

          <input
            name="company_website"
            className="connect-honeypot"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
          />

          <button className="connect-submit" type="submit">Send Request</button>
        </form>
      </section>
    </main>
  );
}
