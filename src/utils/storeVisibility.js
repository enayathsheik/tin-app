// L2 (launch): Google-imported stores that nobody has verified or claimed are
// hidden from every public list, search, sitemap and prerender, and their
// /store/:id page shows "not available" (noindex).
//
// A store is PUBLIC when any of these holds:
//  - it was not bulk-imported (source !== "bulk_upload"), or
//  - the TIN admin verified it (verificationStatus === "verified"), or
//  - a business claimed it and the admin approved the claim (claimedByUid), or
//  - it is linked to an account (users/{uid}.storeId — the caller passes
//    `linked: true` when it knows; the client can't read users/*, so the
//    store page also treats "has live jobs" as linked, since only an
//    admin-linked account can attach a storeId to a job — see firestore.rules).
//
// Shared by src/pages/StoreProfilePage.jsx and scripts/{prerender,generate-sitemap}.js.
export const isImportedStore = (store) => store?.source === "bulk_upload";

export function isStorePublic(store, { linked = false } = {}) {
  if (!store) return false;
  if (linked) return true;
  if (store.verificationStatus === "verified") return true;
  if (store.claimedByUid) return true;
  return !isImportedStore(store);
}
