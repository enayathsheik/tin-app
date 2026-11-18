import { useNavigate } from "react-router-dom";

// Floating "+ Post a Job" button (same look and position as the old
// PostJobModal trigger). Opens the wizard at /jobs/post, which itself shows
// the login prompt to guests and brings them back after logging in.
export function PostJobButton() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/jobs/post")}
      style={{
        position: "fixed", bottom: 90, right: 24, padding: "0 20px", height: 48, borderRadius: 24,
        background: "var(--acc)", color: "white", border: "none", fontSize: 14, fontWeight: 700,
        boxShadow: "0 4px 14px rgba(0,0,0,.25)", cursor: "pointer", zIndex: 200,
        display: "flex", alignItems: "center", gap: 6,
      }}
    >
      + Post a Job
    </button>
  );
}
