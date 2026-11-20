import { Helmet } from "react-helmet-async";
import { JobsStyles } from "../components/jobs/jobsUi";
import { btnPrimary, card } from "../components/jobs/jobsStyle";
import { EmployerDesk } from "../components/jobs/desk/EmployerDesk";

// /jobs/desk — the Employer Desk for anyone who posts jobs (retailer,
// contractor, architect, business). Jobs redesign phase 5a.
export function EmployerDeskPage({ user, isGuest, onRequireLogin }) {
  return (
    <div className="tj-scroll">
      <div className="tj-wrap" style={{ maxWidth: 1100 }}>
        <JobsStyles />
        <Helmet><title>Employer Desk | TIN Jobs</title><meta name="robots" content="noindex" /></Helmet>
        {isGuest || !user?.uid ? (
          <div style={{ ...card, padding: "36px 20px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t2)", marginBottom: 10 }}>Log in to manage your jobs and applicants</div>
            <button onClick={onRequireLogin} style={btnPrimary}>Log in</button>
          </div>
        ) : <EmployerDesk user={user} />}
      </div>
    </div>
  );
}
