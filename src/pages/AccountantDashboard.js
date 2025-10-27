// src/pages/AccountantDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";
import { useNavigate } from "react-router-dom";

function AccountantDashboard() {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const userEmail = auth?.currentUser?.email || "accountant@example.com";
  const navigate = useNavigate();

  useEffect(() => {
    const loadEntries = async () => {
      try {
        const snap = await getDocs(collection(db, "journalEntries"));
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setEntries(data);
        setFilteredEntries(data);
      } catch (e) {
        console.error("Failed to load journal entries:", e);
      } finally {
        setLoading(false);
      }
    };
    loadEntries();
  }, []);

  // Filter entries when filters or entries change
  useEffect(() => {
    let filtered = [...entries];

    // Filter by status
    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (e) => (e.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Filter by date range
    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((e) => e.createdAt?.toDate?.() >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      filtered = filtered.filter((e) => e.createdAt?.toDate?.() <= to);
    }

    // Search by account name, amount, or description
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((e) => {
        const debitMatch = e.debits?.some((d) =>
          d.accountName?.toLowerCase().includes(term)
        );
        const creditMatch = e.credits?.some((c) =>
          c.accountName?.toLowerCase().includes(term)
        );
        const descMatch = e.description?.toLowerCase().includes(term);
        const amountMatch =
          e.debits?.some((d) => String(d.amount).includes(term)) ||
          e.credits?.some((c) => String(c.amount).includes(term));
        return debitMatch || creditMatch || descMatch || amountMatch;
      });
    }

    setFilteredEntries(filtered);
  }, [entries, statusFilter, fromDate, toDate, searchTerm]);

  const tableRows = useMemo(
    () =>
      filteredEntries.map((e) => (
        <tr key={e.id}>
          <td style={td}>
            {e.createdAt?.toDate
              ? e.createdAt.toDate().toLocaleDateString()
              : "—"}
          </td>
          <td style={td}>{e.description || "—"}</td>
          <td style={td}>
            {e.debits?.map((d, i) => (
              <div key={i}>
                {d.accountName}: ${d.amount?.toFixed(2)}
              </div>
            ))}
          </td>
          <td style={td}>
            {e.credits?.map((c, i) => (
              <div key={i}>
                {c.accountName}: ${c.amount?.toFixed(2)}
              </div>
            ))}
          </td>
          <td style={td}>{e.status || "pending"}</td>
          <td style={td}>{e.preparedBy || "—"}</td>
        </tr>
      )),
    [filteredEntries]
  );

  return (
    <div>
      <NavBar userEmail={userEmail} />

      <main style={{ padding: 20 }}>
        {/* Header with Create Journal button */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2>Accountant Dashboard</h2>
          <button
            onClick={() => navigate("/create-journal")}
            style={{
              padding: "8px 12px",
              background: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            + New Journal Entry
          </button>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "12px",
            margin: "16px 0",
            background: "#f8fafc",
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
          }}
        >
          <div>
            <label>Status: </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={select}
            >
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>

          <div>
            <label>From: </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={input}
            />
          </div>

          <div>
            <label>To: </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={input}
            />
          </div>

          <div style={{ flexGrow: 1 }}>
            <label>Search: </label>
            <input
              type="text"
              placeholder="Search account, amount, or description"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...input, width: "100%" }}
            />
          </div>
        </div>

        {loading ? (
          <p>Loading journal entries…</p>
        ) : filteredEntries.length === 0 ? (
          <p>No journal entries found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Date</th>
                  <th style={th}>Description</th>
                  <th style={th}>Debits</th>
                  <th style={th}>Credits</th>
                  <th style={th}>Status</th>
                  <th style={th}>Prepared By</th>
                </tr>
              </thead>
              <tbody>{tableRows}</tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

const th = {
  border: "1px solid #e2e8f0",
  padding: 8,
  background: "#f1f5f9",
  textAlign: "left",
};
const td = {
  border: "1px solid #e2e8f0",
  padding: 8,
  verticalAlign: "top",
  textAlign: "left",
};
const input = {
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  background: "white",
};
const select = { ...input, minWidth: 120 };

export default AccountantDashboard;
