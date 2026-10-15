import { messages, type MessageKey } from "../locales/en";

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("en-US", { maximumFractionDigits: 20 });
}

export function translate(key: MessageKey, vars?: Record<string, string | number>): string {
  const template: string = messages[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = vars[name];
    if (typeof value === "number") return formatNumber(value);
    return String(value ?? "");
  });
}

export function useI18n() {
  return { t: translate, n: formatNumber };
}
