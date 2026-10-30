/**
 * Runs inside the inspected page. The function is serialized by
 * `scripting.executeScript`, so it must not close over imports.
 * Marker installation is intended for the page's main world. Extraction
 * and highlighting can run in the isolated world.
 */
export function runPageTool(command: string, arg?: string): unknown {
  const root = document.documentElement;
  const markAttribute = "data-seo-toolkit-mark";
  const rankmisoHighlightAttribute = "data-rankmiso-highlight";
  const styleId = "seo-toolkit-highlight";
  const inpCaptureKey = "__rankmiso_inp_capture_v1";

  type InpCaptureState = {
    supported: boolean;
    active: boolean;
    interactions: Map<number, number>;
    observers: PerformanceObserver[];
    flush: () => void;
  };

  type InpCaptureSnapshot = {
    supported: boolean;
    active: boolean;
    interactions: Array<[number, number]>;
  };

  function inpSupport(): boolean {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes?.includes("event")
    ) {
      return false;
    }
    const entryType = Reflect.get(globalThis, "PerformanceEventTiming") as
      { prototype?: object } | undefined;
    return Boolean(entryType?.prototype && "interactionId" in entryType.prototype);
  }

  function captureSnapshot(): InpCaptureSnapshot {
    const state = Reflect.get(globalThis, inpCaptureKey) as InpCaptureState | undefined;
    if (!state) return { supported: inpSupport(), active: false, interactions: [] };
    state.flush();
    return {
      supported: state.supported,
      active: state.active,
      interactions: [...state.interactions.entries()],
    };
  }

  function startInpCapture(): InpCaptureSnapshot {
    const current = Reflect.get(globalThis, inpCaptureKey) as InpCaptureState | undefined;
    if (current?.active) return captureSnapshot();
    if (!inpSupport()) return { supported: false, active: false, interactions: [] };

    const interactions = current?.interactions ?? new Map<number, number>();
    const observers: PerformanceObserver[] = [];
    const addEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries as Array<PerformanceEntry & { interactionId?: number }>) {
        if (!entry.interactionId || entry.duration <= 0) continue;
        interactions.set(
          entry.interactionId,
          Math.max(interactions.get(entry.interactionId) ?? 0, entry.duration),
        );
      }
    };
    try {
      const events = new PerformanceObserver((list) => addEntries(list.getEntries()));
      events.observe({
        type: "event",
        buffered: true,
        durationThreshold: 16,
      } as PerformanceObserverInit);
      observers.push(events);
      if (PerformanceObserver.supportedEntryTypes.includes("first-input")) {
        const firstInput = new PerformanceObserver((list) => addEntries(list.getEntries()));
        firstInput.observe({ type: "first-input", buffered: true } as PerformanceObserverInit);
        observers.push(firstInput);
      }
    } catch {
      observers.forEach((observer) => observer.disconnect());
      return { supported: false, active: false, interactions: [] };
    }
    const state: InpCaptureState = {
      supported: true,
      active: true,
      interactions,
      observers,
      flush: () => observers.forEach((observer) => addEntries(observer.takeRecords())),
    };
    Reflect.set(globalThis, inpCaptureKey, state);
    return captureSnapshot();
  }

  function stopInpCapture(): InpCaptureSnapshot {
    const state = Reflect.get(globalThis, inpCaptureKey) as InpCaptureState | undefined;
    if (!state) return captureSnapshot();
    state.flush();
    state.observers.forEach((observer) => observer.disconnect());
    state.active = false;
    return captureSnapshot();
  }

  function clean(value: string | null | undefined): string {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function cssPath(element: Element): string {
    const parts: string[] = [];
    let node: Element | null = element;
    while (node && parts.length < 6) {
      const tag = node.tagName.toLowerCase();
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) {
        parts.unshift(tag);
        break;
      }
      const same = Array.from(parent.children).filter((child) => child.tagName === node?.tagName);
      parts.unshift(`${tag}:nth-of-type(${same.indexOf(node) + 1})`);
      if (tag === "body") break;
      node = parent;
    }
    return parts.join(" > ");
  }

  function accessibleName(element: Element): string {
    const aria = clean(element.getAttribute("aria-label"));
    if (aria) return aria.slice(0, 300);
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ");
      const cleaned = clean(text);
      if (cleaned) return cleaned.slice(0, 300);
    }
    const text = clean(element.textContent).slice(0, 300);
    if (text) return text;
    const image = element.querySelector("img[alt]");
    return clean(image?.getAttribute("alt")).slice(0, 300);
  }

  function visibleText(): { text: string; truncated: boolean } {
    if (!document.body) return { text: "", truncated: false };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let text = "";
    let truncated = false;
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || parent.closest("script, style, noscript, template")) continue;
      if (parent.closest("[hidden], [aria-hidden='true']")) continue;
      const value = walker.currentNode.textContent || "";
      if (!value.trim()) continue;
      if (text.length >= 200_000) {
        truncated = true;
        break;
      }
      const remaining = 200_000 - text.length;
      text += `${value.slice(0, remaining)}\n`;
      if (value.length > remaining) truncated = true;
    }
    return { text: text.trim(), truncated };
  }

  function metaTags() {
    return Array.from(document.querySelectorAll("meta"))
      .slice(0, 400)
      .map((meta) => ({
        name: meta.getAttribute("name"),
        property: meta.getAttribute("property"),
        httpEquiv: meta.getAttribute("http-equiv"),
        content: meta.getAttribute("content"),
        charset: meta.getAttribute("charset"),
      }));
  }

  function linkRels() {
    return Array.from(document.querySelectorAll("link[rel][href]"))
      .slice(0, 200)
      .map((link) => ({
        rel: link.getAttribute("rel") || "",
        href: link.getAttribute("href") || "",
        hreflang: link.getAttribute("hreflang"),
        media: link.getAttribute("media"),
      }));
  }

  function headings() {
    return Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6"))
      .slice(0, 500)
      .map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: clean(heading.textContent).slice(0, 500),
        location: cssPath(heading),
      }));
  }

  function links() {
    return Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 2000)
      .map((anchor) => {
        const href = anchor.getAttribute("href") || "";
        let resolved: string | null = null;
        try {
          resolved = new URL(href, document.baseURI).href;
        } catch {
          resolved = null;
        }
        return {
          href,
          resolvedUrl: resolved,
          accessibleName: accessibleName(anchor),
          rel: (anchor.getAttribute("rel") || "").split(/\s+/).filter(Boolean),
          target: anchor.getAttribute("target"),
          title: anchor.getAttribute("title"),
          location: cssPath(anchor),
        };
      });
  }

  function images() {
    return Array.from(document.querySelectorAll("img"))
      .slice(0, 500)
      .map((image) => {
        const img = image as HTMLImageElement;
        let broken: boolean | null = null;
        if (img.getAttribute("src")) {
          if (!img.complete) broken = null;
          else broken = img.naturalWidth === 0;
        }
        return {
          src: img.currentSrc || img.getAttribute("src"),
          altPresent: img.hasAttribute("alt"),
          altValue: img.getAttribute("alt") || "",
          widthAttr: numberAttr(img.getAttribute("width")),
          heightAttr: numberAttr(img.getAttribute("height")),
          renderedWidth: img.clientWidth || null,
          renderedHeight: img.clientHeight || null,
          naturalWidth: img.complete ? img.naturalWidth : null,
          naturalHeight: img.complete ? img.naturalHeight : null,
          loading: img.getAttribute("loading"),
          fetchPriority: img.getAttribute("fetchpriority"),
          srcset: img.getAttribute("srcset"),
          decoding: img.getAttribute("decoding"),
          sizes: img.getAttribute("sizes"),
          inPicture: Boolean(img.closest("picture")),
          broken,
          location: cssPath(img),
        };
      });
  }

  function numberAttr(value: string | null): number | null {
    if (!value || !/^\d+$/.test(value)) return null;
    return Number(value);
  }

  function structuredData() {
    return Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .slice(0, 40)
      .map((script) => ({
        format: "json-ld",
        raw: (script.textContent || "").slice(0, 100_000),
      }));
  }

  function accessibility() {
    const controls = Array.from(document.querySelectorAll("input, select, textarea")).filter(
      (element) => {
        const type = (element.getAttribute("type") || "").toLowerCase();
        return !["hidden", "button", "submit", "reset", "image"].includes(type);
      },
    );
    const unlabeled = controls.filter((element) => {
      if (clean(element.getAttribute("aria-label"))) return false;
      if (element.getAttribute("aria-labelledby")) return false;
      if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`))
        return false;
      if (element.closest("label")) return false;
      return true;
    }).length;
    const buttons = Array.from(
      document.querySelectorAll(
        'button, input[type="button"], input[type="submit"], input[type="reset"]',
      ),
    );
    const nameless = buttons.filter((element) => {
      if (clean(element.getAttribute("aria-label"))) return false;
      if (element.getAttribute("aria-labelledby")) return false;
      if (clean(element.getAttribute("title"))) return false;
      if (clean(element.textContent)) return false;
      if (clean(element.getAttribute("value"))) return false;
      return true;
    }).length;
    const counts = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((element) => {
      if (!element.id) return;
      counts.set(element.id, (counts.get(element.id) || 0) + 1);
    });
    let duplicateIds = 0;
    counts.forEach((count) => {
      if (count > 1) duplicateIds += 1;
    });
    return {
      unlabeledFormControls: unlabeled,
      namelessButtons: nameless,
      duplicateIds,
      sampled: true,
    };
  }

  async function bufferedEntries(
    type: string,
    options: { durationThreshold?: number } = {},
  ): Promise<PerformanceEntry[]> {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes?.includes(type)
    ) {
      return performance.getEntriesByType(type);
    }

    const entries: PerformanceEntry[] = [];
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => entries.push(...list.getEntries()));
      observer.observe({
        type,
        buffered: true,
        ...options,
      } as PerformanceObserverInit);
      await new Promise((resolve) => setTimeout(resolve, 60));
      entries.push(...observer.takeRecords());
      observer.disconnect();
      return [...new Set(entries)];
    } catch {
      observer?.disconnect();
      return performance.getEntriesByType(type);
    }
  }

  async function performanceSnapshot(capture: InpCaptureSnapshot | null = null) {
    const notes = [
      "Values come from this browser's performance timeline for the current page load.",
      "They are not Chrome UX Report field data and they are not a lab run from PageSpeed Insights.",
    ];
    const supportedEntryTypes =
      typeof PerformanceObserver === "undefined"
        ? []
        : (PerformanceObserver.supportedEntryTypes ?? []);
    const layoutShiftSupported = supportedEntryTypes.includes("layout-shift");
    const eventTimingSupported = inpSupport();
    const navigation = performance.getEntriesByType("navigation")[0] as
      (PerformanceNavigationTiming & { responseStatus?: number }) | undefined;
    const [lcpEntries, shiftEntries, eventEntries, firstInputEntries] = await Promise.all([
      bufferedEntries("largest-contentful-paint"),
      bufferedEntries("layout-shift"),
      bufferedEntries("event", { durationThreshold: 16 }),
      bufferedEntries("first-input"),
    ]);
    const lcp = lcpEntries.at(-1);
    const shifts = shiftEntries as Array<
      PerformanceEntry & { value?: number; hadRecentInput?: boolean }
    >;
    let clsValue = 0;
    let sessionValue = 0;
    let sessionStart = 0;
    let previousShiftTime = 0;
    for (const shift of shifts) {
      if (shift.hadRecentInput) continue;
      if (
        sessionStart === 0 ||
        shift.startTime - previousShiftTime >= 1000 ||
        shift.startTime - sessionStart >= 5000
      ) {
        sessionStart = shift.startTime;
        sessionValue = shift.value || 0;
      } else {
        sessionValue += shift.value || 0;
      }
      previousShiftTime = shift.startTime;
      clsValue = Math.max(clsValue, sessionValue);
    }
    const cls = layoutShiftSupported ? Math.round(clsValue * 1000) / 1000 : null;
    const interactions = new Map<number, number>();
    for (const [id, duration] of capture?.interactions ?? []) {
      interactions.set(id, Math.max(interactions.get(id) ?? 0, duration));
    }
    for (const entry of [...eventEntries, ...firstInputEntries] as Array<
      PerformanceEntry & { interactionId?: number }
    >) {
      if (entry.interactionId && entry.duration > 0) {
        interactions.set(
          entry.interactionId,
          Math.max(interactions.get(entry.interactionId) || 0, entry.duration),
        );
      }
    }
    const interactionDurations = [...interactions.values()].sort((left, right) => left - right);
    const inpIndex = Math.max(
      0,
      interactionDurations.length - 1 - Math.floor(interactionDurations.length / 50),
    );
    const inpMs = interactionDurations.length
      ? Math.round(interactionDurations[inpIndex] || 0)
      : null;
    if (!layoutShiftSupported) {
      notes.push("CLS is unavailable because this browser does not expose layout-shift entries.");
    }
    if (!eventTimingSupported) {
      notes.push("INP is unavailable because this browser does not expose Event Timing entries.");
    } else if (inpMs == null) {
      notes.push("INP is unavailable because no qualifying page interaction entries were exposed.");
    }
    if (capture?.active) {
      notes.push(
        `Explicit INP capture is active and has observed ${capture.interactions.length} interactions so far.`,
      );
    }
    return {
      snapshot: {
        lcpMs: lcp ? Math.round(lcp.startTime) : null,
        cls,
        inpMs,
        domContentLoadedMs: navigation ? Math.round(navigation.domContentLoadedEventEnd) : null,
        loadEventMs: navigation ? Math.round(navigation.loadEventEnd) : null,
        transferSize: navigation && navigation.transferSize > 0 ? navigation.transferSize : null,
        resourceCount: performance.getEntriesByType("resource").length,
        notes,
      },
      status:
        navigation && typeof navigation.responseStatus === "number"
          ? navigation.responseStatus
          : null,
      redirectCount: navigation ? navigation.redirectCount : null,
    };
  }

  async function extract(captureInput?: string) {
    const limitations: string[] = [
      "Microdata and RDFa were not extracted.",
      "Response headers, robots.txt, and sitemaps stay off until the optional site check.",
      "Interaction timing is based on event entries available in this browser session; it is not field data.",
    ];
    const text = visibleText();
    if (text.truncated) limitations.push("TEXT_TRUNCATED");
    let capture: InpCaptureSnapshot | null = null;
    try {
      capture = captureInput ? (JSON.parse(captureInput) as InpCaptureSnapshot) : null;
    } catch {
      capture = null;
    }
    const timing = await performanceSnapshot(capture);
    const htmlLength = document.documentElement ? document.documentElement.outerHTML.length : 0;
    const contentMeta = (name: string) =>
      document
        .querySelector(`meta[property="${name}"], meta[name="${name}"]`)
        ?.getAttribute("content") || null;
    return {
      schemaVersion: 1,
      url: location.href,
      collectedAt: new Date().toISOString(),
      titles: {
        rendered: clean(document.title) || null,
        elements: Array.from(document.querySelectorAll("title")).map(
          (title) => title.textContent || "",
        ),
      },
      meta: metaTags(),
      linksRel: linkRels(),
      headings: headings(),
      links: links(),
      images: images(),
      content: {
        visibleText: text.text,
        textTruncated: text.truncated,
        htmlLength: Math.min(htmlLength, 2_000_000),
        paragraphCount: Array.from(document.querySelectorAll("p")).filter((paragraph) =>
          clean(paragraph.textContent),
        ).length,
        htmlLang: document.documentElement.lang || null,
        publishedTime: contentMeta("article:published_time"),
        modifiedTime: contentMeta("article:modified_time"),
      },
      structuredData: structuredData(),
      accessibility: accessibility(),
      performance: timing.snapshot,
      response: {
        status: timing.status && timing.status > 0 ? timing.status : null,
        redirectCount: timing.redirectCount,
        contentType: document.contentType || null,
        headersAvailable: false,
        headers: [],
      },
      collection: {
        method: "rendered-dom",
        domGeneration: Number(root.dataset.seoToolkitGeneration || "0"),
        limitations,
      },
    };
  }

  function installMarker() {
    if (root.dataset.seoToolkitHook === "2") return { installed: true };
    root.dataset.seoToolkitHook = "2";
    let generation = Number(root.dataset.seoToolkitGeneration || "0");
    const bump = () => {
      generation += 1;
      root.dataset.seoToolkitGeneration = String(generation);
      document.dispatchEvent(new Event("rankmiso:route-change"));
    };
    const originalPush = history.pushState.bind(history);
    const originalReplace = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<History["pushState"]>) => {
      const result = originalPush(...args);
      bump();
      return result;
    };
    history.replaceState = (...args: Parameters<History["replaceState"]>) => {
      const result = originalReplace(...args);
      bump();
      return result;
    };
    window.addEventListener("popstate", bump);
    window.addEventListener("hashchange", bump);
    return { installed: true };
  }

  function generation() {
    return {
      url: location.href,
      generation: Number(root.dataset.seoToolkitGeneration || "0"),
    };
  }

  function clearHighlight() {
    const style = document.getElementById(styleId);
    const legacyMarks = new Set([
      "headings",
      "h1",
      "internal",
      "external",
      "nofollow",
      "sponsored",
      "ugc",
      "missing-alt",
      "broken-images",
    ]);
    document.querySelectorAll(`[${markAttribute}]`).forEach((element) => {
      const mark = element.getAttribute(markAttribute) || "";
      if (style && (mark.startsWith("rankmiso:") || legacyMarks.has(mark))) {
        element.removeAttribute(markAttribute);
      }
    });
    document.querySelectorAll(`[${rankmisoHighlightAttribute}]`).forEach((element) => {
      if ((element.getAttribute(rankmisoHighlightAttribute) || "").startsWith("rankmiso:")) {
        element.removeAttribute(rankmisoHighlightAttribute);
      }
    });
    style?.remove();
    return { cleared: true };
  }

  function highlight(kind: string) {
    clearHighlight();
    const selectors: Record<string, string> = {
      headings: "h1, h2, h3, h4, h5, h6",
      h1: "h1",
      internal: "a[href]",
      external: "a[href]",
      nofollow: "a[rel~='nofollow' i]",
      sponsored: "a[rel~='sponsored' i]",
      ugc: "a[rel~='ugc' i]",
      "missing-alt": "img:not([alt])",
      "broken-images": "img",
    };
    const selector = selectors[kind];
    if (!selector) return { highlighted: 0 };
    const pageHost = location.hostname.replace(/^www\./, "");
    let count = 0;
    document.querySelectorAll(selector).forEach((element) => {
      if (kind === "internal" || kind === "external") {
        const href = element.getAttribute("href") || "";
        let url: URL;
        try {
          url = new URL(href, document.baseURI);
        } catch {
          return;
        }
        if (url.protocol !== "http:" && url.protocol !== "https:") return;
        const host = url.hostname.replace(/^www\./, "");
        const internal = host === pageHost;
        if (kind === "internal" && !internal) return;
        if (kind === "external" && internal) return;
      }
      if (kind === "broken-images") {
        const image = element as HTMLImageElement;
        if (!image.complete || image.naturalWidth !== 0 || !image.getAttribute("src")) return;
      }
      if (element.hasAttribute(rankmisoHighlightAttribute)) return;
      element.setAttribute(rankmisoHighlightAttribute, `rankmiso:${kind}`);
      count += 1;
    });
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      [${rankmisoHighlightAttribute}^="rankmiso:"] { outline: 2px solid #0f6e56 !important; outline-offset: 2px !important; }
      [${rankmisoHighlightAttribute}="rankmiso:external"] { outline-style: dashed !important; outline-color: #175cd3 !important; }
      [${rankmisoHighlightAttribute}="rankmiso:nofollow"], [${rankmisoHighlightAttribute}="rankmiso:sponsored"], [${rankmisoHighlightAttribute}="rankmiso:ugc"] { outline-style: dotted !important; outline-color: #8a5a00 !important; }
      [${rankmisoHighlightAttribute}="rankmiso:missing-alt"], [${rankmisoHighlightAttribute}="rankmiso:broken-images"] { outline-color: #b42318 !important; }
    `;
    document.documentElement.append(style);
    return { highlighted: count };
  }

  if (command === "extract") return extract(arg);
  if (command === "startInpCapture") return startInpCapture();
  if (command === "readInpCapture") return captureSnapshot();
  if (command === "stopInpCapture") return stopInpCapture();
  if (command === "marker") return installMarker();
  if (command === "generation") return generation();
  if (command === "highlight") return highlight(arg || "");
  if (command === "clear") return clearHighlight();
  return { error: "UNKNOWN_COMMAND" };
}
