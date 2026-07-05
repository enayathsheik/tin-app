import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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

// Helper: save user profile to Firestore
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), data, { merge: true });
}

// Helper: get user profile
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}
