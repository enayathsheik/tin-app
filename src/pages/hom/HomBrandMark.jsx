// Shared HOM Systems brand mark — logo + tagline, used in both the public
// microsite masthead (HomSystemsPage) and the TIN admin tab (HomAdminTab),
// so the two surfaces carry one identity. Falls back to a styled text
// wordmark if public/hom-logo.png isn't present yet (404), rather than
// showing a broken image icon.
import { useState } from "react";

export function HomBrandMark() {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="hm-brand-block">
      {!imgFailed ? (
        <img src="/hom-logo.png" alt="HOM Systems" className="hm-logo" onError={() => setImgFailed(true)} />
      ) : (
        <div className="hm-brand">HOM <em>SYSTEMS</em></div>
      )}
      <div className="hm-brand-sub">System designed for infinite possibilities</div>
    </div>
  );
}
