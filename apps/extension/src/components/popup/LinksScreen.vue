<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import type { AuditResult } from "../../types/audit";
import {
  groupLinks,
  linkGroupOrder,
  selectLinks,
  type LinkGroupName,
} from "../../services/popup-summary";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";

defineOptions({ inheritAttrs: false });
const props = defineProps<{ audit: AuditResult }>();
const emit = defineEmits<{ copy: [value: string] }>();
const { t, n } = useI18n();
const query = ref("");
const STEP = 20;
const shownCount = reactive<Record<LinkGroupName, number>>({ internal: 3, external: 3, other: 3 });

const links = computed(() => props.audit.details.links);
const nofollow = computed(() => links.value.filter((link) => link.nofollow).length);
const groups = computed(() => groupLinks(selectLinks(links.value, "all", query.value)));
const searching = computed(() => query.value.trim().length > 0);
const truncated = computed(() => props.audit.source.limitations.includes("LINKS_TRUNCATED"));

const groupText: Record<LinkGroupName, { title: MessageKey; sub: MessageKey; more: MessageKey }> = {
  internal: { title: "pm.internalLinks", sub: "pm.internalSub", more: "pm.moreInternal" },
  external: { title: "pm.externalLinks", sub: "pm.externalSub", more: "pm.moreExternal" },
  other: { title: "pm.otherLinks", sub: "pm.otherSub", more: "pm.moreOther" },
};

function attributes(link: AuditResult["details"]["links"][number]): string[] {
  const list: string[] = [];
  if (link.nofollow) list.push("nofollow");
  if (link.sponsored) list.push("sponsored");
  if (link.ugc) list.push("ugc");
  return list;
}
</script>

<template>
  <div class="kicker">
    <span>{{ t("pane.links") }}</span
    ><span class="minor">{{ t("pm.localAudit") }}</span>
  </div>
  <div class="title-row" style="margin-top: 0">
    <h2>{{ t("popup.linkExplorer") }}</h2>
    <span class="badge">{{
      t(audit.metrics.counts.links === 1 ? "pm.linkCount" : "pm.linksCount", {
        count: n(audit.metrics.counts.links),
      })
    }}</span>
  </div>
  <div class="grid3">
    <div class="mini-tile">
      <strong>{{ n(audit.metrics.counts.internalLinks) }}</strong
      ><span>{{ t("links.internal") }}</span>
    </div>
    <div class="mini-tile">
      <strong>{{ n(audit.metrics.counts.externalLinks) }}</strong
      ><span>{{ t("links.external") }}</span>
    </div>
    <div class="mini-tile">
      <strong>{{ n(nofollow) }}</strong
      ><span>{{ t("popup.nofollowLabel") }}</span>
    </div>
  </div>
  <label class="field-label" for="link-search">{{ t("pm.searchDestinations") }}</label>
  <input id="link-search" v-model="query" class="field" :placeholder="t('pm.linkPlaceholder')" />

  <p v-if="!links.length" class="note" style="margin-top: 10px">{{ t("empty.linksBody") }}</p>
  <div v-else style="margin-top: 10px">
    <template v-for="name in linkGroupOrder" :key="name">
      <details
        v-if="!searching || groups[name].length"
        class="disclosure"
        :open="name === 'internal' || searching"
      >
        <summary>
          <span>
            <strong class="disclosure-title">{{ t(groupText[name].title) }}</strong>
            <span class="disclosure-sub">{{ t(groupText[name].sub) }}</span>
          </span>
          <span class="badge">{{ n(groups[name].length) }}</span>
        </summary>
        <div class="inside">
          <p v-if="!groups[name].length" class="row-sub">{{ t("popup.noLinksInGroup") }}</p>
          <div
            v-for="(link, index) in groups[name].slice(0, shownCount[name])"
            :key="`${link.href}-${index}`"
            class="row"
          >
            <div class="row-content">
              <strong class="row-title">{{ link.accessibleName || t("pm.noLinkText") }}</strong>
              <p class="link-url">{{ link.resolvedUrl || link.href }}</p>
              <span
                v-for="attribute in attributes(link)"
                :key="attribute"
                class="badge"
                style="margin: 5px 5px 0 0"
                >{{ attribute }}</span
              >
            </div>
            <button
              type="button"
              class="icon-btn"
              :aria-label="t('pm.copyLink', { name: link.accessibleName || link.href })"
              @click="emit('copy', link.resolvedUrl || link.href)"
            >
              ⧉
            </button>
          </div>
          <button
            v-if="groups[name].length > shownCount[name]"
            type="button"
            class="text-btn"
            style="margin-top: 7px"
            @click="shownCount[name] += STEP"
          >
            {{ t(groupText[name].more) }} ↗
          </button>
        </div>
      </details>
    </template>
    <p v-if="searching && !linkGroupOrder.some((name) => groups[name].length)" class="note">
      {{ t("pm.noLinkMatch") }}
    </p>
  </div>
  <p class="micro" style="margin-top: 12px">
    {{ truncated ? t("pm.linksTruncated") : t("pm.linksNote") }}
  </p>
</template>
