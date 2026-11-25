// TIN Jobs Admin → one job: its details and every applicant with full
// contact + resume (the admin sees them whether or not they're shortlisted).
import { useEffect, useState } from "react";
import { loadContacts, resumeLinks } from "../../../lib/jobsAdmin";
import { applicantExport, applicantRow, jobStateLabel, shortlistText } from "../../../utils/jobsAdmin.js";
import { stageLabel } from "../../../utils/applications.js";
import { exportSheets } from "../../../utils/exportExcel";
import { DataTable, Email, Facts, Phone, Pill, ResumeButton } from "./bits";
import { dash, fmtDate, linkBtn, panel, panelTitle } from "./format";

export function JobApplicantsPage({ job, applications, seekersById, onOpenCandidate, actions }) {
  const [contacts, setContacts] = useState({ id: null, map: {}, error: "" });
  const [exp, setExp] = useState({ busy: false, error: "" });
  useEffect(() => {
    let cancelled = false;
    loadContacts(applications.map(a => a.id))
      .then(map => { if (!cancelled) setContacts({ id: job.id, map, error: "" }); })
      .catch(e => {
        console.error("[jobs-admin] contacts failed:", e);
        if (!cancelled) setContacts({ id: job.id, map: {}, error: "Some contact details couldn't be loaded — showing the candidates' profile details instead." });
      });
    return () => { cancelled = true; };
  }, [job.id, applications]);
  const loaded = contacts.id === job.id;
  const rows = applications
    .map(a => applicantRow(a, seekersById[a.applicantUid], loaded ? contacts.map[a.id] : null, stageLabel))
    .sort((a, b) => (b.appliedOn?.getTime() || 0) - (a.appliedOn?.getTime() || 0));

  const doExport = async () => {
    setExp({ busy: true, error: "" });
    try {
      const links = await resumeLinks(rows.map(r => r.resume));
      exportSheets([{ name: "Applicants", rows: rows.map((r, i) => applicantExport(job, r, links[i])) }], "tin-job-applicants");
      setExp({ busy: false, error: "" });
    } catch (e) {
      console.error("[jobs-admin] export failed:", e);
      setExp({ busy: false, error: "Export failed: " + (e.message || e) });
    }
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div className="admin-title" style={{ marginBottom: 0 }}>{job.title}</div>
        <Pill kind={job.state}>{jobStateLabel(job.state)}</Pill>
        <a href={`/jobs/${job.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--acc)" }}>Open job page ↗</a>
        {actions}
      </div>
      <div style={panel}>
        <Facts rows={[
          ["Employer", dash(job.employer)],
          ["Employer mobile", <Phone key="p" value={job.employerPhone} />],
          ["Employer email", <Email key="e" value={job.employerEmail} />],
          ["City", dash(job.city)],
          ["Role", job.roles.join(", ")],
          ["Pay", job.payText],
          ["Posted", fmtDate(job.created)],
          ["Shortlists used", `${shortlistText(job)}${job.full ? " · full" : ""}${job.shortlisted > job.slots ? ` · ${job.shortlisted} shortlisted in all (some before the limit started)` : ""}`],
        ]} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ ...panelTitle, marginBottom: 0 }}>Applicants ({rows.length})</div>
        <button type="button" className="btn-sm btn-out" disabled={exp.busy || !loaded || !rows.length} onClick={doExport}>{exp.busy ? "Preparing…" : "📥 Download Excel"}</button>
      </div>
      {(contacts.error || exp.error) && <div role="alert" style={{ color: "#b91c1c", fontSize: 12, marginBottom: 6 }}>⚠ {exp.error || contacts.error}</div>}
      {!loaded ? <div style={{ color: "var(--t3)", padding: 16 }}>Loading applicants…</div> : (
        <DataTable rows={rows} rowKey={r => r.id} empty="No applicants yet." minWidth={1050} columns={[
          ["Name", r => (seekersById[r.uid] ? <button type="button" style={linkBtn} onClick={() => onOpenCandidate(r.uid)}>{r.name}</button> : r.name)],
          ["Mobile", r => <Phone value={r.phone} />],
          ["Email", r => <Email value={r.email} />],
          ["City", r => dash(r.city)],
          ["Role / trade", r => dash(r.roleText)],
          ["Exp. (yrs)", r => dash(r.experienceYears)],
          ["Expected pay", r => dash(r.expectedPay)],
          ["Stage", r => r.stageLabel],
          ["Shortlisted", r => (r.isShortlisted ? <Pill kind="open">Yes</Pill> : "No")],
          ["Applied", r => fmtDate(r.appliedOn)],
          ["Resume", r => <ResumeButton resume={r.resume} />],
        ]} />
      )}
    </div>
  );
}
