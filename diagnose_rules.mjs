import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAL2plvt3XiwLjsHRXxiqsDJnUQIOvNF3I",
  authDomain: "trade-intelligence-netwo-97997.firebaseapp.com",
  projectId: "trade-intelligence-netwo-97997",
  storageBucket: "trade-intelligence-netwo-97997.firebasestorage.app",
  messagingSenderId: "587892307032",
  appId: "1:587892307032:web:9926c4fa1d3267abefc62d",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const EMAIL = `tin-diag-${Date.now()}@example.com`;
const PASSWORD = "TestPass123!";

const cred = await createUserWithEmailAndPassword(auth, EMAIL, PASSWORD);
const uid = cred.user.uid;
console.log("Created auth user:", uid, EMAIL);

// 1) Root identity doc write
try {
  await setDoc(doc(db, "users", uid), { name: "Diag User", email: EMAIL, role: "contributor" }, { merge: true });
  console.log("ROOT DOC WRITE: OK");
} catch (e) {
  console.log("ROOT DOC WRITE: FAILED -", e.code, e.message);
}

// 2) Read back root doc
try {
  const snap = await getDoc(doc(db, "users", uid));
  console.log("ROOT DOC READ:", snap.exists() ? "exists -> " + JSON.stringify(snap.data()) : "does not exist");
} catch (e) {
  console.log("ROOT DOC READ: FAILED -", e.code, e.message);
}

// 3) Stats subcollection write
try {
  await setDoc(doc(db, "users", uid, "stats", "summary"), { points: 0, storesAdded: 0, citiesCovered: 0, level: "Bronze" }, { merge: true });
  console.log("STATS SUBDOC WRITE: OK");
} catch (e) {
  console.log("STATS SUBDOC WRITE: FAILED -", e.code, e.message);
}

// 4) Read back stats subdoc
try {
  const snap = await getDoc(doc(db, "users", uid, "stats", "summary"));
  console.log("STATS SUBDOC READ:", snap.exists() ? "exists -> " + JSON.stringify(snap.data()) : "does not exist");
} catch (e) {
  console.log("STATS SUBDOC READ: FAILED -", e.code, e.message);
}

// Cleanup: delete the auth user (Firestore docs, if any got created, are orphaned harmless test data
// we may not have delete permission for -- reported above, not fatal)
try {
  await deleteUser(auth.currentUser);
  console.log("Cleaned up: deleted auth user", uid);
} catch (e) {
  console.log("Could not delete auth user:", e.message);
}
process.exit(0);
