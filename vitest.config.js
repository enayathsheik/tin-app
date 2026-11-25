import { defineConfig } from "vitest/config";

// Scoped to test/rules + test/unit only — packages/ai-foundation has its own
// vitest.config.js (globals: true) and is run separately; keeping this
// config narrow avoids the two suites colliding when run from repo root.
// test/unit is pure functions (no Firestore) but runs fine alongside the
// emulator-backed test/rules suite — it just never touches the emulator.
export default defineConfig({
  test: {
    include: ["test/rules/**/*.test.js", "test/unit/**/*.test.js"],
    hookTimeout: 60000, // first file to run waits for a cold emulator
    testTimeout: 20000, // tests with many requests, on a cold emulator
  },
});
