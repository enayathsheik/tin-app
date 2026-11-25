import { defineConfig } from "vitest/config";

// Cloud Function tests against the emulators (auth + firestore + functions + storage),
// run by `npm run test:functions` under the demo-tin-test project, which
// can't reach any real Firebase project. Kept separate from test:rules so
// the rules suite doesn't need the functions emulator.
export default defineConfig({
  test: {
    include: ["test/functions/**/*.test.js"],
    testTimeout: 60000,
    fileParallelism: false, // the files share one emulator database
  },
});
