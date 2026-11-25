// The TIN super admin: the SIGNED-IN Firebase account's email, the same check
// firestore.rules isAdmin() and storage.rules isTinAdmin() make. Deliberately
// not `user.role`: that's a field users can write on their own account.
import { auth } from "../firebase/config";

export const SUPER_ADMIN_EMAIL = "enayathsheik@gmail.com";
export const isSuperAdmin = () => (auth.currentUser?.email || "") === SUPER_ADMIN_EMAIL;
// The signed-in account id, recorded on admin actions.
export const adminUid = () => auth.currentUser?.uid || "admin";
