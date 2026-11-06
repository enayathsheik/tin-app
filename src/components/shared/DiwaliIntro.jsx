import { useEffect } from "react";

// Temporary Diwali site gate: until this is removed, every route shows only
// the game. main.jsx renders this instead of <App />, so the main site isn't
// mounted behind it (nothing to see, click or scroll, and no Firestore reads).
export function DiwaliIntro() {
  useEffect(() => {
    for (const el of [document.documentElement, document.body]) {
      el.style.overflow = "hidden";
      el.style.overscrollBehavior = "none";
      el.style.background = "#120d24";
    }
  }, []);

  return (
    <div style={{position:"fixed",inset:0,zIndex:100000,background:"#120d24"}}>
      <iframe
        src="/diwali.html?embed=1"
        title="TIN Diya Dash Diwali game"
        allow="web-share"
        style={{display:"block",width:"100%",height:"100%",border:"none",background:"#120d24"}}
      />
    </div>
  );
}
