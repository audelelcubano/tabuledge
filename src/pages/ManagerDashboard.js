// src/pages/ManagerDashboard.js
import React, { useEffect, useMemo, useState } from "react";
import {
  collection, getDocs, doc, updateDoc, addDoc,
  serverTimestamp, query, orderBy
} from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";
import SendEmailModal from "../components/SendEmailModal";
import {
  computeBalances, trialBalanceRows, incomeStatement,
  balanceSheet, retainedEarningsStatement, serializeReport
} from "../utils/financials";
import { formatMoney } from "../utils/format";
import { useNavigate } from "react-router-dom";

function ManagerDashboard() {
  const navigate = useNavigate();
  const userEmail = auth?.currentUser?.email || "manager@example.com";
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // ---- Journal approvals list ----
  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);

  // ---- Reports state ----
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState("trial"); // trial | income | balance | re
  const [reportData, setReportData] = useState(null);

  // Email modal (for reports)
  const [emailOpen, setEmailOpen] = useState(false);
  const [lastSavedId, setLastSavedId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const q = query(collection(db, "journalEntries"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Failed to load journal entries:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter journals (pending/approved/rejected; date; search by account name/amount/desc/date)
  const filteredEntries = useMemo(() => {
    let list = [...entries];
    if (statusFilter !== "All") {
      list = list.filter(e => (e.status || "pending").toLowerCase() === statusFilter.toLowerCase());
    }
    if (fromDate) list = list.filter(e => e.createdAt?.toDate?.() >= new Date(fromDate));
    if (toDate)   list = list.filter(e => e.createdAt?.toDate?.() <= new Date(toDate));
    if (searchTerm.trim()) {
      const st = searchTerm.toLowerCase();
      list = list.filter(e => {
        // legacy shape
        const dMatch = (e.debits || []).some(d =>
          (d.accountName || "").toLowerCase().includes(st) || String(d.amount).includes(st)
        );
        const cMatch = (e.credits || []).some(c =>
          (c.accountName || "").toLowerCase().includes(st) || String(c.amount).includes(st)
        );
        // new shape
        const lMatch = (e.lines || []).some(l =>
          (l.accountName || "").toLowerCase().includes(st) || String(l.amount).includes(st)
        );
        const desc = (e.description || "").toLowerCase().includes(st);
        const dateStr = (e.date || "").toLowerCase().includes(st);
        return dMatch || cMatch || lMatch || desc || dateStr;
      });
    }
    return list;
  }, [entries, statusFilter, fromDate, toDate, searchTerm]);

  // ---- Approve / Reject ----

  const handleApprove = async (entry) => {
    const { id, description } = entry;
    try {
      // Mark approved
      await updateDoc(doc(db, "journalEntries", id), {
        status: "approved",
        approvedBy: userEmail,
        approvedAt: serverTimestamp(),
      });

      // Normalize lines for posting
      let lines = [];
      if (Array.isArray(entry.lines) && entry.lines.length) {
        lines = entry.lines.map(l => ({
          accountId: l.accountId || "unknown",
          accountName: l.accountName || "unknown",
          amount: Number(l.amount || 0),
          side: (l.side || "").toLowerCase() === "credit" ? "credit" : "debit",
        }));
      } else {
        // legacy shape: debits/credits
        const ds = (entry.debits || []).map(d => ({ ...d, side: "debit" }));
        const cs = (entry.credits || []).map(c => ({ ...c, side: "credit" }));
        lines = [...ds, ...cs].map(x => ({
          accountId: x.accountId || "unknown",
          accountName: x.accountName || "unknown",
          amount: Number(x.amount || 0),
          side: x.side,
        }));
      }

      // Post each line to ledgerEntries
      const posts = lines.map(ln => addDoc(collection(db, "ledgerEntries"), {
        accountId: ln.accountId,
        accountName: ln.accountName,
        debit: ln.side === "debit" ? ln.amount : 0,
        credit: ln.side === "credit" ? ln.amount : 0,
        description: description || "—",
        journalId: id,
        // If the journal had a date (YYYY-MM-DD), store it too for statements:
        date: entry.date ? new Date(entry.date) : null,
        createdBy: userEmail,
        createdAt: serverTimestamp(),
      }));
      await Promise.all(posts);

      // Notify preparer (optional)
      await addDoc(collection(db, "notifications"), {
        recipient: entry.createdBy || entry.preparedBy || "unknown",
        message: `Your journal entry "${description || id}" was approved.`,
        type: "approval",
        createdAt: serverTimestamp(),
        sentBy: userEmail,
      });

      alert("✅ Journal entry approved and posted to ledger.");
      setEntries(prev => prev.map(e => (e.id === id ? { ...e, status: "approved" } : e)));
    } catch (err) {
      console.error("Approval failed:", err);
      alert("Error approving journal entry.");
    }
  };

  const handleReject = async (entry) => {
    const { id, description } = entry;
    const reason = prompt("Enter rejection reason (required):");
    if (!reason || !reason.trim()) return alert("Rejection reason required.");
    try {
      await updateDoc(doc(db, "journalEntries", id), {
        status: "rejected",
        rejectedBy: userEmail,
        rejectedAt: serverTimestamp(),
        rejectionReason: reason.trim(),
      });
      await addDoc(collection(db, "notifications"), {
        recipient: entry.createdBy || entry.preparedBy || "unknown",
        message: `Your journal entry "${description || id}" was rejected: ${reason}`,
        type: "rejection",
        createdAt: serverTimestamp(),
        sentBy: userEmail,
      });
      alert("❌ Journal entry rejected and notification sent.");
      setEntries(prev => prev.map(e => (e.id === id ? { ...e, status: "rejected" } : e)));
    } catch (err) {
      console.error("Rejection failed:", err);
      alert("Error rejecting journal entry.");
    }
  };

  // ---- Reports: Generate / Save / Email / Print ----

  const generateReport = async () => {
    // Pull accounts & ledgerEntries (manager sees all)
    const [accSnap, ledSnap] = await Promise.all([
      getDocs(collection(db, "accounts")),
      getDocs(collection(db, "ledgerEntries")),
    ]);
    const accounts = accSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const ledger = ledSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const accMap = computeBalances(accounts, ledger, rFrom, rTo);

    if (reportType === "trial") {
      const tb = trialBalanceRows(accMap);
      setReportData({ kind: "Trial Balance", period: { from: rFrom, to: rTo }, ...tb });
    } else if (reportType === "income") {
      const is = incomeStatement(accMap);
      setReportData({ kind: "Income Statement", period: { from: rFrom, to: rTo }, ...is });
    } else if (reportType === "balance") {
      // For demo: compute RE from same period NI (no dividends tracking here)
      const is = incomeStatement(accMap);
      const bs = balanceSheet(accMap, /*openingRE*/ 0, /*NI*/ is.netIncome);
      setReportData({ kind: "Balance Sheet", period: { from: rFrom, to: rTo }, ...bs });
    } else {
      const is = incomeStatement(accMap);
      const re = retainedEarningsStatement(/*opening*/ 0, is.netIncome, /*dividends*/ 0);
      setReportData({ kind: "Retained Earnings", period: { from: rFrom, to: rTo }, ...re });
    }
  };

  const saveReport = async () => {
    if (!reportData) return alert("Generate a report first.");
    const docRef = await addDoc(collection(db, "financialReports"), {
      createdAt: serverTimestamp(),
      createdBy: userEmail,
      type: reportData.kind,
      period: { from: rFrom || null, to: rTo || null },
      payload: serializeReport(reportData),
    });
    setLastSavedId(docRef.id);
    alert(`💾 Report saved (id: ${docRef.id}).`);
  };

  const emailReport = () => {
    if (!reportData) return alert("Generate a report first.");
    if (!lastSavedId) alert("Tip: click Save so the email includes a saved report id.");
    setEmailOpen(true);
  };

  const printReport = () => {
    if (!reportData) return alert("Generate a report first.");
    window.print();
  };

  // Render helpers
  const renderReport = () => {
    if (!reportData) return <p style={{ margin: 0, opacity: 0.8 }}>No report yet. Choose type & date range, then Generate.</p>;
    if (reportData.kind === "Trial Balance") {
      const { rows, totalD, totalC } = reportData;
      return (
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Account</th>
              <th style={{...th, textAlign:"right"}}>Debit</th>
              <th style={{...th, textAlign:"right"}}>Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>
                  <button
                    onClick={() => navigate(`/ledger/${r.account.id}`)}
                    style={{
                      background: "transparent",
                      color: "#2563eb",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0
                    }}
                    title="Open ledger for this account"
                  >
                    {r.account.name} ({r.account.number})
                  </button>
                </td>
                <td style={{...td, textAlign:"right"}}>{formatMoney(r.debit)}</td>
                <td style={{...td, textAlign:"right"}}>{formatMoney(r.credit)}</td>
              </tr>
            ))}
            <tr>
              <td style={{...td, fontWeight:700}}>Total</td>
              <td style={{...td, fontWeight:700, textAlign:"right"}}>{formatMoney(totalD)}</td>
              <td style={{...td, fontWeight:700, textAlign:"right"}}>{formatMoney(totalC)}</td>
            </tr>
          </tbody>
        </table>
      );
    }
    if (reportData.kind === "Income Statement") {
      const { revenue, expenses, netIncome } = reportData;
      return (
        <table style={tbl}>
          <tbody>
            <tr><td style={td}>Revenue</td><td style={{...td, textAlign:"right"}}>{formatMoney(revenue)}</td></tr>
            <tr><td style={td}>Expenses</td><td style={{...td, textAlign:"right"}}>{formatMoney(expenses)}</td></tr>
            <tr><td style={{...td, fontWeight:700}}>Net Income</td><td style={{...td, textAlign:"right", fontWeight:700}}>{formatMoney(netIncome)}</td></tr>
          </tbody>
        </table>
      );
    }
    if (reportData.kind === "Balance Sheet") {
      const { assets, liabilities, equityTotal, retainedEarnings } = reportData;
      return (
        <table style={tbl}>
          <tbody>
            <tr><td style={td}>Assets</td><td style={{...td, textAlign:"right"}}>{formatMoney(assets)}</td></tr>
            <tr><td style={td}>Liabilities</td><td style={{...td, textAlign:"right"}}>{formatMoney(liabilities)}</td></tr>
            <tr><td style={td}>Retained Earnings</td><td style={{...td, textAlign:"right"}}>{formatMoney(retainedEarnings)}</td></tr>
            <tr><td style={{...td, fontWeight:700}}>Equity (incl. RE)</td><td style={{...td, textAlign:"right", fontWeight:700}}>{formatMoney(equityTotal)}</td></tr>
          </tbody>
        </table>
      );
    }
    // Retained Earnings Statement
    const { opening, netIncome, dividends, ending } = reportData;
    return (
      <table style={tbl}>
        <tbody>
          <tr><td style={td}>Opening Retained Earnings</td><td style={{...td, textAlign:"right"}}>{formatMoney(opening)}</td></tr>
          <tr><td style={td}>+ Net Income</td><td style={{...td, textAlign:"right"}}>{formatMoney(netIncome)}</td></tr>
          <tr><td style={td}>− Dividends</td><td style={{...td, textAlign:"right"}}>{formatMoney(dividends)}</td></tr>
          <tr><td style={{...td, fontWeight:700}}>Ending Retained Earnings</td><td style={{...td, textAlign:"right", fontWeight:700}}>{formatMoney(ending)}</td></tr>
        </tbody>
      </table>
    );
  };

  const tableRows = useMemo(
    () =>
      filteredEntries.map((e) => {
        const debs = (e.lines || []).filter(l => l.side === "debit");
        const creds = (e.lines || []).filter(l => l.side === "credit");
        // legacy display fallback:
        const showDebs = (debs.length ? debs : e.debits || []).map((d, i) => (
          <div key={`d-${i}`}>{d.accountName}: ${Number(d.amount || 0).toFixed(2)}</div>
        ));
        const showCreds = (creds.length ? creds : e.credits || []).map((c, i) => (
          <div key={`c-${i}`}>{c.accountName}: ${Number(c.amount || 0).toFixed(2)}</div>
        ));
        return (
          <tr key={e.id}>
            <td style={td}>{e.createdAt?.toDate ? e.createdAt.toDate().toLocaleDateString() : "—"}</td>
            <td style={td}>{e.description || "—"}</td>
            <td style={td}>{showDebs}</td>
            <td style={td}>{showCreds}</td>
            <td style={td}>{e.status || "pending"}</td>
            <td style={td}>{e.createdBy || e.preparedBy || "—"}</td>
            <td style={td}>
              {e.status === "pending" && (
                <>
                  <button onClick={() => handleApprove(e)}>Approve</button>{" "}
                  <button onClick={() => handleReject(e)}>Reject</button>
                </>
              )}
            </td>
          </tr>
        );
      }),
    [filteredEntries]
  );

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <main style={{ padding: "20px" }}>
        <h2>Manager Dashboard</h2>

        {/* ===== Reports ===== */}
        <section style={card}>
          <h3 style={{ marginTop: 0 }}>Financial Statements</h3>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <label>Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)} style={input}>
              <option value="trial">Trial Balance</option>
              <option value="income">Income Statement</option>
              <option value="balance">Balance Sheet</option>
              <option value="re">Retained Earnings</option>
            </select>

            <label>From</label>
            <input type="date" value={rFrom} onChange={e => setRFrom(e.target.value)} style={input} />
            <label>To</label>
            <input type="date" value={rTo} onChange={e => setRTo(e.target.value)} style={input} />

            <button onClick={generateReport}>Generate</button>
            <button onClick={saveReport}>Save</button>
            <button onClick={emailReport}>Email</button>
            <button onClick={printReport}>Print</button>
          </div>

          {reportData && (
            <div style={{ marginTop: 12 }}>
              <h4 style={{ marginBottom: 8 }}>
                {reportData.kind} {reportData.period?.from ? `(${reportData.period.from} → ${reportData.period.to || "…"})` : `(to ${reportData.period?.to || "…"})`}
                {lastSavedId ? ` — saved id: ${lastSavedId}` : ""}
              </h4>
              {renderReport()}
            </div>
          )}
        </section>

        {/* ===== Filters Bar ===== */}
        <section style={filterBar}>
          <div>
            <label>Status: </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={input}>
              <option>All</option>
              <option>Pending</option>
              <option>Approved</option>
              <option>Rejected</option>
            </select>
          </div>
          <div>
            <label>From: </label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={input} />
          </div>
          <div>
            <label>To: </label>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={input} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <label>Search: </label>
            <input
              type="text"
              placeholder="Search account, amount, description, or date"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ ...input, width: "100%" }}
            />
          </div>
        </section>

        {/* ===== Journal Table ===== */}
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

      {/* Email modal for reports */}
      <SendEmailModal
        open={emailOpen}
        onClose={() => setEmailOpen(false)}
        sender={userEmail}
        defaultRecipient="accountant@example.com"
      />
    </div>
  );
}

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: 12,
  margin: "8px 0 16px",
  background: "#f8fafc",
};

const filterBar = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "12px",
  margin: "16px 0",
  background: "#f8fafc",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e2e8f0",
};

const tbl = { width: "100%", borderCollapse: "collapse" };
const th  = { border: "1px solid #e2e8f0", padding: 8, background: "#f1f5f9", textAlign: "left" };
const td  = { border: "1px solid #e2e8f0", padding: 8, textAlign: "left" };
const input = { padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: 4, background: "white" };

export default ManagerDashboard;
