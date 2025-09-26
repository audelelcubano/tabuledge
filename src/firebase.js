// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsVoi1Im5qD-FJe0Ojwz40PM5_x-bCGRI",
  authDomain: "tabuledge.firebaseapp.com",
  projectId: "tabuledge",
  storageBucket: "tabuledge.firebasestorage.app",
  messagingSenderId: "714184051345",
  appId: "1:714184051345:web:b01a212f123cf740ee4d30",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
