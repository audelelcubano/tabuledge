// src/components/NavBar.js
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import logo from "../assets/tabuledge-logo.png";

function NavBar({
  userEmail,
  selectedDate,
  onDateChange,
  showNav = true,      // set to false on pages like Login/Register
  showLogout = true,   // set to false on pages like Login/Register
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (e) {
      console.error("Logout failed:", e);
      alert("Logout failed. Please try again.");
    }
  };

  const go = (path) => {
    if (location.pathname !== path) navigate(path);
  };

  return (
    <header style={styles.header}>
      <div style={styles.leftGroup} onClick={() => go("/accounts")} title="Go to Chart of Accounts">
        {/* Make the logo white using a CSS filter to blend with dark theme */}
        <img src={logo} alt="Tabuledge" style={styles.logoWhite} />
        <div style={styles.brandBlock}>
          <div style={styles.brand}>TABULEDGE</div>
          <div style={styles.subbrand}>ACCOUNTING SOFTWARE</div>
        </div>
      </div>

      <div style={styles.rightGroup}>
        {/* Date picker (pop-up calendar) */}
        {onDateChange && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            title="Pick a date"
            style={styles.date}
          />
        )}

        {/* Signed-in user */}
        {userEmail && (
          <span title="Signed-in user" style={styles.user}>
            {userEmail}
          </span>
        )}

        {/* Top navigation buttons */}
        {showNav && (
          <nav style={styles.nav}>
            <button onClick={() => go("/admin")} title="Admin home" style={styles.btn}>
              Admin
            </button>
            <button onClick={() => go("/accounts")} title="Chart of Accounts" style={styles.btn}>
              Chart of Accounts
            </button>
            <button onClick={() => go("/accountant")} title="Journalizing & posting" style={styles.btn}>
              Journal
            </button>
            <button onClick={() => go("/manager")} title="Reports & approvals" style={styles.btn}>
              Reports
            </button>
            <button onClick={() => go("/event-logs")} title="System change history" style={styles.btn}>
              Event Logs
            </button>
          </nav>
        )}

        {/* Logout */}
        {showLogout && (
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ ...styles.btn, ...styles.logout }}
          >
            Logout
          </button>
        )}
      </div>
    </header>
  );
}

const styles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 16px",
    background: "linear-gradient(90deg, #0b1220 0%, #0f172a 60%, #0b1220 100%)",
    color: "#fff",
    position: "sticky",
    top: 0,
    zIndex: 100,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  leftGroup: { display: "flex", alignItems: "center", gap: 10, cursor: "pointer" },
  // Turn dark logo to white: brightness(0) makes it black, invert(1) flips to white.
  logoWhite: { width: 40, height: 40, objectFit: "contain", filter: "brightness(0) invert(1)" },
  brandBlock: { display: "flex", flexDirection: "column", lineHeight: 1 },
  brand: { fontWeight: 800, letterSpacing: 2, fontSize: 14 },
  subbrand: { fontSize: 10, opacity: 0.8, letterSpacing: 1.5 },
  rightGroup: { display: "flex", alignItems: "center", gap: 8 },
  date: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#fff",
  },
  user: { fontSize: 12, opacity: 0.9, marginLeft: 6, marginRight: 2 },
  nav: { display: "flex", gap: 8, alignItems: "center" },
  btn: {
    padding: "8px 12px",
    background: "#1e293b",
    color: "#fff",
    border: "1px solid #334155",
    borderRadius: 8,
    cursor: "pointer",
  },
  logout: { background: "#7f1d1d", borderColor: "#7f1d1d" },
};

export default NavBar;
