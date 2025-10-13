// src/pages/AccountantDashboard.js
import React from "react";
import { auth } from "../firebase";
import NavBar from "../components/NavBar";

function AccountantDashboard() {
  const userEmail = auth?.currentUser?.email || "accountant@example.com";
  const [selectedDate, setSelectedDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <main style={{ padding: "20px" }}>
        <h2>💼 Accountant Dashboard</h2>
        <p>Here accountants will journalize transactions, post entries, and view balances.</p>
      </main>
    </div>
  );
}

export default AccountantDashboard;
