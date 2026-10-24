import { computed, onScopeDispose, ref } from "vue";
import { browser } from "wxt/browser";
import { analyzeSnapshot } from "../services/engine";
import {
  activeTab,
  friendlyInspectionError,
  inspectTab,
  readGeneration,
  tabById,
  type InspectedTab,
} from "../services/inspect";
import {
  isGestureError,
  isHostPermissionError,
  nextAccessRequest,
  webOrigin,
} from "../services/page-access";
import { isBlockedProbeHost, probeSite } from "../services/site-probe";
import type { AuditResult, PageSnapshot } from "../types/audit";
import { formatNumber, translate } from "./useI18n";

export function useAudit(explicitTabId?: number) {
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");
  const error = ref("");
  const audit = ref<AuditResult | null>(null);
  const snapshot = ref<PageSnapshot | null>(null);
  const tab = ref<InspectedTab | null>(null);
  const stale = ref(false);
  const analyzedGeneration = ref(0);
  const probing = ref(false);
  const probeMessage = ref("");

  const scoreText = computed(() => {
    if (!audit.value?.score.available || audit.value.score.value == null) return "–";
    return formatNumber(audit.value.score.value);
  });

  async function refresh() {
    status.value = "loading";
    error.value = "";
    probeMessage.value = "";
    stale.value = false;
    try {
      let current = explicitTabId ? await tabById(explicitTabId) : await activeTab();
      if (!current?.id) throw new Error("No active tab is available.");
      const prepared = await prepareTabAccess(current, snapshot.value?.url);
      current = prepared.tab;
      tab.value = current;
      if (prepared.again) {
        status.value = "error";
        error.value = translate("state.refreshAgain", { site: prepared.site });
        stale.value = true;
        return;
      }
      const page = await readPage(current);
      snapshot.value = page;
      audit.value = await analyzeSnapshot(page);
      analyzedGeneration.value = page.collection.domGeneration;
      status.value = "ready";
    } catch (caught) {
      status.value = "error";
      error.value = friendlyInspectionError(caught);
      stale.value = true;
    }
  }

  async function prepareTabAccess(
    current: InspectedTab,
    previousUrl: string | undefined,
  ): Promise<{ tab: InspectedTab; again: boolean; site: string }> {
    let tab = await withUrl(current);
    let askedForTabs = false;
    let request = await requestFor(tab.url, previousUrl);
    if (request.type === "tabs") {
      const granted = await browser.permissions.request({ permissions: ["tabs"] });
      if (!granted) throw new Error(translate("state.refreshDenied"));
      askedForTabs = true;
      tab = await withUrl(tab);
      request = await requestFor(tab.url, previousUrl);
    }
    if (request.type === "origin") {
      const allowed = await requestOrigin(request.origin);
      if (allowed === "again" || (allowed === "denied" && askedForTabs)) {
        return { tab, again: true, site: new URL(request.origin).host };
      }
      if (allowed === "denied") throw new Error(translate("state.refreshDenied"));
    }
    return { tab, again: false, site: "" };
  }

  async function requestFor(visibleUrl: string | undefined, previousUrl: string | undefined) {
    const origin = webOrigin(visibleUrl);
    const originPermission = origin
      ? await browser.permissions.contains({ origins: [`${origin}/*`] })
      : false;
    const tabsPermission = await browser.permissions.contains({ permissions: ["tabs"] });
    return nextAccessRequest({ visibleUrl, previousUrl, tabsPermission, originPermission });
  }

  async function requestOrigin(origin: string): Promise<"ok" | "denied" | "again"> {
    try {
      const granted = await browser.permissions.request({ origins: [`${origin}/*`] });
      return granted ? "ok" : "denied";
    } catch (caught) {
      if (isGestureError(caught)) return "again";
      throw caught;
    }
  }

  async function withUrl(current: InspectedTab): Promise<InspectedTab> {
    if (current.url) return current;
    return tabById(current.id);
  }

  async function readPage(current: InspectedTab) {
    try {
      return await inspectTab(current.id);
    } catch (caught) {
      const origin = webOrigin(current.url);
      if (!origin || !isHostPermissionError(caught)) throw caught;
      const allowed = await requestOrigin(origin);
      if (allowed === "again") {
        throw new Error(translate("state.refreshAgain", { site: new URL(origin).host }));
      }
      if (allowed !== "ok") throw new Error(translate("state.refreshDenied"));
      return inspectTab(current.id);
    }
  }

  async function runSiteProbe(continueLinks = false) {
    const page = snapshot.value;
    if (!page || probing.value) return;
    probeMessage.value = "";
    let parsed: URL;
    try {
      parsed = new URL(page.url);
    } catch {
      probeMessage.value = translate("technical.siteUnsupported");
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      probeMessage.value = translate("technical.siteUnsupported");
      return;
    }
    if (isBlockedProbeHost(parsed.hostname)) {
      probeMessage.value = translate("technical.sitePrivate");
      return;
    }
    probing.value = true;
    try {
      const granted = await browser.permissions.request({ origins: [`${parsed.origin}/*`] });
      if (!granted) {
        probeMessage.value = translate("technical.siteDenied");
        return;
      }
      const next = await probeSite(page, {
        ...(continueLinks ? { linksOnly: true, linkOffset: page.site?.linksChecked ?? 0 } : {}),
        onLinkProgress: (checked, total) => {
          probeMessage.value = translate(
            continueLinks ? "technical.siteMoreProgress" : "technical.siteProgress",
            { checked, total },
          );
        },
      });
      snapshot.value = next;
      audit.value = await analyzeSnapshot(next);
      probeMessage.value = translate(
        continueLinks ? "technical.siteMoreDone" : "technical.siteDone",
      );
    } catch (caught) {
      probeMessage.value =
        caught instanceof Error && caught.message
          ? caught.message
          : translate("technical.siteFailed");
    } finally {
      probing.value = false;
    }
  }

  async function checkFreshness() {
    if (!tab.value?.id || !audit.value) return;
    try {
      const current = await readGeneration(tab.value.id);
      stale.value =
        current.url !== audit.value.page.url || current.generation !== analyzedGeneration.value;
    } catch {
      stale.value = true;
    }
  }

  const onUpdated = (updatedTabId: number, info: { status?: string; url?: string }) => {
    if (!audit.value || updatedTabId !== tab.value?.id) return;
    if (info.url && info.url !== audit.value.page.url) stale.value = true;
    if (info.status === "loading") stale.value = true;
  };
  const onActivated = (info: { tabId: number }) => {
    if (explicitTabId || !audit.value || !tab.value?.id) return;
    if (info.tabId !== tab.value.id) stale.value = true;
  };
  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onActivated.addListener(onActivated);
  onScopeDispose(() => {
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onActivated.removeListener(onActivated);
  });

  return {
    status,
    error,
    audit,
    snapshot,
    tab,
    stale,
    scoreText,
    probing,
    probeMessage,
    refresh,
    runSiteProbe,
    checkFreshness,
  };
}
