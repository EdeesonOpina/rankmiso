<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { browser } from "wxt/browser";
import { ArrowDownToLine, CircleCheck, ShieldCheck, Share2 } from "lucide-vue-next";
import type { AuditResult } from "../../types/audit";
import {
  exportAuditJson,
  exportChecksCsv,
  exportHeadingsCsv,
  exportHtmlReport,
  exportImagesCsv,
  exportLinksCsv,
} from "../../services/export";
import type { MessageKey } from "../../locales/en";
import { useI18n } from "../../composables/useI18n";
import { writeMcpIntegrationEnabled } from "../../adapters/storage";
import { serializeAuditJson } from "../../services/export";
import {
  checkNativeCompanion,
  isNativeMessagingPermissionRequestPending,
  requestNativeMessagingPermission,
  hasNativeMessagingPermission,
  NativeCompanionError,
  MAX_NATIVE_MESSAGE_BYTES,
  shareAudit,
} from "../../services/mcp-native-bridge";
import PageHeading from "./PageHeading.vue";
import { useWorkbench } from "./context";

const props = defineProps<{ audit: AuditResult }>();
const { t } = useI18n();
const { tabId, toast, go } = useWorkbench();
const pending = ref<string | null>(null);
const shareOpen = ref(false);
const shareBusy = ref(false);
const shareMessage = ref("");
const shareFailed = ref(false);
const shareSucceeded = ref(false);
const mcpPermission = ref(false);
const mcpPermissionPending = ref(false);
const connectOpen = ref(false);
const connectStatus = ref<
  "checking" | "permission-required" | "awaiting-permission" | "not-installed" | "connection-failed"
>("checking");
const connectBusy = ref(false);
const shareSnapshot = ref<AuditResult | null>(null);
const shareButton = ref<HTMLButtonElement | null>(null);
const shareDialog = ref<HTMLDialogElement | null>(null);
const connectDialog = ref<HTMLDialogElement | null>(null);
const shareConfirm = ref<HTMLButtonElement | null>(null);
const connectAction = ref<HTMLButtonElement | null>(null);
const connectStatusMessage = computed(() => {
  const messages: Record<typeof connectStatus.value, MessageKey> = {
    checking: "mcp.connectChecking",
    "permission-required": "mcp.statePermissionRequiredMessage",
    "awaiting-permission": "mcp.stateAwaitingPermissionMessage",
    "not-installed": "mcp.connectNotInstalled",
    "connection-failed": "mcp.stateConnectionFailedMessage",
  };
  return t(messages[connectStatus.value]);
});
const connectStatusTitle = computed(() => {
  const titles: Record<typeof connectStatus.value, MessageKey> = {
    checking: "mcp.stateChecking",
    "permission-required": "mcp.statePermissionRequired",
    "awaiting-permission": "mcp.stateAwaitingPermission",
    "not-installed": "mcp.stateNotInstalled",
    "connection-failed": "mcp.stateConnectionFailed",
  };
  return t(titles[connectStatus.value]);
});
const serializedSize = computed(() =>
  shareSnapshot.value
    ? new TextEncoder().encode(serializeAuditJson(shareSnapshot.value)).byteLength
    : 0,
);
const displaySize = computed(() =>
  serializedSize.value < 1024 * 1024
    ? `${Math.max(1, Math.round(serializedSize.value / 1024))} KB`
    : `${(serializedSize.value / (1024 * 1024)).toFixed(1)} MB`,
);
const canShareSize = computed(() => serializedSize.value + 1024 < MAX_NATIVE_MESSAGE_BYTES);

const formats: Array<{
  id: string;
  glyph: string;
  title: MessageKey;
  sub: MessageKey;
  action: MessageKey;
  run: (audit: AuditResult) => void;
}> = [
  {
    id: "html",
    glyph: "HTML",
    title: "wb.ex.html",
    sub: "wb.ex.htmlSub",
    action: "action.exportHtml",
    run: exportHtmlReport,
  },
  {
    id: "json",
    glyph: "JSON",
    title: "wb.ex.json",
    sub: "wb.ex.jsonSub",
    action: "action.exportJson",
    run: exportAuditJson,
  },
  {
    id: "checks",
    glyph: "CSV",
    title: "wb.ex.checks",
    sub: "wb.ex.checksSub",
    action: "action.exportChecks",
    run: exportChecksCsv,
  },
  {
    id: "links",
    glyph: "CSV",
    title: "wb.ex.links",
    sub: "wb.ex.linksSub",
    action: "action.exportLinks",
    run: exportLinksCsv,
  },
  {
    id: "headings",
    glyph: "CSV",
    title: "wb.ex.headings",
    sub: "wb.ex.headingsSub",
    action: "action.exportHeadings",
    run: exportHeadingsCsv,
  },
  {
    id: "images",
    glyph: "CSV",
    title: "wb.ex.images",
    sub: "wb.ex.imagesSub",
    action: "action.exportImages",
    run: exportImagesCsv,
  },
];

