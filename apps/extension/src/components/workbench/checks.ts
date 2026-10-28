import type { CheckResult, CheckStatus } from "../../types/audit";
import type { MessageKey } from "../../locales/en";
import type { Tone } from "./context";

export function checkTone(status: CheckStatus): Tone {
  if (status === "ERROR") return "err";
  if (status === "WARNING") return "warn";
  if (status === "PASS") return "good";
  return "gray";
}

export function badgeTone(status: CheckStatus): "ok" | "warn" | "err" | "gray" {
  if (status === "ERROR") return "err";
  if (status === "WARNING") return "warn";
  if (status === "PASS") return "ok";
  return "gray";
}

export const statusKey: Record<CheckStatus, MessageKey> = {
  ERROR: "status.error",
  WARNING: "status.warning",
  PASS: "status.pass",
  INFO: "status.info",
  UNAVAILABLE: "status.unavailable",
  NOT_APPLICABLE: "status.notApplicable",
};

const limitationKeys: Record<string, MessageKey> = {
  TEXT_TRUNCATED: "wb.limit.text",
  HEADINGS_TRUNCATED: "wb.limit.headings",
  LINKS_TRUNCATED: "wb.limit.links",
  IMAGES_TRUNCATED: "wb.limit.images",
  META_TRUNCATED: "wb.limit.meta",
  STRUCTURED_DATA_TRUNCATED: "wb.limit.structured",
};

/** Source limitations mix sentences and codes; codes get a readable line. */
export function limitationText(item: string, t: (key: MessageKey) => string): string {
  if (!/^[A-Z_]+$/.test(item)) return item;
  return t(limitationKeys[item] ?? "wb.limit.other");
}

export function actionable(checks: readonly CheckResult[]): CheckResult[] {
  return checks.filter((check) => check.status === "ERROR" || check.status === "WARNING");
}
