import { defineConfig } from "@playwright/test";

/** The service worker on its own: public/ served statically, no app, no database. */
export default defineConfig({
  testDir: "tests/sw",
  timeout: 30_000,
  // PW_CHROMIUM: a preinstalled Chromium when the pinned one is not downloaded (CI images, cloud sessions)
  use: { baseURL: "http://localhost:3101", launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {} },
  webServer: { command: "node scripts/serve-public.mjs", url: "http://localhost:3101", reuseExistingServer: true, timeout: 20_000 },
});
