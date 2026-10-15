import { escapeHtml } from "./csv";

export interface HtmlReportInput {
  title: string;
  url: string;
  analyzedAt: string;
  version: string;
  rulesetVersion: string;
  score: string;
  disclaimer: string;
  rows: Array<{ status: string; title: string; description: string; evidence: string }>;
}

export function renderHtmlReport(input: HtmlReportInput): string {
  const rows = input.rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.status)}</td>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.evidence)}</td>
      </tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { font-family: sans-serif; margin: 24px; color: #1c1917; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d6d3d1; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #f5f5f4; }
    p.note { color: #57534e; }
  </style>
</head>
<body>
  <h1>${escapeHtml(input.title)}</h1>
  <p>${escapeHtml(input.url)}</p>
  <p>Analyzed ${escapeHtml(input.analyzedAt)}. Extension ${escapeHtml(input.version)}. Rules ${escapeHtml(input.rulesetVersion)}.</p>
  <p>Score: ${escapeHtml(input.score)}</p>
  <p class="note">${escapeHtml(input.disclaimer)}</p>
  <table>
    <caption>Check results</caption>
    <thead><tr><th>Status</th><th>Check</th><th>What this means</th><th>Evidence</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
