// Employer Desk (C): the people in one bucket (shortlisted, contacted, …), with
// one-tap Call and Message. Everyone here is past Shortlisted, so their contact
// is already unlocked (L8); it's read from the private contact doc, a page at
// a time, under the same rules as everywhere else.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { currentStage, isFromSearch } from "../../../utils/applications.js";
import { PEOPLE_BUCKETS, peopleIn } from "../../../utils/employerDesk.js";
import { loadApplicationContact, moveApplication, openApplicationCv } from "../../../lib/applications";
import { messageAboutApplication } from "../../../lib/jobMessages";
import { StagePill } from "../ApplicationBits";
import { card, heading } from "../jobsStyle";
import { ApplicantDetail } from "./ApplicantDetail";
import { Sheet } from "./Sheet";

const PAGE = 20;
const btn = { minHeight: 44, padding: "0 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", textDecoration: "none" };
const primary = { ...btn, background: "#e85a2a", color: "#fff", border: "none" };
const outline = { ...btn, background: "transparent", color: "var(--t1)", border: "1px solid var(--b3)" };
const about = (a) => [a.profileSnapshot?.role, a.profileSnapshot?.city, a.profileSnapshot?.experienceYears != null && a.profileSnapshot?.experienceYears !== "" ? `${a.profileSnapshot.experienceYears} yrs` : ""].filter(Boolean).join(" · ");

// `jobsById` = { id: normalised job }; `showJob` when the list spans jobs.
export function PeopleList({ bucket, apps, jobsById, employer, showJob = false, onAppChange }) {
  const navigate = useNavigate();
  const [shown, setShown] = useState(PAGE);
  const [contacts, setContacts] = useState({}); // appId → contact, or null when there is none
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const people = peopleIn(apps, bucket);
  const page = people.slice(0, shown);
  const missing = page.filter(a => !(a.id in contacts)).map(a => a.id).join();
  useEffect(() => {
    if (!missing) return;
    let cancelled = false;
    const need = page.filter(a => !(a.id in contacts));
    Promise.all(need.map(a => loadApplicationContact(a).then(c => [a.id, c]))).then(found => {
      if (!cancelled) setContacts(p => ({ ...p, ...Object.fromEntries(found) }));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `missing` names exactly the ones to load
  }, [missing]);

  const run = async (a, fn) => {
    setBusyId(a.id); setError("");
    try { await fn(); } catch (e) { console.error("[desk] people action failed:", e); setError("Couldn't do that: " + (e.message || e)); }
    setBusyId("");
  };
  const name = (a) => a.applicantName || "Applicant";
  const employerOf = (a) => ({ ...employer, name: jobsById[a.jobId]?.businessName || employer.name });
  const message = (a) => run(a, async () => navigate(`/conversations/${await messageAboutApplication({ myUid: employer.uid, myName: employerOf(a).name, otherUid: a.applicantUid, otherName: a.applicantName, app: a })}`));
  const markContacted = (a) => run(a, async () => onAppChange(await moveApplication(a, "contacted", "employer", employer.uid)));
  const openCv = async (a, contact) => {
    const win = window.open("", "_blank");
    try { await openApplicationCv({ ...a, ...contact }, win); } catch (e) { if (win) win.close(); setError("Couldn't open the CV: " + (e.message || e)); }
  };
  const opened = apps.find(a => a.id === openId) || null;
  const label = PEOPLE_BUCKETS.find(b => b.key === bucket)?.label || "";

  return (
    <div>
      <h2 style={{ ...heading, fontSize: 20, margin: "0 0 8px" }}>{label} · {people.length}</h2>
      {error && <div role="alert" style={{ fontSize: 13, color: "#b91c1c", marginBottom: 10 }}>⚠ {error}</div>}
      {people.length === 0 && <div style={{ ...card, padding: "24px 16px", textAlign: "center", fontSize: 14, color: "var(--t3)" }}>Nobody here yet.</div>}
      <div style={{ display: "grid", gap: 8 }}>
        {page.map(a => {
          const contact = contacts[a.id];
          const stage = currentStage(a);
          const iv = a.interview?.date && ["int_invited", "int_scheduled", "int_rescheduled"].includes(stage) ? `${a.interview.date} ${a.interview.time || ""} · ${a.interview.mode || ""}` : "";
          return (
            <div key={a.id} style={{ ...card, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <button type="button" onClick={() => setOpenId(a.id)} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "var(--t1)" }}>{name(a)}</div>
                  <div style={{ fontSize: 12, color: "var(--t3)" }}>{about(a)}{isFromSearch(a) ? `${about(a) ? " · " : ""}🔎 Found in search` : ""}</div>
                  {showJob && <div style={{ fontSize: 12, color: "var(--t2)" }}>For: {jobsById[a.jobId]?.title || a.jobSnapshot?.title || "Job"}</div>}
                  {iv && <div style={{ fontSize: 12, fontWeight: 700, color: "#b45309" }}>🗓 {iv}</div>}
                </button>
                <StagePill stage={stage} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {contact?.applicantPhone && <a href={`tel:${contact.applicantPhone.replace(/[^\d+]/g, "")}`} aria-label={`Call ${name(a)}`} style={primary}>📞 Call</a>}
                <button type="button" disabled={busyId === a.id} onClick={() => message(a)} aria-label={`Message ${name(a)}`} style={outline}>💬 Message</button>
                {(contact?.resumePath || contact?.resumeUrl) && <button type="button" onClick={() => openCv(a, contact)} style={outline}>📄 CV</button>}
                {bucket === "shortlisted" && stage === "shortlisted" && <button type="button" disabled={busyId === a.id} onClick={() => markContacted(a)} style={outline}>✓ Mark contacted</button>}
                <button type="button" onClick={() => setOpenId(a.id)} style={outline}>More…</button>
              </div>
              {a.id in contacts && !contact?.applicantPhone && <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6 }}>No phone number on file.</div>}
            </div>
          );
        })}
      </div>
      {people.length > shown && <button type="button" onClick={() => setShown(n => n + PAGE)} style={{ ...outline, marginTop: 10 }}>Show more</button>}
      {opened && (
        <Sheet title={name(opened)} onClose={() => setOpenId(null)}>
          <ApplicantDetail key={opened.id} app={opened} job={jobsById[opened.jobId]} employer={employerOf(opened)} onChange={onAppChange} />
        </Sheet>
      )}
    </div>
  );
}
