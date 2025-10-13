// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPanel from "./pages/AdminPanel";
import ManagerDashboard from "./pages/ManagerDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import LedgerPage from "./pages/LedgerPage";
import EventLogPage from "./pages/EventLogPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/manager" element={<ManagerDashboard />} />
        <Route path="/accountant" element={<AccountantDashboard />} />
        <Route path="/accounts" element={<ChartOfAccounts />} />
        <Route path="/ledger/:id" element={<LedgerPage />} />
        <Route path="/event-logs" element={<EventLogPage />} />
      </Routes>
    </Router>
  );
}

export default App;
