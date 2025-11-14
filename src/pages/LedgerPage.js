// src/pages/LedgerPage.js
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import NavBar from "../components/NavBar";
import { formatMoney } from "../utils/format";

/**
 * Decide if the account is debit-normal.
 * Works with either:
 *   - account.normalSide = "Debit" | "Credit", or
 *   - account.category   = "Asset" | "Expense" | "Liability" | "Equity" | "Revenue"
 */
function isDebitNormalAccount(account) {
  const side = (account?.normalSide || "").toLowerCase(); // "debit" | "credit"
  if (side === "debit" || side === "credit") return side === "debit";

  const cat = account?.category; // "Asset" | "Liability" | "Equity" | "Revenue" | "Expense"
  return cat === "Asset" || cat === "Expense";
}

/**
 * Compute next running balance given the prior balance and line amounts.
 * For debit-normal accounts => balance += debit - credit
 * For credit-normal accounts => balance += credit - debit
 */
function computeNextBalance(isDebitNormal, previous, debit, credit) {
  const d = Number(debit || 0);
  const c = Number(credit || 0);
  return isDebitNormal ? previous + d - c : previous + c - d;
}

function LedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userEmail = auth?.currentUser?.email || "user@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [account, setAccount] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");


  useEffect(() => {
    const load = async () => {
      try {
        // Load account
        const accSnap = await getDoc(doc(db, "accounts", id));
        if (accSnap.exists()) setAccount({ id: accSnap.id, ...accSnap.data() });

        // Query entries filtered by accountId (no index required), then sort in JS
        const q = query(collection(db, "ledgerEntries"), where("accountId", "==", id));
        const snap = await getDocs(q);
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => {
          const ad = a.date?.toDate ? a.date.toDate().getTime() : 0;
          const bd = b.date?.toDate ? b.date.toDate().getTime() : 0;
          if (ad !== bd) return ad - bd;
          const ac = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
          const bc = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
          return ac - bc;
        });
        setEntries(rows);
      } catch (e) {
        console.error(e);
        setErrorMsg("Failed to load ledger entries.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

 const computed = useMemo(() => {
  if (!account) return [];

  // Step 1: apply filters before computing running balances
  let list = [...entries];

  // Date filtering
  if (fromDate) {
    const from = new Date(fromDate);
    list = list.filter(
      (e) => (e.date?.toDate ? e.date.toDate() : new Date(0)) >= from
    );
  }

  if (toDate) {
    const to = new Date(toDate);
    list = list.filter(
      (e) => (e.date?.toDate ? e.date.toDate() : new Date(0)) <= to
    );
  }

  // Search filtering
  if (searchTerm.trim()) {
    const st = searchTerm.toLowerCase();

    list = list.filter((e) => {
      const descMatch = (e.description || "").toLowerCase().includes(st);
      const byMatch = (e.createdBy || "").toLowerCase().includes(st);
      const prMatch = (e.journalId || "").toLowerCase().includes(st);

      const amtMatch =
        String(e.debit || "").includes(st) ||
        String(e.credit || "").includes(st);

      return descMatch || byMatch || prMatch || amtMatch;
    });
  }

  // Step 2: recompute running balances based on filtered list
  const debitNormal = isDebitNormalAccount(account);
  let run = Number(account.initialBalance || 0);

  return list.map((e) => {
    run = computeNextBalance(debitNormal, run, e.debit, e.credit);
    return { ...e, runningBalance: run };
  });
}, [entries, fromDate, toDate, searchTerm, account]);

  return (
    <div>
      <NavBar
        userEmail={userEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <main style={{ padding: 20 }}>
        {loading ? (
          <p>Loading…</p>
        ) : errorMsg ? (
          <p style={{ color: "crimson" }}>{errorMsg}</p>
        ) : !account ? (
          <p>Account not found.</p>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2>
                Ledger — {account.name}{" "}
                <span style={{ color: "#64748b" }}>({account.number})</span>
              </h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => navigate(`/accounts/${id}`)} title="View account details">
                  Account Details
                </button>
                <button
                 onClick={() => navigate(`/event-log?accountId=${id}`)}
                 title="View event logs for this account"
               >
                 Event Log
              </button>

                <button onClick={() => navigate("/accounts")} title="Back to Chart of Accounts">
                  Back
                </button>
              </div>
            </div>

            <div style={{ margin: "8px 0 16px", color: "#334155" }}>
              <div>
                <strong>Category:</strong> {account.category} → {account.subcategory}
              </div>
              <div>
                <strong>Normal Side:</strong> {account.normalSide}
              </div>
              <div>
                <strong>Initial Balance:</strong>{" "}
                {formatMoney(account.initialBalance || 0)}
              </div>
            </div>

            {/* === Ledger Filters === */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
                background: "#f8fafc",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                marginBottom: 16,
              }}
            >
              <div>
              <label>From: </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ padding: 6, border: "1px solid #cbd5e1", borderRadius: 4 }}
              />
            </div>

            <div>
              <label>To: </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ padding: 6, border: "1px solid #cbd5e1", borderRadius: 4 }}
              />
            </div>

              <div style={{ flexGrow: 1 }}>
              <input
                type="text"
                placeholder="Search description, amount, journal ID, enteredBy"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: "100%", padding: 6, border: "1px solid #cbd5e1", borderRadius: 4 }}
              />
            </div>
          </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>

                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Description</th>
                    <th style={{ ...th, textAlign: "right" }}>Debit</th>
                    <th style={{ ...th, textAlign: "right" }}>Credit</th>
                    <th style={{ ...th, textAlign: "right" }}>Running Balance</th>
                    <th style={th}>Post Ref (PR)</th>
                    <th style={th}>Entered By</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.length === 0 ? (
                    <tr>
                      <td colSpan="7">No entries yet.</td>
                    </tr>
                  ) : (
                    computed.map((e) => (
                      <tr key={e.id}>
                        <td style={td}>
                          {e.date?.toDate ? e.date.toDate().toLocaleDateString() : "—"}
                        </td>
                        <td style={td}>{e.description || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {formatMoney(e.debit || 0)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {formatMoney(e.credit || 0)}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>
                          {formatMoney(e.runningBalance || 0)}
                        </td>
                        <td style={td}>
                          {e.journalId ? (
                            <button
                              onClick={() => navigate(`/journal/${e.journalId}`)}
                              title="Open journal entry"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#2563eb",
                                cursor: "pointer",
                                textDecoration: "underline",
                              }}
                            >
                              {e.journalId.slice(0, 6)}…
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
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

const th = {
  border: "1px solid #e2e8f0",
  padding: 8,
  background: "#f1f5f9",
  textAlign: "left",
};
const td = { border: "1px solid #e2e8f0", padding: 8, textAlign: "left" };

export default LedgerPage;
