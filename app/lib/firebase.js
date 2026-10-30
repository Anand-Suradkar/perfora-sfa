
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";

const useEmulators =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

const firebaseConfig = useEmulators
  ? {
      apiKey: "demo-api-key",
      authDomain: "demo-perfora-sfa.firebaseapp.com",
      projectId: "demo-perfora-sfa",
      storageBucket: "demo-perfora-sfa.appspot.com",
      messagingSenderId: "000000000000",
      appId: "1:000000000000:web:localdemo",
    }
  : {
      apiKey: "AIzaSyCjCXDjzRcq17AJDyGhkMAlElw8HoYwesY",
      authDomain: "perfora-sfa.firebaseapp.com",
      projectId: "perfora-sfa",
      storageBucket: "perfora-sfa.firebasestorage.app",
      messagingSenderId: "507864080315",
      appId: "1:507864080315:web:c36d5220d46a98215bee9e",
    };

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Fail safely if a previous initialization is still using the live project.
if (useEmulators && app.options.projectId !== "demo-perfora-sfa") {
  throw new Error(
    "Firebase emulator safety check failed. Stop all Next.js dev servers and restart."
  );
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

if (useEmulators && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });

  connectFirestoreEmulator(db, "127.0.0.1", 8080);

  console.info(
    "Firebase emulator mode enabled: demo-perfora-sfa"
  );
}
