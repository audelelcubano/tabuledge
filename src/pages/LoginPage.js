// src/pages/LoginPage.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import NavBar from "../components/NavBar";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/accounts");
    } catch (error) {
      setErr(error.message);
    }
  };

  return (
    <div>
      <NavBar
        userEmail=""
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        showNav={false}
        showLogout={false}
      />

      <main style={styles.container}>
        <h2>Sign in</h2>
        <form onSubmit={handleLogin} style={styles.form}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <input
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
          {err && <div style={styles.error}>{err}</div>}
          <button type="submit">Login</button>
        </form>
        <p style={{ marginTop: 10 }}>
          No account? <Link to="/register">Register</Link>
        </p>
      </main>
    </div>
  );
}

const styles = {
  container: { padding: 20, maxWidth: 420, margin: "20px auto" },
  form: {
    display: "grid",
    gap: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 16,
  },
  error: { color: "#b91c1c" },
};

export default LoginPage;
