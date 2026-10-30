import { browser } from "wxt/browser";
import { runPageTool } from "../extraction/page-tool";
import { collectMarkup } from "./structured-markup";
import type { PageSnapshot } from "../types/audit";

export interface InspectedTab {
  id: number;
  windowId?: number;
  url?: string;
  title?: string;
  status?: string;
}

export interface InpCaptureSnapshot {
  supported: boolean;
  active: boolean;
  interactions: Array<[number, number]>;
}

function inspected(tab: {
  id?: number;
  windowId?: number;
  url?: string;
  title?: string;
  status?: string;
}): InspectedTab | null {
  if (!tab.id) return null;
  return { id: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title, status: tab.status };
}

export async function activeTab(): Promise<InspectedTab | null> {
  const focused = await browser.windows
    .getLastFocused({ populate: true, windowTypes: ["normal"] })
    .catch(() => null);
  const current = focused?.tabs?.find((tab) => tab.active);
  const found = current ? inspected(current) : null;
  if (found) return found;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab ? inspected(tab) : null;
}

export async function tabById(tabId: number): Promise<InspectedTab> {
  const tab = await browser.tabs.get(tabId);
  return inspected(tab) ?? { id: tabId };
}

export async function inspectTab(tabId: number): Promise<PageSnapshot> {
  await browser.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: runPageTool,
      args: ["marker"],
    })
    .catch(() => undefined);
  await browser.scripting
    .executeScript({
      target: { tabId },
      world: "ISOLATED",
      func: listenForRouteChanges,
    })
    .catch(() => undefined);
  const [captureResult] = await browser.scripting
    .executeScript({
      target: { tabId },
      world: "MAIN",
      func: runPageTool,
      args: ["readInpCapture"],
    })
    .catch(() => []);
  const capture = captureResult?.result as InpCaptureSnapshot | undefined;
  const [extracted] = await browser.scripting.executeScript({
    target: { tabId },
    func: runPageTool,
    args: ["extract", capture ? JSON.stringify(capture) : ""],
  });
  if (!extracted?.result || typeof extracted.result !== "object") {
    throw new Error("The page did not return an SEO snapshot.");
  }
  const snapshot = extracted.result as PageSnapshot;
  const [markup] = await browser.scripting
    .executeScript({
      target: { tabId },
      func: collectMarkup,
    })
    .catch(() => []);
  const extra = markup?.result;
  if (Array.isArray(extra)) {
    const blocks = snapshot.structuredData ?? [];
    snapshot.structuredData = [...blocks, ...extra].slice(0, 40);
    snapshot.collection.limitations = (snapshot.collection?.limitations ?? []).filter(
      (item) => item !== "Microdata and RDFa were not extracted.",
    );
  }
  return snapshot;
}

function listenForRouteChanges() {
  const page = window as Window & { __rankmisoRouteListener?: boolean };
  if (page.__rankmisoRouteListener) return;
  page.__rankmisoRouteListener = true;
  document.addEventListener("rankmiso:route-change", () => {
    const extension = globalThis as typeof globalThis & {
      browser?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } };
      chrome?: { runtime?: { sendMessage?: (message: unknown) => Promise<unknown> } };
    };
    const sendMessage =
      extension.browser?.runtime?.sendMessage ?? extension.chrome?.runtime?.sendMessage;
    void sendMessage?.({ type: "rankmiso:route-change" }).catch(() => undefined);
  });
}

export async function readInpCapture(tabId: number): Promise<InpCaptureSnapshot> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: runPageTool,
    args: ["readInpCapture"],
  });
  return result?.result as InpCaptureSnapshot;
}

export async function startInpCapture(tabId: number): Promise<InpCaptureSnapshot> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: runPageTool,
    args: ["startInpCapture"],
  });
  return result?.result as InpCaptureSnapshot;
}

export async function stopInpCapture(tabId: number): Promise<InpCaptureSnapshot> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: runPageTool,
    args: ["stopInpCapture"],
  });
  return result?.result as InpCaptureSnapshot;
}

export async function readGeneration(tabId: number): Promise<{ url: string; generation: number }> {
  const [result] = await browser.scripting.executeScript({
    target: { tabId },
    func: runPageTool,
    args: ["generation"],
  });
  const value = result?.result as { url?: string; generation?: number } | undefined;
  return { url: value?.url || "", generation: value?.generation || 0 };
}

export async function highlightElements(tabId: number, kind: string): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: runPageTool,
    args: ["highlight", kind],
  });
}

export async function clearHighlights(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId },
    func: runPageTool,
    args: ["clear"],
  });
}

export function friendlyInspectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /cannot access|restricted|extensions gallery|moz-extension|chrome:|edge:|about:/i.test(message)
  ) {
    return "This page cannot be analyzed. Browser pages, the extension store, and some protected pages block extensions from reading them.";
  }
  if (/receiving end does not exist|could not establish connection/i.test(message)) {
    return "The page was not ready for analysis. Refresh the page and try again.";
  }
  return message || "Analysis failed.";
}
