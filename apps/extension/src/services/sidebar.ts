import { browser } from "wxt/browser";

type SidebarApi = {
  sidePanel?: { open?: (details: { tabId?: number }) => Promise<void> };
  sidebarAction?: { open?: () => Promise<void>; toggle?: () => Promise<void> };
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
