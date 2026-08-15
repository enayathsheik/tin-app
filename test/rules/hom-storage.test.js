// HOM order attachments + catalog photos — storage rules proof (Block 2 +
// Block 3). Public/unauthenticated create-time upload of order attachments
// (type/size-limited, admin-only read); admin/hom_admin-only upload of
// catalog photos (public read). The catalog-photo path's isHomManager()
// check reads Firestore data (a `role` field) from within Storage rules via
// firestore.get() — this test environment runs BOTH emulators together so
// that cross-service call actually resolves. Run against the Storage +
// Firestore emulators — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getBytes } from "firebase/storage";

// MUST be the real project id (matches .firebaserc), NOT an arbitrary test
// id like every other rules test file in this repo uses — confirmed
// empirically that the Storage emulator's cross-service firestore.get()
// calls (see storage.rules' isHomManager()) resolve against the CLI's
// actual configured project, regardless of what projectId this test
// environment itself was initialized with. An arbitrary id here makes
// every hom_admin-role check silently evaluate against a Firestore project
// with no seeded data at all.
const PROJECT_ID = "trade-intelligence-netwo-97997";
const ADMIN_EMAIL = "enayathsheik@gmail.com";

let testEnv;

const smallImage = () => new Uint8Array(1024).fill(7);
// Just over the 15MB cap in storage.rules' hom/orders create rule.
const oversized = () => new Uint8Array(15 * 1024 * 1024 + 1);
// Just over the 5MB cap in storage.rules' hom/catalog create rule.
const oversizedCatalogPhoto = () => new Uint8Array(5 * 1024 * 1024 + 1);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
  });

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users", "homAdminUid"), { role: "hom_admin", name: "HOM Admin" });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("HOM order attachments — storage rules", () => {
  it("1. public upload of an accepted image under the size limit succeeds", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "hom/orders/order1/photo.jpg"), smallImage(), { contentType: "image/jpeg" })
    );
  });

  it("2. public upload of an accepted PDF under the size limit succeeds", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(
      uploadBytes(ref(storage, "hom/orders/order1/drawing.pdf"), smallImage(), { contentType: "application/pdf" })
    );
  });

  it("3. public upload of an unsupported content type is denied", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, "hom/orders/order1/file.exe"), smallImage(), { contentType: "application/x-msdownload" })
    );
  });

  it("4. public upload over the 15MB size limit is denied", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(storage, "hom/orders/order1/big.jpg"), oversized(), { contentType: "image/jpeg" })
    );
  });

  it("5. an unauthenticated user cannot read an uploaded attachment", async () => {
    const adminStorage = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).storage();
    await uploadBytes(ref(adminStorage, "hom/orders/order2/seed.jpg"), smallImage(), { contentType: "image/jpeg" });
    const publicStorage = testEnv.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(publicStorage, "hom/orders/order2/seed.jpg")));
  });

  it("6. admin can read an uploaded attachment", async () => {
    const adminStorage = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).storage();
    await uploadBytes(ref(adminStorage, "hom/orders/order3/seed.jpg"), smallImage(), { contentType: "image/jpeg" });
    await assertSucceeds(getBytes(ref(adminStorage, "hom/orders/order3/seed.jpg")));
  });

  it("7. a non-admin authenticated user cannot read an uploaded attachment", async () => {
    const userStorage = testEnv.authenticatedContext("someUser", { email: "someone@example.com" }).storage();
    await assertFails(getBytes(ref(userStorage, "hom/orders/order3/seed.jpg")));
  });
});

describe("HOM catalog photos — storage rules (Block 3)", () => {
  it("8. full TIN admin can upload a catalog photo", async () => {
    const adminStorage = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).storage();
    await assertSucceeds(
      uploadBytes(ref(adminStorage, "hom/catalog/profiles/item1/photo.jpg"), smallImage(), { contentType: "image/jpeg" })
    );
  });

  it("9. hom_admin (role-based, NOT the master email) can upload a catalog photo", async () => {
    const homAdminStorage = testEnv.authenticatedContext("homAdminUid", { email: "hom-admin-not-master@example.com" }).storage();
    await assertSucceeds(
      uploadBytes(ref(homAdminStorage, "hom/catalog/colours/item2/photo.jpg"), smallImage(), { contentType: "image/jpeg" })
    );
  });

  it("10. an unauthenticated user cannot upload a catalog photo", async () => {
    const publicStorage = testEnv.unauthenticatedContext().storage();
    await assertFails(
      uploadBytes(ref(publicStorage, "hom/catalog/profiles/item3/photo.jpg"), smallImage(), { contentType: "image/jpeg" })
    );
  });

  it("11. a plain authenticated user (no hom_admin role, not master admin) cannot upload a catalog photo", async () => {
    const plainStorage = testEnv.authenticatedContext("plainUid", { email: "plain@example.com" }).storage();
    await assertFails(
      uploadBytes(ref(plainStorage, "hom/catalog/profiles/item4/photo.jpg"), smallImage(), { contentType: "image/jpeg" })
    );
  });

  it("12. a catalog photo over the 5MB limit is denied even for hom_admin", async () => {
    const homAdminStorage = testEnv.authenticatedContext("homAdminUid", { email: "hom-admin-not-master@example.com" }).storage();
    await assertFails(
      uploadBytes(ref(homAdminStorage, "hom/catalog/profiles/item5/big.jpg"), oversizedCatalogPhoto(), { contentType: "image/jpeg" })
    );
  });

  it("13. a non-image catalog photo is denied even for hom_admin", async () => {
    const homAdminStorage = testEnv.authenticatedContext("homAdminUid", { email: "hom-admin-not-master@example.com" }).storage();
    await assertFails(
      uploadBytes(ref(homAdminStorage, "hom/catalog/profiles/item6/file.pdf"), smallImage(), { contentType: "application/pdf" })
    );
  });

  it("14. anyone (unauthenticated) can read a catalog photo — the microsite has no auth", async () => {
    const publicStorage = testEnv.unauthenticatedContext().storage();
    await assertSucceeds(getBytes(ref(publicStorage, "hom/catalog/profiles/item1/photo.jpg")));
  });

  // hom/catalog/{itemType}/{itemId}/{fileName} — itemType is a bare
  // wildcard segment, so it already covers brands/hingeCategories/
  // hingeBrands/handleless (added to the admin Catalogue UI) with no rule
  // change; proven directly here rather than just asserted in a comment.
  it("15. hom_admin can upload a photo under each new admin-editable item type (brands/hingeCategories/hingeBrands/handleless)", async () => {
    const homAdminStorage = testEnv.authenticatedContext("homAdminUid", { email: "hom-admin-not-master@example.com" }).storage();
    for (const itemType of ["brands", "hingeCategories", "hingeBrands", "handleless"]) {
      await assertSucceeds(
        uploadBytes(ref(homAdminStorage, `hom/catalog/${itemType}/item1/photo.jpg`), smallImage(), { contentType: "image/jpeg" })
      );
    }
  });
});
