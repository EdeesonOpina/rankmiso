import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
  },
});
