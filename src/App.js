// src/App.js
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminPanel from "./pages/AdminPanel";
import ManagerDashboard from "./pages/ManagerDashboard";
import AccountantDashboard from "./pages/AccountantDashboard";


function App() {
  return (
    <Router>
<Routes>
  <Route path="/" element={<LoginPage />} />
  <Route path="/register" element={<RegisterPage />} />
  <Route path="/admin" element={<AdminPanel />} />
  <Route path="/manager" element={<ManagerDashboard />} />
  <Route path="/accountant" element={<AccountantDashboard />} />
</Routes>
    </Router>
  );
}

export default App;
