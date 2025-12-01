// src/pages/EventLogPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import NavBar from "../components/NavBar";
import { formatMoney } from "../utils/format";

export default function EventLogPage() {
  const userEmail = auth?.currentUser?.email || "user@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // On-page filters
  const [entityFilter, setEntityFilter] = useState("account"); // we focus on account logs
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Deep-link filter (?accountId=....)
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const qAccountId = params.get("accountId");

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(query(collection(db, "eventLogs"), orderBy("at", "desc")));
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, []);

  const view = useMemo(() => {
    let v = logs;

    // limit by entity type
    if (entityFilter) v = v.filter(l => l.entity === entityFilter);

    // deep link accountId (from CoA "View Logs")
    if (qAccountId) v = v.filter(l => l.entityId === qAccountId);

    // date range
    if (from) {
      const f = new Date(from).getTime();
      v = v.filter(l => (l.at?.toDate ? l.at.toDate().getTime() : 0) >= f);
    }
    if (to) {
      const t = new Date(to).getTime();
      v = v.filter(l => (l.at?.toDate ? l.at.toDate().getTime() : 0) <= t);
    }

    // free-text search in name/number/description/comments of before/after
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      const matchSnapshot = (snap) => {
        if (!snap) return false;
        const txt = [
          snap.name, snap.number, snap.description, snap.comment,
          snap.category, snap.subcategory, snap.normalSide, snap.statement,
          typeof snap.balance === "number" ? formatMoney(snap.balance) : "",
        ].filter(Boolean).join(" ").toLowerCase();
        return txt.includes(s);
      };
      v = v.filter(l =>
        (l.user || "").toLowerCase().includes(s) ||
        matchSnapshot(l.before) ||
        matchSnapshot(l.after)
      );
    }

    return v;
  }, [logs, entityFilter, qAccountId, from, to, search]);

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <main style={{ padding: 20 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2>Event Logs</h2>
          <div style={{ display:"flex", gap:8 }}>
            <select value={entityFilter} onChange={e=>setEntityFilter(e.target.value)} title="Entity">
              <option value="account">Account</option>
              {/* Add other entities if you start logging them */}
            </select>
            <input type="date" value={from} onChange={e=>setFrom(e.target.value)} title="From date" />
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} title="To date" />
            <input
              placeholder="Search user/name/number/desc"
              value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{ width:260 }}
            />
          </div>
        </div>

        {qAccountId && (
          <div style={{ margin: "8px 0 12px", fontSize: 12 }}>
            Filtering by accountId: <code>{qAccountId}</code>
            <button onClick={() => navigate("/event-logs")} style={{ marginLeft: 8 }}>
              Clear
            </button>
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>When</th>
                <th style={th}>User</th>
                <th style={th}>Action</th>
                <th style={th}>Account (before)</th>
                <th style={th}>Account (after)</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5">Loading…</td></tr>
              ) : view.length === 0 ? (
                <tr><td colSpan="5">No logs found.</td></tr>
              ) : (
                view.map(l => (
                  <tr key={l.id}>
                    <td style={td}>{l.at?.toDate ? l.at.toDate().toLocaleString() : "—"}</td>
                    <td style={td}>{l.user || "—"}</td>
                    <td style={td}>{l.action}</td>
                    <td style={td}>
                      {l.before ? (
                        <>
                          <div><strong>{l.before.name}</strong> ({l.before.number})</div>
                          <div>{l.before.category} ▸ {l.before.subcategory}</div>
                          <div>Bal: {typeof l.before.balance === "number" ? formatMoney(l.before.balance) : "—"}</div>
                        </>
                      ) : <em>— first insert —</em>}
                    </td>
                    <td style={td}>
                      {l.after ? (
                        <>
                          <div><strong>{l.after.name}</strong> ({l.after.number})</div>
                          <div>{l.after.category} ▸ {l.after.subcategory}</div>
                          <div>Bal: {typeof l.after.balance === "number" ? formatMoney(l.after.balance) : "—"}</div>
                        </>
                      ) : "—"}
                    </td>
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

const th = { border: "1px solid #e2e8f0", padding: 8, background: "#f1f5f9", textAlign: "left" };
const td = { border: "1px solid #e2e8f0", padding: 8, textAlign: "left" };
