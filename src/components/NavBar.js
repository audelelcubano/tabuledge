// src/components/NavBar.js
import React from "react";
import logo from "../logo.svg";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

function NavBar({ userEmail, onDateChange, selectedDate }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      alert("You have been logged out.");
      navigate("/");
    } catch (e) {
      console.error("Logout failed:", e);
      alert("Logout failed. Please try again.");
    }
  };

  return (
    <header style={styles.header}>
      <div style={styles.leftGroup}>
        <img src={logo} alt="Tabuledge" style={styles.logo} title="Tabuledge" />
        <div style={styles.meta}>
          <strong title="Currently signed-in user">{userEmail || "Guest"}</strong>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange?.(e.target.value)}
            title="Pick a date (pop-up calendar)"
            style={styles.date}
          />
        </div>
      </div>

      <nav style={styles.nav}>
        <button onClick={() => navigate("/admin")} title="Admin home" style={styles.btn}>Admin</button>
        <button onClick={() => navigate("/accounts")} title="Chart of Accounts" style={styles.btn}>Chart of Accounts</button>
        <button onClick={() => navigate("/accountant")} title="Journalizing & posting" style={styles.btn}>Journal</button>
        <button onClick={() => navigate("/manager")} title="Reports & approvals" style={styles.btn}>Reports</button>
        <button onClick={() => navigate("/event-logs")} title="System change history" style={styles.btn}>Event Logs</button>

        {/* Logout */}
        <button onClick={handleLogout} title="Sign out of Tabuledge" style={{ ...styles.btn, background: "#7f1d1d", borderColor: "#7f1d1d" }}>
          Logout
        </button>
      </nav>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "#0f172a",
    color: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  leftGroup: { display: "flex", alignItems: "center", gap: 12 },
  logo: { width: 40, height: 40 },
  meta: { display: "flex", alignItems: "center", gap: 8 },
  date: { padding: "4px 8px", borderRadius: 6, border: "1px solid #334155" },
  nav: { display: "flex", gap: 8, alignItems: "center" },
  btn: {
    padding: "8px 12px",
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    cursor: "pointer",
  },
};

export default NavBar;
