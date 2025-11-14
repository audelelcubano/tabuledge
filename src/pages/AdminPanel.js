// src/pages/AdminPanel.js
import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";

function AdminPanel() {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);
  const [suspendDates, setSuspendDates] = useState({});
  const userEmail = auth?.currentUser?.email || "admin@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    const fetchData = async () => {
      const reqSnap = await getDocs(collection(db, "userRequests"));
      setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const userSnap = await getDocs(collection(db, "users"));
      setUsers(userSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  const approveRequest = async (req) => {
    const username = req.username || generateUsername(req.firstName, req.lastName);

    await addDoc(collection(db, "users"), {
      ...req,
      username,
      role: "accountant",
      active: true,
      failedAttempts: 0,
      passwordSetAt: Date.now(),
    });

    await deleteDoc(doc(db, "userRequests", req.id));
    setRequests(requests.filter((r) => r.id !== req.id));
    alert(`✅ Approved user: ${username}`);
  };

  const rejectRequest = async (id) => {
    await updateDoc(doc(db, "userRequests", id), { status: "rejected" });
    setRequests(requests.filter((r) => r.id !== id));
    alert("❌ Request rejected");
  };

  const toggleActive = async (id, currentStatus) => {
    const ref = doc(db, "users", id);
    await updateDoc(ref, { active: !currentStatus });
    setUsers(users.map((u) => (u.id === id ? { ...u, active: !currentStatus } : u)));
  };

  const suspendUser = async (id) => {
    const { start, end } = suspendDates[id] || {};
    if (!start || !end) {
      alert("Please select start and end dates.");
      return;
    }

    const ref = doc(db, "users", id);
    await updateDoc(ref, { suspendedFrom: start, suspendedTo: end, active: false });
    setUsers(users.map((u) => (u.id === id ? { ...u, suspendedFrom: start, suspendedTo: end, active: false } : u)));
    alert("⏸ User suspended");
  };

  const generateUsername = (firstName, lastName) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${mm}${yy}`;
  };

  const getExpiredUsers = () => {
    const now = Date.now();
    const ninetyDays = 90 * 24 * 60 * 60 * 1000;
    return users.filter((u) => u.passwordSetAt && now - u.passwordSetAt > ninetyDays);
  };

  const sendEmail = (email) => {
    alert(`📧 Simulated email sent to ${email}`);
  };

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />

      <div style={{ margin: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2>👑 Admin Panel</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => window.location.assign("/accounts")} title="Open Chart of Accounts">Chart of Accounts</button>
            <button onClick={() => window.location.assign("/event-logs")} title="Open Event Logs">Event Logs</button>
          </div>
        </div>

        {/* Pending Requests */}
        <h3>Pending Requests</h3>
        {requests.length === 0 ? (
          <p>No pending requests</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.firstName} {r.lastName}</td>
                  <td>{r.email}</td>
                  <td>{r.username || generateUsername(r.firstName, r.lastName)}</td>
                  <td>
                    <button onClick={() => approveRequest(r)}>Approve</button>
                    <button onClick={() => rejectRequest(r.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Existing Users */}
        <h3>Users</h3>
        {users.length === 0 ? (
          <p>No users yet</p>
        ) : (
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Suspend</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{u.role}</td>
                  <td>{u.active ? "Active" : "Inactive"}</td>
                  <td>
                    <input
                      type="date"
                      onChange={(e) =>
                        setSuspendDates({ ...suspendDates, [u.id]: { ...suspendDates[u.id], start: e.target.value } })
                      }
                    />
                    <input
                      type="date"
                      onChange={(e) =>
                        setSuspendDates({ ...suspendDates, [u.id]: { ...suspendDates[u.id], end: e.target.value } })
                      }
                    />
                    <button onClick={() => suspendUser(u.id)}>Suspend</button>
                  </td>
                  <td>
                    <button onClick={() => toggleActive(u.id, u.active)}>
                      {u.active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => sendEmail(u.email)}>Send Email</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Expired Password Report */}
        <h3>⚠️ Expired Passwords</h3>
        {getExpiredUsers().length === 0 ? (
          <p>No expired passwords</p>
        ) : (
          <ul>
            {getExpiredUsers().map((u) => (
              <li key={u.id}>
                {u.username} ({u.email}) → expired
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
