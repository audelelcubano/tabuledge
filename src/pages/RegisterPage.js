// src/pages/RegisterPage.js
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import NavBar from "../components/NavBar";

function RegisterPage() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      await addDoc(collection(db, "users"), {
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        role: "accountant",
        active: true,
        createdAt: Date.now(),
        uid: cred.user.uid,
      });
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
        <h2>Create account</h2>
        <form onSubmit={submit} style={styles.form}>
          <input
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            required
          />
          <input
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {err && <div style={styles.error}>{err}</div>}
          <button type="submit">Register</button>
        </form>
        <p style={{ marginTop: 10 }}>
          Already have an account? <Link to="/">Login</Link>
        </p>
      </main>
    </div>
  );
}

const styles = {
  container: { padding: 20, maxWidth: 520, margin: "20px auto" },
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

export default RegisterPage;
