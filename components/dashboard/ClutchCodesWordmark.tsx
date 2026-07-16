interface ClutchCodesWordmarkProps {
  dark?: boolean;
}

export default function ClutchCodesWordmark({ dark = false }: ClutchCodesWordmarkProps) {
  return (
    <span className={`ds-wordmark${dark ? " is-dark" : ""}`} aria-label="Clutch Codes">
      <span className="ds-wordmark-mark" aria-hidden="true">C</span>
      <span className="ds-wordmark-copy">
        <strong>Clutch Codes™</strong>
        <small>Trackable marketing</small>
      </span>
    </span>
  );
}
