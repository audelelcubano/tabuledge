// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPanel from "./pages/AdminPanel";
import ManagerDashboard from "./pages/ManagerDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import AccountDetailsPage from "./pages/AccountDetailsPage";
import LedgerPage from "./pages/LedgerPage";
import EventLogPage from "./pages/EventLogPage";
import JournalEntryPage from "./pages/JournalEntryPage";
import CreateJournalEntry from "./pages/CreateJournalEntry";
import JournalEntryDetails from "./pages/JournalEntryDetails";

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
        <Route path="/accounts/:id" element={<AccountDetailsPage />} />
        <Route path="/ledger/:id" element={<LedgerPage />} />
        <Route path="/event-logs" element={<EventLogPage />} />
        <Route path="/journal" element={<JournalEntryPage />} />
        <Route path="/journal/:id" element={<JournalEntryPage />} />
        <Route path="/create-journal" element={<CreateJournalEntry />} />
        <Route path="/journal/:id" element={<JournalEntryDetails />} />
      </Routes>
    </Router>
  );
}

export default App;
