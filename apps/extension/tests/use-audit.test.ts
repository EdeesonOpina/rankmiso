import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

const harness = vi.hoisted(() => {
  type Listener = (...args: never[]) => void;
  const event = () => {
    const listeners = new Set<Listener>();
    return {
      addListener: vi.fn((listener: Listener) => listeners.add(listener)),
      removeListener: vi.fn((listener: Listener) => listeners.delete(listener)),
      emit: (...args: unknown[]) => listeners.forEach((listener) => listener(...(args as never[]))),
      count: () => listeners.size,
      clear: () => listeners.clear(),
    };
  };
  const activated = event();
  const updated = event();
  const removed = event();
  const focusChanged = event();
  const message = event();
  const permissionAdded = event();
  const permissionRemoved = event();
  const grantedOrigins = new Set<string>();
  const storageValues = new Map<string, unknown>();
  const tabs = new Map<number, { id: number; windowId: number; url?: string; status: string }>();
  const browser = {
    tabs: {
      onActivated: activated,
      onUpdated: updated,
      onRemoved: removed,
      query: vi.fn(async () => [] as Array<{ id?: number }>),
    },
    windows: { onFocusChanged: focusChanged },
    runtime: {
      onMessage: message,
      getURL: (path: string) => `moz-extension://rankmiso${path}`,
    },
    permissions: {
      onAdded: permissionAdded,
      onRemoved: permissionRemoved,
      contains: vi.fn(
        async (request?: { origins?: string[] }) =>
          request?.origins?.every((origin) => grantedOrigins.has(origin)) ?? false,
      ),
      getAll: vi.fn(async () => ({ origins: [...grantedOrigins] })),
      request: vi.fn(async (request?: { origins?: string[] }) => {
        for (const origin of request?.origins ?? []) grantedOrigins.add(origin);
        return true;
      }),
      remove: vi.fn(async (request?: { origins?: string[] }) => {
        for (const origin of request?.origins ?? []) grantedOrigins.delete(origin);
        return true;
      }),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storageValues.get(key) })),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [key, value] of Object.entries(items)) storageValues.set(key, value);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) storageValues.delete(key);
        }),
      },
    },
  };
  return {
    activated,
    updated,
    removed,
    focusChanged,
    message,
    permissionAdded,
    permissionRemoved,
    grantedOrigins,
    storageValues,
    tabs,
    browser,
    supportsOptionalExternalChecks: true,
  };
});

const inspect = vi.hoisted(() => ({
  activeTab: vi.fn(async () => ({
    id: 1,
    windowId: 10,
    url: "https://a.test/",
    status: "complete",
  })),
  tabById: vi.fn(async (id: number) => {
    const found = harness.tabs.get(id);
    if (!found) throw new Error("Tab not found");
    return found;
  }),
  inspectTab: vi.fn(async (id: number) => page(id)),
  readGeneration: vi.fn(async (id: number) => ({
    url: harness.tabs.get(id)?.url ?? "",
    generation: 0,
  })),
}));

function page(id: number) {
  return {
    url: harness.tabs.get(id)?.url ?? `https://${id}.test/`,
    title: `Page ${id}`,
    collection: { domGeneration: 0 },
  } as never;
}

vi.mock("wxt/browser", () => ({ browser: harness.browser }));
vi.mock("../src/config/features.config", () => ({
  get supportsOptionalExternalChecks() {
    return harness.supportsOptionalExternalChecks;
  },
}));
vi.mock("../src/services/inspect", () => ({
  ...inspect,
  friendlyInspectionError: (error: unknown) => String(error),
}));
vi.mock("../src/services/engine", () => ({
  analyzeSnapshot: vi.fn(async (snapshot: { url: string; title: string }) => ({
    page: snapshot,
    score: { available: true, value: 70 },
  })),
}));
vi.mock("../src/services/page-access", () => ({
  isGestureError: () => false,
  isHostPermissionError: (error: unknown) => /host permission/i.test(String(error)),
  permissionPatternMatchesUrl: (pattern: string, url?: string) => {
    if (!url) return false;
    const site = new URL(url);
    const match = /^(https?):\/\/([^/]+)\/\*$/.exec(pattern);
    return Boolean(match && `${match[1]}:` === site.protocol && match[2] === site.hostname);
  },
  sitePermission: (url?: string) => {
    if (!url) return null;
    const site = new URL(url);
    if (site.protocol !== "https:" && site.protocol !== "http:") return null;
    return {
      origin: site.origin,
      hostname: site.hostname,
      pattern: `${site.protocol}//${site.hostname}/*`,
    };
  },
  nextAccessRequest: (input: {
    visibleUrl?: string;
    previousUrl?: string;
    tabsPermission: boolean;
    originPermission: boolean;
  }) => {
    const origin = input.visibleUrl ? new URL(input.visibleUrl).origin : null;
    if (
      harness.supportsOptionalExternalChecks &&
      origin &&
      input.previousUrl &&
      origin !== new URL(input.previousUrl).origin &&
      !input.originPermission
    ) {
      return { type: "origin", origin };
    }
    if (!origin && !input.tabsPermission) return { type: "tabs" };
    return { type: "none" };
  },
  webOrigin: (url?: string) => (url ? new URL(url).origin : null),
}));
vi.mock("../src/services/site-probe", () => ({
  isBlockedProbeHost: () => false,
  probeSite: vi.fn(),
}));

