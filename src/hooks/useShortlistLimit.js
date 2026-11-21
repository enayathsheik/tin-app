// L10: the per-job shortlist limit from config/pricing (admin, L9), default 10.
import { useEffect, useState } from "react";
import { loadShortlistLimit } from "../lib/shortlist";
import { DEFAULT_SHORTLIST_LIMIT } from "../utils/shortlist.js";

export function useShortlistLimit() {
  const [limit, setLimit] = useState(DEFAULT_SHORTLIST_LIMIT);
  useEffect(() => { let c = false; loadShortlistLimit().then(n => { if (!c) setLimit(n); }); return () => { c = true; }; }, []);
  return limit;
}
