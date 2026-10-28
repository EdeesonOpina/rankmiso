<script setup lang="ts">
import { computed, reactive, ref, useId } from "vue";
import { Copy, Search } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import {
  groupLinks,
  initialLinkGroups,
  linkGroupOrder,
  selectLinks,
  type LinkGroupName,
} from "../../services/popup-summary";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";
import RelatedChecks from "./RelatedChecks.vue";

const props = defineProps<{ audit: AuditResult }>();
const { t, n } = useI18n();
const { copy, highlight, clearMarks } = useWorkbench();
const searchId = useId();
const query = ref("");
const STEP = 40;
const shown = reactive<Record<LinkGroupName, number>>({
  internal: STEP,
  external: STEP,
  other: STEP,
});
const all = computed(() => props.audit.details.links);
const searching = computed(() => query.value.trim().length > 0);
const groups = computed(() => groupLinks(selectLinks(all.value, "all", query.value)));
const preferred = ref<Record<LinkGroupName, boolean> | null>(null);
const open = computed(() =>
  searching.value
    ? {
        internal: groups.value.internal.length > 0,
        external: groups.value.external.length > 0,
        other: groups.value.other.length > 0,
      }
    : (preferred.value ?? initialLinkGroups(groupLinks(all.value))),
);
const truncated = computed(() => props.audit.source.limitations.includes("LINKS_TRUNCATED"));
const labels: Record<LinkGroupName, MessageKey> = {
  internal: "links.group.internal",
  external: "links.group.external",
  other: "wb.ln.other",
};

function onToggle(name: LinkGroupName, event: Event) {
  if (searching.value) return;
  const current = preferred.value ?? initialLinkGroups(groupLinks(all.value));
  preferred.value = { ...current, [name]: (event.target as HTMLDetailsElement).open };
}

function flags(link: AuditResult["details"]["links"][number]): string[] {
  const list: string[] = [];
  if (link.nofollow) list.push("nofollow");
  if (link.sponsored) list.push("sponsored");
  if (link.ugc) list.push("ugc");
  return list;
}
</script>

<template>
  <PageHeading
    :overline="t('wb.ln.overline')"
    :title="t('popup.linkExplorer')"
    :text="t('wb.ln.text')"
  />
  <div class="compact-stats">
    <div class="kpi">
      <strong>{{ n(audit.metrics.counts.links) }}</strong
      ><span>{{ t("wb.ln.total") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(audit.metrics.counts.internalLinks) }}</strong
      ><span>{{ t("links.internal") }}</span>
    </div>
    <div class="kpi">
      <strong>{{ n(audit.metrics.counts.externalLinks) }}</strong
      ><span>{{ t("links.external") }}</span>
    </div>
  </div>
  <label class="search" :for="searchId">
    <Search class="ic" aria-hidden="true" />
    <input
      :id="searchId"
      v-model="query"
      type="search"
      autocomplete="off"
      :placeholder="t('wb.ln.search')"
      :aria-label="t('links.search')"
    />
  </label>
  <p v-if="!all.length" class="callout">{{ t("empty.linksBody") }}</p>
  <div v-else class="group-stack">
    <template v-for="name in linkGroupOrder" :key="name">
      <details
        v-if="!searching || groups[name].length"
        class="disclosure"
        :open="open[name]"
        @toggle="onToggle(name, $event)"
      >
        <summary>
          <span>{{ t(labels[name]) }}</span
          ><em>{{ n(groups[name].length) }}</em
          ><span aria-hidden="true">⌄</span>
        </summary>
        <div class="details-body">
          <p v-if="!groups[name].length">{{ t("popup.noLinksInGroup") }}</p>
          <div
            v-for="(link, index) in groups[name].slice(0, shown[name])"
            :key="`${link.href}-${index}`"
            class="link-entry"
          >
            <div>
              <strong :class="{ 'is-empty': !link.accessibleName }">{{
                link.accessibleName || t("pm.noLinkText")
              }}</strong>
              <p>{{ link.resolvedUrl || link.href }}</p>
              <span v-for="flag in flags(link)" :key="flag" class="badge gray link-flag">{{
                flag
              }}</span>
            </div>
            <button
              type="button"
              class="icon-ghost"
              :aria-label="t('pm.copyLink', { name: link.accessibleName || link.href })"
              @click="copy(link.resolvedUrl || link.href)"
            >
              <Copy class="ic" aria-hidden="true" />
            </button>
          </div>
          <button
            v-if="groups[name].length > shown[name]"
            type="button"
            class="subtle-btn more-btn"
            @click="shown[name] += STEP"
          >
            {{ t("wb.showMore", { count: n(groups[name].length - shown[name]) }) }} →
          </button>
        </div>
      </details>
    </template>
    <p
      v-if="searching && !linkGroupOrder.some((name) => groups[name].length)"
      class="details-body empty-note"
    >
      {{ t("pm.noLinkMatch") }}
    </p>
  </div>
  <p class="hint">{{ truncated ? t("pm.linksTruncated") : t("pm.linksNote") }}</p>
  <div class="actions-row" role="group" :aria-label="t('links.actions')">
    <button type="button" class="quiet" @click="highlight('internal')">
      {{ t("action.highlightInternal") }}
    </button>
    <button type="button" class="quiet" @click="highlight('external')">
      {{ t("action.highlightExternal") }}
    </button>
    <button type="button" class="quiet" @click="highlight('nofollow')">
      {{ t("action.highlightNofollow") }}
    </button>
    <button type="button" class="quiet" @click="clearMarks">
      {{ t("action.clearHighlights") }}
    </button>
  </div>
  <RelatedChecks :audit="audit" category="links" />
</template>
