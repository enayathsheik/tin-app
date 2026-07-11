export function JobApplyModal({
  applyingJob, applyName, setApplyName, applyPhone, setApplyPhone,
  applyMessage, setApplyMessage, applyResumeFile, applySubmitting,
  applySubmitted, applyError,
  closeApply, handleResumeChange, submitApplication,
}) {
  if (!applyingJob) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "#00000080", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={closeApply}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,.15)", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        {applySubmitted ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#080808" }}>Application sent</div>
            <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>The poster will reach out to you directly.</div>
          </div>
        ) : <>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 800, fontSize: 20, color: "#080808", marginBottom: 4 }}>Apply — {applyingJob.jobTitle}</div>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{applyingJob.businessName || applyingJob.postedByName} · {applyingJob.city}</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Your Name</div>
            <input className="fi" placeholder="Full name" value={applyName} onChange={e => setApplyName(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Phone Number</div>
            <input className="fi" placeholder="Your mobile number" value={applyPhone} onChange={e => setApplyPhone(e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Message (optional)</div>
            <textarea className="fta" rows={3} placeholder="A short note about why you're a good fit…" value={applyMessage} onChange={e => setApplyMessage(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>Resume <span style={{color:"#e85a2a"}}>*</span></div>
            <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleResumeChange} style={{ fontSize: 12, width: "100%" }} />
            {applyResumeFile && <div style={{ fontSize: 11, color: "#16a34a", marginTop: 4 }}>✓ {applyResumeFile.name}</div>}
            <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>PDF or Word document, max 5MB.</div>
          </div>

          {applyError && (
            <div style={{ fontSize: 12, color: "#dc2626", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
              ⚠ {applyError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={submitApplication} disabled={applySubmitting}
              style={{ flex: 1, padding: "9px", borderRadius: 8, background: applySubmitting ? "#f5f5f5" : "#e85a2a", border: "none", color: applySubmitting ? "#888" : "white", fontSize: 13, fontWeight: 700, cursor: applySubmitting ? "default" : "pointer" }}>
              {applySubmitting ? "Uploading…" : "Send Application"}
            </button>
            <button onClick={closeApply} style={{ padding: "9px 16px", borderRadius: 8, background: "#f5f5f5", border: "1px solid #e0e0e0", color: "#080808", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}
