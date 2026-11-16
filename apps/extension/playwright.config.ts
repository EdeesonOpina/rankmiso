import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  outputDir: process.env.RANKMISO_PLAYWRIGHT_OUTPUT_DIR ?? "./test-results",
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
  },
});
