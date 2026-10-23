import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjCXDjzRcq17AJDyGhkMAlElw8HoYwesY",
  authDomain: "perfora-sfa.firebaseapp.com",
  projectId: "perfora-sfa",
  storageBucket: "perfora-sfa.firebasestorage.app",
  messagingSenderId: "507864080315",
  appId: "1:507864080315:web:c36d5220d46a98215bee9e"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// FORCE PERMANENT LOGIN (Keeps user logged in for months)
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();