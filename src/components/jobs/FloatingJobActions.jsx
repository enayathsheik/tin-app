// L3: floating "Search Jobs" / "Post a Job" buttons by user type — rule in
// src/utils/jobRoles.js. Rendered once by App.jsx (replaces the old
// per-page PostJobButton). Signed-in users see nothing until their role
// check finishes, so the buttons don't flicker from two to one.
import { useLocation, useNavigate } from "react-router-dom";
import { useJobRoles } from "../../lib/jobRoles";
import { floatingButtonsFor, floatingButtonsPlacement } from "../../utils/jobRoles.js";

const base = {
  height: 48, padding: "0 20px", borderRadius: 24, border: "none", fontSize: 14, fontWeight: 700,
  boxShadow: "0 4px 14px rgba(0,0,0,.25)", cursor: "pointer", display: "flex", alignItems: "center",
  gap: 6, fontFamily: "'Barlow',sans-serif", whiteSpace: "nowrap",
};

export function FloatingJobActions({ user, page }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const roles = useJobRoles(user);
  const placement = floatingButtonsPlacement(pathname, { page });
  if (!placement) return null;
  if (user && !roles && user.role !== "admin" && user.role !== "hom_admin") return null;
  const show = floatingButtonsFor(user, roles);
  const search = show.search && !placement.hideSearch;
  const post = show.post;
  if (!search && !post) return null;

  const onSearch = () => {
    if (placement.searchFocusesBox) {
      const box = document.querySelector('input[aria-label="Search jobs"]');
      if (box) { box.scrollIntoView({ behavior: "smooth", block: "center" }); box.focus({ preventScroll: true }); return; }
    }
    navigate("/jobs");
  };

  return (
    <div style={{ position: "fixed", bottom: 90, right: 16, zIndex: 200, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {search && (
        <button type="button" onClick={onSearch} style={{ ...base, background: "#fff", color: "var(--acc)", border: "2px solid var(--acc)" }}>
          🔍 Search Jobs
        </button>
      )}
      {post && (
        <button type="button" onClick={() => navigate("/jobs/post")} style={{ ...base, background: "var(--acc)", color: "#fff" }}>
          + Post a Job
        </button>
      )}
    </div>
  );
}
