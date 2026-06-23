"use client";

import { BuilderConfig } from "@/lib/builder-types";
import BuilderPublicProfile from "./BuilderPublicProfile";

interface BuilderPreviewProps {
  config: BuilderConfig;
  profile: any;
}

export default function BuilderPreview({ config, profile }: BuilderPreviewProps) {
  return (
    <div className="builder-preview">
      <div className="preview-header">
        <h3>Live Preview</h3>
        <span className="device-indicator">📱 Mobile</span>
      </div>
      <div className="preview-frame">
        <BuilderPublicProfile config={config} profile={profile} />
      </div>
    </div>
  );
}
