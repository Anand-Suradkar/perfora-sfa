import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";

export const OWNER_ADMIN_EMAIL = "anand@perforacare.com";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Loads an already-provisioned application role. Ordinary users must never
 * assign their own role from the client. The owner account remains a bootstrap
 * administrator if its profile document is missing.
 */
export async function loadAppUser(firebaseUser, db) {
  const email = normalizeEmail(firebaseUser?.email);
  if (!email) throw new Error("This login does not provide an email address.");

  const snap = await getDoc(doc(db, "users", email));
  const stored = snap.exists() ? snap.data() : null;
  const profile = email === OWNER_ADMIN_EMAIL
    ? { ...(stored || {}), email, name: stored?.name || firebaseUser.displayName || "Admin", role: "Admin" }
    : stored;

  const role = String(profile?.role || "").trim().toUpperCase();
  if (!profile || !["ADMIN", "SO"].includes(role)) {
    throw new Error("Your account is not provisioned for Perfora SFA. Please contact the administrator.");
  }

  return {
    ...profile,
    email,
    name: profile.name || firebaseUser.displayName || email.split("@")[0],
    role: role === "ADMIN" ? "Admin" : "SO",
  };
}

/** Return only distributors explicitly mapped to a field user's email. */
export async function getAccessibleDistributors(db, email, isAdmin) {
  if (isAdmin) {
    const snap = await getDocs(collection(db, "distributors"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  const normalized = normalizeEmail(email);
  const [arraySnap, legacySnap] = await Promise.all([
    getDocs(query(collection(db, "distributors"), where("mapped_SO_emails", "array-contains", normalized))),
    getDocs(query(collection(db, "distributors"), where("mapped_SO_email", "==", normalized))),
  ]);
  const byId = new Map();
  for (const d of [...arraySnap.docs, ...legacySnap.docs]) {
    byId.set(d.id, { id: d.id, ...d.data() });
  }
  return [...byId.values()];
}