function confirm() {
  const format = formats.find((item) => item.id === pending.value);
  pending.value = null;
  format?.run(props.audit);
}

async function openShareConfirmation() {
  shareMessage.value = "";
  shareFailed.value = false;
  shareSucceeded.value = false;
  try {
    shareSnapshot.value = JSON.parse(serializeAuditJson(props.audit)) as AuditResult;
    if (!tabId.value) throw new Error(t("mcp.pageUnavailable"));
    const current = await browser.tabs.get(tabId.value);
    if (!sameInspectedPage(current.url)) throw new Error(t("mcp.pageChanged"));
  } catch (error) {
    shareSnapshot.value = null;
    const message = error instanceof Error ? error.message : "";
    shareMessage.value = [t("mcp.pageUnavailable"), t("mcp.pageChanged")].includes(message)
      ? message
      : t("mcp.pageUnavailable");
    return;
  }
  connectStatus.value = "checking";
  connectOpen.value = true;
  await nextTick();
  connectDialog.value?.showModal();
  await checkShareConnection();
}

async function checkShareConnection() {
  if (connectBusy.value) return;
  connectBusy.value = true;
  connectStatus.value = "checking";
  try {
    if (mcpPermissionPending.value || isNativeMessagingPermissionRequestPending()) {
      mcpPermission.value = await hasNativeMessagingPermission();
      if (!connectOpen.value) return;
      if (!mcpPermission.value) {
        connectStatus.value = "awaiting-permission";
        return;
      }
      mcpPermissionPending.value = false;
    } else {
      mcpPermission.value = await hasNativeMessagingPermission();
      if (!connectOpen.value) return;
    }
    if (!mcpPermission.value) {
      connectStatus.value = "permission-required";
      return;
    }
    await checkNativeCompanion(true);
    if (!connectOpen.value) return;
    connectDialog.value?.close();
    connectOpen.value = false;
    shareOpen.value = true;
    await nextTick();
    shareDialog.value?.showModal();
    shareConfirm.value?.focus();
  } catch (error) {
    if (!connectOpen.value) return;
    connectStatus.value =
      error instanceof NativeCompanionError && error.code === "not-installed"
        ? "not-installed"
        : error instanceof NativeCompanionError && error.code === "permission-required"
          ? "permission-required"
          : "connection-failed";
  } finally {
    connectBusy.value = false;
    if (connectOpen.value && connectStatus.value !== "checking") {
      await nextTick();
      connectAction.value?.focus();
    }
  }
}

async function connectBeforeShare() {
  if (connectBusy.value) return;
  if (
    connectStatus.value === "permission-required" ||
    connectStatus.value === "awaiting-permission"
  ) {
    connectBusy.value = true;
    connectStatus.value = "checking";
    try {
      if (mcpPermissionPending.value || isNativeMessagingPermissionRequestPending()) {
        mcpPermission.value = await hasNativeMessagingPermission();
        if (!connectOpen.value) return;
        if (!mcpPermission.value) {
          connectStatus.value = "awaiting-permission";
          return;
        }
        mcpPermissionPending.value = false;
      } else {
        const granted = await requestNativeMessagingPermission();
        if (!connectOpen.value) return;
        if (granted === null) {
          mcpPermissionPending.value = true;
          connectStatus.value = "awaiting-permission";
          return;
        }
        if (!granted) {
          connectStatus.value = "permission-required";
          return;
        }
        mcpPermission.value = true;
        try {
          await writeMcpIntegrationEnabled(true);
        } catch {
          // Connection can still be checked if the preference cannot be persisted.
        }
      }
    } catch {
      connectStatus.value = "permission-required";
      return;
    } finally {
      connectBusy.value = false;
    }
  }
  await checkShareConnection();
}

