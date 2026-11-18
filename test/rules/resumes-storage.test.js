// CV (resume) privacy — storage rules proof for resumes/{uid}/{fileName}.
// Only the CV's owner and the TIN admin may read or list a candidate's CVs
// through the Storage SDK. Employers open CVs through the download link
// saved on the jobApplications doc (test 7 proves those links keep working,
// since download links carry their own token and bypass these rules).
// Run against the Storage + Firestore emulators — never production:
//   firebase emulators:exec --only firestore,storage "npx vitest run --no-file-parallelism"
import { readFileSync } from "fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { ref, uploadBytes, getBytes, getDownloadURL, listAll } from "firebase/storage";

// Same reasoning as hom-storage.test.js: storage emulator tests use the
// real project id from .firebaserc.
const PROJECT_ID = "trade-intelligence-netwo-97997";
const ADMIN_EMAIL = "enayathsheik@gmail.com";
const CANDIDATE = "candidateUid";
const OTHER = "otherUserUid";
const CV_PATH = `resumes/${CANDIDATE}/1700000000000_cv.pdf`;
const PDF = "application/pdf";

let testEnv;
const smallFile = () => new Uint8Array(1024).fill(7);
const oversized = () => new Uint8Array(5 * 1024 * 1024 + 1);

const candidateStorage = () => testEnv.authenticatedContext(CANDIDATE, { email: "cand@example.com" }).storage();
const otherStorage = () => testEnv.authenticatedContext(OTHER, { email: "other@example.com" }).storage();

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
    storage: { rules: readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: 9199 },
  });
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), CV_PATH), smallFile(), { contentType: PDF });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("resumes/ — storage rules", () => {
  it("1. the candidate can upload their own CV and open it", async () => {
    const storage = candidateStorage();
    const path = `resumes/${CANDIDATE}/1700000000001_new.pdf`;
    await assertSucceeds(uploadBytes(ref(storage, path), smallFile(), { contentType: PDF }));
    await assertSucceeds(getBytes(ref(storage, path)));
    await assertSucceeds(getDownloadURL(ref(storage, path)));
  });

  it("2. another logged-in user can't open someone else's CV", async () => {
    await assertFails(getBytes(ref(otherStorage(), CV_PATH)));
    await assertFails(getDownloadURL(ref(otherStorage(), CV_PATH)));
  });

  it("3. another logged-in user can't list someone else's CV folder", async () => {
    await assertFails(listAll(ref(otherStorage(), `resumes/${CANDIDATE}`)));
  });

  it("4. a logged-out visitor can't open or list CVs", async () => {
    const storage = testEnv.unauthenticatedContext().storage();
    await assertFails(getBytes(ref(storage, CV_PATH)));
    await assertFails(listAll(ref(storage, `resumes/${CANDIDATE}`)));
  });

  it("5. the TIN admin can open a CV", async () => {
    const storage = testEnv.authenticatedContext("adminUid", { email: ADMIN_EMAIL }).storage();
    await assertSucceeds(getBytes(ref(storage, CV_PATH)));
  });

  it("6. upload limits unchanged: no uploading into someone else's folder, oversize or non-PDF/Word", async () => {
    await assertFails(uploadBytes(ref(otherStorage(), `resumes/${CANDIDATE}/x.pdf`), smallFile(), { contentType: PDF }));
    await assertFails(uploadBytes(ref(candidateStorage(), `resumes/${CANDIDATE}/big.pdf`), oversized(), { contentType: PDF }));
    await assertFails(uploadBytes(ref(candidateStorage(), `resumes/${CANDIDATE}/pic.png`), smallFile(), { contentType: "image/png" }));
    await assertFails(uploadBytes(ref(testEnv.unauthenticatedContext().storage(), `resumes/${CANDIDATE}/anon.pdf`), smallFile(), { contentType: PDF }));
    await assertSucceeds(uploadBytes(ref(candidateStorage(), `resumes/${CANDIDATE}/cv.docx`), smallFile(),
      { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  });

  it("7. a saved download link still opens the CV without logging in (existing employers keep access)", async () => {
    // The apply flow saves this link on the jobApplications doc at upload time.
    const url = await getDownloadURL(ref(candidateStorage(), CV_PATH));
    expect(url).toContain("token=");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(1024);
  });
});
