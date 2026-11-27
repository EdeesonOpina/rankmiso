import { analyze_rendering } from "../wasm/pkg/seo_wasm.js";
import type { CheckResult } from "../types/audit";
import { ensureEngine } from "./engine";
import type { RenderSignals } from "./html-signals";

/** Why the initial HTML is missing. Matches `HtmlFetch` reasons plus `denied`. */
export type SourceUnavailable =
  | "denied"
  | "blocked"
  | "redirect"
  | "type"
  | "size"
  | "timeout"
  | "status"
  | "network"
  | "aborted";

export interface RenderingReport {
  schemaVersion: number;
  sourceOrigin: "fetch" | "file";
  findings: CheckResult[];
}

export async function analyzeRendering(
  pageUrl: string,
  rendered: RenderSignals,
  source:
    | { origin: "fetch" | "file"; signals: RenderSignals }
    | { origin: "fetch"; unavailable: SourceUnavailable },
): Promise<RenderingReport> {
  await ensureEngine();
  const json = analyze_rendering(JSON.stringify({ schemaVersion: 1, pageUrl, source, rendered }));
  return JSON.parse(json) as RenderingReport;
}
