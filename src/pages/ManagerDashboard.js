// src/pages/ManagerDashboard.js
import React, { useEffect, useState, useMemo } from "react";
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp,} from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";

function ManagerDashboard() {
  const userEmail = auth?.currentUser?.email || "manager@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);

  // Load journal entries
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

  // Filtering logic
  useEffect(() => {
    let filtered = [...entries];

    if (statusFilter !== "All") {
      filtered = filtered.filter(
        (e) => (e.status || "").toLowerCase() === statusFilter.toLowerCase()
      );
    }

    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((e) => e.createdAt?.toDate?.() >= from);
    }

    if (toDate) {
      const to = new Date(toDate);
      filtered = filtered.filter((e) => e.createdAt?.toDate?.() <= to);
    }

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

  // Approve journal entry and post to ledger
  const handleApprove = async (entry) => {
    const { id, debits = [], credits = [], description, preparedBy } = entry;
    try {
      // 1️⃣ Update journal status
      await updateDoc(doc(db, "journalEntries", id), {
        status: "approved",
        approvedBy: userEmail,
        approvedAt: serverTimestamp(),
      });

      // 2️⃣ Post each line to ledgerEntries
      const lines = [...debits, ...credits];
      const posts = lines.map((line) =>
        addDoc(collection(db, "ledgerEntries"), {
          accountId: line.accountId || "unknown",
          accountName: line.accountName || "unknown",
          debit: debits.includes(line) ? line.amount : 0,
          credit: credits.includes(line) ? line.amount : 0,
          description: description || "—",
          journalId: id,
          createdBy: userEmail,
          createdAt: serverTimestamp(),
        })
      );
      await Promise.all(posts);

      // 3️⃣ Notify accountant
      await addDoc(collection(db, "notifications"), {
        recipient: preparedBy,
        message: `Your journal entry "${description}" was approved.`,
        sentBy: userEmail,
        type: "approval",
        createdAt: serverTimestamp(),
      });

      alert("✅ Journal entry approved and posted to ledger.");
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "approved" } : e))
      );
    } catch (err) {
      console.error("Approval failed:", err);
      alert("Error approving journal entry.");
    }
  };

  // Reject journal entry
  const handleReject = async (entry) => {
    const { id, description, preparedBy } = entry;
    const reason = prompt("Enter rejection reason:");
    if (!reason) return alert("Rejection reason required.");

    try {
      await updateDoc(doc(db, "journalEntries", id), {
        status: "rejected",
        rejectedBy: userEmail,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason,
      });

      await addDoc(collection(db, "notifications"), {
        recipient: preparedBy,
        message: `Your journal entry "${description}" was rejected: ${reason}`,
        sentBy: userEmail,
        type: "rejection",
        createdAt: serverTimestamp(),
      });

      alert("❌ Journal entry rejected and notification sent.");
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: "rejected" } : e))
      );
    } catch (err) {
      console.error("Rejection failed:", err);
      alert("Error rejecting journal entry.");
    }
  };

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
          <td style={td}>
            {e.status === "pending" && (
              <>
                <button onClick={() => handleApprove(e)}>Approve</button>{" "}
                <button onClick={() => handleReject(e)}>Reject</button>
              </>
            )}
          </td>
        </tr>
      )),
    [filteredEntries]
  );

  return (
    <div>
      <NavBar
        userEmail={userEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <main style={{ padding: "20px" }}>
        <h2>Manager Dashboard</h2>

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
                  <th style={th}>Actions</th>
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

export default ManagerDashboard;