import { useAudit } from "../src/composables/useAudit";

describe("sidebar active-tab audit lifecycle", () => {
  beforeEach(() => {
    harness.supportsOptionalExternalChecks = true;
    harness.activated.clear();
    harness.updated.clear();
    harness.removed.clear();
    harness.focusChanged.clear();
    harness.message.clear();
    harness.permissionAdded.clear();
    harness.permissionRemoved.clear();
    harness.grantedOrigins.clear();
    harness.storageValues.clear();
    harness.browser.tabs.query.mockReset().mockResolvedValue([]);
    harness.browser.permissions.request.mockReset().mockImplementation(async (request) => {
      for (const origin of request?.origins ?? []) harness.grantedOrigins.add(origin);
      return true;
    });
    harness.browser.permissions.getAll.mockReset().mockImplementation(async () => ({
      origins: [...harness.grantedOrigins],
    }));
    harness.browser.permissions.remove.mockReset().mockImplementation(async (request) => {
      for (const origin of request?.origins ?? []) harness.grantedOrigins.delete(origin);
      return true;
    });
    harness.tabs.clear();
    for (const id of [1, 2, 3]) {
      harness.tabs.set(id, {
        id,
        windowId: 10,
        url: `https://${String.fromCharCode(96 + id)}.test/`,
        status: "complete",
      });
      harness.grantedOrigins.add(`https://${String.fromCharCode(96 + id)}.test/*`);
    }
    const firstTab = harness.tabs.get(1)!;
    inspect.activeTab.mockResolvedValue({ ...firstTab, url: firstTab.url ?? "" });
    inspect.tabById.mockImplementation(async (id) => {
      const found = harness.tabs.get(id);
      if (!found) throw new Error("Tab not found");
      return { ...found, url: found.url ?? "" };
    });
    inspect.inspectTab.mockImplementation(async (id) => page(id));
    inspect.readGeneration.mockImplementation(async (id) => ({
      url: harness.tabs.get(id)?.url ?? "",
      generation: 0,
    }));
  });

  afterEach(() => vi.clearAllMocks());

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("follows switches and reuses a still-matching cached result", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.activated.emit({ tabId: 2, windowId: 10 });
    await settle();
    expect(state.audit.value?.page.url).toBe("https://b.test/");
    harness.activated.emit({ tabId: 1, windowId: 10 });
    await settle();
    expect(state.audit.value?.page.url).toBe("https://a.test/");
    harness.activated.emit({ tabId: 2, windowId: 10 });
    harness.activated.emit({ tabId: 3, windowId: 10 });
    harness.activated.emit({ tabId: 1, windowId: 10 });
    await settle();
    expect(state.audit.value?.page.url).toBe("https://a.test/");
    expect(inspect.inspectTab).toHaveBeenCalledTimes(2);
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    scope.stop();
  });

  it("ignores a late result after a newer active tab starts auditing", async () => {
    let finishA!: (value: never) => void;
    inspect.inspectTab.mockImplementation((id) =>
      id === 1 ? new Promise((resolve) => (finishA = resolve)) : Promise.resolve(page(id)),
    );
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    const auditA = state.refresh({ automatic: true });
    await settle();
    harness.activated.emit({ tabId: 2, windowId: 10 });
    await settle();
    finishA(page(1));
    await auditA;
    await settle();
    expect(state.audit.value?.page.url).toBe("https://b.test/");
    scope.stop();
  });

  it("invalidates a cached result when an inactive tab reloads", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.activated.emit({ tabId: 2, windowId: 10 });
    await settle();
    harness.updated.emit(1, { status: "loading" }, harness.tabs.get(1));
    harness.updated.emit(1, { status: "complete" }, harness.tabs.get(1));
    harness.activated.emit({ tabId: 1, windowId: 10 });
    await settle();
    expect(state.audit.value?.page.url).toBe("https://a.test/");
    expect(inspect.inspectTab).toHaveBeenCalledTimes(3);
    scope.stop();
  });

  it("invalidates same-tab navigation and refreshes on completion", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.tabs.set(1, { id: 1, windowId: 10, url: "https://a.test/next", status: "loading" });
    harness.updated.emit(1, { url: "https://a.test/next", status: "loading" }, harness.tabs.get(1));
    expect(state.audit.value).toBeNull();
    harness.tabs.set(1, { id: 1, windowId: 10, url: "https://a.test/next", status: "complete" });
    harness.updated.emit(1, { status: "complete" }, harness.tabs.get(1));
    await settle();
    expect(state.audit.value?.page.url).toBe("https://a.test/next");
    scope.stop();
  });

  it("keeps pinned report results visibly stale after the inspected tab navigates", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(1))!;
    await state.refresh();
    harness.updated.emit(1, { status: "loading" }, harness.tabs.get(1));
    expect(state.stale.value).toBe(true);
    scope.stop();
  });

  it("ignores activation in another window and removes listeners on disposal", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.activated.emit({ tabId: 3, windowId: 99 });
    await settle();
    expect(state.tab.value?.id).toBe(1);
    expect(harness.activated.count()).toBe(1);
    scope.stop();
    expect(harness.activated.count()).toBe(0);
    expect(harness.updated.count()).toBe(0);
    expect(harness.removed.count()).toBe(0);
    expect(harness.focusChanged.count()).toBe(0);
    expect(harness.message.count()).toBe(0);
    expect(harness.permissionAdded.count()).toBe(0);
    expect(harness.permissionRemoved.count()).toBe(0);
  });

  it("resolves the remaining active tab after the selected tab closes", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.browser.tabs.query.mockResolvedValue([{ id: 2 }]);
    harness.removed.emit(1, { windowId: 10 });
    await settle();
    expect(state.tab.value?.id).toBe(2);
    expect(state.audit.value?.page.url).toBe("https://b.test/");
    scope.stop();
  });

  it("does not request access or retain old results when the new page is unauthorized", async () => {
    harness.grantedOrigins.delete("https://b.test/*");
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.activated.emit({ tabId: 2, windowId: 10 });
    await settle();
    expect(state.audit.value).toBeNull();
    expect(state.siteAccessState.value).toBe("required");
    expect(state.siteAccessHost.value).toBe("b.test");
    expect(inspect.inspectTab).toHaveBeenCalledTimes(1);
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    scope.stop();
  });

  it("requests only the selected website synchronously and audits after approval", async () => {
    harness.grantedOrigins.clear();
    harness.browser.tabs.query.mockResolvedValue([{ id: 1 }]);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(state.siteAccessState.value).toBe("required");
    expect(inspect.inspectTab).not.toHaveBeenCalled();

    const requested = state.requestSiteAccess();
    expect(harness.browser.permissions.request).toHaveBeenCalledWith({
      origins: ["https://a.test/*"],
    });
    await requested;

    expect(state.audit.value?.page.url).toBe("https://a.test/");
    expect(state.siteAccessState.value).toBeNull();
    scope.stop();
  });

  it("requests optional HTTP and HTTPS website access synchronously only after explicit opt-in", async () => {
    harness.grantedOrigins.clear();
    harness.browser.tabs.query.mockResolvedValue([{ id: 1 }]);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(inspect.inspectTab).not.toHaveBeenCalled();
    expect(state.inspectionMode.value).toBeNull();

    const enabling = state.enableAutomaticChecks();
    expect(harness.browser.permissions.request).toHaveBeenCalledTimes(1);
    expect(harness.browser.permissions.request).toHaveBeenCalledWith({
      origins: ["http://*/*", "https://*/*"],
    });
    await enabling;

    expect(state.inspectionMode.value).toBe("automatic");
    expect(state.automaticAccessGranted.value).toBe(true);
    expect(state.audit.value?.page.url).toBe("https://a.test/");
    expect(inspect.inspectTab).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("follows multiple sites automatically under the opt-in broad grant without re-prompting", async () => {
    harness.storageValues.set("rankmiso.inspectionMode", "automatic");
    harness.grantedOrigins.clear();
    harness.grantedOrigins.add("http://*/*");
    harness.grantedOrigins.add("https://*/*");
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(state.audit.value?.page.url).toBe("https://a.test/");

    for (const tabId of [2, 3, 1, 2]) {
      harness.activated.emit({ tabId, windowId: 10 });
      await settle();
      expect(state.audit.value?.page.url).toBe(harness.tabs.get(tabId)?.url);
    }

    expect(inspect.inspectTab).toHaveBeenCalledTimes(3);
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    scope.stop();
  });

  it("keeps Automatic Mode disabled after the browser denies broad access", async () => {
    harness.grantedOrigins.clear();
    harness.browser.permissions.request.mockResolvedValue(false);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    await state.enableAutomaticChecks();

    expect(state.inspectionMode.value).toBeNull();
    expect(state.automaticAccessGranted.value).toBe(false);
    expect(state.siteAccessState.value).toBe("denied");
    expect(inspect.inspectTab).not.toHaveBeenCalled();
    scope.stop();
  });

  it("does not use broad browser access for automatic inspection in Individual Mode", async () => {
    harness.storageValues.set("rankmiso.inspectionMode", "individual");
    for (const origin of [...harness.grantedOrigins]) {
      if (!origin.endsWith("/*") || origin.includes("*/*")) continue;
      harness.grantedOrigins.delete(origin);
    }
    harness.grantedOrigins.add("http://*/*");
    harness.grantedOrigins.add("https://*/*");
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });

    expect(state.siteAccessState.value).toBe("required");
    expect(state.inspectionMode.value).toBe("individual");
    expect(inspect.inspectTab).not.toHaveBeenCalled();
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    scope.stop();
  });

  it("makes manual Refresh bypass a matching automatic audit cache and reread the page", async () => {
    harness.storageValues.set("rankmiso.inspectionMode", "automatic");
    harness.grantedOrigins.add("http://*/*");
    harness.grantedOrigins.add("https://*/*");
    harness.browser.tabs.query.mockResolvedValue([{ id: 1 }]);
    let title = "Page 1";
    inspect.inspectTab.mockImplementation(
      async (id) => ({ ...(page(id) as object), title }) as never,
    );
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(state.audit.value?.page.title).toBe("Page 1");

    title = "Updated page title";
    await state.refresh({ forceFresh: true });

    expect(inspect.inspectTab).toHaveBeenCalledTimes(2);
    expect(state.audit.value?.page.title).toBe("Updated page title");
    scope.stop();
  });

  it("stops automatic inspection after broad access is revoked", async () => {
    harness.storageValues.set("rankmiso.inspectionMode", "automatic");
    harness.grantedOrigins.add("http://*/*");
    harness.grantedOrigins.add("https://*/*");
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(state.audit.value?.page.url).toBe("https://a.test/");

    harness.grantedOrigins.delete("http://*/*");
    harness.grantedOrigins.delete("https://*/*");
    harness.grantedOrigins.delete("https://a.test/*");
    harness.permissionRemoved.emit({
      origins: ["http://*/*", "https://*/*", "https://a.test/*"],
    });
    await settle();

    expect(state.automaticAccessGranted.value).toBe(false);
    expect(state.audit.value).toBeNull();
    expect(state.siteAccessState.value).toBe("required");
    expect(inspect.inspectTab).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("reports when the browser refuses the explicit broad-permission revocation", async () => {
    harness.storageValues.set("rankmiso.inspectionMode", "automatic");
    harness.grantedOrigins.add("http://*/*");
    harness.grantedOrigins.add("https://*/*");
    harness.browser.permissions.remove.mockResolvedValue(false);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });

    await expect(state.revokeAutomaticAccess()).resolves.toBe(false);
    expect(state.automaticAccessGranted.value).toBe(true);
    expect(state.error.value).toContain("couldn't remove website access");
    scope.stop();
  });

  it("shows a recoverable denied state without inspecting the page", async () => {
    harness.grantedOrigins.clear();
    harness.browser.permissions.request.mockResolvedValue(false);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    await state.requestSiteAccess();

    expect(state.siteAccessState.value).toBe("denied");
    expect(inspect.inspectTab).not.toHaveBeenCalled();
    state.dismissSiteAccess();
    expect(state.siteAccessState.value).toBeNull();
    expect(state.error.value).toBeTruthy();
    scope.stop();
  });

  it("does not use permission approval after the active page changes", async () => {
    harness.grantedOrigins.clear();
    let grant!: (value: boolean) => void;
    harness.browser.permissions.request.mockImplementation(
      () => new Promise<boolean>((resolve) => (grant = resolve)),
    );
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    const pending = state.requestSiteAccess();
    harness.activated.emit({ tabId: 2, windowId: 10 });
    await settle();
    grant(true);
    await pending;

    expect(harness.browser.permissions.request).toHaveBeenCalledWith({
      origins: ["https://a.test/*"],
    });
    expect(inspect.inspectTab).not.toHaveBeenCalled();
    expect(state.tab.value?.id).toBe(2);
    expect(state.siteAccessState.value).toBe("required");
    scope.stop();
  });

  it("invalidates current and cached results when website permission is revoked", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.grantedOrigins.delete("https://a.test/*");
    harness.permissionRemoved.emit({ origins: ["https://a.test/*"] });
    await settle();

    expect(state.audit.value).toBeNull();
    expect(state.siteAccessState.value).toBe("required");
    harness.activated.emit({ tabId: 1, windowId: 10 });
    await settle();
    expect(inspect.inspectTab).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("offers explicit authorization when Firefox cannot expose an unapproved page URL", async () => {
    harness.supportsOptionalExternalChecks = false;
    harness.grantedOrigins.clear();
    harness.tabs.set(1, { ...harness.tabs.get(1)!, url: "" });
    inspect.activeTab.mockResolvedValue({
      id: 1,
      windowId: 10,
      url: "",
      status: "complete",
    });
    inspect.inspectTab.mockRejectedValue(new Error("missing host permission"));
    harness.browser.permissions.request.mockRejectedValue(
      new Error("permissions.request may only be called from a user input handler"),
    );
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;

    await state.refresh();

    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    expect(state.siteAccessState.value).toBe("required");
    expect(state.audit.value).toBeNull();
    scope.stop();
  });

  it("keeps Chrome's explicit origin permission request on Refresh", async () => {
    harness.grantedOrigins.delete("https://b.test/*");
    harness.browser.permissions.request.mockResolvedValue(true);
    const scope = effectScope();
    const state = scope.run(() => useAudit())!;
    await state.refresh();
    inspect.activeTab.mockResolvedValue({
      ...harness.tabs.get(2)!,
      url: "https://b.test/",
    });

    await state.refresh();

    expect(harness.browser.permissions.request).toHaveBeenCalledWith({
      origins: ["https://b.test/*"],
    });
    expect(state.audit.value?.page.url).toBe("https://b.test/");
    scope.stop();
  });

  it("refreshes the active Firefox sidebar after its toolbar popup authorizes inspection", async () => {
    harness.supportsOptionalExternalChecks = false;
    inspect.inspectTab
      .mockRejectedValueOnce(new Error("missing host permission"))
      .mockResolvedValue(page(1));
    harness.browser.tabs.query.mockResolvedValue([{ id: 1 }]);
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    expect(state.audit.value).toBeNull();

    harness.message.emit(
      { type: "rankmiso:inspection-ready", tabId: 1 },
      { url: harness.browser.runtime.getURL("/popup.html") },
    );
    await settle();

    expect(state.audit.value?.page.url).toBe("https://a.test/");
    expect(state.status.value).toBe("ready");
    expect(harness.browser.permissions.request).not.toHaveBeenCalled();
    scope.stop();
  });

  it("re-audits after a same-document SPA route notification", async () => {
    const scope = effectScope();
    const state = scope.run(() => useAudit(undefined, true))!;
    await state.refresh({ automatic: true });
    harness.tabs.set(1, { id: 1, windowId: 10, url: "https://a.test/route", status: "complete" });
    harness.browser.tabs.query.mockResolvedValue([{ id: 1 }]);
    harness.message.emit({ type: "rankmiso:route-change" }, { tab: { id: 1, windowId: 10 } });
    await settle();
    expect(state.audit.value?.page.url).toBe("https://a.test/route");
    harness.message.emit({ type: "rankmiso:route-change" }, { tab: { id: 1, windowId: 10 } });
    await settle();
    expect(inspect.inspectTab).toHaveBeenCalledTimes(2);
    scope.stop();
  });
});
