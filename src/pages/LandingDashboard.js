// src/pages/LandingDashboard.js
import React, { useEffect, useState } from "react";
import NavBar from "../components/NavBar";
import {collection, getDocs, query, where} from "firebase/firestore";
import { db, auth } from "../firebase";
import useUserRole from "../hooks/useUserRole";
import { useNavigate } from "react-router-dom";


// Existing financial utilities
import {
  computeBalances,
  incomeStatement,
  balanceSheet
} from "../utils/financials";

// Ratios utility
import { computeRatios } from "../utils/ratios";

export default function LandingDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();
  const { role, loading: roleLoading, userEmail } = useUserRole();

  useEffect(() => {
    if (!auth?.currentUser) {
        navigate("/");
      }
    }, [navigate]);

  // Ratio & message state
  const [ratios, setRatios] = useState(null);
  const [loading, setLoading] = useState(true);

  const [pendingCount, setPendingCount] = useState(0);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [lastLogin, setLastLogin] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        // -------------------------
        // 1. Load Accounts
        // -------------------------
        const accSnap = await getDocs(collection(db, "accounts"));
        const accounts = accSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        // -------------------------
        // 2. Load Ledger Entries
        // -------------------------
        const ledSnap = await getDocs(collection(db, "ledgerEntries"));
        const ledger = ledSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        // -------------------------
        // 3. Compute Balances
        // -------------------------
        const accMap = computeBalances(accounts, ledger, null, today);

        // -------------------------
        // 4. Compute Income Statement + Balance Sheet
        // -------------------------
        const is = incomeStatement(accMap);
        const bs = balanceSheet(accMap, 0, is.netIncome);

        // -------------------------
        // 5. Extract totals needed for ratios
        // -------------------------
        const totals = {
          currentAssets: bs.currentAssets ?? 0,
          inventory: bs.inventory ?? 0,
          currentLiabilities: bs.currentLiabilities ?? 0,
          totalLiabilities: bs.totalLiabilities ?? 0,
          totalEquity: bs.totalEquity ?? 0,
          totalAssets: bs.totalAssets ?? 0,
          netIncome: is.netIncome ?? 0,
          revenue: is.revenue ?? 0
        };

        // -------------------------
        // 6. Compute Ratios
        // -------------------------
        setRatios(computeRatios(totals));

        // -------------------------
        // 7. Journal Entry Messages
        // -------------------------
        const jeSnap = await getDocs(collection(db, "journalEntries"));
        const journalEntries = jeSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));

        const pending = journalEntries.filter(
          (j) => j.status === "pending"
        ).length;

        const rejected = journalEntries.filter(
          (j) => j.status === "rejected"
        ).length;

        setPendingCount(pending);
        setRejectedCount(rejected);

        // -------------------------
        // 8. Notifications
        // (All are considered unread for now)
        // -------------------------
        const notifSnap = await getDocs(collection(db, "notifications"));
        const notifications = notifSnap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        setUnreadNotifications(notifications.length);

        // -------------------------
        // 9. Last Login
        // -------------------------
        const userEmail = auth?.currentUser?.email;
        if (userEmail) {
          const eventSnap = await getDocs(
            query(
              collection(db, "eventLogs"),
              where("createdBy", "==", userEmail)
            )
          );

          const events = eventSnap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((e) => e.action === "login")
            .sort(
              (a, b) =>
                (b.timestamp || 0) - (a.timestamp || 0)
            );

          if (events.length > 0) {
            setLastLogin(events[0].timestamp);
          }
        }
      } catch (err) {
        console.error("Dashboard load failed:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [today]);

  return (
    <div>
      <NavBar
        userEmail={userEmail || ""}
        selectedDate={today}
        onDateChange={() => {}}
      />

      <main
        style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}
      >
        <h2>Dashboard</h2>

        {/* ----------------------------- */}
        {/* Financial Ratios Section */}
        {/* ----------------------------- */}
        <section
          style={{
            border: "1px solid #e2e8f0",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20
          }}
        >
          <h3>Financial Ratios</h3>

          {loading && <p>Loading...</p>}
          {!loading && !ratios && <p>No ratio data available.</p>}

          {!loading && ratios && (
            <ul>
              {ratios.map((r) => {
                const color =
                  r.status === "good"
                    ? "#16a34a"
                    : r.status === "warning"
                    ? "#f59e0b"
                    : "#dc2626";

                return (
                  <li key={r.key} style={{ marginBottom: 6 }}>
                    <strong>{r.label}:</strong>{" "}
                    <span style={{ color }}>{r.formatted}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ----------------------------- */}
        {/* Important Messages Section */}
        {/* ----------------------------- */}
        <section
          style={{
            border: "1px solid #e2e8f0",
            padding: 16,
            borderRadius: 8
          }}
        >
          <h3>Important Messages</h3>
          <ul>
            <li>
              <strong>Pending Journal Entries:</strong>{" "}
              {pendingCount}
            </li>
            <li>
              <strong>Rejected Journal Entries:</strong>{" "}
              {rejectedCount}
            </li>
            <li>
              <strong>Unread Notifications:</strong>{" "}
              {unreadNotifications}
            </li>
            <li>
              <strong>Last Login:</strong>{" "}
              {lastLogin
                ? new Date(lastLogin).toLocaleString()
                : "—"}
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}

