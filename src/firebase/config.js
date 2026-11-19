import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyAL2plvt3XiwLjsHRXxiqsDJnUQIOvNF3I",
  authDomain: "trade-intelligence-netwo-97997.firebaseapp.com",
  projectId: "trade-intelligence-netwo-97997",
  storageBucket: "trade-intelligence-netwo-97997.firebasestorage.app",
  messagingSenderId: "587892307032",
  appId: "1:587892307032:web:9926c4fa1d3267abefc62d",
  measurementId: "G-2DTB0TYBL7"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);
export const functions = getFunctions(firebaseApp, "asia-south1");

// LOCAL DEV ONLY: point the app at the Firebase emulators (seeded test data,
// never production). Needs BOTH the Vite dev server (import.meta.env.DEV is
// false in every production build, so this block is dead code there) AND
// VITE_USE_EMULATORS=true set on the command line, e.g.
//   VITE_USE_EMULATORS=true npx vite
// vite.config.js also refuses to build if the variable is set.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  console.warn("[firebase] Using local EMULATORS — not production data.");
}

// Fields that live in users/{uid}/stats/summary instead of the root identity doc
const STAT_FIELDS = ["points", "storesAdded", "citiesCovered", "level"];

function splitProfileData(data) {
  const identity = {}, stats = {};
  Object.entries(data).forEach(([k, v]) => {
    (STAT_FIELDS.includes(k) ? stats : identity)[k] = v;
  });
  return { identity, stats };
}

// Helper: save user profile — identity fields go to users/{uid},
// stat fields (points/storesAdded/citiesCovered/level) go to users/{uid}/stats/summary
export async function saveUserProfile(uid, data) {
  const { identity, stats } = splitProfileData(data);
  const writes = [];
  if (Object.keys(identity).length) writes.push(setDoc(doc(db, "users", uid), identity, { merge: true }));
  if (Object.keys(stats).length) writes.push(setDoc(doc(db, "users", uid, "stats", "summary"), stats, { merge: true }));
  await Promise.all(writes);
}

// Helper: get user profile — merges the identity doc with the stats/summary subdoc
export async function getUserProfile(uid) {
  const [identitySnap, statsSnap] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "users", uid, "stats", "summary")),
  ]);
  if (!identitySnap.exists()) return null;
  return { ...identitySnap.data(), ...(statsSnap.exists() ? statsSnap.data() : {}) };
}

// Helper: write directly to users/{uid}/stats/summary (e.g. with increment())
export async function updateUserStats(uid, statsData) {
  await setDoc(doc(db, "users", uid, "stats", "summary"), statsData, { merge: true });
}
