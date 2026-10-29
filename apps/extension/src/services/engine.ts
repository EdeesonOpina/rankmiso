import init, { analyze_page, crawl_permitted } from "../wasm/pkg/seo_wasm.js";
import wasmUrl from "../wasm/pkg/seo_wasm_bg.wasm?url";
import type { AuditResult, PageSnapshot } from "../types/audit";

let ready: Promise<unknown> | null = null;

export function ensureEngine(): Promise<unknown> {
  ready ??= init({ module_or_path: wasmUrl });
  return ready;
}

export async function crawlPermitted(robotsBody: string, path: string): Promise<boolean> {
  await ensureEngine();
  return crawl_permitted(robotsBody, path);
}

export async function analyzeSnapshot(snapshot: PageSnapshot): Promise<AuditResult> {
  await ensureEngine();
  try {
    const json = analyze_page(JSON.stringify(snapshot), "");
    return JSON.parse(json) as AuditResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message || "The analysis engine failed.");
  }
}
