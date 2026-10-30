import { browser } from "wxt/browser";
import { appConfig } from "../config/app.config";
import { themeConfig, type ThemePreference } from "../config/theme.config";

export type InspectionMode = "automatic" | "individual";

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
  localStorage.removeItem(appConfig.navHintKey);
  localStorage.removeItem(appConfig.siteCrawlKey);
  localStorage.removeItem(appConfig.inspectionModeKey);
  try {
    await browser.storage.local.remove([
      appConfig.themeKey,
      appConfig.pageSpeedKey,
      appConfig.navHintKey,
      appConfig.inspectionModeKey,
    ]);
  } catch {
    // Extension storage is unavailable in unit tests and some restricted pages.
  }
}

export async function readInspectionMode(): Promise<InspectionMode | null> {
  try {
    const stored = await browser.storage.local.get(appConfig.inspectionModeKey);
    const value = stored[appConfig.inspectionModeKey];
    if (value === "automatic" || value === "individual") return value;
  } catch {
    // Extension storage is unavailable in isolated component tests.
  }
  return null;
}

export async function writeInspectionMode(mode: InspectionMode): Promise<void> {
  await browser.storage.local.set({ [appConfig.inspectionModeKey]: mode });
}

export async function readNavHintDismissed(): Promise<boolean> {
  try {
    const stored = await browser.storage.local.get(appConfig.navHintKey);
    if (stored[appConfig.navHintKey] === true) return true;
  } catch {
    // Extension storage is unavailable in unit tests and some restricted pages.
  }
  return localStorage.getItem(appConfig.navHintKey) === "1";
}

export async function dismissNavHint(): Promise<void> {
  localStorage.setItem(appConfig.navHintKey, "1");
  try {
    await browser.storage.local.set({ [appConfig.navHintKey]: true });
  } catch {
    // Extension storage is unavailable in unit tests and some restricted pages.
  }
}

export async function readPageSpeedApiKey(): Promise<string> {
  const stored = await browser.storage.local.get(appConfig.pageSpeedKey);
  const value = stored[appConfig.pageSpeedKey];
  return typeof value === "string" ? value : "";
}

export async function savePageSpeedApiKey(value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) {
    await browser.storage.local.remove(appConfig.pageSpeedKey);
    return;
  }
  await browser.storage.local.set({ [appConfig.pageSpeedKey]: trimmed });
}
