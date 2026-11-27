<script setup lang="ts">
import { computed } from "vue";
import { crawlerById, platformShortNames, platforms } from "../config/crawlers.config";
import { useI18n } from "../composables/useI18n";
import { useCrawlerAccess } from "../composables/useCrawlerAccess";
import type { MessageKey } from "../locales/en";
import type { CrawlState } from "../services/crawler-access";
import PlatformMark from "./PlatformMark.vue";

/**
 * Every platform's mark with its latest crawler-access reading, for Overview. The reading is
 * the stored check for this page (shared by all RankMiso windows); Check access runs a new one.
 */
const props = defineProps<{ url: string; buttonClass?: string }>();
const { t } = useI18n();
const { result, busy, message, host, check, verdicts, label, tone, isPreference } =
  useCrawlerAccess(() => props.url);

const crawlKey: Record<CrawlState, MessageKey> = {
  allowed: "disc.st.allowed",
  disallowed: "disc.st.disallowed",
  "no-rules": "disc.st.noRule",
  "robots-missing": "disc.st.noRule",
  "robots-error": "disc.st.error",
  "not-measured": "disc.st.notMeasured",
};
const useKey: Record<CrawlState, MessageKey> = {
  allowed: "disc.st.useOpen",
  disallowed: "disc.st.useRestricted",
  "no-rules": "disc.st.useNone",
  "robots-missing": "disc.st.useNone",
  "robots-error": "disc.st.error",
  "not-measured": "disc.st.notMeasured",
};

const tiles = computed(() =>
  platforms.map((item) => {
    const id = item.crawlerIds[0];
    const verdict = id ? verdicts.value.get(id) : undefined;
    const preference = isPreference(id);
    const unsupported = item.supportLevel === "unsupported";
    return {
      id: item.id,
      name: item.name,
      short: platformShortNames[item.id] ?? item.name,
      token: id ? (crawlerById(id)?.token ?? "") : "",
      state: unsupported
        ? t("disc.st.unsupported")
        : verdict
          ? t((preference ? useKey : crawlKey)[verdict.crawl])
          : t("disc.st.notMeasured"),
      full: unsupported ? t("access.state.unsupported") : label(verdict, preference),
      tone: unsupported ? "gray" : tone(verdict, preference),
    };
  }),
);
const checked = computed(() =>
  result.value
    ? t("access.checked", { time: new Date(result.value.checkedAt).toLocaleString() })
    : t("disc.snapNone"),
);
</script>

<template>
  <div class="psnap">
    <div class="psnap-head">
      <div>
        <strong>{{ t("disc.snapTitle") }}</strong>
        <span>{{ checked }}</span>
      </div>
      <button
        type="button"
        :class="buttonClass ?? 'secondary'"
        :disabled="busy || !host"
        :aria-busy="busy"
        @click="check"
      >
        {{ busy ? t("access.checking") : t("access.check") }}
      </button>
    </div>
    <p v-if="message" class="psnap-message" role="status">{{ message }}</p>
    <ul class="psnap-grid" role="list">
      <li
        v-for="tile in tiles"
        :key="tile.id"
        class="psnap-tile"
        :title="`${tile.name}${tile.token ? ` · ${tile.token}` : ''}: ${tile.full}`"
      >
        <PlatformMark :platform-id="tile.id" :name="tile.name" />
        <span class="psnap-text" aria-hidden="true">
          <strong>{{ tile.short }}</strong>
          <span class="psnap-state" :class="tile.tone"
            ><i aria-hidden="true"></i>{{ tile.state }}</span
          >
        </span>
        <span class="sr-only">{{ tile.name }}: {{ tile.full }}</span>
      </li>
    </ul>
  </div>
</template>
