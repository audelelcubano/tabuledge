// src/pages/CreateJournal.js
import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";

function CreateJournal() {
  const userEmail = auth?.currentUser?.email || "accountant@example.com";
  const [description, setDescription] = useState("");
  const [debits, setDebits] = useState([{ accountName: "", amount: "" }]);
  const [credits, setCredits] = useState([{ accountName: "", amount: "" }]);
  const [attachments, setAttachments] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Add/Remove rows
  const addRow = (type) =>
    type === "debit"
      ? setDebits([...debits, { accountName: "", amount: "" }])
      : setCredits([...credits, { accountName: "", amount: "" }]);

  const removeRow = (type, i) =>
    type === "debit"
      ? setDebits(debits.filter((_, idx) => idx !== i))
      : setCredits(credits.filter((_, idx) => idx !== i));

  // Validate before submit
  const validate = () => {
    if (debits.length === 0 || credits.length === 0)
      return "Each journal entry must include at least one debit and one credit.";

    const totalDebit = debits.reduce((s, d) => s + Number(d.amount || 0), 0);
    const totalCredit = credits.reduce((s, c) => s + Number(c.amount || 0), 0);

    if (totalDebit !== totalCredit)
      return `Total debits (${totalDebit.toFixed(
        2
      )}) must equal total credits (${totalCredit.toFixed(2)}).`;

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const msg = validate();

    if (msg) {
      setError(msg);

      // log to Firestore errorMessages collection
      await addDoc(collection(db, "errorMessages"), {
        user: userEmail,
        message: msg,
        createdAt: serverTimestamp(),
        context: "create-journal",
      });
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, "journalEntries"), {
        description,
        debits: debits.map((d) => ({
          accountName: d.accountName,
          amount: Number(d.amount || 0),
        })),
        credits: credits.map((c) => ({
          accountName: c.accountName,
          amount: Number(c.amount || 0),
        })),
        attachments,
        preparedBy: userEmail,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setDescription("");
      setDebits([{ accountName: "", amount: "" }]);
      setCredits([{ accountName: "", amount: "" }]);
      setAttachments([]);
      setError("");
      alert("Journal entry submitted for approval.");
    } catch (err) {
      console.error(err);
      setError("Failed to save journal entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <NavBar userEmail={userEmail} />
      <main style={{ padding: 20 }}>
        <h2>Create Journal Entry</h2>
        <form onSubmit={handleSubmit} style={{ maxWidth: 800 }}>
          <label>Description:</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={input}
            required
          />

          <h3>Debits</h3>
          {debits.map((d, i) => (
            <div key={i} style={row}>
              <input
                placeholder="Account name"
                value={d.accountName}
                onChange={(e) => {
                  const arr = [...debits];
                  arr[i].accountName = e.target.value;
                  setDebits(arr);
                  setError("");
                }}
                style={input}
                required
              />
              <input
                type="number"
                placeholder="Amount"
                value={d.amount}
                onChange={(e) => {
                  const arr = [...debits];
                  arr[i].amount = e.target.value;
                  setDebits(arr);
                  setError("");
                }}
                style={input}
                required
              />
              <button type="button" onClick={() => removeRow("debit", i)}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addRow("debit")}>
            + Add Debit
          </button>

          <h3>Credits</h3>
          {credits.map((c, i) => (
            <div key={i} style={row}>
              <input
                placeholder="Account name"
                value={c.accountName}
                onChange={(e) => {
                  const arr = [...credits];
                  arr[i].accountName = e.target.value;
                  setCredits(arr);
                  setError("");
                }}
                style={input}
                required
              />
              <input
                type="number"
                placeholder="Amount"
                value={c.amount}
                onChange={(e) => {
                  const arr = [...credits];
                  arr[i].amount = e.target.value;
                  setCredits(arr);
                  setError("");
                }}
                style={input}
                required
              />
              <button type="button" onClick={() => removeRow("credit", i)}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addRow("credit")}>
            + Add Credit
          </button>

          <h3>Attachments</h3>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png"
            onChange={(e) =>
              setAttachments([...e.target.files].map((f) => f.name))
            }
          />

          {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

          <div style={{ marginTop: 20 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Submit Journal"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDescription("");
                setDebits([{ accountName: "", amount: "" }]);
                setCredits([{ accountName: "", amount: "" }]);
                setAttachments([]);
                setError("");
              }}
              style={{ marginLeft: 8 }}
            >
              Reset
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

const input = {
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  margin: "4px 8px 4px 0",
};
const row = { display: "flex", alignItems: "center", marginBottom: 8 };

export default CreateJournal;
