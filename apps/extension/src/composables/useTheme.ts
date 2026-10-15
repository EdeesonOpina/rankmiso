import { onMounted, onUnmounted, ref } from "vue";
import { readThemePreference, writeThemePreference } from "../adapters/storage";
import { appConfig } from "../config/app.config";
import type { ThemePreference } from "../config/theme.config";

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(appConfig.themeKey);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // localStorage is unavailable in some restricted pages.
  }
  return "system";
}

function resolvedTheme(value: ThemePreference): "light" | "dark" {
  if (value === "system") {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return value;
}

const preference = ref<ThemePreference>(storedPreference());
const resolved = ref<"light" | "dark">(resolvedTheme(preference.value));

function apply(value: ThemePreference) {
  resolved.value = resolvedTheme(value);
  document.documentElement.dataset.theme = resolved.value;
  document.documentElement.dataset.themePreference = value;
}

if (typeof document !== "undefined") apply(preference.value);

export function useTheme() {
  let media: MediaQueryList | null = null;
  const onChange = () => {
    if (preference.value === "system") apply("system");
  };

  onMounted(async () => {
    preference.value = await readThemePreference();
    apply(preference.value);
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", onChange);
  });

  onUnmounted(() => media?.removeEventListener("change", onChange));

  async function setPreference(value: ThemePreference) {
    preference.value = value;
    apply(value);
    await writeThemePreference(value);
  }

  return { preference, resolved, setPreference };
}
