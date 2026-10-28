import type { Category, CheckResult, CheckStatus } from "../types/audit";

const severityRank: Record<CheckStatus, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
  UNAVAILABLE: 3,
  NOT_APPLICABLE: 4,
  PASS: 5,
};

export type CheckSort = "severity" | "title";

export function selectChecks(
  checks: readonly CheckResult[],
  options: {
    status?: CheckStatus | "all";
    category?: Category | "all";
    query?: string;
    sort?: CheckSort;
  } = {},
): CheckResult[] {
  const status = options.status ?? "all";
  const category = options.category ?? "all";
  const query = (options.query ?? "").trim().toLowerCase();
  const sort = options.sort ?? "severity";
  const visible = checks.filter((check) => {
    if (status !== "all" && check.status !== status) return false;
    if (category !== "all" && check.category !== category) return false;
    if (!query) return true;
    const haystack =
      `${check.title} ${check.description} ${check.id} ${check.recommendation ?? ""}`.toLowerCase();
    return haystack.includes(query);
  });
  return visible.sort((left, right) => {
    if (sort === "title")
      return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    return (
      severityRank[left.status] - severityRank[right.status] ||
      left.title.localeCompare(right.title) ||
      left.id.localeCompare(right.id)
    );
  });
}
