import { defineConfig } from "vitest/config";

// Scoped to test/rules only — packages/ai-foundation has its own
// vitest.config.js (globals: true) and is run separately; keeping this
// config narrow avoids the two suites colliding when run from repo root.
export default defineConfig({
  test: {
    include: ["test/rules/**/*.test.js"],
  },
});
