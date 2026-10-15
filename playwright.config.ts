import { defineConfig, devices } from "@playwright/test";

// R01 E2E matrix: responsive widths, RTL/LTR locales, themes, accessibility,
// offline resilience, and whole-frame startup. The web server is the only
// required service — the shell is fully functional with the api unreachable,
// so no backend is started for E2E (client resilience rule, contracts/api.md).

const commonUse = {
  baseURL: "http://localhost:5174",
  trace: "on-first-retry",
  screenshot: "only-on-failure",
  // Emulated offline must not be blocked by service workers (none in R01).
  bypassCSP: true,
} as const;

// On Windows the Playwright CDN is blocked, so chromium-based projects use a
// system-installed Chrome. `channel` is chromium-only, so it is applied to the
// chromium projects, never to the firefox/webkit projects.
const isWin32 = process.platform === "win32";
const chromeChannel = isWin32 ? { channel: "chrome" } : {};
const chromiumUse = { ...chromeChannel } as const;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : "50%",
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: commonUse,
  projects: [
    // Desktop-class primary project (current Chromium) — runs the full suite.
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        ...chromiumUse,
      },
      testMatch: /.*\.spec\.ts/,
    },
    // Cross-browser smoke spec on Firefox and WebKit (NFR-004).
    {
      name: "desktop-firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } },
      testMatch: /browser-support\.spec\.ts/,
    },
    {
      name: "desktop-webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
      testMatch: /browser-support\.spec\.ts/,
    },
    // Mobile-class browser target (chromium → uses system Chrome on Windows).
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], viewport: { width: 360, height: 800 }, ...chromiumUse },
      testMatch: /browser-support\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: "node ./node_modules/vite/bin/vite.js --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // Production preview (built in global-setup) used by the NFR-002
      // 3G-class mobile load validation.
      command: "node ./node_modules/vite/bin/vite.js preview --port 5175 --strictPort",
      url: "http://localhost:5175",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
