import { computed, onScopeDispose, ref } from "vue";
import { browser } from "wxt/browser";
import { readInspectionMode, writeInspectionMode, type InspectionMode } from "../adapters/storage";
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
  permissionPatternMatchesUrl,
  sitePermission,
  webOrigin,
} from "../services/page-access";
import { isBlockedProbeHost, probeSite } from "../services/site-probe";
import { supportsOptionalExternalChecks } from "../config/features.config";
import { permissionsConfig } from "../config/permissions.config";
import type { AuditResult, PageSnapshot } from "../types/audit";
import { formatNumber, translate } from "./useI18n";

export function useAudit(explicitTabId?: number, followActiveTab = false) {
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");
  const error = ref("");
  const audit = ref<AuditResult | null>(null);
  const snapshot = ref<PageSnapshot | null>(null);
  const tab = ref<InspectedTab | null>(null);
  const stale = ref(false);
  const analyzedGeneration = ref(0);
  const probing = ref(false);
  const probeMessage = ref("");
  const siteAccessState = ref<"required" | "denied" | "error" | null>(null);
  const siteAccessHost = ref("");
  const siteAccessPending = ref(false);
  const inspectionMode = ref<InspectionMode | null>(null);
  const automaticAccessGranted = ref(false);
  const preferenceLoad = (async () => {
    inspectionMode.value = await readInspectionMode();
    automaticAccessGranted.value = await hasAutomaticWebsiteAccess();
  })();
  let requestRevision = 0;
  let permissionAttempt = 0;
  let ownerWindowId: number | undefined;
  const toolbarAuthorizedTabs = new Map<number, string>();
  const cached = new Map<
    number,
    { url: string; generation: number; page: PageSnapshot; result: AuditResult }
  >();
  let automaticRequest: { tabId: number; url?: string; revision: number } | undefined;
  let sidebarActive = !followActiveTab || document.visibilityState !== "hidden";
  let listenersBound = false;

  async function hasAutomaticWebsiteAccess() {
    try {
      return await browser.permissions.contains({ origins: [...permissionsConfig.optionalHosts] });
    } catch {
      return false;
    }
  }

  async function hasIndividualWebsiteAccess(url: string | undefined) {
    const permission = sitePermission(url);
    if (!permission) return false;
    try {
      const granted = await browser.permissions.getAll();
      return (
        granted.origins?.some(
          (pattern) =>
            pattern !== "http://*/*" &&
            pattern !== "https://*/*" &&
            permissionPatternMatchesUrl(pattern, url),
        ) ?? false
      );
    } catch {
      return false;
    }
  }

  async function hasInspectionAccess(url: string | undefined) {
    if (inspectionMode.value === "automatic" && (await hasAutomaticWebsiteAccess())) return true;
    return hasIndividualWebsiteAccess(url);
  }

  async function resolveActiveTab() {
    if (followActiveTab && ownerWindowId != null) {
      const [active] = await browser.tabs.query({ active: true, windowId: ownerWindowId });
      return active?.id ? tabById(active.id) : null;
    }
    return activeTab();
  }

  const scoreText = computed(() => {
    if (!audit.value?.score.available || audit.value.score.value == null) return "–";
    return formatNumber(audit.value.score.value);
  });

  async function refresh(
    options: { automatic?: boolean; targetTabId?: number; forceFresh?: boolean } = {},
  ) {
    const automatic = options.automatic === true;
    if (followActiveTab && !sidebarActive) return;
    if (
      automatic &&
      options.targetTabId != null &&
      automaticRequest?.tabId === options.targetTabId
    ) {
      return;
    }
    const revision = ++requestRevision;
    status.value = "loading";
    error.value = "";
    siteAccessState.value = null;
    siteAccessHost.value = "";
    probeMessage.value = "";
    stale.value = false;
    if (automatic) {
      siteAccessPending.value = false;
      audit.value = null;
      snapshot.value = null;
    }
    try {
      await preferenceLoad;
      let current = options.targetTabId
        ? await tabById(options.targetTabId)
        : explicitTabId
          ? await tabById(explicitTabId)
          : await resolveActiveTab();
      if (!current?.id) throw new Error("No active tab is available.");
      if (followActiveTab && ownerWindowId == null) ownerWindowId = current.windowId;
      if (followActiveTab && ownerWindowId != null && current.windowId !== ownerWindowId) return;
      if (revision !== requestRevision) return;
      if (followActiveTab && current.status === "loading") {
        tab.value = current;
        return;
      }
      tab.value = current;
      if (automatic) automaticRequest = { tabId: current.id, url: current.url, revision };
      if (followActiveTab) {
        const temporary =
          toolbarAuthorizedTabs.has(current.id) &&
          (!current.url || toolbarAuthorizedTabs.get(current.id) === current.url);
        let allowed: boolean;
        try {
          allowed = temporary || (await hasInspectionAccess(current.url));
        } catch {
          showSiteAccess(current, "error");
          error.value = translate("permission.nativeError");
          return;
        }
        if (revision !== requestRevision) return;
        if (!current.url && allowed) {
          current = await withUrl(current);
          tab.value = current;
        }
        const permission = sitePermission(current.url);
        if (!allowed && (permission || !current.url)) {
          showSiteAccess(current, "required");
          return;
        }
        if (!allowed && current.url) {
          status.value = "error";
          error.value = translate("permission.unsupportedPage");
          return;
        }
        if (!permission && !temporary) {
          status.value = "error";
          error.value = translate(
            current.url ? "permission.unsupportedPage" : "permission.addressUnavailable",
          );
          return;
        }
      } else if (!automatic) {
        const prepared = await prepareTabAccess(current, snapshot.value?.url);
        current = prepared.tab;
        if (revision !== requestRevision) return;
        if (prepared.again) {
          tab.value = current;
          status.value = "error";
          error.value = translate("state.refreshAgain", { site: prepared.site });
          stale.value = true;
          return;
        }
      }
      if (automatic && !options.forceFresh) {
        const previous = cached.get(current.id);
        if (previous && previous.url === current.url) {
          try {
            const generation = await readGeneration(current.id);
            if (
              revision === requestRevision &&
              generation.url === previous.url &&
              generation.generation === previous.generation
            ) {
              snapshot.value = previous.page;
              audit.value = previous.result;
              analyzedGeneration.value = previous.generation;
              status.value = "ready";
              return;
            }
          } catch {
            cached.delete(current.id);
          }
        }
      }
      const page = await readPage(current, !followActiveTab && !automatic);
      if (revision !== requestRevision) return;
      const result = await analyzeSnapshot(page);
      if (revision !== requestRevision) return;
      snapshot.value = page;
      audit.value = result;
      analyzedGeneration.value = page.collection.domGeneration;
      if (followActiveTab) {
        cached.delete(current.id);
        cached.set(current.id, {
          url: page.url,
          generation: page.collection.domGeneration,
          page,
          result,
        });
        if (cached.size > 5) cached.delete(cached.keys().next().value!);
      }
      status.value = "ready";
    } catch (caught) {
      if (revision !== requestRevision) return;
      status.value = "error";
      const permission = sitePermission(tab.value?.url);
      if (followActiveTab && isHostPermissionError(caught) && permission) {
        showSiteAccess(tab.value!, "required");
      } else if (followActiveTab && isHostPermissionError(caught)) {
        if (tab.value) showSiteAccess(tab.value, "required");
        else {
          status.value = "error";
          error.value = translate("permission.addressUnavailable");
        }
      } else if (!supportsOptionalExternalChecks && isHostPermissionError(caught)) {
        error.value = translate("state.firefoxToolbarAccess");
      } else {
        error.value = friendlyInspectionError(caught);
      }
      stale.value = false;
    } finally {
      if (automaticRequest?.revision === revision) automaticRequest = undefined;
    }
  }

  function showSiteAccess(current: InspectedTab, state: "required" | "denied" | "error") {
    siteAccessHost.value = sitePermission(current.url)?.hostname ?? "";
    siteAccessState.value = state;
    status.value = "error";
    audit.value = null;
    snapshot.value = null;
    error.value = "";
    stale.value = false;
  }

  async function setInspectionMode(mode: InspectionMode) {
    try {
      await writeInspectionMode(mode);
    } catch {
      error.value = translate("permission.preferenceError");
      status.value = "error";
      return;
    }
    inspectionMode.value = mode;
    if (followActiveTab && sidebarActive) void refresh({ automatic: true });
  }

  function enableAutomaticChecks(): Promise<void> {
    if (automaticAccessGranted.value) return setInspectionMode("automatic");

    const attempt = ++permissionAttempt;
    siteAccessPending.value = true;
    siteAccessState.value = null;
    status.value = "loading";
    error.value = "";

    let requesting: Promise<boolean>;
    try {
      // This request is intentionally the first browser call made by the click handler.
      requesting = browser.permissions.request({ origins: [...permissionsConfig.optionalHosts] });
    } catch (caught) {
      console.warn("[RankMiso] Automatic website permission request failed", caught);
      siteAccessPending.value = false;
      siteAccessState.value = "error";
      status.value = "error";
      error.value = translate("permission.nativeError");
      return Promise.resolve();
    }
    return finishAutomaticAccessRequest(requesting, attempt);
  }

  async function finishAutomaticAccessRequest(requesting: Promise<boolean>, attempt: number) {
    try {
      const granted = await requesting;
      if (attempt !== permissionAttempt) return;
      if (!granted) {
        siteAccessState.value = "denied";
        status.value = "error";
        error.value = translate("permission.autoDenied");
        return;
      }
      automaticAccessGranted.value = await hasAutomaticWebsiteAccess();
      if (!automaticAccessGranted.value) throw new Error("The permission was not retained.");
      await writeInspectionMode("automatic");
      inspectionMode.value = "automatic";
      if (!followActiveTab || !sidebarActive) return;

      const current = await resolveActiveTab();
      if (attempt !== permissionAttempt || !current?.id) return;
      if (ownerWindowId == null) ownerWindowId = current.windowId;
      if (current.windowId !== ownerWindowId) return;
      await refresh({ automatic: true, targetTabId: current.id });
    } catch (caught) {
      console.warn("[RankMiso] Automatic website permission request failed", caught);
      if (attempt === permissionAttempt) {
        siteAccessState.value = "error";
        status.value = "error";
        error.value = translate("permission.nativeError");
      }
    } finally {
      if (attempt === permissionAttempt) siteAccessPending.value = false;
    }
  }

  async function revokeAutomaticAccess(): Promise<boolean> {
    try {
      const removed = await browser.permissions.remove({
        origins: [...permissionsConfig.optionalHosts],
      });
      automaticAccessGranted.value = await hasAutomaticWebsiteAccess();
      if (!removed || automaticAccessGranted.value)
        throw new Error("Website access remains granted.");
      if (followActiveTab && sidebarActive) void refresh({ automatic: true });
      return true;
    } catch (caught) {
      console.warn("[RankMiso] Automatic website permission removal failed", caught);
      error.value = translate("permission.revokeError");
      status.value = "error";
      return false;
    }
  }

  async function prepareTabAccess(
    current: InspectedTab,
    previousUrl: string | undefined,
  ): Promise<{ tab: InspectedTab; again: boolean; site: string }> {
    let tab = await withUrl(current);
    if (!supportsOptionalExternalChecks) return { tab, again: false, site: "" };
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
    const permission = sitePermission(visibleUrl);
    const originPermission = origin
      ? await browser.permissions.contains({ origins: [permission?.pattern ?? `${origin}/*`] })
      : false;
    const tabsPermission = await browser.permissions.contains({ permissions: ["tabs"] });
    return nextAccessRequest({ visibleUrl, previousUrl, tabsPermission, originPermission });
  }

  async function requestOrigin(origin: string): Promise<"ok" | "denied" | "again"> {
    try {
      const permission = sitePermission(origin);
      if (!permission) return "denied";
      const granted = await browser.permissions.request({ origins: [permission.pattern] });
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

  async function readPage(current: InspectedTab, allowPermissionPrompt = true) {
    try {
      return await inspectTab(current.id);
    } catch (caught) {
      const origin = webOrigin(current.url);
      if (
        !allowPermissionPrompt ||
        !supportsOptionalExternalChecks ||
        !origin ||
        !isHostPermissionError(caught)
      ) {
        throw caught;
      }
      const allowed = await requestOrigin(origin);
      if (allowed === "again") {
        throw new Error(translate("state.refreshAgain", { site: new URL(origin).host }));
      }
      if (allowed !== "ok") throw new Error(translate("state.refreshDenied"));
      return inspectTab(current.id);
    }
  }

  function requestSiteAccess(): Promise<void> {
    const current = tab.value;
    const permission = sitePermission(current?.url);
    if (!followActiveTab || !current || !permission) {
      error.value = translate("permission.addressUnavailable");
      status.value = "error";
      return Promise.resolve();
    }

    const revision = requestRevision;
    const attempt = ++permissionAttempt;
    siteAccessPending.value = true;
    siteAccessState.value = null;
    status.value = "loading";
    error.value = "";

    let requesting: Promise<boolean>;
    try {
      requesting = browser.permissions.request({ origins: [permission.pattern] });
    } catch (caught) {
      console.warn("[RankMiso] Individual website permission request failed", caught);
      siteAccessPending.value = false;
      showSiteAccess(current, "error");
      error.value = translate("permission.nativeError");
      return Promise.resolve();
    }

    return finishSiteAccessRequest(requesting, current, permission.pattern, revision, attempt);
  }

  async function finishSiteAccessRequest(
    requesting: Promise<boolean>,
    requestedTab: InspectedTab,
    requestedPattern: string,
    revision: number,
    attempt: number,
  ) {
    try {
      const granted = await requesting;
      if (attempt !== permissionAttempt || revision !== requestRevision) return;
      if (!granted) {
        showSiteAccess(requestedTab, "denied");
        return;
      }

      const windowId = requestedTab.windowId ?? ownerWindowId;
      if (windowId == null) {
        showSiteAccess(requestedTab, "error");
        error.value = translate("permission.contextChanged");
        return;
      }
      const [active] = await browser.tabs.query({ active: true, windowId });
      const latest = await tabById(requestedTab.id);
      if (
        attempt !== permissionAttempt ||
        revision !== requestRevision ||
        active?.id !== requestedTab.id ||
        sitePermission(latest.url)?.pattern !== requestedPattern
      ) {
        return;
      }
      if (!(await browser.permissions.contains({ origins: [requestedPattern] }))) {
        showSiteAccess(requestedTab, "error");
        error.value = translate("permission.requestError");
        return;
      }

      toolbarAuthorizedTabs.set(requestedTab.id, latest.url ?? "");
      if (toolbarAuthorizedTabs.size > 5) {
        toolbarAuthorizedTabs.delete(toolbarAuthorizedTabs.keys().next().value!);
      }
      await refresh({ automatic: true, targetTabId: requestedTab.id });
    } catch {
      if (attempt === permissionAttempt && revision === requestRevision) {
        showSiteAccess(requestedTab, "error");
        error.value = translate("permission.nativeError");
      }
    } finally {
      if (attempt === permissionAttempt) siteAccessPending.value = false;
    }
  }

  function dismissSiteAccess() {
    if (inspectionMode.value == null) {
      inspectionMode.value = "individual";
      void writeInspectionMode("individual").catch(() => undefined);
    }
    siteAccessState.value = null;
    error.value = translate("permission.notNowMessage");
    status.value = "error";
  }

  async function runSiteProbe(continueLinks = false) {
    if (!supportsOptionalExternalChecks) {
      probeMessage.value = translate("technical.firefoxChecksDisabled");
      return;
    }
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
      const permission = sitePermission(page.url);
      if (!permission) {
        probeMessage.value = translate("technical.siteUnsupported");
        return;
      }
      const granted = await browser.permissions.request({ origins: [permission.pattern] });
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

  const onPermissionAdded = async (change: { origins?: string[] }) => {
    if (!change.origins?.length) return;
    automaticAccessGranted.value = await hasAutomaticWebsiteAccess();
    if (!followActiveTab || siteAccessPending.value) return;
    const current = tab.value;
    if (!current || !siteAccessState.value) return;
    if (
      current.url &&
      !change.origins.some((pattern) => permissionPatternMatchesUrl(pattern, current.url)) &&
      !automaticAccessGranted.value
    )
      return;
    const revision = requestRevision;
    try {
      const [active] = await browser.tabs.query({ active: true, windowId: ownerWindowId });
      const allowed = await hasInspectionAccess(current.url);
      if (
        allowed &&
        revision === requestRevision &&
        active?.id === current.id &&
        siteAccessState.value
      ) {
        void refresh({ automatic: true, targetTabId: current.id });
      }
    } catch {
      // The explicit Allow action reports its own error; browser-managed changes can be retried.
    }
  };

  const onPermissionRemoved = (change: { origins?: string[] }) => {
    if (!change.origins?.length) return;
    void hasAutomaticWebsiteAccess().then((granted) => (automaticAccessGranted.value = granted));
    if (!followActiveTab) return;
    const affects = (url: string) =>
      change.origins!.some((pattern) => permissionPatternMatchesUrl(pattern, url));
    for (const [id, item] of cached) {
      if (affects(item.url)) {
        cached.delete(id);
        toolbarAuthorizedTabs.delete(id);
      }
    }
    if (tab.value?.url && affects(tab.value.url)) {
      const current = tab.value;
      requestRevision += 1;
      permissionAttempt += 1;
      automaticRequest = undefined;
      siteAccessPending.value = false;
      audit.value = null;
      snapshot.value = null;
      siteAccessState.value = null;
      error.value = "";
      status.value = "loading";
      void refresh({ automatic: true, targetTabId: current.id });
    }
  };

  const onUpdated = (
    updatedTabId: number,
    info: { status?: string; url?: string },
    updated?: { windowId?: number },
  ) => {
    if (followActiveTab && (info.url || info.status === "loading")) {
      cached.delete(updatedTabId);
      toolbarAuthorizedTabs.delete(updatedTabId);
    }
    if (updatedTabId !== tab.value?.id) return;
    if (!followActiveTab) {
      if (!audit.value) return;
      if (info.url && info.url !== audit.value.page.url) stale.value = true;
      if (info.status === "loading") stale.value = true;
      return;
    }
    if (ownerWindowId != null && updated?.windowId != null && updated.windowId !== ownerWindowId)
      return;
    if (info.url || info.status === "loading") {
      requestRevision += 1;
      automaticRequest = undefined;
      audit.value = null;
      snapshot.value = null;
      stale.value = false;
      error.value = "";
      status.value = "loading";
    }
    if (info.status === "complete" || (info.url && info.status !== "loading")) {
      void refresh({ automatic: true, targetTabId: updatedTabId });
    }
  };
  const onActivated = (info: { tabId: number; windowId: number }) => {
    if (!followActiveTab) return;
    if (ownerWindowId == null) ownerWindowId = info.windowId;
    if (info.windowId !== ownerWindowId) return;
    void refresh({ automatic: true, targetTabId: info.tabId });
  };
  const onRemoved = (removedTabId: number, details?: { windowId?: number }) => {
    cached.delete(removedTabId);
    toolbarAuthorizedTabs.delete(removedTabId);
    if (followActiveTab && removedTabId === tab.value?.id) {
      requestRevision += 1;
      automaticRequest = undefined;
      audit.value = null;
      snapshot.value = null;
      tab.value = null;
      status.value = "idle";
      const windowId = details?.windowId ?? ownerWindowId;
      if (windowId === ownerWindowId && windowId != null) {
        void browser.tabs.query({ active: true, windowId }).then(([current]) => {
          if (current?.id && tab.value?.id !== current.id) {
            void refresh({ automatic: true, targetTabId: current.id });
          }
        });
      }
    }
  };
  const onWindowFocusChanged = async (windowId: number) => {
    if (!followActiveTab || windowId !== ownerWindowId) return;
    const [current] = await browser.tabs.query({ active: true, windowId });
    if (current?.id && current.id !== tab.value?.id) {
      void refresh({ automatic: true, targetTabId: current.id });
    }
  };
  const onRuntimeMessage = async (
    message: { type?: string; tabId?: number },
    sender: { tab?: { id?: number; windowId?: number }; url?: string },
  ) => {
    const source = sender.tab;
    if (message.type === "rankmiso:inspection-ready") {
      if (
        !followActiveTab ||
        sender.url !== browser.runtime.getURL("/popup.html") ||
        message.tabId == null ||
        ownerWindowId == null
      ) {
        return;
      }
      const [current] = await browser.tabs.query({ active: true, windowId: ownerWindowId });
      if (current?.id === message.tabId) {
        const authorizedTab = await tabById(message.tabId);
        toolbarAuthorizedTabs.set(message.tabId, authorizedTab.url ?? "");
        if (toolbarAuthorizedTabs.size > 5) {
          toolbarAuthorizedTabs.delete(toolbarAuthorizedTabs.keys().next().value!);
        }
        void refresh({ automatic: true, targetTabId: message.tabId });
      }
      return;
    }
    if (
      !followActiveTab ||
      message.type !== "rankmiso:route-change" ||
      source?.id == null ||
      source.windowId !== ownerWindowId
    ) {
      return;
    }
    const [current] = await browser.tabs.query({ active: true, windowId: ownerWindowId });
    if (current?.id === source.id) {
      if (audit.value && tab.value?.id === source.id) {
        try {
          const generation = await readGeneration(source.id);
          if (
            generation.url === audit.value.page.url &&
            generation.generation === analyzedGeneration.value
          ) {
            return;
          }
        } catch {
          // Reinspection below reports revoked access or a navigation race.
        }
      }
      automaticRequest = undefined;
      void refresh({ automatic: true, targetTabId: source.id });
    }
  };
  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onActivated.addListener(onActivated);
    if (followActiveTab) {
      browser.tabs.onRemoved.addListener(onRemoved);
      browser.windows.onFocusChanged.addListener(onWindowFocusChanged);
      browser.runtime.onMessage.addListener(onRuntimeMessage);
    }
    browser.permissions.onAdded.addListener(onPermissionAdded);
    browser.permissions.onRemoved.addListener(onPermissionRemoved);
  }

  function unbindListeners() {
    if (!listenersBound) return;
    listenersBound = false;
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onActivated.removeListener(onActivated);
    if (followActiveTab) {
      browser.tabs.onRemoved.removeListener(onRemoved);
      browser.windows.onFocusChanged.removeListener(onWindowFocusChanged);
      browser.runtime.onMessage.removeListener(onRuntimeMessage);
    }
    browser.permissions.onAdded.removeListener(onPermissionAdded);
    browser.permissions.onRemoved.removeListener(onPermissionRemoved);
  }

  const onVisibilityChange = () => {
    if (!followActiveTab) return;
    if (document.visibilityState === "hidden") {
      sidebarActive = false;
      unbindListeners();
      requestRevision += 1;
      permissionAttempt += 1;
      automaticRequest = undefined;
      siteAccessPending.value = false;
      cached.clear();
      audit.value = null;
      snapshot.value = null;
      tab.value = null;
      status.value = "idle";
      return;
    }
    if (!sidebarActive) {
      sidebarActive = true;
      bindListeners();
      void refresh({ automatic: true });
    }
  };

  if (followActiveTab) document.addEventListener("visibilitychange", onVisibilityChange);
  if (sidebarActive) bindListeners();
  onScopeDispose(() => {
    unbindListeners();
    if (followActiveTab) document.removeEventListener("visibilitychange", onVisibilityChange);
    requestRevision += 1;
    permissionAttempt += 1;
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
    siteAccessState,
    siteAccessHost,
    siteAccessPending,
    inspectionMode,
    automaticAccessGranted,
    refresh,
    requestSiteAccess,
    enableAutomaticChecks,
    setInspectionMode,
    revokeAutomaticAccess,
    dismissSiteAccess,
    runSiteProbe,
    checkFreshness,
  };
}
