import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, deleteUser } from "firebase/auth";
import { getFirestore, doc, deleteDoc } from "firebase/firestore";

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

const EMAIL = process.argv[2];
const PASSWORD = process.argv[3];
if (!EMAIL || !PASSWORD) { console.error("Usage: node cleanup_test_account.mjs <email> <password>"); process.exit(1); }

try {
  const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
  const uid = cred.user.uid;
  console.log("Signed in as test account, uid:", uid);

  for (const path of [["users", uid, "stats", "summary"], ["users", uid]]) {
    try {
      await deleteDoc(doc(db, ...path));
      console.log("Deleted doc:", path.join("/"));
    } catch (e) {
      console.log("Could not delete doc", path.join("/"), "-", e.message);
    }
  }

  await deleteUser(auth.currentUser);
  console.log("Deleted Firebase Auth user:", uid);
} catch (e) {
  console.error("Cleanup failed:", e.message);
  process.exit(1);
}
process.exit(0);
