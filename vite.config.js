import process from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Guard for the local-dev emulator switch in src/firebase/config.js: a
  // production build must never be made with VITE_USE_EMULATORS turned on
  // (from the shell or any .env file). Fail the build instead of shipping it.
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && (env.VITE_USE_EMULATORS === "true" || process.env.VITE_USE_EMULATORS === "true")) {
    throw new Error("VITE_USE_EMULATORS=true is set — refusing to build. Unset it; it is for the local dev server only.");
  }
  return {
    plugins: [react()],
  };
})
