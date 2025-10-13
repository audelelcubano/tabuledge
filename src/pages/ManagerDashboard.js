// src/pages/ManagerDashboard.js
import React from "react";
import { auth } from "../firebase";
import NavBar from "../components/NavBar";

function ManagerDashboard() {
  const userEmail = auth?.currentUser?.email || "manager@example.com";
  const [selectedDate, setSelectedDate] = React.useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  return (
    <div>
      <NavBar userEmail={userEmail} selectedDate={selectedDate} onDateChange={setSelectedDate} />
      <main style={{ padding: "20px" }}>
        <h2>📊 Manager Dashboard</h2>
        <p>Here managers will review transactions, approve/reject, and view reports.</p>
      </main>
    </div>
  );
}

export default ManagerDashboard;
