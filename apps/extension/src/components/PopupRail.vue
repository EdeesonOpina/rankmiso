<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { Component } from "vue";
import {
  Braces,
  Clock,
  Download,
  Eye,
  FileText,
  Gauge,
  Globe,
  Heading,
  Image,
  Layers,
  LayoutGrid,
  Link,
  Network,
  Settings,
  Share2,
  SlidersHorizontal,
  TextAlignStart,
  TriangleAlert,
} from "lucide-vue-next";
import { brandConfig } from "../config/brand.config";

const props = defineProps<{
  items: { id: string; label: string; short: string }[];
  current: string;
  label: string;
  menuLabel: string;
  menuOpen: boolean;
}>();

const emit = defineEmits<{ select: [id: string]; more: [] }>();

const icons: Record<string, Component> = {
  overview: LayoutGrid,
  issues: TriangleAlert,
  metadata: FileText,
  content: TextAlignStart,
  headings: Heading,
  links: Link,
  images: Image,
  schema: Braces,
  social: Share2,
  technical: SlidersHorizontal,
  performance: Gauge,
  international: Globe,
  accessibility: Eye,
  site: Layers,
  sitemaps: Network,
  reports: Clock,
  export: Download,
  settings: Settings,
};

const nav = ref<HTMLElement | null>(null);
const moreButton = ref<HTMLButtonElement | null>(null);

watch(
  () => props.current,
  async (id) => {
    await nextTick();
    nav.value?.querySelector(`[data-nav="${id}"]`)?.scrollIntoView({ block: "nearest" });
  },
);

watch(
  () => props.menuOpen,
  (open) => {
    if (!open) moreButton.value?.focus();
  },
);

async function onKeys(event: KeyboardEvent) {
  const ids = props.items.map((item) => item.id);
  const index = Math.max(0, ids.indexOf(props.current));
  let next = index;
  if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % ids.length;
  else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
    next = (index - 1 + ids.length) % ids.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ids.length - 1;
  else return;
  event.preventDefault();
  const id = ids[next];
  if (!id) return;
  emit("select", id);
  await nextTick();
  nav.value?.querySelector<HTMLButtonElement>(`[data-nav="${id}"]`)?.focus();
}
</script>

<template>
  <aside class="rail" :aria-label="label">
    <button
      type="button"
      class="brand"
      :aria-label="`${brandConfig.identity.name} ${items[0]?.label ?? ''}`"
      @click="emit('select', 'overview')"
    >
      <span class="brand-square">
        <img :src="brandConfig.assets.icon" :alt="brandConfig.identity.name" />
      </span>
    </button>
    <nav ref="nav" class="rail-nav" :aria-label="label" @keydown="onKeys">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="rail-link"
        :data-nav="item.id"
        :title="item.label"
        :aria-label="item.label"
        :aria-current="current === item.id ? 'page' : undefined"
        :tabindex="current === item.id ? 0 : -1"
        @click="emit('select', item.id)"
      >
        <component :is="icons[item.id] ?? LayoutGrid" aria-hidden="true" />
        <span>{{ item.short }}</span>
      </button>
    </nav>
    <div class="rail-bottom">
      <button
        ref="moreButton"
        type="button"
        class="more"
        :aria-label="menuLabel"
        :title="menuLabel"
        aria-haspopup="dialog"
        :aria-expanded="menuOpen"
        @click="emit('more')"
      >
        ···
      </button>
    </div>
  </aside>
</template>
