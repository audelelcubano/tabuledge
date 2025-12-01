// src/components/SendEmailModal.js
import React, { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

/**
 * A simple modal for sending messages (emails) to a target role or address.
 * The message is saved in Firestore "notifications" collection.
 */
export default function SendEmailModal({ open, onClose, sender, defaultRecipient }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setSuccess(false);

    try {
      await addDoc(collection(db, "notifications"), {
        type: "manual_message",
        from: sender,
        to: defaultRecipient || "manager@example.com",
        subject,
        body: message,
        createdAt: serverTimestamp(),
      });
      setSuccess(true);
      setSubject("");
      setMessage("");
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Error sending message. Check console for details.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3 style={{ marginBottom: 12 }}>Send Message to Manager</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label>Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              style={input}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              style={{ ...input, resize: "vertical" }}
            />
          </div>
          {success && <p style={{ color: "green" }}>Message sent successfully.</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Styles
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal = {
  background: "#fff",
  padding: 20,
  borderRadius: 8,
  boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
  width: "100%",
  maxWidth: 420,
};

const input = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  background: "white",
};
