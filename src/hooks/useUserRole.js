// src/hooks/useUserRole.js
// Lightweight hook to read the signed-in user's role from Firestore.
// We look up by email to match how LoginPage and AdminPanel store users.

import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { collection, getDocs, query, where, limit } from "firebase/firestore";

export default function useUserRole() {
  const [role, setRole] = useState(null);        // "admin" | "manager" | "accountant" | null
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState(null);

  useEffect(() => {
    const email = auth?.currentUser?.email || null;
    setUserEmail(email);
    if (!email) {
      setRole(null);
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        // Users are stored in Firestore "users" with an "email" and "role" field.
        const q = query(
          collection(db, "users"),
          where("email", "==", email),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setRole(data.role || null);
        } else {
          setRole(null);
        }
      } catch (e) {
        console.error("Error fetching role:", e);
        setRole(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, []);

  return { role, loading, userEmail };
}
