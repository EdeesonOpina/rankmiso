import { computed, ref } from "vue";
import { analyzeSnapshot } from "../services/engine";
import {
  activeTab,
  friendlyInspectionError,
  inspectTab,
  readGeneration,
  type InspectedTab,
} from "../services/inspect";
import type { AuditResult, PageSnapshot } from "../types/audit";
import { formatNumber } from "./useI18n";

export function useAudit(explicitTabId?: number) {
  const status = ref<"idle" | "loading" | "ready" | "error">("idle");
  const error = ref("");
  const audit = ref<AuditResult | null>(null);
  const snapshot = ref<PageSnapshot | null>(null);
  const tab = ref<InspectedTab | null>(null);
  const stale = ref(false);
  const analyzedGeneration = ref(0);

  const scoreText = computed(() => {
    if (!audit.value?.score.available || audit.value.score.value == null) return "–";
    return formatNumber(audit.value.score.value);
  });

  async function refresh() {
    status.value = "loading";
    error.value = "";
    stale.value = false;
    try {
      const current = explicitTabId
        ? { id: explicitTabId, url: undefined, title: undefined }
        : await activeTab();
      if (!current?.id) throw new Error("No active tab is available.");
      tab.value = current;
      const page = await inspectTab(current.id);
      snapshot.value = page;
      audit.value = await analyzeSnapshot(page);
      analyzedGeneration.value = page.collection.domGeneration;
      status.value = "ready";
    } catch (caught) {
      status.value = "error";
      error.value = friendlyInspectionError(caught);
    }
  }

  async function checkFreshness() {
    if (!tab.value?.id || !audit.value) return;
    try {
      const current = await readGeneration(tab.value.id);
      stale.value =
        current.url !== audit.value.page.url || current.generation !== analyzedGeneration.value;
    } catch {
      stale.value = false;
    }
  }

  return { status, error, audit, snapshot, tab, stale, scoreText, refresh, checkFreshness };
}
