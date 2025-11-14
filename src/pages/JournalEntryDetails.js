// src/pages/JournalEntryDetails.js
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function JournalEntryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, "journalEntries", id));
        if (snap.exists()) {
          setEntry({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("Failed to load journal entry:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  if (!entry) return <p style={{ padding: 20 }}>Journal entry not found.</p>;

  // normalize debit/credit data
  const debitLines =
    entry.debits ||
    entry.lines?.filter((l) => l.side === "debit") ||
    [];

  const creditLines =
    entry.credits ||
    entry.lines?.filter((l) => l.side === "credit") ||
    [];

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: "0 auto" }}>
      <button onClick={() => navigate(-1)}>← Back</button>

      <h2>Journal Entry Details</h2>

      <p><strong>ID:</strong> {entry.id}</p>
      <p><strong>Date:</strong> {entry.date || "—"}</p>
      <p><strong>Description:</strong> {entry.description || "—"}</p>
      <p><strong>Status:</strong> {entry.status || "pending"}</p>
      <p><strong>Prepared By:</strong> {entry.preparedBy || entry.createdBy || "—"}</p>

      <h3>Debits</h3>
      <ul>
        {debitLines.map((d, i) => (
          <li key={i}>
            {d.accountName} — ${Number(d.amount || 0).toFixed(2)}
          </li>
        ))}
      </ul>

      <h3>Credits</h3>
      <ul>
        {creditLines.map((c, i) => (
          <li key={i}>
            {c.accountName} — ${Number(c.amount || 0).toFixed(2)}
          </li>
        ))}
      </ul>

      {/** === Attachments Section === */}
      {entry.attachments?.length > 0 && (
        <>
          <h3>Attachments</h3>
          <ul>
            {entry.attachments.map((a, i) => (
              <li key={i}>
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#2563eb", textDecoration: "underline" }}
                >
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
