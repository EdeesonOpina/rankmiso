export interface PermissionDefinition {
  name: string;
  required: boolean;
  purposeKey: string;
  browsers: Array<"chromium" | "firefox">;
}

export const permissionsConfig = {
  required: [
    {
      name: "storage",
      required: true,
      purposeKey: "permissions.storage",
      browsers: ["chromium", "firefox"],
    },
    {
      name: "activeTab",
      required: true,
      purposeKey: "permissions.activeTab",
      browsers: ["chromium", "firefox"],
    },
    {
      name: "scripting",
      required: true,
      purposeKey: "permissions.scripting",
      browsers: ["chromium", "firefox"],
    },
  ] satisfies PermissionDefinition[],
  optional: [
    {
      name: "sidePanel",
      required: false,
      purposeKey: "permissions.sidePanel",
      browsers: ["chromium"],
    },
  ] satisfies PermissionDefinition[],
  optionalHosts: ["http://*/*", "https://*/*"],
} as const;
