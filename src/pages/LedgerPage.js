// src/pages/LedgerPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import NavBar from "../components/NavBar";
import { formatMoney } from "../utils/format";

function computeNextBalance(normalSide, previous, debit, credit) {
  const d = Number(debit || 0);
  const c = Number(credit || 0);
  // Debit-normal (Assets, Expenses): balance += debit - credit
  // Credit-normal (Liabilities, Equity, Revenue): balance += credit - debit
  const debitNormal = ["Asset", "Expense"];
  if (debitNormal.includes(normalSide)) {
    return previous + d - c;
  } else {
    return previous + c - d;
  }
}

function LedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userEmail = auth?.currentUser?.email || "user@example.com";
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [account, setAccount] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Load account header
      const accSnap = await getDoc(doc(db, "accounts", id));
      if (accSnap.exists()) setAccount({ id: accSnap.id, ...accSnap.data() });

      // Load ledger entries
      const q = query(
        collection(db, "ledgerEntries"),
        where("accountId", "==", id),
        orderBy("date", "asc"),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEntries(rows);
      setLoading(false);
    };
    load();
  }, [id]);

  const computed = useMemo(() => {
    if (!account) return [];
    let run = Number(account.initialBalance || 0);
    const normalSide = account.category; // category determines normal side (Asset/Expense = debit-normal)
    return entries.map(e => {
      run = computeNextBalance(normalSide, run, e.debit, e.credit);
      return {
        ...e,
        runningBalance: run
      };
    });
  }, [entries, account]);

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <main style={{ padding: 20 }}>
        {loading ? (
          <p>Loading…</p>
        ) : !account ? (
          <p>Account not found.</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>
                Ledger — {account.name} <span style={{ color: "#64748b" }}>({account.number})</span>
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => navigate(`/accounts/${id}`)} title="View account details">Account Details</button>
                <button onClick={() => navigate("/accounts")} title="Back to Chart of Accounts">Back</button>
              </div>
            </div>

            <div style={{ margin: "8px 0 16px", color: "#334155" }}>
              <div><strong>Category:</strong> {account.category} → {account.subcategory}</div>
              <div><strong>Normal Side:</strong> {account.normalSide}</div>
              <div><strong>Initial Balance:</strong> {formatMoney(account.initialBalance || 0)}</div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Description</th>
                    <th style={th}>Debit</th>
                    <th style={th}>Credit</th>
                    <th style={th}>Running Balance</th>
                    <th style={th}>Entered By</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.length === 0 ? (
                    <tr><td colSpan="6">No entries yet.</td></tr>
                  ) : (
                    computed.map(e => (
                      <tr key={e.id}>
                        <td style={td}>{e.date?.toDate ? e.date.toDate().toLocaleDateString() : "—"}</td>
                        <td style={td}>{e.description || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{formatMoney(e.debit || 0)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{formatMoney(e.credit || 0)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>{formatMoney(e.runningBalance || 0)}</td>
                        <td style={td}>{e.createdBy || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

const th = { border: "1px solid #e2e8f0", padding: 8, background: "#f1f5f9", textAlign: "left" };
const td = { border: "1px solid #e2e8f0", padding: 8 };

export default LedgerPage;
