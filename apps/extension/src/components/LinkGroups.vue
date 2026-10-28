<script setup lang="ts">
import { computed, ref } from "vue";
import {
  groupLinks,
  initialLinkGroups,
  linkGroupOrder,
  type LinkGroupName,
} from "../services/popup-summary";
import { resolveShareImage } from "../services/share-preview";
import { useI18n } from "../composables/useI18n";
import CopyButton from "./CopyButton.vue";

const props = defineProps<{
  links: ReadonlyArray<{
    href: string;
    resolvedUrl: string | null;
    accessibleName: string;
    classification: string;
    rel: string[];
    nofollow: boolean;
    sponsored: boolean;
    ugc: boolean;
  }>;
  pageUrl: string;
  limit: number;
  searching: boolean;
  truncated: boolean;
}>();

const { t } = useI18n();
const preferred = ref<Record<LinkGroupName, boolean> | null>(null);
const shown = ref<Record<LinkGroupName, number>>({
  internal: props.limit,
  external: props.limit,
  other: props.limit,
});
const grouped = computed(() => groupLinks(props.links));
const open = computed(() => {
  if (props.searching) {
    return {
      internal: grouped.value.internal.length > 0,
      external: grouped.value.external.length > 0,
      other: grouped.value.other.length > 0,
    };
  }
  return preferred.value ?? initialLinkGroups(grouped.value);
});

function label(group: LinkGroupName): string {
  if (group === "internal") return t("links.group.internal");
  if (group === "external") return t("links.group.external");
  return t("links.group.other");
}

function onToggle(group: LinkGroupName, event: Event) {
  if (props.searching || event.target !== event.currentTarget) return;
  const current = preferred.value ?? initialLinkGroups(grouped.value);
  preferred.value = { ...current, [group]: (event.target as HTMLDetailsElement).open };
}

function destination(link: (typeof props.links)[number]): string {
  return link.resolvedUrl || link.href;
}

function openable(link: (typeof props.links)[number]): string | null {
  return resolveShareImage(props.pageUrl, destination(link));
}
</script>

<template>
  <p v-if="truncated" class="json-note">{{ t("links.truncated") }}</p>
  <p v-if="searching && links.length === 0" class="m-0 text-[13px] text-muted">
    {{ t("links.noMatch") }}
  </p>
  <div v-else class="link-groups">
    <details
      v-for="group in linkGroupOrder"
      :key="group"
      class="link-group"
      :open="open[group]"
      @toggle="onToggle(group, $event)"
    >
      <summary>
        <span>{{ label(group) }}</span>
        <span class="json-hint">{{ grouped[group].length }}</span>
      </summary>
      <ul class="link-records">
        <li
          v-for="(link, index) in grouped[group].slice(0, shown[group])"
          :key="`${link.href}-${index}`"
        >
          <details class="link-record">
            <summary>
              <span>{{ link.accessibleName || t("value.noName") }}</span>
              <span class="link-url">{{ destination(link) }}</span>
              <span v-if="link.nofollow" class="link-badge">{{ t("links.nofollow") }}</span>
              <span v-if="link.sponsored" class="link-badge">{{ t("links.sponsored") }}</span>
              <span v-if="link.ugc" class="link-badge">{{ t("links.ugc") }}</span>
            </summary>
            <dl class="link-detail">
              <div>
                <dt>{{ t("field.url") }}</dt>
                <dd>
                  <a
                    v-if="openable(link)"
                    :href="openable(link) ?? undefined"
                    target="_blank"
                    rel="noopener noreferrer"
                    >{{ openable(link) }}</a
                  >
                  <span v-else>{{ destination(link) }}</span>
                </dd>
              </div>
              <div>
                <dt>{{ t("field.class") }}</dt>
                <dd>{{ link.classification }}</dd>
              </div>
              <div v-if="link.rel.length">
                <dt>{{ t("field.rel") }}</dt>
                <dd>{{ link.rel.join(" ") }}</dd>
              </div>
              <CopyButton :value="destination(link)" :label="t('action.copy')" />
            </dl>
          </details>
        </li>
      </ul>
      <button
        v-if="grouped[group].length > shown[group]"
        type="button"
        class="inspector-action"
        @click="shown[group] += limit"
      >
        {{ t("links.showMore", { group: label(group) }) }}
      </button>
      <p v-if="grouped[group].length > shown[group]" class="json-note">
        {{ t("links.capped", { shown: shown[group], total: grouped[group].length }) }}
      </p>
    </details>
  </div>
</template>
