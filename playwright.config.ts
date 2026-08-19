import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: { baseURL, viewport: { width: 1440, height: 900 } },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
