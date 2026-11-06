import { useEffect, useState } from "react";

// Temporary Diwali teaser: full-screen game overlay over the home route, once
// per browser session. Renders nothing from DIWALI_END onwards, so it switches
// itself off with no further deploy.
const DIWALI_END = new Date("2026-11-12T00:00:00+05:30").getTime();
const SEEN_KEY = "tinDiwaliSeen";

// Covers browsers that block sessionStorage, so the overlay doesn't come back
// on every in-app return to the home route.
let seenThisLoad = false;

function shouldShow() {
  if (Date.now() >= DIWALI_END || seenThisLoad) return false;
  try {
    return !sessionStorage.getItem(SEEN_KEY);
  } catch {
    return true;
  }
}

export function DiwaliIntro() {
  const [open, setOpen] = useState(shouldShow);

  useEffect(() => {
    if (!open) return;
    seenThisLoad = true;
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Storage blocked — seenThisLoad still covers this page load.
    }
  }, [open]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="TIN Diwali game" style={{position:"fixed",inset:0,zIndex:100000,background:"#120d24"}}>
      <iframe
        src="/diwali.html?embed=1"
        title="TIN Diya Dash Diwali game"
        allow="web-share"
        style={{display:"block",width:"100%",height:"100%",border:"none",background:"#120d24"}}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{position:"absolute",zIndex:1,top:"calc(env(safe-area-inset-top, 0px) + 10px)",right:"calc(env(safe-area-inset-right, 0px) + 10px)",minHeight:44,padding:"10px 16px",borderRadius:999,background:"#120d24",border:"1px solid #ffb627",color:"#ffb627",fontSize:14,fontWeight:700,fontFamily:"'Barlow',sans-serif",cursor:"pointer",touchAction:"manipulation"}}
      >
        Skip to TIN ✕
      </button>
    </div>
  );
}
