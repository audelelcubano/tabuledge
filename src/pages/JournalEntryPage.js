// src/pages/JournalEntryPage.js
import React, { useEffect, useMemo, useState } from "react";
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../firebase";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
];

function moneyToNumber(v) {
  if (typeof v === "number") return v;
  if (!v) return 0;
  return Number(String(v).replace(/,/g, ""));
}

function formatMoney(n) {
  const x = Number(n || 0);
  return x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function JournalEntryPage() {
  const user = auth.currentUser;
  const [accounts, setAccounts] = useState([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [debits, setDebits] = useState([{ accountId: "", amount: "" }]);
  const [credits, setCredits] = useState([{ accountId: "", amount: "" }]);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // list view state
  const [entries, setEntries] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all"); // all | pending | approved | rejected
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Load accounts for dropdowns
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "accounts"));
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  const normalizeStatus = (s) => {
    if (!s) return "pending";
    s = s.toLowerCase();
    if (["approved", "rejected", "pending"].includes(s)) return s;

    // Map old synonyms to Sprint-approved values
    if (s === "pendingapproval" || s === "submitted") return "pending";

    return "pending"; // default fallback
  };

  const normalizeDate = (entry) => {
  // 1. Prefer explicit "date" field from JournalEntryPage
    if (entry.date) return entry.date;

  // 2. Fallback: convert Firestore createdAt to yyyy-mm-dd
    if (entry.createdAt?.toDate) {
      return entry.createdAt.toDate().toISOString().slice(0, 10);
  }

  // 3. As a last fallback
  return "";
};


  // Load the current user's journal entries (and others, accountant should be able to view all entries)
  useEffect(() => {
    const loadEntries = async () => {
      
      const q = query(collection(db, "journalEntries"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setEntries(
        snap.docs.map(d => {
          const data = d.data();
           return {
             id: d.id,
              ...data,
              status: normalizeStatus(data.status), 
              filterDate: normalizeDate(data),
           };
         })
     );
  };

   loadEntries();
}, []);
    
 

  const totalDebits = useMemo(
    () => debits.reduce((s, r) => s + moneyToNumber(r.amount), 0),
    [debits]
  );
  const totalCredits = useMemo(
    () => credits.reduce((s, r) => s + moneyToNumber(r.amount), 0),
    [credits]
  );

  const onChangeDebit = (idx, key, val) => {
    const next = debits.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
    setDebits(next);
  };
  const onChangeCredit = (idx, key, val) => {
    const next = credits.map((r, i) => (i === idx ? { ...r, [key]: val } : r));
    setCredits(next);
  };

  const addDebit = () => setDebits([...debits, { accountId: "", amount: "" }]);
  const addCredit = () => setCredits([...credits, { accountId: "", amount: "" }]);
  const removeDebit = (idx) => setDebits(debits.filter((_, i) => i !== idx));
  const removeCredit = (idx) => setCredits(credits.filter((_, i) => i !== idx));

  const resetForm = () => {
    setDate(new Date().toISOString().slice(0, 10));
    setDescription("");
    setDebits([{ accountId: "", amount: "" }]);
    setCredits([{ accountId: "", amount: "" }]);
    setFiles([]);
    setError("");
  };

  const validate = () => {
    // At least one debit and one credit
    if (debits.length === 0 || credits.length === 0) {
      return "Each journal entry must have at least one debit and one credit.";
    }
    // All lines must have an account and positive amount
    for (const r of [...debits, ...credits]) {
      if (!r.accountId) return "All lines must have an account selected.";
      const amt = moneyToNumber(r.amount);
      if (!amt || amt <= 0) return "All line amounts must be greater than zero.";
    }
    // Must balance
    if (Math.abs(totalDebits - totalCredits) > 0.0001) {
      return "Total debits must equal total credits.";
    }
    // Files must be allowed types
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        return `Unsupported file type: ${f.name}`;
      }
    }
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) {
      setError(v);
      // Ensure an error “record” exists in Firestore per requirements
      // Stores the message used, who saw it, and when
      await addDoc(collection(db, "errorMessages"), {
        code: "JE_VALIDATION",
        message: v,
        user: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });
      return;
    }

    try {
      setSubmitting(true);

      // Upload attachments (if any)
      const uploads = [];
      for (const f of files) {
        const storageRef = ref(storage, `journal_attachments/${Date.now()}_${f.name}`);
        await uploadBytes(storageRef, f);
        const url = await getDownloadURL(storageRef);
        uploads.push({ name: f.name, url, contentType: f.type, size: f.size });
      }

      // Resolve account metadata for lines
      const accountLookup = Object.fromEntries(accounts.map(a => [a.id, a]));
      const debitLines = debits.map(r => ({
        accountId: r.accountId,
        accountName: accountLookup[r.accountId]?.name || "",
        amount: moneyToNumber(r.amount),
        side: "debit",
      }));
      const creditLines = credits.map(r => ({
        accountId: r.accountId,
        accountName: accountLookup[r.accountId]?.name || "",
        amount: moneyToNumber(r.amount),
        side: "credit",
      }));

      // Create journal entry (status pending)
      const docRef = await addDoc(collection(db, "journalEntries"), {
        date,
        description,
        lines: [...debitLines, ...creditLines],
        totalDebits: Number(totalDebits.toFixed(2)),
        totalCredits: Number(totalCredits.toFixed(2)),
        status: "pending",
        attachments: uploads,
        createdBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      // Manager notification stub (can be expanded later)
      await addDoc(collection(db, "notifications"), {
        type: "journal_submitted",
        journalId: docRef.id,
        forRole: "manager",
        createdBy: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });

      resetForm();
      alert("Journal entry submitted for approval.");
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred while submitting the journal entry.");
      await addDoc(collection(db, "errorMessages"), {
        code: "JE_SUBMIT",
        message: String(err?.message || err),
        user: user?.email || "unknown",
        createdAt: serverTimestamp(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Simple client-side filters for list
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (fromDate && e.filterDate < fromDate) return false;
      if (toDate && e.filterDate > toDate) return false;

      if (searchTerm) {
        const st = searchTerm.toLowerCase();

        const inAccounts =
          Array.isArray(e.lines) &&
          e.lines.some(
            ln =>
              (ln.accountName || "").toLowerCase().includes(st) ||
            (ln.accountNumber || "").toLowerCase?.().includes(st) || 
              String(ln.amount).includes(st)
          );
        const inDesc = (e.description || "").toLowerCase().includes(st);
        const inDate =  (e.date || "").includes(st) ||(e.filterDate || "").includes(st);   
        return inAccounts || inDesc || inDate;

      }
      return true;
    });
  }, [entries, statusFilter, fromDate, toDate, searchTerm]);

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h2>Journal Entries</h2>

      {/* Entry form */}
      <form onSubmit={handleSubmit} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
          <div>
            <label>Date</label><br />
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div style={{ flex: 1 }}>
            <label>Description</label><br />
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Debits */}
          <div>
            <h4>Debits</h4>
            {debits.map((row, idx) => (
              <div key={`d-${idx}`} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select
                  value={row.accountId}
                  onChange={e => onChangeDebit(idx, "accountId", e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.number})</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={e => onChangeDebit(idx, "amount", e.target.value)}
                  placeholder="Amount"
                  required
                  style={{ width: 140, textAlign: "right" }}
                />
                {debits.length > 1 && (
                  <button type="button" onClick={() => removeDebit(idx)}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addDebit}>Add debit line</button>
          </div>

          {/* Credits */}
          <div>
            <h4>Credits</h4>
            {credits.map((row, idx) => (
              <div key={`c-${idx}`} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <select
                  value={row.accountId}
                  onChange={e => onChangeCredit(idx, "accountId", e.target.value)}
                  required
                >
                  <option value="">Select account</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.number})</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={e => onChangeCredit(idx, "amount", e.target.value)}
                  placeholder="Amount"
                  required
                  style={{ width: 140, textAlign: "right" }}
                />
                {credits.length > 1 && (
                  <button type="button" onClick={() => removeCredit(idx)}>Remove</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addCredit}>Add credit line</button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <strong>Total Debits:</strong> {formatMoney(totalDebits)} &nbsp; | &nbsp;
            <strong>Total Credits:</strong> {formatMoney(totalCredits)}
          </div>
          <div>
            <input
              type="file"
              multiple
              onChange={e => setFiles(Array.from(e.target.files || []))}
              accept={ALLOWED_TYPES.join(",")}
            />
          </div>
        </div>

        {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <button type="submit" disabled={submitting}>Submit for approval</button>
          <button type="button" onClick={resetForm}>Reset</button>
        </div>
      </form>

      {/* Journal Entries list (accountant view) */}
      <div style={{ border: "1px solid #ddd", padding: 16 }}>
        <h3>All Journal Entries</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <div>
            <label style={{ marginRight: 4 }}>From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label style={{ marginRight: 4 }}>To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <input
            type="text"
            placeholder="Search by account name, amount, or description"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ flex: 1, minWidth: 260 }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table border="1" cellPadding="8" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th>Debits</th>
                <th>Credits</th>
                <th>Attachments</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((je) => {
                const debs = (je.lines || []).filter(l => l.side === "debit");
                const creds = (je.lines || []).filter(l => l.side === "credit");
                return (
                  <tr key={je.id}>
                    <td>{je.date}</td>
                    <td>{je.description || ""}</td>
                    <td>{je.status}</td>
                    <td>
                      {debs.map((l, i) => (
                        <div key={i}>{l.accountName}: {formatMoney(l.amount)}</div>
                      ))}
                      <div><strong>Total:</strong> {formatMoney(je.totalDebits)}</div>
                    </td>
                    <td>
                      {creds.map((l, i) => (
                        <div key={i}>{l.accountName}: {formatMoney(l.amount)}</div>
                      ))}
                      <div><strong>Total:</strong> {formatMoney(je.totalCredits)}</div>
                    </td>
                    <td>
                      {(je.attachments || []).map((a, i) => (
                        <div key={i}>
                          <a href={a.url} target="_blank" rel="noreferrer">{a.name}</a>
                        </div>
                      ))}
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr><td colSpan={6}>No journal entries found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  }
