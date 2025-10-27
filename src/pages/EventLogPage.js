// src/pages/EventLogPage.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";

function EventLogPage() {
  const userEmail = auth?.currentUser?.email || "admin@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, "eventLogs"), orderBy("at", "desc"));
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  return (
    <div>
      <NavBar
        userEmail={userEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <main style={{ padding: 20 }}>
        <h2>Event Logs</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Entity</th>
                <th>Action</th>
                <th>User</th>
                <th>Timestamp</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan="7">No events yet.</td></tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td>{l.id}</td>
                    <td>{l.entity}</td>
                    <td>{l.action}</td>
                    <td>{l.user}</td>
                    <td>{l.at?.toDate ? l.at.toDate().toLocaleString() : ""}</td>
                    <td><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(l.before, null, 2)}</pre></td>
                    <td><pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(l.after, null, 2)}</pre></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default EventLogPage;
