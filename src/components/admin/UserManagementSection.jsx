import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { exportToExcel } from "../../utils/exportExcel";

export function UserManagementSection() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(null);
  const [editRole, setEditRole] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch(e) { console.log("Users load error:", e); }
    };
    loadUsers();
  }, []);

  const filtered = users.filter(u =>
    !search ||
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const startEdit = (u) => {
    setEditId(u.id);
    setEditRole(u.role || "contributor");
    setEditStatus(u.validationStatus || "n/a");
  };

  const saveEdit = async (uid) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", uid), { role: editRole, validationStatus: editStatus });
      setUsers(us => us.map(u => u.id === uid ? { ...u, role: editRole, validationStatus: editStatus } : u));
      setEditId(null);
    } catch(e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  const roleBadgeColor = (r) => {
    if (r === "contributor") return "#e85a2a";
    if (r === "retailer") return "#0891b2";
    if (r === "consumer") return "#16a34a";
    if (r === "contractor") return "#7c3aed";
    if (r === "architect") return "#1d4ed8";
    return "#888";
  };

  return (
    <div>
      <div className="admin-hd" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div className="admin-title">User Management</div>
          <div className="admin-sub">View and manage all registered TIN users</div>
        </div>
        <button className="btn-sm btn-out" onClick={() => exportToExcel(filtered, "tin-users-export")} disabled={!filtered.length}>
          📥 Export to Excel
        </button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <input className="fi" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 360 }} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ padding: 24, color: "var(--t3)", fontSize: 14 }}>No users found.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Validation Status</th><th>Joined</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500, color: "var(--t1)" }}>{u.name || "—"}</td>
                  <td style={{ fontSize: 12 }}>{u.email || u.workEmail || "—"}</td>
                  <td>
                    {editId === u.id ? (
                      <select value={editRole} onChange={e => setEditRole(e.target.value)} style={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--b3)", padding: "3px 6px" }}>
                        <option value="contributor">contributor</option>
                        <option value="retailer">retailer</option>
                        <option value="consumer">consumer</option>
                        <option value="contractor">contractor</option>
                        <option value="architect">architect</option>
                      </select>
                    ) : (
                      <span style={{ background: roleBadgeColor(u.role), color: "#fff", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{u.role || "—"}</span>
                    )}
                  </td>
                  <td>
                    {editId === u.id ? (
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ fontSize: 12, borderRadius: 6, border: "1px solid var(--b3)", padding: "3px 6px" }}>
                        <option value="active">active</option>
                        <option value="pending">pending</option>
                        <option value="unvalidated">unvalidated</option>
                        <option value="rejected">rejected</option>
                        <option value="n/a">n/a</option>
                      </select>
                    ) : (
                      <span>{u.validationStatus || "—"}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: "var(--t3)" }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN") : "—"}</td>
                  <td>
                    {editId === u.id ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-sm btn-ok" onClick={() => saveEdit(u.id)} disabled={saving}>{saving ? "..." : "Save"}</button>
                        <button className="btn-sm btn-out" onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn-sm btn-ok" onClick={() => startEdit(u)}>Edit Role</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
