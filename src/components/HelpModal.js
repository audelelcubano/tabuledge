// src/components/HelpModal.js
import React from "react";

function HelpModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3>Help & Topics</h3>
        <p><strong>Chart of Accounts:</strong> Add, edit, deactivate, and search accounts. Click an account to view its ledger.</p>
        <p><strong>Journal:</strong> Use the Accountant dashboard to journalize transactions and post to ledgers.</p>
        <p><strong>Event Logs:</strong> View a full history of adds, edits, deactivations with who/when and before/after.</p>
        <p><strong>Security:</strong> Passwords expire after 90 days; accounts lock after 3 failed login attempts.</p>
        <button onClick={onClose} title="Close help">Close</button>
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
  },
  modal: {
    background: "#fff", color: "#0f172a", padding: 20, borderRadius: 12, width: 520,
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },
};

export default HelpModal;
