// src/pages/ChartOfAccounts.js
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
  const canManage = role === "admin"; // ⬅️ RBAC: only admins can add/edit/deactivate
  const fallbackEmail = auth?.currentUser?.email || "admin@example.com";

  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [helpOpen, setHelpOpen] = useState(false);

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // filters
  const [filters, setFilters] = useState({
    name: "",
    number: "",
    category: "",
    subcategory: "",
    minAmount: "",
    maxAmount: "",
    activeOnly: true,
  });

  // form state for add/edit (hidden for non-admin)
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
        if (
          filters.subcategory &&
          !String(a.subcategory).toLowerCase().includes(filters.subcategory.toLowerCase())
        )
          return false;
        const amt = Number(a.balance || 0);
        if (filters.minAmount && amt < parseMoney(filters.minAmount)) return false;
        if (filters.maxAmount && amt > parseMoney(filters.maxAmount)) return false;
        return true;
      })
      .sort((x, y) => String(x.order).localeCompare(String(y.order)));
  }, [accounts, filters]);

  // --- helpers ---
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
    const balance = parseMoney(
      raw.balance !== undefined ? raw.balance : initBal + debit - credit
    );

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
      action, // create | update | deactivate
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
      initialBalance: formatMoney(acc.initialBalance),
      debit: formatMoney(acc.debit),
      credit: formatMoney(acc.credit),
      balance: formatMoney(acc.balance),
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

  // Show page only after we know the role (prevents flicker)
  if (roleLoading) {
    return <div style={{ padding: 20 }}>Loading…</div>;
  }

  return (
    <div>
      <NavBar
        userEmail={userEmail || fallbackEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />

      <main style={styles.container}>
        <h2 style={styles.h2}>Chart of Accounts</h2>

        {/* Role banner */}
        {!canManage && (
          <div style={styles.banner} title="You can view and search accounts only">
            View-only mode: your role (<strong>{role || "unknown"}</strong>) cannot add, edit, or deactivate accounts.
          </div>
        )}

        <div style={styles.actions}>
          <button onClick={() => setHelpOpen(true)} title="Open help for this page">
            Help
          </button>
        </div>

        {/* Add / Edit form (admins only) */}
        {canManage && (
          <form
            onSubmit={
              editingId ? (e) => { e.preventDefault(); saveEdit(); } : handleSubmit
            }
            style={styles.form}
          >
            <div style={styles.row}>
              <label title="Account name">Name*</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <label title="Digits only; must match category prefix">Number*</label>
              <input
                value={form.number}
                onChange={(e) =>
                  setForm({ ...form, number: e.target.value.replace(/[^\d]/g, "") })
                }
                required
              />

              <label title="Display order, keeps leading zeros">Order</label>
              <input
                value={form.order}
                onChange={(e) =>
                  setForm({ ...form, order: e.target.value.replace(/[^\d]/g, "") })
                }
              />
            </div>

            <div style={styles.row}>
              <label>Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div style={styles.row}>
              <label>Normal Side</label>
              <select
                value={form.normalSide}
                onChange={(e) => setForm({ ...form, normalSide: e.target.value })}
              >
                <option>Debit</option>
                <option>Credit</option>
              </select>

              <label>Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Asset</option>
                <option>Liability</option>
                <option>Equity</option>
                <option>Revenue</option>
                <option>Expense</option>
              </select>

              <label>Subcategory</label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}
              />
            </div>

            <div style={styles.row}>
              <label title="Two decimals, commas OK">Initial Balance</label>
              <input
                value={form.initialBalance}
                onChange={(e) =>
                  setForm({
                    ...form,
                    initialBalance: e.target.value.replace(/[^\d.,-]/g, ""),
                  })
                }
              />

              <label>Debit</label>
              <input
                value={form.debit}
                onChange={(e) =>
                  setForm({ ...form, debit: e.target.value.replace(/[^\d.,-]/g, "") })
                }
              />

              <label>Credit</label>
              <input
                value={form.credit}
                onChange={(e) =>
                  setForm({ ...form, credit: e.target.value.replace(/[^\d.,-]/g, "") })
                }
              />

              <label>Balance</label>
              <input
                value={form.balance}
                onChange={(e) =>
                  setForm({ ...form, balance: e.target.value.replace(/[^\d.,-]/g, "") })
                }
              />
            </div>

            <div style={styles.row}>
              <label>Statement</label>
              <select
                value={form.statement}
                onChange={(e) => setForm({ ...form, statement: e.target.value })}
              >
                <option value="BS">BS</option>
                <option value="IS">IS</option>
                <option value="RE">RE</option>
              </select>

              <label>Comment</label>
              <input
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
              />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              {!editingId ? (
                <button type="submit" title="Add account">Add Account</button>
              ) : (
                <>
                  <button onClick={saveEdit} title="Save changes">Save Changes</button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm);
                    }}
                    title="Cancel editing"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </form>
        )}

        {/* Filters (all roles can use) */}
        <section style={styles.filters}>
          <input
            placeholder="Filter by name"
            value={filters.name}
            onChange={(e) => setFilters({ ...filters, name: e.target.value })}
            title="Filter by account name"
          />
          <input
            placeholder="Filter by number"
            value={filters.number}
            onChange={(e) =>
              setFilters({
                ...filters,
                number: e.target.value.replace(/[^\d]/g, ""),
              })
            }
            title="Filter by account number"
          />
          <select
            value={filters.category}
            onChange={(e) =>
              setFilters({ ...filters, category: e.target.value })
            }
            title="Filter by category"
          >
            <option value="">All Categories</option>
            <option>Asset</option>
            <option>Liability</option>
            <option>Equity</option>
            <option>Revenue</option>
            <option>Expense</option>
          </select>
          <input
            placeholder="Filter by subcategory"
            value={filters.subcategory}
            onChange={(e) =>
              setFilters({ ...filters, subcategory: e.target.value })
            }
            title="Filter by subcategory"
          />
          <input
            placeholder="Min balance"
            value={filters.minAmount}
            onChange={(e) =>
              setFilters({
                ...filters,
                minAmount: e.target.value.replace(/[^\d.,-]/g, ""),
              })
            }
            title="Filter by minimum balance"
          />
          <input
            placeholder="Max balance"
            value={filters.maxAmount}
            onChange={(e) =>
              setFilters({
                ...filters,
                maxAmount: e.target.value.replace(/[^\d.,-]/g, ""),
              })
            }
            title="Filter by maximum balance"
          />
          <label
            style={{ display: "flex", alignItems: "center", gap: 6 }}
            title="Show only active accounts"
          >
            <input
              type="checkbox"
              checked={filters.activeOnly}
              onChange={(e) =>
                setFilters({ ...filters, activeOnly: e.target.checked })
              }
            />
            Active only
          </label>
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
                <tr>
                  <td colSpan="9">Loading…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9">No accounts match your filters.</td>
                </tr>
              ) : (
                filtered.map((acc) => (
                  <tr
                    key={acc.id}
                    style={{ opacity: acc.active === false ? 0.5 : 1 }}
                  >
                    <td>{acc.order}</td>
                    <td>
                      <button
                        onClick={() => goLedger(acc)}
                        style={styles.linkBtn}
                        title="Open ledger for this account"
                      >
                        {acc.name}
                      </button>
                    </td>
                    <td>{acc.number}</td>
                    <td>{acc.category}</td>
                    <td>{acc.subcategory}</td>
                    <td>{acc.normalSide}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatMoney(acc.balance)}
                    </td>
                    <td>{acc.active === false ? "Inactive" : "Active"}</td>
                    <td>
                      {/* For non-admins, show disabled buttons with tooltips */}
                      {canManage ? (
                        <>
                          <button
                            onClick={() => startEdit(acc)}
                            title="Edit account"
                          >
                            Edit
                          </button>{" "}
                          <button
                            onClick={() => deactivate(acc)}
                            title="Deactivate account"
                          >
                            Deactivate
                          </button>
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
  form: {
    display: "grid",
    gap: 12,
    background: "#f8fafc",
    padding: 16,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "120px 1fr 120px 1fr 120px 1fr",
    gap: 10,
  },
  filters: { display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" },
  table: { width: "100%", borderCollapse: "collapse" },
  linkBtn: {
    background: "transparent",
    color: "#2563eb",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  },
};

export default ChartOfAccounts;
