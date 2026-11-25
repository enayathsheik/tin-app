// L10: the per-job shortlist limit from config/pricing (admin, L9); Infinity in
// beta mode, and until it's loaded (the rules enforce it, not the screen).
import { useEffect, useState } from "react";
import { loadShortlistLimit } from "../lib/shortlist";

export function useShortlistLimit() {
  const [limit, setLimit] = useState(Infinity);
  useEffect(() => { let c = false; loadShortlistLimit().then(n => { if (!c) setLimit(n); }); return () => { c = true; }; }, []);
  return limit;
}
