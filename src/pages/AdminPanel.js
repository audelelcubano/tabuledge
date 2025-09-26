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
import { db } from "../firebase";

function AdminPanel() {
  const [requests, setRequests] = useState([]);
  const [users, setUsers] = useState([]);

  // Fetch account requests + users
  useEffect(() => {
    const fetchData = async () => {
      const reqSnap = await getDocs(collection(db, "userRequests"));
      setRequests(reqSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      const userSnap = await getDocs(collection(db, "users"));
      setUsers(userSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    fetchData();
  }, []);

  // Approve request → move to users collection
  const approveRequest = async (req) => {
    const username = req.username || generateUsername(req.firstName, req.lastName);

    await addDoc(collection(db, "users"), {
      ...req,
      username,
      role: "accountant", // default role, can be changed later
      active: true,
      failedAttempts: 0,
      passwordSetAt: Date.now(),
    });

    // Remove from requests
    await deleteDoc(doc(db, "userRequests", req.id));

    setRequests(requests.filter((r) => r.id !== req.id));
    alert(`✅ Approved user: ${username}`);
  };

  // Reject request → mark as rejected
  const rejectRequest = async (id) => {
    await updateDoc(doc(db, "userRequests", id), { status: "rejected" });
    setRequests(requests.filter((r) => r.id !== id));
    alert("❌ Request rejected");
  };

  // Toggle user active/inactive
  const toggleActive = async (id, currentStatus) => {
    const ref = doc(db, "users", id);
    await updateDoc(ref, { active: !currentStatus });
    setUsers(users.map((u) => (u.id === id ? { ...u, active: !currentStatus } : u)));
  };

  // Generate username format: first initial + last name + MMYY
  const generateUsername = (firstName, lastName) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${mm}${yy}`;
  };

  return (
    <div style={{ margin: "20px" }}>
      <h2>👑 Admin Panel</h2>

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
              <th>Toggle Active</th>
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
                  <button onClick={() => toggleActive(u.id, u.active)}>
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default AdminPanel;
