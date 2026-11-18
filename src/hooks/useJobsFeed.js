import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveJobsPage } from "../lib/jobsFeed";

// Paged public jobs feed with "load more". When `matchCount` (how many
// loaded jobs pass the page's current filters) is below `target`, it quietly
// loads up to `autoPages` more pages, then stops and leaves it to the
// "Load more" button — so a narrow filter never turns into a full scan.
export function useJobsFeed({ matchCount, target = 20, autoPages = 4, filterKey = "" } = {}) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const cursorRef = useRef(null);
  const busyRef = useRef(false);
  const autoLeftRef = useRef(autoPages);

  const loadPage = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const page = await fetchLiveJobsPage(cursorRef.current);
      cursorRef.current = page.cursor;
      setJobs(prev => {
        const seen = new Set(prev.map(j => j.id));
        return [...prev, ...page.jobs.filter(j => !seen.has(j.id))];
      });
      setDone(page.done);
      setError(false);
    } catch (e) {
      console.error("[jobs] Failed to load listings:", e);
      setError(true);
      setDone(true);
    }
    busyRef.current = false;
    setLoading(false);
  }, []);

  // First page on mount.
  useEffect(() => { loadPage(); }, [loadPage]);

  // New filters → allow another short burst of automatic pages.
  useEffect(() => { autoLeftRef.current = autoPages; }, [filterKey, autoPages]);

  // Too few matches → fetch another page automatically (bounded).
  useEffect(() => {
    if (loading || done || typeof matchCount !== "number") return;
    if (matchCount >= target || autoLeftRef.current <= 0) return;
    autoLeftRef.current -= 1;
    loadPage();
  }, [matchCount, target, loading, done, loadPage, filterKey]);

  const loadMore = useCallback(() => {
    autoLeftRef.current = autoPages;
    loadPage();
  }, [autoPages, loadPage]);

  return { jobs, loading, error, done, loadMore };
}
