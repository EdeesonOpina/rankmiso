import { browser } from "wxt/browser";

type SidebarApi = {
  sidePanel?: {
    open?: (details: { tabId?: number }) => Promise<void>;
    close?: (details: { tabId?: number; windowId?: number }) => Promise<void>;
  };
  sidebarAction?: {
    open?: () => Promise<void>;
    toggle?: () => Promise<void>;
    close?: () => Promise<void>;
  };
};

function sidebarApi(): SidebarApi {
  return browser as typeof browser & SidebarApi;
}

export function sidebarAvailable(): boolean {
  const api = sidebarApi();
  return Boolean(api.sidePanel?.open || api.sidebarAction?.open || api.sidebarAction?.toggle);
}

export async function openSidebar(tabId?: number): Promise<void> {
  const api = sidebarApi();
  if (api.sidePanel?.open) {
    await api.sidePanel.open(tabId == null ? {} : { tabId });
    return;
  }
  if (api.sidebarAction?.open) {
    await api.sidebarAction.open();
    return;
  }
  await api.sidebarAction?.toggle?.();
}

export async function closeSidebar(tabId: number, windowId?: number): Promise<void> {
  const api = sidebarApi();
  if (api.sidePanel?.close) {
    if (windowId == null) {
      throw new Error("The originating browser window is unavailable.");
    }
    await api.sidePanel.close({ windowId });
    return;
  }
  if (api.sidebarAction?.close) {
    await api.sidebarAction.close();
    return;
  }
  throw new Error("The browser does not support closing this extension sidebar.");
}

export async function openReportFromSidebar(
  tabId: number,
  windowId: number | undefined,
  section: string,
): Promise<boolean> {
  const opening = browser.tabs.create({
    url: browser.runtime.getURL(
      `/dashboard.html?tabId=${tabId.toString()}&section=${encodeURIComponent(section)}`,
    ),
  });
  const closing = closeSidebar(tabId, windowId);
  const [opened, closed] = await Promise.allSettled([opening, closing]);
  if (opened.status === "rejected") throw opened.reason;
  return closed.status === "fulfilled";
}
