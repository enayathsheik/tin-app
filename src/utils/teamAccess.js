// Private bypass for the temporary Diwali site gate (see DiwaliIntro.jsx).
const TEAM_KEY = "tinTeamAccess";
const TEAM_ON = "tin2026";
const TEAM_OFF = "off";

// Applies ?team=... then reports whether this browser skips the gate. The
// param is stripped from the URL so it doesn't linger in the address bar or
// in links copied from it.
export function hasTeamAccess() {
  const params = new URLSearchParams(window.location.search);
  const team = params.get("team");
  let access;
  try {
    if (team === TEAM_ON) localStorage.setItem(TEAM_KEY, "1");
    if (team === TEAM_OFF) localStorage.removeItem(TEAM_KEY);
    access = localStorage.getItem(TEAM_KEY) === "1";
  } catch {
    // Storage blocked — the bypass still works for this page load.
    access = team === TEAM_ON;
  }
  if (team === TEAM_ON || team === TEAM_OFF) {
    params.delete("team");
    const search = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (search ? `?${search}` : "") + window.location.hash);
  }
  return access;
}
