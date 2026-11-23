// TIN Jobs Admin → one candidate: contact, resume, full profile, and every
// job they applied to (with stage, shortlist and the CV sent for that job).
import { useEffect, useState } from "react";
import { loadContacts } from "../../../lib/jobsAdmin";
import { applicantRow } from "../../../utils/jobsAdmin.js";
import { stageLabel } from "../../../utils/applications.js";
import { tinProfileLines } from "../../../utils/jobProfile.js";
import { VISIBILITY, labelOf } from "../../../data/jobsTaxonomy.js";
import { DataTable, Email, Facts, Phone, Pill, ResumeButton } from "./bits";
import { dash, fmtDate, linkBtn, panel, panelTitle } from "./format";

export function CandidatePage({ seeker, jobsById, onOpenJob }) {
  const [contacts, setContacts] = useState({ uid: null, map: {}, error: "" });
  useEffect(() => {
    let cancelled = false;
    loadContacts(seeker.applications.map(a => a.id))
      .then(map => { if (!cancelled) setContacts({ uid: seeker.uid, map, error: "" }); })
      .catch(e => {
        console.error("[jobs-admin] contacts failed:", e);
        if (!cancelled) setContacts({ uid: seeker.uid, map: {}, error: "Some resumes sent with applications couldn't be loaded." });
      });
    return () => { cancelled = true; };
  }, [seeker]);
  const loaded = contacts.uid === seeker.uid;
  const rows = seeker.applications.map(a => ({
    ...applicantRow(a, null, loaded ? contacts.map[a.id] : null, stageLabel),
    job: jobsById[a.jobId] || null,
  }));
  const pay = (v) => (v ? <>{v}{seeker.payHidden && <span style={{ color: "var(--t3)" }}> · hidden from employers</span>}</> : "");
  const extra = tinProfileLines(seeker.snapshot).filter(([k]) => !["Trades", "Role", "Experience", "City"].includes(k));

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="admin-title" style={{ marginBottom: 0 }}>{seeker.name}</div>
        <ResumeButton resume={seeker.resume} label="View / Download resume" />
      </div>
      <div style={panel}>
        <div style={panelTitle}>Contact</div>
        <Facts rows={[
          ["Mobile", <Phone key="p" value={seeker.phone} />],
          ["Email", <Email key="e" value={seeker.email} />],
          ["City", dash(seeker.city)],
          ["Works in", seeker.areas],
        ]} />
      </div>
      <div style={panel}>
        <div style={panelTitle}>Profile</div>
        <Facts rows={[
          ["Role / trade", dash(seeker.roleText)],
          ["Experience", seeker.experienceYears !== "" ? `${seeker.experienceYears} ${seeker.experienceYears === "1" ? "year" : "years"}` : "—"],
          ["Expected pay", pay(seeker.expectedPay) || "—"],
          ["Current pay", pay(seeker.currentPay)],
          ...extra,
          ["Profile visibility", labelOf(VISIBILITY, seeker.visibility) || (seeker.hasProfile ? "" : "No job profile — applied only")],
          [seeker.hasProfile ? "Profile created" : "Joined", fmtDate(seeker.created)],
        ]} />
      </div>
      <div style={panelTitle}>Jobs applied ({seeker.applied}) · shortlisted {seeker.shortlisted} {seeker.shortlisted === 1 ? "time" : "times"}</div>
      {contacts.error && <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginBottom: 6 }}>⚠ {contacts.error}</div>}
      <DataTable rows={rows} rowKey={r => r.id} empty="Hasn't applied to any job yet." minWidth={760} columns={[
        ["Job", r => (r.job
          ? <button type="button" style={linkBtn} onClick={() => onOpenJob(r.job.id)}>{r.job.title}</button>
          : <>{dash(r.app.jobSnapshot?.title)} <span style={{ color: "var(--t3)" }}>(job removed)</span></>)],
        ["Employer", r => dash(r.job?.employer || r.app.jobSnapshot?.businessName)],
        ["City", r => dash(r.job?.city || r.app.jobSnapshot?.city)],
        ["Applied", r => fmtDate(r.appliedOn)],
        ["Stage", r => r.stageLabel],
        ["Shortlisted", r => (r.isShortlisted ? <Pill kind="open">Yes</Pill> : "No")],
        ["Resume sent", r => (r.app.hasCv && !loaded ? "…" : <ResumeButton resume={r.resume} />)],
      ]} />
    </div>
  );
}
