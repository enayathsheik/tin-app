// Admin: verify / reject a store (moved unchanged from AdminDashboard so
// Admin → TIN Jobs Admin uses the same logic). firestore.rules let only the
// TIN admin set verificationStatus.
import { addDoc, collection, doc, getDoc, getDocs, increment, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db, updateUserStats } from "../firebase/config";
import { getLevel } from "../utils/helpers";

// Returns the message to show.
export async function verifyStore(storeId) {
  await updateDoc(doc(db, "stores", storeId), { verificationStatus: "verified", verifiedAt: serverTimestamp(), verifiedBy: "admin" });
  // Auto-credit 50 referral points if this store's contributor was referred by someone
  try {
    const storeSnap = await getDoc(doc(db, "stores", storeId));
    const contributorId = storeSnap.data()?.contributorId;
    if (contributorId) {
      const userSnap = await getDoc(doc(db, "users", contributorId));
      const referredBy = userSnap.data()?.referredBy;
      if (referredBy) {
        const refSnap = await getDocs(query(collection(db, "users"), where("referralCode", "==", referredBy)));
        if (!refSnap.empty) {
          const referrerUid = refSnap.docs[0].id;
          const referrerStatsSnap = await getDoc(doc(db, "users", referrerUid, "stats", "summary"));
          const currentPoints = referrerStatsSnap.exists() ? (referrerStatsSnap.data().points || 0) : 0;
          await updateUserStats(referrerUid, { points: increment(50), level: getLevel(currentPoints + 50).name });
          await addDoc(collection(db, "notifications", referrerUid, "items"), {
            type: "referral_credited",
            message: "You earned 50 points! Your referral was validated as a Market Champion.",
            read: false,
            createdAt: serverTimestamp()
          });
          return "Approved! 50 referral points credited to referrer.";
        }
      }
    }
  } catch(refErr) { console.log("Referral credit error:", refErr); }
  return "Store verified!";
}

export async function rejectStore(storeId) {
  await updateDoc(doc(db, "stores", storeId), { verificationStatus: "rejected" });
  return "Store rejected.";
}
