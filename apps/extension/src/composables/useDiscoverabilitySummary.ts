import { computed, ref, watch, type Ref } from "vue";
import { useI18n } from "./useI18n";
import type { MessageKey } from "../locales/en";
import { crawlerAccessFor, renderingFor } from "../services/ai-search-store";
import { analyzeReadiness, summarize, type ReadinessReport } from "../services/readiness";
import { loadStore, type VisibilityStatus } from "../services/visibility";
import type { AuditResult, PageSnapshot } from "../types/audit";

export interface SummaryLine {
  title: string;
  sub: string;
  badge: string;
  tone: "ok" | "warn" | "gray";
}

const statusKey: Record<VisibilityStatus, MessageKey> = {
  cited: "visibility.status.cited",
  mentioned: "visibility.status.mentioned",
  "not-observed": "visibility.status.notObserved",
  unknown: "visibility.status.unknown",
  "not-measured": "visibility.status.notMeasured",
};

/**
 * Overview lines for Discoverability, from results already on this device: the latest
 * crawler check made in this window, content readiness from the collected snapshot, and the
 * local visibility journal. Nothing here makes a request.
 */
export function useDiscoverabilitySummary(
  audit: () => AuditResult,
  snapshot: Ref<PageSnapshot | null | undefined> | undefined,
) {
  const { t, n } = useI18n();
  const url = () => audit().page.url;
  const crawler = computed(() => crawlerAccessFor(url()));
  const rendering = computed(() => renderingFor(url()));

  const report = ref<ReadinessReport | null>(null);
  let run = 0;
  watch(
    [() => snapshot?.value, crawler, rendering],
    async ([page]) => {
      const current = ++run;
      if (!page || page.url !== url()) {
        report.value = null;
        return;
      }
      try {
        const next = await analyzeReadiness(page, crawler.value, rendering.value);
        if (current === run) report.value = next;
      } catch {
        if (current === run) report.value = null;
      }
    },
    { immediate: true },
  );

  const host = computed(() => {
    try {
      return new URL(url()).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  });

  const lines = computed<SummaryLine[]>(() => {
    const access = crawler.value?.report.agents;
    const accessLine: SummaryLine = access
      ? (() => {
          const blocked = access.filter((agent) => agent.crawl === "disallowed").length;
          const allowed = access.filter((agent) => agent.crawl === "allowed").length;
          return {
            title: t("disc.access"),
            sub: t("disc.accessRead", { allowed: n(allowed), blocked: n(blocked) }),
            badge: blocked ? t("disc.blocked", { count: n(blocked) }) : t("disc.noneBlocked"),
            tone: blocked ? "warn" : "ok",
          };
        })()
      : {
          title: t("disc.access"),
          sub: t("disc.accessNone"),
          badge: t("access.state.notMeasured"),
          tone: "gray",
        };

    const totals = report.value ? summarize(report.value.findings) : null;
    const readinessLine: SummaryLine = totals
      ? {
          title: t("disc.readiness"),
          sub: t("disc.readinessRead", {
            completed: n(totals.completed),
            notMeasured: n(totals.notMeasured),
          }),
          badge: totals.opportunities
            ? t("pa.reviewCount", { count: n(totals.opportunities) })
            : t("pa.observed"),
          tone: totals.opportunities ? "warn" : "ok",
        }
      : {
          title: t("disc.readiness"),
          sub: t("disc.readinessNone"),
          badge: t("access.state.notMeasured"),
          tone: "gray",
        };

    const { store } = loadStore();
    const queries = store.queries.filter(
      (query) => query.domain.replace(/^www\./, "").toLowerCase() === host.value,
    );
    const ids = new Set(queries.map((query) => query.id));
    const latest = store.observations
      .filter((item) => ids.has(item.queryId))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0];
    const visibilityLine: SummaryLine = queries.length
      ? {
          title: t("disc.visibility"),
          sub: latest
            ? t("disc.visibilityRead", { count: n(queries.length), date: latest.observedOn })
            : t("disc.visibilityNoSamples", { count: n(queries.length) }),
          badge: latest ? t(statusKey[latest.status]) : t("access.state.notMeasured"),
          tone: latest?.status === "cited" || latest?.status === "mentioned" ? "ok" : "gray",
        }
      : {
          title: t("disc.visibility"),
          sub: t("disc.visibilityNone"),
          badge: t("access.state.notMeasured"),
          tone: "gray",
        };

    return [accessLine, readinessLine, visibilityLine];
  });

  return { lines };
}
