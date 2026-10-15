export const themeConfig = {
  defaultPreference: "system",
  preferences: ["system", "light", "dark"],
  popupWidth: "380px",
  popupMinHeight: "560px",
  sidebarWidth: "232px",
} as const;

export type ThemePreference = "system" | "light" | "dark";
