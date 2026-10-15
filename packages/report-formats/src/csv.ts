const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return `${lines.join("\n")}\n`;
}

export function safeFilename(input: string, extension: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${cleaned || "seo-report"}.${extension.replace(/^\./, "")}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
