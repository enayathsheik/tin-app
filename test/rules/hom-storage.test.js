// HOM order attachments — storage rules proof (Block 2). Public/unauthenticated
// create-time upload, type/size-limited; admin-only read. Run against the
// Storage emulator only — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes } from "firebase/storage";

const PROJECT_ID = "hom-storage-rules-test";
const ADMIN_EMAIL = "enayathsheik@gmail.com";

let testEnv;

const smallImage = () => new Uint8Array(1024).fill(7);
// Just over the 15MB cap in storage.rules' hom/orders create rule.
const oversized = () => new Uint8Array(15 * 1024 * 1024 + 1);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199,
    },
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
