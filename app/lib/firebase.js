import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCjCXDjzRcq17AJDyGhkMAlElw8HoYwesY",
  authDomain: "perfora-sfa.firebaseapp.com",
  projectId: "perfora-sfa",
  storageBucket: "perfora-sfa.firebasestorage.app",
  messagingSenderId: "507864080315",
  appId: "1:507864080315:web:c36d5220d46a98215bee9e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication and Database
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();