function openAiIntegrations() {
  connectDialog.value?.close();
  connectOpen.value = false;
  shareSnapshot.value = null;
  go("ai-integrations");
}

async function cancelConnection() {
  connectDialog.value?.close();
  connectOpen.value = false;
  shareSnapshot.value = null;
  await nextTick();
  shareButton.value?.focus();
}

async function cancelShare() {
  shareDialog.value?.close();
  shareOpen.value = false;
  shareSnapshot.value = null;
  shareMessage.value = "";
  shareFailed.value = false;
  await nextTick();
  shareButton.value?.focus();
}

function sameInspectedPage(current: string | undefined): boolean {
  try {
    const expected = new URL(shareSnapshot.value?.page.url ?? "");
    const actual = new URL(current ?? "");
    return (
      ["http:", "https:"].includes(expected.protocol) &&
      expected.origin === actual.origin &&
      expected.pathname === actual.pathname &&
      expected.search === actual.search
    );
  } catch {
    return false;
  }
}

async function shareConfirmed() {
  if (shareBusy.value) return;
  if (!canShareSize.value) {
    shareMessage.value = t("mcp.tooLarge");
    return;
  }
  shareBusy.value = true;
  shareMessage.value = "";
  shareFailed.value = false;
  try {
    // Invoke the permission request before awaiting anything so browsers retain
    // the confirming button's user gesture.
    if (mcpPermissionPending.value || isNativeMessagingPermissionRequestPending()) {
      mcpPermission.value = await hasNativeMessagingPermission();
      if (!mcpPermission.value) {
        if (isNativeMessagingPermissionRequestPending()) {
          mcpPermissionPending.value = true;
          shareMessage.value = t("mcp.permissionWaiting");
        } else {
          mcpPermissionPending.value = false;
          shareMessage.value = t("mcp.permissionDenied");
        }
        return;
      }
      mcpPermissionPending.value = false;
    }
    const granted = mcpPermission.value || (await requestNativeMessagingPermission());
    if (granted === null) {
      mcpPermissionPending.value = true;
      shareMessage.value = t("mcp.permissionWaiting");
      return;
    }
    if (!granted) {
      shareMessage.value = t("mcp.permissionDenied");
      return;
    }
    if (!tabId.value) throw new Error(t("mcp.pageUnavailable"));
    const current = await browser.tabs.get(tabId.value);
    if (!sameInspectedPage(current.url)) throw new Error(t("mcp.pageChanged"));
    if (!shareSnapshot.value) throw new Error(t("mcp.pageUnavailable"));
    await shareAudit(shareSnapshot.value);
    try {
      await writeMcpIntegrationEnabled(true);
    } catch {
      // A confirmed local share remains successful if preference storage is unavailable.
    }
    shareDialog.value?.close();
    shareOpen.value = false;
    shareSnapshot.value = null;
    shareMessage.value = "";
    shareSucceeded.value = true;
    toast(t("mcp.sharedToast"), t("mcp.sharedToastText"), "success");
  } catch {
    shareMessage.value = t("mcp.shareFailed");
    shareFailed.value = true;
  } finally {
    shareBusy.value = false;
  }
}
</script>

