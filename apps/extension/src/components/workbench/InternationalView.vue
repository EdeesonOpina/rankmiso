<script setup lang="ts">
import { computed } from "vue";
import type { AuditResult } from "../../types/audit";
import { resolveShareImage } from "../../services/share-preview";
import { useI18n } from "../../composables/useI18n";
import PageHeading from "./PageHeading.vue";
import WbCard from "./WbCard.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const links = computed(() => props.audit.details.hreflang);
const probe = computed(() => props.audit.details.site ?? null);
const names = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" });
  } catch {
    return null;
  }
})();

function languageName(code: string): string {
  if (code.toLowerCase() === "x-default") return t("wb.in.default");
  try {
    return names?.of(code) ?? code;
  } catch {
    return code;
  }
}

function href(value: string): string {
  return resolveShareImage(props.audit.page.url, value) ?? value;
}
</script>

<template>
  <PageHeading
    :overline="t('wb.in.overline')"
    :title="t('nav.international')"
    :text="t('wb.in.text')"
  />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ audit.details.metadata.language || "–" }}</strong
      ><span>{{ t("international.documentLanguage") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(links.length) }}</strong
      ><span>{{ t("wb.in.alternates") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(links.filter((link) => !link.validSyntax).length) }}</strong
      ><span>{{ t("wb.in.invalid") }}</span>
    </div>
  </div>
  <p v-if="!links.length" class="callout">{{ t("empty.hreflangBody") }}</p>
  <div v-else class="language-list">
    <div v-for="link in links" :key="`${link.lang}-${link.href}`" class="language-row">
      <div class="lang">{{ link.lang }}</div>
      <div>
        <strong>{{ languageName(link.lang) }}</strong>
        <small>
          <a :href="href(link.href)" target="_blank" rel="noopener noreferrer">{{
            href(link.href)
          }}</a>
        </small>
      </div>
      <span>
        <span class="badge" :class="link.validSyntax ? 'gray' : 'err'">
          {{ link.validSyntax ? t("wb.in.notChecked") : t("value.invalid") }}
        </span>
      </span>
    </div>
  </div>
  <WbCard :title="t('wb.in.boundaries')" class="spaced">
    <p class="hint first">{{ t("international.returnNote") }}</p>
    <p v-if="probe?.requested" class="hint">
      {{
        t("technical.hreflangCounts", {
          checked: n(probe.hreflangChecked),
          missing: n(probe.hreflangMissing),
          skipped: n(probe.hreflangSkipped ?? 0),
        })
      }}
    </p>
  </WbCard>
  <RelatedChecks :audit="audit" category="international" />
</template>
