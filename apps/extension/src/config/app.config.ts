export const APP_VERSION = "0.1.1";

export const appConfig = {
  version: APP_VERSION,
  snapshotSchemaVersion: 1,
  auditSchemaVersion: 1,
  rulesetVersion: "1.0.0",
  storagePrefix: "seoToolkit",
  themeKey: "seoToolkit.theme",
  pageSpeedKey: "rankmiso.pageSpeedApiKey",
  maxStoredReports: 20,
} as const;
