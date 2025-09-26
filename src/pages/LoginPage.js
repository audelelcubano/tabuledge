// src/pages/LoginPage.js
import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // Check user document in Firestore
      const userDocRef = doc(db, "users", email);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();

        // Check if account is locked
        if (data.failedAttempts >= 3) {
          alert("❌ Account locked. Contact admin.");
          return;
        }

        // Check password expiration (90 days, warn at 3 days left)
        const ninetyDays = 90 * 24 * 60 * 60 * 1000;
        if (data.passwordSetAt) {
          const age = Date.now() - data.passwordSetAt;
          if (age > ninetyDays) {
            alert("❌ Password expired. Please reset it.");
            return;
          } else if (age > ninetyDays - (3 * 24 * 60 * 60 * 1000)) {
            alert("⚠️ Your password will expire in less than 3 days.");
          }
        }
      }

      // Attempt login with Firebase Auth
      await signInWithEmailAndPassword(auth, email, password);

      // Reset failed attempts on success
      if (snap.exists()) {
        await updateDoc(userDocRef, { failedAttempts: 0 });
      }

      alert("✅ Login successful!");
      // TODO: redirect based on role
    } catch (err) {
      setError(err.message);

      // Increment failed attempts
      const userDocRef = doc(db, "users", email);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const attempts = (snap.data().failedAttempts || 0) + 1;
        await updateDoc(userDocRef, { failedAttempts: attempts });
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email above first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("📧 Password reset email sent!");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px" }}>
      <form
        onSubmit={handleLogin}
        style={{ display: "flex", flexDirection: "column", width: "300px" }}
      >
        <h2>Tabuledge Login</h2>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
        {error && <p style={{ color: "red" }}>{error}</p>}

        <button type="button" onClick={handleForgotPassword}>
          Forgot Password
        </button>

        <button type="button" onClick={() => navigate("/register")}>
          Create New User
        </button>
      </form>
    </div>
  );
}

export default LoginPage;
