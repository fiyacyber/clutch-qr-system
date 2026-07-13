"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Contact,
  FileText,
  Globe2,
  Mail,
  Megaphone,
  Monitor,
  Package,
  Palette,
  QrCode,
  Smartphone,
  Store,
} from "lucide-react";
import { qrServerImageUrl, qrUrl } from "@/lib/qr";
import styles from "./ClutchOnboardingTabs.module.css";

type TabKey = "create" | "customize" | "distribute";
type DistributionKey = "print" | "business-card" | "direct-mail" | "packaging" | "screen" | "signage";

const distributions: Array<{
  key: DistributionKey;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  tips: string[];
}> = [
  {
    key: "print",
    label: "Printed marketing",
    icon: FileText,
    title: "Prepare a code for flyers, brochures, and postcards",
    tips: ["Export SVG or print-resolution PNG", "Keep a clear quiet zone around the code", "Test-scan at the final printed size"],
  },
  {
    key: "business-card",
    label: "Business cards",
    icon: BriefcaseBusiness,
    title: "Make every business card measurable",
    tips: ["Keep the code away from trim and rounded corners", "Use a direct call to action", "Link to a profile, contact card, or booking page"],
  },
  {
    key: "direct-mail",
    label: "Direct mail",
    icon: Mail,
    title: "Track each mail campaign separately",
    tips: ["Use one code per design or campaign", "Match the destination to the printed offer", "Name the campaign before downloading"],
  },
  {
    key: "packaging",
    label: "Packaging",
    icon: Package,
    title: "Connect packaging to instructions, offers, and reorders",
    tips: ["Use high contrast on the final material", "Avoid seams and curved edges", "Leave enough room around the code"],
  },
  {
    key: "screen",
    label: "Digital screens",
    icon: Monitor,
    title: "Design for viewing distance and limited screen time",
    tips: ["Increase code size for distant viewers", "Use strong contrast", "Keep the code visible long enough to scan"],
  },
  {
    key: "signage",
    label: "Signs and banners",
    icon: Store,
    title: "Size the code for the expected scanning distance",
    tips: ["Start near one inch of code width per foot of distance", "Avoid reflective placement", "Test from the real viewing position"],
  },
];

const destinationCards = [
  { label: "Website", icon: Globe2 },
  { label: "Clutch Connect", icon: Contact },
  { label: "File", icon: FileText },
  { label: "Email or contact", icon: Mail },
];

export default function ClutchOnboardingTabs({ firstName }: { firstName?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>("create");
  const [distribution, setDistribution] = useState<DistributionKey>("print");
  const activeDistribution = useMemo(
    () => distributions.find((item) => item.key === distribution) || distributions[0],
    [distribution]
  );

  return (
    <section className={styles.shell}>
      <div className={styles.headingRow}>
        <div>
          <span className={styles.eyebrow}>Start here</span>
          <h1>Welcome{firstName ? `, ${firstName}` : ""}.</h1>
          <p>Create, customize, distribute, and track every Clutch Code from one workspace.</p>
        </div>
        <Link href="/portal/create" className={styles.headerCreate}>
          <QrCode size={18} /> Create Clutch Code
        </Link>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Clutch Codes onboarding">
        <button type="button" role="tab" aria-selected={activeTab === "create"} className={activeTab === "create" ? styles.activeTab : ""} onClick={() => setActiveTab("create")}>
          <span>1</span> Create your code
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "customize"} className={activeTab === "customize" ? styles.activeTab : ""} onClick={() => setActiveTab("customize")}>
          <span>2</span> Customize the design
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "distribute"} className={activeTab === "distribute" ? styles.activeTab : ""} onClick={() => setActiveTab("distribute")}>
          <span>3</span> Choose where to use it
        </button>
      </div>

      <div className={styles.panel}>
        <div className={styles.content}>
          {activeTab === "create" ? (
            <>
              <span className={styles.stepLabel}>Create</span>
              <h2>Where should your Clutch Code send people?</h2>
              <p>Choose a destination first. You can update supported destinations later without reprinting the code.</p>
              <div className={styles.destinationGrid}>
                {destinationCards.map(({ label, icon: Icon }) => (
                  <article key={label}><Icon size={22} /><span>{label}</span></article>
                ))}
              </div>
              <Link href="/portal/create" className={styles.primaryCta}>Create your first Clutch Code <ArrowRight size={17} /></Link>
            </>
          ) : null}

          {activeTab === "customize" ? (
            <>
              <span className={styles.stepLabel}>Customize</span>
              <h2>Make the code look like your brand without sacrificing scan quality.</h2>
              <div className={styles.tipList}>
                <article><Palette size={21} /><div><strong>Brand colors</strong><p>Use approved colors with enough contrast for dependable scanning.</p></div></article>
                <article><Megaphone size={21} /><div><strong>Call-to-action</strong><p>Tell customers what happens after they scan.</p></div></article>
                <article><Smartphone size={21} /><div><strong>Logo and frame</strong><p>Add a logo and an original Clutch frame around the validated QR area.</p></div></article>
              </div>
              <Link href="/portal/create" className={styles.primaryCta}>Open the Clutch Code Studio <ArrowRight size={17} /></Link>
            </>
          ) : null}

          {activeTab === "distribute" ? (
            <>
              <span className={styles.stepLabel}>Distribute</span>
              <h2>How will customers see this code?</h2>
              <p>Select a use case to see practical placement and sizing guidance.</p>
              <div className={styles.distributionChoices}>
                {distributions.map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button" onClick={() => setDistribution(key)} className={distribution === key ? styles.activeChoice : ""}>
                    <Icon size={19} /><span>{label}</span>
                  </button>
                ))}
              </div>
              <div className={styles.guidanceCard}>
                <strong>{activeDistribution.title}</strong>
                {activeDistribution.tips.map((tip) => <p key={tip}><CheckCircle2 size={16} /> {tip}</p>)}
              </div>
              <Link href="/portal/create" className={styles.primaryCta}>Create a code for this use <ArrowRight size={17} /></Link>
            </>
          ) : null}
        </div>

        <div className={styles.previewColumn} aria-label="Clutch Code preview example">
          <div className={styles.previewCallout}>Use your brand colors</div>
          <div className={styles.circularFrame}>
            <span className={styles.topText}>SCAN TO CONNECT</span>
            <img src={qrServerImageUrl({ url: qrUrl("preview"), foreground_color: "#384862", background_color: "#ffffff", size: 340 })} alt="Sample Clutch Code" />
            <span className={styles.bottomText}>POWERED BY CLUTCH CODES™</span>
          </div>
          <div className={styles.qualityCard}>
            <strong>Scan quality</strong>
            <span><CheckCircle2 size={15} /> Strong contrast</span>
            <span><CheckCircle2 size={15} /> Quiet zone preserved</span>
            <span><CheckCircle2 size={15} /> Print-ready framing</span>
          </div>
        </div>
      </div>
    </section>
  );
}
