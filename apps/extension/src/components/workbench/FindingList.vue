<script setup lang="ts" generic="T extends CheckResult">
import { useI18n } from "../../composables/useI18n";
import type { CheckResult } from "../../types/audit";

/**
 * One list style for engine findings shown outside Issues (content readiness, crawl
 * relationships, redirects, structured data): status in words, explanation, next step,
 * evidence, and sources. The `actions` slot adds per-finding buttons.
 */
defineProps<{ findings: readonly T[] }>();
const { t } = useI18n();

function label(finding: CheckResult): string {
  if (finding.status === "ERROR" || finding.status === "WARNING") return t("ready.status.review");
  if (finding.status === "INFO")
    return t(finding.recommendation ? "ready.status.opportunity" : "ready.status.observation");
  if (finding.status === "PASS") return t("ready.status.clear");
  if (finding.status === "UNAVAILABLE") return t("ready.status.notMeasured");
  return t("ready.status.notApplicable");
}

function tone(finding: CheckResult): "ok" | "warn" | "err" | "gray" {
  if (finding.status === "ERROR") return "err";
  if (finding.status === "WARNING") return "warn";
  if (finding.status === "PASS") return "ok";
  return "gray";
}
</script>

<template>
  <ul class="ax-findings" role="list">
    <li v-for="finding in findings" :key="finding.id" class="ax-finding">
      <span
        class="record-dot"
        :class="tone(finding) === 'ok' ? 'good' : tone(finding)"
        aria-hidden="true"
      ></span>
      <div class="ax-finding-main">
        <div class="ax-finding-head">
          <h4>{{ finding.title }}</h4>
          <span class="badge" :class="tone(finding)">{{ label(finding) }}</span>
        </div>
        <p>{{ finding.description }}</p>
        <p v-if="finding.recommendation" class="ax-next">
          <strong>{{ t("ready.next") }}</strong> {{ finding.recommendation }}
        </p>
        <div class="ax-finding-actions"><slot name="actions" :finding="finding" /></div>
        <details
          v-if="finding.evidence.length || finding.references.length"
          class="disclosure ax-evidence"
        >
          <summary>{{ t("access.evidence") }}<span aria-hidden="true">⌄</span></summary>
          <div class="details-body ax-crawler">
            <dl v-if="finding.evidence.length">
              <div v-for="(item, index) in finding.evidence" :key="`${item.label}-${index}`">
                <dt>{{ item.label }}</dt>
                <dd>{{ item.value }}</dd>
              </div>
            </dl>
            <p v-for="source in finding.references" :key="source.url">
              <a :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}</a>
            </p>
          </div>
        </details>
      </div>
    </li>
  </ul>
</template>
