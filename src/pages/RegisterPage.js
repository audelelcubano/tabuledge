// src/pages/RegisterPage.js
import React, { useState } from "react";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import PasswordChecklist from "react-password-checklist";

function RegisterPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address: "",
    dob: "",
    email: "",
    password: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Generate username format: first initial + last name + MMYY
  const generateUsername = (firstName, lastName) => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(-2);
    return `${firstName[0].toLowerCase()}${lastName.toLowerCase()}${mm}${yy}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const username = generateUsername(form.firstName, form.lastName);

      // Save request in Firestore
      await addDoc(collection(db, "userRequests"), {
        ...form,
        username,
        active: false,
        role: "pending",
        passwordSetAt: Date.now(),
      });

      setSubmitted(true);
    } catch (err) {
      console.error("Error submitting request:", err);
    }
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h3>✅ Request submitted!</h3>
        <p>Your username will be generated after admin approval.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "300px",
        margin: "50px auto",
      }}
    >
      <h2>Request New Account</h2>
      <input name="firstName" placeholder="First Name" onChange={handleChange} required />
      <input name="lastName" placeholder="Last Name" onChange={handleChange} required />
      <input name="address" placeholder="Address" onChange={handleChange} required />
      <input name="dob" type="date" onChange={handleChange} required />
      <input name="email" type="email" placeholder="Email" onChange={handleChange} required />

      <input
        name="password"
        type="password"
        placeholder="Password"
        value={form.password}
        onChange={handleChange}
        required
      />

      <PasswordChecklist
        rules={["minLength", "letter", "number", "specialChar"]}
        minLength={8}
        value={form.password}
        messages={{
          minLength: "Must be at least 8 characters",
          letter: "Must contain a letter",
          number: "Must contain a number",
          specialChar: "Must contain a special character",
        }}
      />

      <button type="submit">Submit Request</button>
    </form>
  );
}

export default RegisterPage;
