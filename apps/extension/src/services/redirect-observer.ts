import { browser } from "wxt/browser";

/**
 * Browsers return an opaque response for `redirect: "manual"`, hiding the status and Location.
 * With the optional `webRequest` permission, RankMiso reads them for its own requests (tab -1)
 * so it can follow redirects one validated hop at a time. Nothing is blocked or changed.
 */
export const REDIRECT_PERMISSION = "webRequest";

export interface ObservedResponse {
  status: number;
  location: string | null;
}

export interface RedirectObserver {
  /** The observed status and Location for the latest request to `url`, if any. */
  read(url: string): Promise<ObservedResponse | null>;
  stop(): void;
}

export async function hasRedirectDetails(): Promise<boolean> {
  try {
    return await browser.permissions.contains({ permissions: [REDIRECT_PERMISSION] });
  } catch {
    return false;
  }
}

/** Call from a click handler; Firefox requires a user action for permission prompts. */
export function requestRedirectDetails(): Promise<boolean> {
  try {
    return browser.permissions.request({ permissions: [REDIRECT_PERMISSION] }).catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

function key(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.href;
  } catch {
    return url;
  }
}

/** Watches response headers for `pattern` (a host match pattern RankMiso already holds). */
export function observeRedirects(pattern: string): RedirectObserver | null {
  const events = (browser as { webRequest?: typeof browser.webRequest }).webRequest
    ?.onHeadersReceived;
  if (!events) return null;
  const seen = new Map<string, ObservedResponse>();
  let own = "";
  try {
    own = new URL(browser.runtime.getURL("/")).origin;
  } catch {
    own = "";
  }
  const listener = (details: {
    url: string;
    tabId: number;
    statusCode: number;
    initiator?: string;
    originUrl?: string;
    documentUrl?: string;
    responseHeaders?: Array<{ name: string; value?: string }>;
  }): undefined => {
    // Only RankMiso's own requests: from a RankMiso page (Chrome `initiator`, Firefox
    // `originUrl`/`documentUrl`) or from its background (tab -1).
    const from = details.initiator ?? details.originUrl ?? details.documentUrl ?? "";
    const mine = details.tabId === -1 || (own !== "" && from.startsWith(own));
    if (!mine) return undefined;
    const location =
      details.responseHeaders?.find((header) => header.name.toLowerCase() === "location")?.value ??
      null;
    seen.set(key(details.url), { status: details.statusCode, location });
    if (seen.size > 200) {
      const oldest = seen.keys().next().value;
      if (oldest !== undefined) seen.delete(oldest);
    }
    return undefined;
  };
  try {
    events.addListener(listener, { urls: [pattern], types: ["xmlhttprequest", "other"] }, [
      "responseHeaders",
    ]);
  } catch {
    return null;
  }
  return {
    async read(url) {
      // The event can arrive just after fetch() settles; wait briefly, bounded.
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const found = seen.get(key(url));
        if (found) {
          seen.delete(key(url));
          return found;
        }
        await new Promise((done) => setTimeout(done, 20));
      }
      return null;
    },
    stop() {
      events.removeListener(listener);
    },
  };
}