<template>
  <PageHeading :overline="t('wb.ex.overline')" :title="t('wb.ex.title')" :text="t('wb.ex.text')" />
  <div class="formats">
    <button
      v-for="format in formats"
      :key="format.id"
      type="button"
      class="format-button"
      :class="{ 'is-pending': pending === format.id }"
      :aria-label="t(format.action)"
      :aria-expanded="pending === format.id"
      @click="pending = pending === format.id ? null : format.id"
    >
      <span class="file-glyph" aria-hidden="true">{{ format.glyph }}</span>
      <span>
        <strong>{{ t(format.title) }}</strong>
        <small>{{ t(format.sub) }}</small>
      </span>
      <ArrowDownToLine class="ic" aria-hidden="true" />
    </button>
  </div>
  <div v-if="pending" class="confirm-box" role="group" :aria-label="t('export.confirm')">
    <p>{{ t("export.confirm") }}</p>
    <div class="actions-row">
      <button type="button" class="primary" @click="confirm">
        {{ t("export.confirmAction") }}
      </button>
      <button type="button" class="secondary" @click="pending = null">
        {{ t("export.cancel") }}
      </button>
    </div>
  </div>
  <div class="mcp-share-action">
    <button
      ref="shareButton"
      type="button"
      class="secondary"
      :aria-expanded="connectOpen || shareOpen"
      @click="openShareConfirmation"
    >
      <Share2 class="ic" aria-hidden="true" /> {{ t("mcp.shareAction") }}
    </button>
  </div>
  <dialog
    v-if="connectOpen"
    ref="connectDialog"
    class="confirm-box mcp-confirm"
    aria-labelledby="mcp-connect-title"
    aria-describedby="mcp-connect-description"
    @cancel.prevent="cancelConnection"
  >
    <h2 id="mcp-connect-title">{{ connectStatusTitle }}</h2>
    <p id="mcp-connect-description" role="status" aria-live="polite">{{ connectStatusMessage }}</p>
    <div class="actions-row">
      <button
        v-if="connectStatus !== 'checking'"
        ref="connectAction"
        type="button"
        class="primary"
        :disabled="connectBusy"
        @click="connectBeforeShare"
      >
        {{
          connectBusy
            ? t("mcp.checking")
            : connectStatus === "permission-required"
              ? t("mcp.enable")
              : connectStatus === "awaiting-permission"
                ? t("mcp.checkPermission")
                : t("mcp.checkConnection")
        }}
      </button>
      <button
        v-if="connectStatus !== 'checking'"
        type="button"
        class="secondary"
        @click="openAiIntegrations"
      >
        {{ t("mcp.openAi") }}
      </button>
      <button type="button" class="secondary" @click="cancelConnection">
        {{ t("export.cancel") }}
      </button>
    </div>
  </dialog>
  <dialog
    v-if="shareOpen"
    ref="shareDialog"
    class="confirm-box mcp-confirm"
    aria-labelledby="mcp-share-title"
    aria-describedby="mcp-share-description mcp-share-privacy"
    @cancel.prevent="cancelShare"
  >
    <h2 id="mcp-share-title">{{ t("mcp.confirmTitle") }}</h2>
    <p class="mcp-connection-ready" role="status">
      <CircleCheck aria-hidden="true" /> {{ t("mcp.connectionReady") }}
    </p>
    <p id="mcp-share-description">{{ t("mcp.confirmText") }}</p>
    <dl class="mcp-share-details">
      <div>
        <dt>{{ t("mcp.website") }}</dt>
        <dd>{{ shareSnapshot?.page.url }}</dd>
      </div>
      <div>
        <dt>{{ t("mcp.auditTime") }}</dt>
        <dd>{{ shareSnapshot?.analyzedAt }}</dd>
      </div>
      <div>
        <dt>{{ t("mcp.auditType") }}</dt>
        <dd>{{ t("mcp.fullAudit") }}</dd>
      </div>
      <div>
        <dt>{{ t("mcp.approxSize") }}</dt>
        <dd>{{ displaySize }}</dd>
      </div>
      <div>
        <dt>{{ t("mcp.destination") }}</dt>
        <dd>{{ t("mcp.localCompanion") }}</dd>
      </div>
    </dl>
    <p id="mcp-share-privacy" class="mcp-privacy-note">{{ t("mcp.clientPrivacy") }}</p>
    <p v-if="!canShareSize" class="mcp-privacy-note" role="status">{{ t("mcp.tooLarge") }}</p>
    <div class="actions-row">
      <button
        ref="shareConfirm"
        type="button"
        class="primary"
        :disabled="shareBusy || !canShareSize"
        @click="shareConfirmed"
      >
        {{ shareBusy ? t("mcp.sharing") : t("mcp.confirmShare") }}
      </button>
      <button type="button" class="secondary" :disabled="shareBusy" @click="cancelShare">
        {{ t("export.cancel") }}
      </button>
    </div>
  </dialog>
  <p v-if="shareMessage" class="hint" role="status" aria-live="polite">
    <strong v-if="shareFailed">{{ t("mcp.shareFailedTitle") }}</strong> {{ shareMessage }}
  </p>
  <div v-if="shareSucceeded" class="share-success-link">
    <span>{{ t("mcp.sharedToastText") }}</span>
    <button type="button" class="quiet" @click="go('ai-integrations')">
      {{ t("ai.viewSharedAudits") }}
    </button>
  </div>
  <div class="callout">
    <ShieldCheck class="ic" aria-hidden="true" />
    <div>
      <strong>{{ t("wb.ex.privacy") }}</strong>
      <p>{{ t("wb.ex.privacyText") }}</p>
    </div>
  </div>
</template>
