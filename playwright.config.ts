import { defineConfig, devices } from "@playwright/test";

const frontendUrl = "http://127.0.0.1:3000";
const backendUrl = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: frontendUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chrome",
      use: {
        ...devices["Desktop Chrome"],
        browserName: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: [
    {
      command: "npm run start:e2e",
      cwd: "../pm-backend",
      url: backendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PORT: "3001" },
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: frontendUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_LEMIGAS_API_URL: backendUrl,
        LEMIGAS_API_URL: backendUrl,
      },
    },
  ],
});
