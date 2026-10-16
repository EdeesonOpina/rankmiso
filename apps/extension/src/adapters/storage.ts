import { browser } from "wxt/browser";
import { appConfig } from "../config/app.config";
import { themeConfig, type ThemePreference } from "../config/theme.config";

const allowed: ThemePreference[] = ["system", "light", "dark"];

export async function readThemePreference(): Promise<ThemePreference> {
  try {
    const stored = await browser.storage.local.get(appConfig.themeKey);
    const value = stored[appConfig.themeKey];
    if (typeof value === "string" && allowed.includes(value as ThemePreference)) {
      return value as ThemePreference;
    }
  } catch {
    const fallback = localStorage.getItem(appConfig.themeKey);
    if (fallback === "light" || fallback === "dark" || fallback === "system") return fallback;
  }
  return themeConfig.defaultPreference;
}

export async function writeThemePreference(preference: ThemePreference): Promise<void> {
  localStorage.setItem(appConfig.themeKey, preference);
  try {
    await browser.storage.local.set({ [appConfig.themeKey]: preference });
  } catch {
    // Extension storage is unavailable in unit tests and some restricted pages.
  }
}

export async function clearStoredSettings(): Promise<void> {
  localStorage.removeItem(appConfig.themeKey);
  try {
    await browser.storage.local.clear();
  } catch {
    // Nothing else is stored by this version.
  }
}
