export const themeConfig = {
  defaultPreference: "light",
  preferences: ["system", "light", "dark"],
  popupWidth: "420px",
  popupMinHeight: "560px",
  sidebarWidth: "232px",
} as const;

export type ThemePreference = "system" | "light" | "dark";
