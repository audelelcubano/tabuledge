// src/pages/LedgerPage.js
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import NavBar from "../components/NavBar";

function LedgerPage() {
  const { id } = useParams();
  const userEmail = auth?.currentUser?.email || "admin@example.com";
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [account, setAccount] = useState(null);

  useEffect(() => {
    const load = async () => {
      const snap = await getDoc(doc(db, "accounts", id));
      if (snap.exists()) setAccount({ id: snap.id, ...snap.data() });
    };
    load();
  }, [id]);

  return (
    <div>
      <NavBar
        userEmail={userEmail}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
      />
      <main style={{ padding: 20 }}>
        {!account ? (
          <p>Loading…</p>
        ) : (
          <>
            <h2>Ledger: {account.name} ({account.number})</h2>
            <p><em>Placeholder:</em> Journal entries and running balances will be displayed here.</p>
          </>
        )}
      </main>
    </div>
  );
}

export default LedgerPage;
