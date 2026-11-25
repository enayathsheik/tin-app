// Create a TIN account (B1). Same pieces as the old register form: Firebase
// email/password (a mobile number becomes an internal email, utils/phoneAuth),
// a tinit handle, and users/{uid}. The handle is picked automatically; it can
// be changed later in Account.
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, saveUserProfile } from "../firebase/config";
import { CATEGORY_TREE } from "../data/constants";
import { claimHandle, findAvailableHandle, suggestHandleBase } from "../utils/handles";
import { signupIdentity, signupProfile } from "../utils/signup.js";

export const PRODUCT_CATEGORIES = Object.keys(CATEGORY_TREE); // TIN's 22

export async function createAccount(kind, form) {
  const { authEmail } = signupIdentity(form);
  // A retry after the account was made but its profile wasn't saved.
  const uid = auth.currentUser?.email === authEmail
    ? auth.currentUser.uid
    : (await createUserWithEmailAndPassword(auth, authEmail, form.password.trim())).user.uid;
  const profile = signupProfile(kind, form, uid, PRODUCT_CATEGORIES);
  await saveUserProfile(uid, profile);
  try {
    const handle = await findAvailableHandle(suggestHandleBase(profile.name));
    await claimHandle(uid, handle, { role: profile.role, displayName: profile.name, city: "", photoUrl: null });
    await saveUserProfile(uid, { handle });
    profile.handle = handle;
  } catch (e) {
    console.error("[signup] handle not claimed:", e); // not needed to use TIN
  }
  return profile;
}
