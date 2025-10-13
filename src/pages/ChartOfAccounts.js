// src/pages/ChartOfAccounts.js
// NOTE: This is the same RBAC-ready file you have, with an extra "View" button.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import NavBar from "../components/NavBar";
import HelpModal from "../components/HelpModal";
import { formatMoney, parseMoney } from "../utils/format";
import { isDigitsOnly, hasCorrectPrefix } from "../utils/validation";
import useUserRole from "../hooks/useUserRole";

function ChartOfAccounts() {
  const navigate = useNavigate();
  const { role, loading: roleLoading, userEmail } = useUserRole();
  const canManage = role === "admin";
  const fallbackEmail = auth?.currentUser?.email || "admin@example.com";

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [helpOpen, setHelpOpen] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const [filters, setFilters] = useState({
    name: "",
    number: "",
    category: "",
    subcategory: "",
    minAmount: "",
    maxAmount: "",
    activeOnly: true,
  });

  const emptyForm = {
    name: "",
    number: "",
    description: "",
    normalSide: "Debit",
    category: "Asset",
    subcategory: "Current Assets",
    initialBalance: "0.00",
    debit: "0.00",
    credit: "0.00",
    balance: "0.00",
    statement: "BS",
    order: "01",
    comment: "",
  };
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "accounts"));
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    return accounts
      .filter((a) => {
        if (filters.activeOnly && a.active === false) return false;
        if (filters.name && !a.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
        if (filters.number && !String(a.number).startsWith(filters.number)) return false;
        if (filters.category && a.category !== filters.category) return false;
        if (filters.subcategory && !String(a.subcategory).toLowerCase().includes(filters.subcategory.toLowerCase())) return false;
        const amt = Number(a.balance || 0);
        if (filters.minAmount && amt < parseMoney(filters.minAmount)) return false;
        if (filters.maxAmount && amt > parseMoney(filters.maxAmount)) return false;
        return true;
      })
      .sort((x, y) => String(x.order).localeCompare(String(y.order)));
  }, [accounts, filters]);

  const ensureUnique = async (name, number, excludeId = null) => {
    const nameQ = query(collection(db, "accounts"), where("name", "==", name));
    const nameSnap = await getDocs(nameQ);
    const nameClash = nameSnap.docs.some((d) => d.id !== excludeId);

    const numQ = query(collection(db, "accounts"), where("number", "==", String(number)));
    const numSnap = await getDocs(numQ);
    const numClash = numSnap.docs.some((d) => d.id !== excludeId);

    if (nameClash) throw new Error("Duplicate account name not allowed");
    if (numClash) throw new Error("Duplicate account number not allowed");
  };

  const validateForm = () => {
    if (!form.name.trim()) throw new Error("Account name is required");
    if (!isDigitsOnly(String(form.number))) throw new Error("Account number must be digits only");
    if (!hasCorrectPrefix(form.category, String(form.number)))
      throw new Error(`Account number must start with correct prefix for ${form.category}`);
  };

  const toPersist = (raw) => {
    const initBal = parseMoney(raw.initialBalance);
    const debit = parseMoney(raw.debit);
    const credit = parseMoney(raw.credit);
    const balance = parseMoney(raw.balance !== undefined ? raw.balance : initBal + debit - credit);

    return {
      name: raw.name.trim(),
      number: String(raw.number),
      description: raw.description.trim(),
      normalSide: raw.normalSide,
      category: raw.category,
      subcategory: raw.subcategory,
      initialBalance: initBal,
      debit,
      credit,
      balance,
      statement: raw.statement,
      order: String(raw.order).padStart(2, "0"),
      comment: raw.comment || "",
      createdAt: serverTimestamp(),
      createdBy: userEmail || fallbackEmail,
      active: true,
    };
  };

  const logEvent = async ({ action, before, after, entityId }) => {
    await addDoc(collection(db, "eventLogs"), {
      entity: "account",
      entityId,
      action,
      before: before || null,
      after: after || null,
      user: userEmail || fallbackEmail,
      at: serverTimestamp(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return alert("View-only: your role cannot add accounts.");
    try {
      validateForm();
      await ensureUnique(form.name, form.number);
      const data = toPersist(form);
      const ref = await addDoc(collection(db, "accounts"), data);
      await logEvent({ action: "create", before: null, after: data, entityId: ref.id });
      setAccounts([{ id: ref.id, ...data }, ...accounts]);
      setForm(emptyForm);
      alert("✅ Account added");
    } catch (err) {
      alert(err.message);
    }
  };

  const startEdit = (acc) => {
    if (!canManage) return alert("View-only: your role cannot edit accounts.");
    setEditingId(acc.id);
    setForm({
      ...acc,
      initialBalance: (acc.initialBalance ?? 0).toFixed(2),
      debit: (acc.debit ?? 0).toFixed(2),
      credit: (acc.credit ?? 0).toFixed(2),
      balance: (acc.balance ?? 0).toFixed(2),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveEdit = async () => {
    if (!canManage) return alert("View-only: your role cannot edit accounts.");
    try {
      validateForm();
      await ensureUnique(form.name, form.number, editingId);

      const before = accounts.find((a) => a.id === editingId);
      const updated = { ...before, ...toPersist(form) };
      delete updated.createdAt;

      await updateDoc(doc(db, "accounts", editingId), updated);
      await logEvent({ action: "update", before, after: updated, entityId: editingId });

      setAccounts(accounts.map((a) => (a.id === editingId ? updated : a)));
      setEditingId(null);
      setForm(emptyForm);
      alert("✅ Account updated");
    } catch (err) {
      alert(err.message);
    }
  };

  const deactivate = async (acc) => {
    if (!canManage) return alert("View-only: your role cannot deactivate accounts.");
    if ((acc.balance || 0) > 0) {
      alert("Accounts with balance greater than zero cannot be deactivated");
      return;
    }
    const before = { ...acc };
    const after = { ...acc, active: false };
    await updateDoc(doc(db, "accounts", acc.id), { active: false });
    await logEvent({ action: "deactivate", before, after, entityId: acc.id });
    setAccounts(accounts.map((a) => (a.id === acc.id ? { ...a, active: false } : a)));
  };

  const goLedger = (acc) => navigate(`/ledger/${acc.id}`);
  const goDetails = (acc) => navigate(`/accounts/${acc.id}`);

  if (roleLoading) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }

  return (
    <div>
      <NavBar userEmail={userEmail || fallbackEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />

      <main style={styles.container}>
        <h2 style={styles.h2}>Chart of Accounts</h2>

        {!canManage && (
          <div style={styles.banner} title="You can view and search accounts only">
            View-only mode: your role (<strong>{role || "unknown"}</strong>) cannot add, edit, or deactivate accounts.
          </div>
        )}

        <div style={styles.actions}>
          <button onClick={() => setHelpOpen(true)} title="Open help for this page">Help</button>
        </div>

        {/* Add / Edit form (admins only) */}
        {canManage && (
          <form onSubmit={editingId ? (e) => { e.preventDefault(); saveEdit(); } : handleSubmit} style={styles.form}>
            {/* … form fields unchanged … */}
            <div style={{ display: "flex", gap: 8 }}>
              {!editingId ? (
                <button type="submit" title="Add account">Add Account</button>
              ) : (
                <>
                  <button onClick={saveEdit} title="Save changes">Save Changes</button>
                  <button type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }} title="Cancel editing">Cancel</button>
                </>
              )}
            </div>
          </form>
        )}

        {/* Filters */}
        <section style={styles.filters}>
          {/* … filters unchanged … */}
        </section>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Name</th>
                <th>Number</th>
                <th>Category</th>
                <th>Subcategory</th>
                <th>Normal</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="9">No accounts match your filters.</td></tr>
              ) : (
                filtered.map((acc) => (
                  <tr key={acc.id} style={{ opacity: acc.active === false ? 0.5 : 1 }}>
                    <td>{acc.order}</td>
                    <td>
                      <button onClick={() => goLedger(acc)} style={styles.linkBtn} title="Open ledger for this account">
                        {acc.name}
                      </button>
                    </td>
                    <td>{acc.number}</td>
                    <td>{acc.category}</td>
                    <td>{acc.subcategory}</td>
                    <td>{acc.normalSide}</td>
                    <td style={{ textAlign: "right" }}>{formatMoney(acc.balance)}</td>
                    <td>{acc.active === false ? "Inactive" : "Active"}</td>
                    <td>
                      {/* NEW: View Details */}
                      <button onClick={() => goDetails(acc)} title="View account details">View</button>{" "}
                      {canManage ? (
                        <>
                          <button onClick={() => startEdit(acc)} title="Edit account">Edit</button>{" "}
                          <button onClick={() => deactivate(acc)} title="Deactivate account">Deactivate</button>
                        </>
                      ) : (
                        <>
                          <button disabled title="Admins only">Edit</button>{" "}
                          <button disabled title="Admins only">Deactivate</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

const styles = {
  container: { padding: 20 },
  h2: { margin: "12px 0" },
  banner: {
    margin: "8px 0 12px",
    padding: "10px 12px",
    background: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: 8,
    color: "#7c2d12",
  },
  actions: { display: "flex", justifyContent: "flex-end" },
  form: { display: "grid", gap: 12, background: "#f8fafc", padding: 16, borderRadius: 12, border: "1px solid #e2e8f0" },
  row: { display: "grid", gridTemplateColumns: "120px 1fr 120px 1fr 120px 1fr", gap: 10 },
  filters: { display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" },
  table: { width: "100%", borderCollapse: "collapse" },
  linkBtn: { background: "transparent", color: "#2563eb", border: "none", cursor: "pointer", textDecoration: "underline" },
};

export default ChartOfAccounts;
