import { computed, onBeforeUnmount, ref } from "vue";
import { browser } from "wxt/browser";
import { useI18n } from "./useI18n";
import { crawlerById, type PlatformDefinition } from "../config/crawlers.config";
import type { MessageKey } from "../locales/en";
import {
  checkCrawlerAccess,
  type AccessCheck,
  type AgentVerdict,
  type CrawlState,
} from "../services/crawler-access";
import { sitePermission } from "../services/page-access";
import { crawlerAccessFor, rememberCrawlerAccess } from "../services/ai-search-store";

const stateKey: Record<CrawlState, MessageKey> = {
  allowed: "access.state.allowed",
  disallowed: "access.state.disallowed",
  "no-rules": "access.state.noRules",
  "robots-missing": "access.state.robotsMissing",
  "robots-error": "access.state.robotsError",
  "not-measured": "access.state.notMeasured",
};
const useKey: Partial<Record<CrawlState, MessageKey>> = {
  allowed: "access.use.allowed",
  disallowed: "access.use.disallowed",
  "no-rules": "access.use.none",
  "robots-missing": "access.use.none",
};

export function isPreference(id: string | undefined): boolean {
  return !!id && crawlerById(id)?.kind === "content-use";
}

/** Content-use tokens are preferences, so their tone stays neutral. */
export function tone(
  verdict: AgentVerdict | undefined,
  contentToken = false,
): "ok" | "warn" | "gray" {
  if (!verdict || contentToken) return "gray";
  if (verdict.crawl === "disallowed" || verdict.crawl === "robots-error") return "warn";
  if (verdict.crawl === "not-measured") return "gray";
  return "ok";
}

/**
 * One crawler-access check for one page, shared by the report and the popup. Asks for site
 * access inside the click, reads robots.txt and the page once, and keeps the latest result
 * in memory for this page context only.
 */
export function useCrawlerAccess(url: () => string) {
  const { t, n } = useI18n();
  // Shared with every RankMiso window through the store; a new check anywhere shows here.
  const result = computed<AccessCheck | null>(() => crawlerAccessFor(url()) ?? null);
  const busy = ref(false);
  const message = ref("");
  let controller: AbortController | null = null;

  const host = computed(() => sitePermission(url())?.hostname ?? "");
  const verdicts = computed(
    () => new Map(result.value?.report.agents.map((agent) => [agent.id, agent]) ?? []),
  );
  const counts = computed(() => {
    const agents = result.value?.report.agents ?? [];
    const count = (states: CrawlState[]) =>
      n(agents.filter((agent) => states.includes(agent.crawl)).length);
    return {
      allowed: count(["allowed"]),
      disallowed: count(["disallowed"]),
      noRule: count(["no-rules", "robots-missing"]),
      unknown: count(["robots-error", "not-measured"]),
    };
  });

  /** Content-use tokens are preferences, so their wording stays neutral. */
  function label(verdict: AgentVerdict | undefined, contentToken = false): string {
    if (!verdict) return t("access.state.notMeasured");
    const key = contentToken ? useKey[verdict.crawl] : undefined;
    return t(key ?? stateKey[verdict.crawl]);
  }

  /** The crawler a platform's status follows. */
  function lead(item: PlatformDefinition): AgentVerdict | undefined {
    return item.crawlerIds[0] ? verdicts.value.get(item.crawlerIds[0]) : undefined;
  }

  async function check() {
    if (busy.value) return;
    message.value = "";
    const permission = sitePermission(url());
    if (!permission) {
      message.value = t("access.noOrigin");
      return;
    }
    let granted = false;
    try {
      // Keep the request inside the click's user-action context (Firefox requires it).
      granted = await browser.permissions.request({ origins: [permission.pattern] });
    } catch {
      message.value = t("access.unavailable");
      return;
    }
    if (!granted) {
      message.value = t("access.denied");
      return;
    }
    controller?.abort();
    controller = new AbortController();
    busy.value = true;
    try {
      const page = url();
      rememberCrawlerAccess(page, await checkCrawlerAccess(page, controller.signal));
    } catch (error) {
      message.value = t(
        error instanceof DOMException && error.name === "AbortError"
          ? "access.cancelled"
          : "access.failed",
      );
    } finally {
      busy.value = false;
    }
  }

  function cancel() {
    controller?.abort();
  }

  onBeforeUnmount(cancel);

  return {
    result,
    busy,
    message,
    host,
    verdicts,
    counts,
    check,
    cancel,
    label,
    tone,
    lead,
    isPreference,
  };
}
