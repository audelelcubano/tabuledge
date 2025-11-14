// src/pages/AccountDetailsPage.js
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import NavBar from "../components/NavBar";
import { formatMoney } from "../utils/format";
import { logEvent } from "../utils/logEvent";
import SendEmailModal from "../components/SendEmailModal";

function Row({ label, value, mono = false }) {
  return (
    <div style={styles.row}>
      <div style={styles.label}>{label}</div>
      <div
        style={{
          ...styles.value,
          fontFamily: mono
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AccountDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userEmail = auth?.currentUser?.email || "user@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState({});
  const [showEmailModal, setShowEmailModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "accounts", id));
      if (snap.exists()) {
        setAccount({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };
    load();
  }, [id]);

  const handleQuickUpdate = async (newData) => {
    if (!account) return;
    const before = { ...account };
    const after = { ...account, ...newData };
    await updateDoc(doc(db, "accounts", account.id), newData);
    await logEvent("account", "update", before, after);
    setAccount(after);
    setEditMode(false);
    alert("✅ Account updated successfully.");
  };

  return (
    <div>
      <NavBar
        userEmail={userEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <main style={styles.container}>
        {loading ? (
          <p>Loading…</p>
        ) : !account ? (
          <p>Account not found.</p>
        ) : (
          <>
            <div style={styles.header}>
              <h2>Account Details</h2>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => navigate(`/ledger/${id}`)}
                  title="Open ledger for this account"
                >
                  Go to Ledger
                </button>
                
                <button
                   onClick={() => navigate(`/event-log?accountId=${id}`)}
                   title="View event logs for this account"
                >
                  Event Log
                </button>
                <button
                  onClick={() => navigate("/accounts")}
                  title="Back to Chart of Accounts"
                >
                  Back
                </button>
                <button
                  onClick={() => setEditMode(!editMode)}
                  title="Edit account info"
                >
                  {editMode ? "Cancel Edit" : "Edit"}
                </button>
                <button
                  onClick={() => setShowEmailModal(true)}
                  title="Send message to manager"
                >
                  Send Message
                </button>
              </div>
            </div>

            <section style={styles.card}>
              <Row label="Name" value={account.name} />
              <Row label="Number" value={account.number} mono />
              <Row label="Description" value={account.description || "—"} />
              <Row
                label="Category"
                value={`${account.category} → ${account.subcategory}`}
              />
              <Row label="Normal Side" value={account.normalSide} />
              <Row label="Statement" value={account.statement} />
              <Row label="Order" value={account.order} mono />
              <Row label="Comment" value={account.comment || "—"} />
              <Row
                label="Status"
                value={account.active === false ? "Inactive" : "Active"}
              />
              <Row label="Created By" value={account.createdBy || "—"} />
              <Row
                label="Created At"
                value={
                  account.createdAt?.toDate
                    ? account.createdAt.toDate().toLocaleString()
                    : "—"
                }
              />

              <div style={styles.hr} />

              <div style={styles.moneyGrid}>
                <div>
                  <div style={styles.moneyLabel}>Initial Balance</div>
                  <div style={styles.moneyValue}>
                    {formatMoney(account.initialBalance || 0)}
                  </div>
                </div>
                <div>
                  <div style={styles.moneyLabel}>Debit</div>
                  <div style={styles.moneyValue}>
                    {formatMoney(account.debit || 0)}
                  </div>
                </div>
                <div>
                  <div style={styles.moneyLabel}>Credit</div>
                  <div style={styles.moneyValue}>
                    {formatMoney(account.credit || 0)}
                  </div>
                </div>
                <div>
                  <div style={styles.moneyLabel}>Balance</div>
                  <div style={{ ...styles.moneyValue, fontWeight: 700 }}>
                    {formatMoney(account.balance || 0)}
                  </div>
                </div>
              </div>

              {editMode && (
                <div
                  style={{
                    marginTop: 16,
                    borderTop: "1px solid #ccc",
                    paddingTop: 12,
                  }}
                >
                  <h4>Edit Account Info</h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      maxWidth: 320,
                    }}
                  >
                    <label>
                      Description:
                      <input
                        type="text"
                        value={
                          edited.description ?? account.description ?? ""
                        }
                        onChange={(e) =>
                          setEdited({
                            ...edited,
                            description: e.target.value,
                          })
                        }
                        style={{ width: "100%" }}
                      />
                    </label>
                    <label>
                      Initial Balance:
                      <input
                        type="number"
                        step="0.01"
                        value={
                          edited.initialBalance ??
                          account.initialBalance ??
                          0
                        }
                        onChange={(e) =>
                          setEdited({
                            ...edited,
                            initialBalance: parseFloat(e.target.value),
                          })
                        }
                      />
                    </label>
                    <button
                      onClick={() => handleQuickUpdate(edited)}
                      disabled={
                        !edited.description && !edited.initialBalance
                      }
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* ✅ Message Modal */}
      <SendEmailModal
        open={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        sender={userEmail}
        defaultRecipient="manager@example.com"
      />
    </div>
  );
}

const styles = {
  container: { padding: 20 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  card: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "180px 1fr",
    gap: 12,
    padding: "6px 0",
  },
  label: { color: "#334155", fontWeight: 600 },
  value: { color: "#0f172a" },
  hr: { height: 1, background: "#e2e8f0", margin: "12px 0" },
  moneyGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 },
  moneyLabel: {
    color: "#334155",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  moneyValue: { fontSize: 18 },
};

export default AccountDetailsPage;
