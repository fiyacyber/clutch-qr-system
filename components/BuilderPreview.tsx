"use client";

import { BuilderConfig } from "@/lib/builder-types";
import ConnectProfileView from "./connect/ConnectProfileView";

interface BuilderPreviewProps {
  config: BuilderConfig;
  profile: any;
  editablePreview?: boolean;
  selectedBlockId?: string | null;
  onSelectBlock?: (blockId: string) => void;
}

export default function BuilderPreview({ config, profile, editablePreview = false, selectedBlockId, onSelectBlock }: BuilderPreviewProps) {
  return (
    <div className="saas-preview-wrap">
      {/* Label row */}
      <div className="saas-preview-label-row">
        <span className="saas-preview-label">Live Preview</span>
        <span className="saas-preview-device-pill">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }}>
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
          Mobile
        </span>
      </div>

      {/* Device frame */}
      <div className="saas-device-outer">
        <div className="saas-device-frame">
          {/* Notch */}
          <div className="saas-device-notch">
            <span className="saas-notch-island" />
          </div>
          {/* Screen scroll area */}
          <div className="saas-device-screen">
            <ConnectProfileView
              profile={profile}
              blocks={config.blocks}
              theme={config.theme}
              mode={editablePreview ? "editor" : "preview"}
              selectedBlockId={selectedBlockId}
              onSelectBlock={onSelectBlock}
            />
          </div>
          {/* Home bar */}
          <div className="saas-device-bar" />
        </div>
      </div>
    </div>
  );
}
