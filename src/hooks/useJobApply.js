import { useEffect, useState } from "react";
import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";

const RESUME_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const RESUME_MAX_BYTES = 5 * 1024 * 1024;

function validateResumeFile(f) {
  const name = f.name.toLowerCase();
  const validExt = name.endsWith(".pdf") || name.endsWith(".doc") || name.endsWith(".docx");
  const validMime = RESUME_MIME_TYPES.includes(f.type);
  if (!validExt || !validMime) return "Please upload a PDF or Word document (.pdf, .doc, .docx).";
  if (f.size > RESUME_MAX_BYTES) return "Resume file must be under 5MB.";
  return null;
}

// Shared apply-to-job lifecycle, used by both the Jobs list (JobsPage) and
// the single job detail page (JobDetailPage) so the flow only lives once.
export function useJobApply(user, isGuest, onRequireLogin) {
  const [appliedJobIds, setAppliedJobIds] = useState(new Set());
  const [applyingJob, setApplyingJob] = useState(null);
  const [applyName, setApplyName] = useState("");
  const [applyPhone, setApplyPhone] = useState("");
  const [applyMessage, setApplyMessage] = useState("");
  const [applyResumeFile, setApplyResumeFile] = useState(null);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applySubmitted, setApplySubmitted] = useState(false);
  const [applyError, setApplyError] = useState("");

  const loadAppliedJobIds = async () => {
    if (!user?.uid) { setAppliedJobIds(new Set()); return; }
    try {
      const snap = await getDocs(query(collection(db, "jobApplications"), where("applicantUid", "==", user.uid)));
      setAppliedJobIds(new Set(snap.docs.map(d => d.data().jobId)));
    } catch (e) {
      console.error("[jobs] Failed to load applied jobs:", e);
    }
  };

  useEffect(() => { loadAppliedJobIds(); }, [user?.uid]);

  const openApply = (job) => {
    if (isGuest) { onRequireLogin(); return; }
    if (job.postedByUid === user?.uid) return; // can't apply to your own listing
    if (appliedJobIds.has(job.id)) return; // already applied — no re-apply
    setApplyingJob(job);
    setApplyName(user?.name || "");
    setApplyPhone(user?.phone || "");
    setApplyMessage("");
    setApplyResumeFile(null);
    setApplyError("");
    setApplySubmitted(false);
  };

  const closeApply = () => { setApplyingJob(null); setApplySubmitted(false); setApplyResumeFile(null); };

  const handleResumeChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) { setApplyResumeFile(null); return; }
    const err = validateResumeFile(f);
    if (err) { setApplyError(err); setApplyResumeFile(null); e.target.value = ""; return; }
    setApplyError("");
    setApplyResumeFile(f);
  };

  const submitApplication = async () => {
    if (!applyName.trim() || !applyPhone.trim()) { setApplyError("Please enter your name and phone number."); return; }
    if (!applyResumeFile) { setApplyError("Please attach your resume (PDF or Word document)."); return; }
    const resumeErr = validateResumeFile(applyResumeFile);
    if (resumeErr) { setApplyError(resumeErr); return; }
    setApplySubmitting(true);
    setApplyError("");
    try {
      const path = `resumes/${user.uid}/${Date.now()}_${applyResumeFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, applyResumeFile);
      const resumeUrl = await getDownloadURL(storageRef);

      // Deterministic ID (jobId_applicantUid) — a second apply attempt targets the same
      // doc instead of creating a duplicate; firestore.rules also blocks resubmission.
      const appId = `${applyingJob.id}_${user.uid}`;
      await setDoc(doc(db, "jobApplications", appId), {
        jobId: applyingJob.id,
        applicantUid: user.uid,
        applicantName: applyName.trim(),
        applicantPhone: applyPhone.trim(),
        message: applyMessage.trim(),
        resumeUrl,
        resumeFileName: applyResumeFile.name,
        applicantStatus: "new",
        createdAt: serverTimestamp(),
      });
      setAppliedJobIds(ids => new Set(ids).add(applyingJob.id));
      setApplySubmitted(true);
      setApplySubmitting(false);
      setTimeout(() => { closeApply(); }, 2500);
    } catch (e) {
      console.error("[jobs] Application failed:", e);
      setApplyError("Could not send application: " + e.message);
      setApplySubmitting(false);
    }
  };

  return {
    appliedJobIds,
    applyingJob, applyName, setApplyName, applyPhone, setApplyPhone,
    applyMessage, setApplyMessage, applyResumeFile, applySubmitting,
    applySubmitted, applyError,
    openApply, closeApply, handleResumeChange, submitApplication,
  };
}
