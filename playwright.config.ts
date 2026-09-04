import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    // Every spec starts on the fictional club. Belstone is real people and
    // real results; nothing a test writes may land on it. A spec that wants
    // Belstone sets the cookie itself.
    storageState: {
      cookies: [
        { name: "it.club", value: "kilburn-athletic", domain: new URL(baseURL).hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" },
      ],
      origins: [],
    },
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "npm run dev -- -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
