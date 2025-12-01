// src/utils/logEvent.js
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

/**
 * Writes a before/after log entry to Firestore.
 * @param {string} entity - e.g. "account"
 * @param {string} action - e.g. "create" | "update" | "delete"
 * @param {object|null} before - previous state
 * @param {object|null} after - new state
 */
export async function logEvent(entity, action, before, after) {
  try {
    const user = auth?.currentUser?.email || "unknown";
    await addDoc(collection(db, "eventLogs"), {
      entity,
      action,
      user,
      before: before || null,
      after: after || null,
      at: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to write event log:", err);
  }
}
