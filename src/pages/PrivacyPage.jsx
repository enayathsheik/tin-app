// /privacy — TIN Privacy (launch, 22 Nov 2026). Plain-language summary of
// what TIN Jobs shares and when. Keep the contact-visibility section in sync
// with src/components/jobs/ShortlistNotice.jsx and the rules (L8).
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { JobsStyles } from "../components/jobs/jobsUi";
import { card, heading } from "../components/jobs/jobsStyle";
import { SHORTLIST_NOTICE } from "../components/jobs/ShortlistNotice";

const h2 = { ...heading, fontSize: 18, margin: "18px 0 6px" };
const p = { fontSize: 14, color: "var(--t2)", lineHeight: 1.6, margin: "0 0 8px" };
const li = { fontSize: 14, color: "var(--t2)", lineHeight: 1.6 };

export function PrivacyPage() {
  return (
    <div className="tj-scroll"><div className="tj-wrap" style={{ maxWidth: 760 }}>
      <JobsStyles />
      <Helmet><title>Privacy | TIN Jobs</title></Helmet>
      <div style={{ fontSize: 12, color: "var(--t3)", fontWeight: 700, marginBottom: 6 }}>
        <Link to="/jobs" style={{ color: "var(--t3)", textDecoration: "none" }}>Jobs</Link> / Privacy
      </div>
      <div style={{ ...card, padding: 20 }}>
        <h1 style={{ ...heading, fontSize: 26, margin: "0 0 4px" }}>Privacy</h1>
        <p style={{ ...p, color: "var(--t3)" }}>How TIN Jobs (tinit.in) handles your details. Updated 25 November 2026.</p>

        <h2 style={h2}>If you are looking for work</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}><b>Your job profile</b> (name, work, skills, experience, education, work history, area) can be found by employers on TIN only if you say yes to <b>“Let employers find and call me”</b> and your profile is set to looking. Your phone number, email, CV and pay are not shown in search.</li>
          <li style={li}><b>If you say yes</b>, an employer who finds you can shortlist you for one of their live jobs without asking you again. It shows in My applications, and that employer can then see your phone number, email and CV.</li>
          <li style={li}><b>If you say no</b>, employers can’t find you in search; they see you only when you apply. You can change your answer at any time. Changing it to no doesn’t take back details an employer has already seen.</li>
          <li style={li}><b>When you apply</b>, the employer sees your TIN Profile card and your full job profile — <b>without</b> your phone number, email or CV.</li>
          <li style={li}><b>{SHORTLIST_NOTICE}</b> From that moment they stay visible to everyone who manages that job — today the person who posted it; later also the business owner, admins, HR and recruiters on that business’s team — even if the application is later rejected or the job is closed.</li>
          <li style={li}><b>Your expected and current pay</b> are shown to employers you apply to only if you switch on “Show my pay to employers” in your job profile. It’s off unless you turn it on.</li>
          <li style={li}><b>If you sign up or log in with an SMS code</b>, your mobile number is passed to our SMS provider (today Google Firebase) to send it.</li>
          <li style={li}>Employers can message you on TIN at any time; your number is not shown in messages.</li>
        </ul>

        <h2 style={h2}>If you are hiring</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>Your job posts are public, including your business name, city and the pay range.</li>
          <li style={li}>The contact phone on a job post is used by the TIN team to reach you about the listing; it is not shown on the job page.</li>
          <li style={li}>The phone numbers, emails and CVs of applicants and people you shortlist are for hiring for that job only. Don’t share them or use them for anything else.</li>
        </ul>

        <h2 style={h2}>Business listings</h2>
        <p style={p}>Some business pages on TIN were created from public listings. They are not shown publicly until the business is verified or claimed by its owner. If you own a business listed on TIN, you can claim it from “Post a Job”.</p>

        <h2 style={h2}>Who can see your account</h2>
        <p style={p}>The TIN team (admins) can see accounts, profiles and applications to run and protect the service. We don’t sell your details.</p>

        <h2 style={h2}>Your choices</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={li}>Edit or hide your job profile, or turn “Let employers find and call me” off, at any time from <Link to="/jobs/profile" style={{ color: "var(--acc)" }}>My Profile</Link>.</li>
          <li style={li}>Withdraw an application from <Link to="/jobs/applications" style={{ color: "var(--acc)" }}>My applications</Link>.</li>
          <li style={li}>To delete your account or ask about your data, write to the TIN team through Messages or the contact on this site.</li>
        </ul>
      </div>
    </div></div>
  );
}
