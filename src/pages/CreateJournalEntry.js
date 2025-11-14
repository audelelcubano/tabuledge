// src/pages/CreateJournalEntry.js
import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  getDocs
} from "firebase/firestore";
import { db, auth } from "../firebase";
import NavBar from "../components/NavBar";
import { uploadAttachment } from "../utils/uploadAttachment";

function CreateJournal() {
  const userEmail = auth?.currentUser?.email || "accountant@example.com";

  const [description, setDescription] = useState("");
  const [debits, setDebits] = useState([{ accountId: "", accountName: "", amount: "" }]);
  const [credits, setCredits] = useState([{ accountId: "", accountName: "", amount: "" }]);
  const [attachments, setAttachments] = useState([]);

  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Load Chart of Accounts
  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, "accounts"));
      setAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  // Add row
  const addRow = (type) => {
    const blank = { accountId: "", accountName: "", amount: "" };
    type === "debit"
      ? setDebits([...debits, blank])
      : setCredits([...credits, blank]);
  };

  // Remove row
  const removeRow = (type, i) => {
    type === "debit"
      ? setDebits(debits.filter((_, idx) => idx !== i))
      : setCredits(credits.filter((_, idx) => idx !== i));
  };

  // Validation rules
  const validate = () => {

    if (!description || !description.trim()) {
      return "Description is required.";
   }

   for (const d of debits) {
    if (!d.accountId || !d.accountName) {
      return "All debit accounts must be selected.";
    }
  }
  for (const c of credits) {
    if (!c.accountId || !c.accountName) {
      return "All credit accounts must be selected.";
    }
  }

   
  for (const d of debits) {
    const amt = Number(d.amount);

    if (amt < 0) {
       return "Debit amounts cannot be negative.";
    }

    if (!amt || amt <= 0) {
      return "Debit amounts must be greater than zero.";
    }
  }

for (const d of debits) {
  const account = accounts.find(a => a.id === d.accountId);
  if (!account) {
    return "One or more debit accounts no longer exist in the chart of accounts.";
  }
  if (account.active === false) {
    return `Debit account "${account.name}" is inactive and cannot be used.`;
  }
}

for (const c of credits) {
  const account = accounts.find(a => a.id === c.accountId);
  if (!account) {
    return "One or more credit accounts no longer exist in the chart of accounts.";
  }
  if (account.active === false) {
    return `Credit account "${account.name}" is inactive and cannot be used.`;
  }
}


  
  for (const c of credits) {
    const amt = Number(c.amount);

    if (amt < 0) {
       return "Credit amounts cannot be negative.";
    }

    if (!amt || amt <= 0) {
      return "Credit amounts must be greater than zero.";
    }
  }

    if (debits.length === 0 || credits.length === 0)
      return "Each journal entry must include at least one debit and one credit.";

    const totalDebit = debits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const totalCredit = credits.reduce((sum, c) => sum + Number(c.amount || 0), 0);

    if (totalDebit !== totalCredit) {
      return `Total debits (${totalDebit.toFixed(2)}) must equal total credits (${totalCredit.toFixed(2)}).`;
    }

    return "";
  };

  // Submit journal entry
  const handleSubmit = async (e) => {
    e.preventDefault();

    const msg = validate();
    if (msg) {
      setError(msg);

      // Log validation error (Sprint req 28–30)
      await addDoc(collection(db, "errorMessages"), {
        user: userEmail,
        message: msg,
        createdAt: serverTimestamp(),
        context: "create-journal"
      });

      return;
    }

    try {
      setSaving(true);

      // Create base journal entry
      const entryRef = await addDoc(collection(db, "journalEntries"), {
        description,
        debits: debits.map(d => ({
          accountId: d.accountId,
          accountName: d.accountName,
          amount: Number(d.amount || 0)
        })),
        credits: credits.map(c => ({
          accountId: c.accountId,
          accountName: c.accountName,
          amount: Number(c.amount || 0)
        })),
        attachments: [],
        preparedBy: userEmail,
        preparedByRole: "accountant",
        postRef: `PR-${Date.now()}`,
        status: "pending",
        createdAt: serverTimestamp()
      });

      const journalId = entryRef.id;

      // Upload attachments
      const finalAttachments = [];

      for (const att of attachments) {
        if (!att.file) continue;

        const ext = att.file.name.split(".").pop().toLowerCase();
        const allowed = ["pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "png"];
         
       if (!allowed.includes(ext)) {
      
        await addDoc(collection(db, "errorMessages"), {
          user: userEmail,
          message: `Attachment upload failed: ${att.file?.name}`,
          createdAt: serverTimestamp(),
          context: "create-journal-attachment"
        });
      continue;   
      }

      try {
    const uploaded = await uploadAttachment(
      `journalEntries/${journalId}/attachments`,
      att.file
    );
    finalAttachments.push(uploaded);
  } catch (err) {
    
    await addDoc(collection(db, "errorMessages"), {
      user: userEmail,
      message: `Attachment upload failed: ${att.file.name}`,
      createdAt: serverTimestamp(),
      context: "create-journal-attachment"
    });
  }
}

await updateDoc(entryRef, { attachments: finalAttachments })
    
      await updateDoc(entryRef, { attachments: finalAttachments });

      // Create notification for manager review
      await addDoc(collection(db, "notifications"), {
        recipient: "manager@example.com",
        sender: userEmail,
        senderRole: "accountant", 
        entryId: journalId, description, 
        totalDebit: debits.reduce((s, d) => s + Number(d.amount || 0), 0), 
        totalCredit: credits.reduce((s, c) => s + Number(c.amount || 0), 0),
        message: `A new adjusting journal entry was submitted by ${userEmail}.`, 
        type: "submission",
        createdAt: serverTimestamp()
      });

      // Reset
      setDescription("");
      setDebits([{ accountId: "", accountName: "", amount: "" }]);
      setCredits([{ accountId: "", accountName: "", amount: "" }]);
      setAttachments([]);
      setError("");

      alert("Journal entry submitted for approval.");
    } catch (err) {
      console.error("Save error:", err);
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

          {/* Description */}
          <label>Description:</label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            style={input}
            required
          />

          {/* DEBITS */}
          <h3>Debits</h3>
          {debits.map((d, i) => (
            <div key={i} style={row}>
              <select
                value={d.accountId}
                onChange={(e) => {
                  const account = accounts.find(a => a.id === e.target.value);
                  const arr = [...debits];
                  arr[i].accountId = account.id;
                  arr[i].accountName = account.name;
                  setDebits(arr);
                  setError("");
                }}
                style={input}
                required
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.number} — {acc.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Amount"
                value={d.amount}
                style={input}
                onChange={(e) => {
                  const arr = [...debits];
                  arr[i].amount = e.target.value;
                  setDebits(arr);
                  setError("");
                }}
                required
              />

              <button type="button" onClick={() => removeRow("debit", i)}>✕</button>
            </div>
          ))}

          <button type="button" onClick={() => addRow("debit")}>+ Add Debit</button>

          {/* CREDITS */}
          <h3>Credits</h3>
          {credits.map((c, i) => (
            <div key={i} style={row}>
              <select
                value={c.accountId}
                onChange={(e) => {
                  const account = accounts.find(a => a.id === e.target.value);
                  const arr = [...credits];
                  arr[i].accountId = account.id;
                  arr[i].accountName = account.name;
                  setCredits(arr);
                  setError("");
                }}
                style={input}
                required
              >
                <option value="">Select account</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.number} — {acc.name}
                  </option>
                ))}
              </select>

              <input
                type="number"
                placeholder="Amount"
                value={c.amount}
                style={input}
                onChange={(e) => {
                  const arr = [...credits];
                  arr[i].amount = e.target.value;
                  setCredits(arr);
                  setError("");
                }}
                required
              />

              <button type="button" onClick={() => removeRow("credit", i)}>✕</button>
            </div>
          ))}

          <button type="button" onClick={() => addRow("credit")}>+ Add Credit</button>

          {/* ATTACHMENTS */}
          <h3>Attachments</h3>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.png"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              if (files.length === 0) return;

              const results = [];
              for (const file of files) {
                const uploaded = await uploadAttachment("temp", file);
                results.push({ name: uploaded.name, url: uploaded.url, file });

              }

              setAttachments(prev => [...prev, ...results]);
              setError("");
            }}
          />

          {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

          {/* SUBMIT + RESET */}
          <div style={{ marginTop: 20 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Submit Journal"}
            </button>

            <button
              type="button"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setDescription("");
                setDebits([{ accountId: "", accountName: "", amount: "" }]);
                setCredits([{ accountId: "", accountName: "", amount: "" }]);
                setAttachments([]);
                setError("");
              }}
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
  margin: "4px 8px 4px 0"
};

const row = {
  display: "flex",
  alignItems: "center",
  marginBottom: 8
};

export default CreateJournal;
