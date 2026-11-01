<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { BookOpen, CircleAlert, CircleCheck, CircleX, LoaderCircle } from "lucide-vue-next";
import { browser } from "wxt/browser";
import type { AuditResult } from "../../types/audit";
import { readMcpIntegrationEnabled, writeMcpIntegrationEnabled } from "../../adapters/storage";
import { useI18n } from "../../composables/useI18n";
import type { MessageKey } from "../../locales/en";
import {
  checkNativeCompanion,
  hasNativeMessagingPermission,
  isNativeMessagingPermissionRequestPending,
  listSharedAudits,
  MCP_STATUS_FRESH_MS,
  NativeCompanionError,
  removeSharedAudit,
  requestNativeMessagingPermission,
  type SharedAudit,
} from "../../services/mcp-native-bridge";
import { useWorkbench } from "./context";
import PageHeading from "./PageHeading.vue";

const { t } = useI18n();
const { toast } = useWorkbench();
defineProps<{ audit?: AuditResult | null }>();
const guideUrl = browser.runtime.getURL("/mcp-guide.html");
const mcpPermission = ref(false);
const mcpPermissionPending = ref(false);
const mcpEnabled = ref(false);
let permissionRevision = 0;
let connectionFreshnessTimer = 0;
type McpStatus =
  | "ready"
  | "permission-required"
  | "awaiting-permission"
  | "checking"
  | "connected"
  | "disconnected"
  | "not-installed"
  | "connection-failed";
const mcpStatus = ref<McpStatus>("permission-required");
const mcpConnected = computed(() => mcpStatus.value === "connected");
const mcpStatusLabel = computed(() => {
  const labels: Record<McpStatus, MessageKey> = {
    ready: "mcp.stateReady",
    "permission-required": "mcp.statePermissionRequired",
    "awaiting-permission": "mcp.stateAwaitingPermission",
    checking: "mcp.stateChecking",
    connected: "mcp.stateConnected",
    disconnected: "mcp.stateDisconnected",
    "not-installed": "mcp.stateNotInstalled",
    "connection-failed": "mcp.stateConnectionFailed",
  };
  return t(labels[mcpStatus.value]);
});
const mcpStatusMessage = computed(() => {
  if (mcpStatus.value === "ready" && mcpEnabled.value) {
    return t("mcp.stateReadyRecheckMessage");
  }
  const messages: Record<McpStatus, MessageKey> = {
    ready: "mcp.stateReadyMessage",
    "permission-required": "mcp.statePermissionRequiredMessage",
    "awaiting-permission": "mcp.stateAwaitingPermissionMessage",
    checking: "mcp.stateCheckingMessage",
    connected: "mcp.stateConnectedMessage",
    disconnected: "mcp.stateDisconnectedMessage",
    "not-installed": "mcp.stateNotInstalledMessage",
    "connection-failed": "mcp.stateConnectionFailedMessage",
  };
  return t(messages[mcpStatus.value]);
});
const mcpMessage = ref("");
const mcpBusy = ref(false);
const sharedAudits = ref<SharedAudit[]>([]);
const pendingRemove = ref<string | null>(null);
const sharedOffset = ref(0);
const sharedTotal = ref(0);
const sharedNextOffset = ref<number | null>(null);

const permissionRemoved = (permissions: { permissions?: string[] }) => {
  if (!permissions.permissions?.includes("nativeMessaging")) return;
  permissionRevision++;
  window.clearTimeout(connectionFreshnessTimer);
  mcpPermission.value = false;
  mcpPermissionPending.value = false;
  mcpStatus.value = "permission-required";
  sharedAudits.value = [];
  sharedTotal.value = 0;
  sharedNextOffset.value = null;
  mcpMessage.value = t("mcp.permissionRevoked");
};
const permissionAdded = (permissions: { permissions?: string[] }) => {
  if (!permissions.permissions?.includes("nativeMessaging")) return;
  const resumeAfterGrant = mcpPermissionPending.value && !mcpBusy.value;
  mcpPermission.value = true;
  mcpPermissionPending.value = false;
  if (resumeAfterGrant) {
    mcpEnabled.value = true;
    void writeMcpIntegrationEnabled(true);
  }
  if (!mcpBusy.value) {
    if (resumeAfterGrant) void checkMcpConnection(false, true);
    else if (mcpEnabled.value) void checkMcpConnection();
    else mcpStatus.value = "ready";
  }
};
const onTabActivated = () => {
  if (mcpEnabled.value && mcpStatus.value === "ready" && !mcpBusy.value) {
    void checkMcpConnection();
  }
};

onMounted(() => {
  browser.permissions.onRemoved.addListener(permissionRemoved);
  browser.permissions.onAdded.addListener(permissionAdded);
  browser.tabs?.onActivated?.addListener(onTabActivated);
  void initializeMcp();
});
onUnmounted(() => {
  window.clearTimeout(connectionFreshnessTimer);
  browser.permissions.onRemoved.removeListener(permissionRemoved);
  browser.permissions.onAdded.removeListener(permissionAdded);
  browser.tabs?.onActivated?.removeListener(onTabActivated);
});

function formatAuditTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? value : new Date(timestamp).toLocaleString();
}

async function initializeMcp() {
  const currentPermissionRevision = permissionRevision;
  mcpEnabled.value = await readMcpIntegrationEnabled();
  mcpPermission.value = await hasNativeMessagingPermission();
  if (currentPermissionRevision !== permissionRevision) return;
  if (!mcpPermission.value) {
    mcpStatus.value = "permission-required";
    sharedAudits.value = [];
    sharedTotal.value = 0;
    return;
  }
  if (mcpEnabled.value) void checkMcpConnection();
  else mcpStatus.value = "ready";
}

async function checkMcpConnection(requestPermission = false, notifyOnSuccess = false) {
  if (mcpBusy.value) return;
  window.clearTimeout(connectionFreshnessTimer);
  const currentPermissionRevision = permissionRevision;
  mcpBusy.value = true;
  mcpStatus.value = "checking";
  mcpMessage.value = "";
  sharedAudits.value = [];
  sharedTotal.value = 0;
  sharedNextOffset.value = null;
  try {
    if (mcpPermissionPending.value) {
      mcpPermission.value = await hasNativeMessagingPermission();
      if (!mcpPermission.value) {
        if (isNativeMessagingPermissionRequestPending()) {
          mcpStatus.value = "awaiting-permission";
          mcpMessage.value = t("mcp.permissionWaiting");
        } else {
          mcpPermissionPending.value = false;
          mcpStatus.value = "permission-required";
          mcpMessage.value = t("mcp.permissionDenied");
        }
        return;
      }
      mcpPermissionPending.value = false;
    } else if (!mcpPermission.value && requestPermission) {
      mcpStatus.value = "awaiting-permission";
      const granted = await requestNativeMessagingPermission();
      if (granted === null) {
        mcpPermission.value = await hasNativeMessagingPermission();
        if (!mcpPermission.value) {
          mcpPermissionPending.value = true;
          mcpStatus.value = "awaiting-permission";
          mcpMessage.value = t("mcp.permissionWaiting");
          return;
        }
      } else if (!granted) {
        mcpPermission.value = false;
        mcpStatus.value = "permission-required";
        mcpMessage.value = t("mcp.permissionDenied");
        return;
      } else {
        mcpPermission.value = true;
        mcpEnabled.value = true;
        await writeMcpIntegrationEnabled(true);
      }
    } else if (!mcpPermission.value) {
      mcpStatus.value = "permission-required";
      return;
    }
    if (!mcpPermission.value || !(await hasNativeMessagingPermission())) {
      mcpPermission.value = false;
      mcpStatus.value = "permission-required";
      mcpMessage.value = t("mcp.permissionDenied");
      return;
    }
    if (requestPermission && !mcpEnabled.value) {
      mcpEnabled.value = true;
      await writeMcpIntegrationEnabled(true);
    }
    mcpPermissionPending.value = false;
    if (await checkNativeCompanion(requestPermission)) {
      if (currentPermissionRevision !== permissionRevision) return;
      mcpStatus.value = "connected";
      connectionFreshnessTimer = window.setTimeout(() => {
        if (currentPermissionRevision !== permissionRevision || !mcpConnected.value) return;
        mcpStatus.value = "ready";
        sharedAudits.value = [];
        sharedTotal.value = 0;
      }, MCP_STATUS_FRESH_MS);
      if (notifyOnSuccess) toast(t("mcp.connectedToast"), t("mcp.connectedToastText"), "success");
      await refreshSharedAudits(currentPermissionRevision, requestPermission);
    }
  } catch (error) {
    if (currentPermissionRevision !== permissionRevision) return;
    if (error instanceof NativeCompanionError && error.code === "not-installed") {
      mcpStatus.value = "not-installed";
    } else if (error instanceof NativeCompanionError && error.code === "permission-required") {
      mcpPermission.value = false;
      mcpStatus.value = "permission-required";
      mcpMessage.value = t("mcp.permissionDenied");
    } else {
      mcpStatus.value = "connection-failed";
      mcpMessage.value = "";
    }
  } finally {
    mcpBusy.value = false;
  }
}

async function refreshSharedAudits(
  expectedPermissionRevision = permissionRevision,
  force = false,
): Promise<boolean> {
  if (!mcpConnected.value) return false;
  try {
    sharedOffset.value = 0;
    const result = await listSharedAudits(0, force);
    if (expectedPermissionRevision !== permissionRevision || !mcpPermission.value) return false;
    sharedAudits.value = result.snapshots;
    sharedTotal.value = result.total;
    sharedNextOffset.value = result.nextOffset;
    return true;
  } catch {
    if (expectedPermissionRevision === permissionRevision && mcpPermission.value) {
      mcpStatus.value = "connection-failed";
    }
    sharedAudits.value = [];
    return false;
  }
}

async function nextSharedAudits() {
  if (sharedNextOffset.value == null || mcpBusy.value) return;
  const currentPermissionRevision = permissionRevision;
  mcpBusy.value = true;
  try {
    const result = await listSharedAudits(sharedNextOffset.value);
    if (currentPermissionRevision !== permissionRevision || !mcpPermission.value) return;
    sharedOffset.value = result.offset;
    sharedAudits.value = result.snapshots;
    sharedTotal.value = result.total;
    sharedNextOffset.value = result.nextOffset;
  } catch {
    if (currentPermissionRevision === permissionRevision && mcpPermission.value) {
      mcpStatus.value = "connection-failed";
    }
  } finally {
    mcpBusy.value = false;
  }
}

async function previousSharedAudits() {
  if (sharedOffset.value === 0 || mcpBusy.value) return;
  const offset = Math.max(0, sharedOffset.value - 50);
  const currentPermissionRevision = permissionRevision;
  mcpBusy.value = true;
  try {
    const result = await listSharedAudits(offset);
    if (currentPermissionRevision !== permissionRevision || !mcpPermission.value) return;
    sharedOffset.value = result.offset;
    sharedAudits.value = result.snapshots;
    sharedTotal.value = result.total;
    sharedNextOffset.value = result.nextOffset;
  } catch {
    if (currentPermissionRevision === permissionRevision && mcpPermission.value) {
      mcpStatus.value = "connection-failed";
    }
  } finally {
    mcpBusy.value = false;
  }
}

function disconnectMcp() {
  mcpStatus.value = "disconnected";
  window.clearTimeout(connectionFreshnessTimer);
  mcpEnabled.value = false;
  mcpPermissionPending.value = false;
  void writeMcpIntegrationEnabled(false);
  sharedAudits.value = [];
  mcpMessage.value = "";
}

async function confirmRemove(snapshotId: string) {
  if (mcpBusy.value) return;
  mcpBusy.value = true;
  try {
    await removeSharedAudit(snapshotId);
    pendingRemove.value = null;
    toast(t("mcp.removedToast"), t("mcp.removedToastText"), "success");
    await refreshSharedAudits();
  } catch {
    mcpMessage.value = t("mcp.removeFailed");
  } finally {
    mcpBusy.value = false;
  }
}
</script>

<template>
  <PageHeading :overline="t('wb.st.overline')" :title="t('ai.title')" :text="t('ai.description')" />
  <section class="ai-guide-entry" aria-labelledby="ai-guide-title">
    <div>
      <h2 id="ai-guide-title">{{ t("ai.guideTitle") }}</h2>
      <p>{{ t("ai.guideDescription") }}</p>
    </div>
    <a class="secondary ai-guide-link" :href="guideUrl" target="_blank" rel="noopener">
      <BookOpen aria-hidden="true" />
      {{ t("ai.viewGuide") }}
    </a>
  </section>
  <section class="ai-companion-card" aria-labelledby="ai-companion-title">
    <div class="section-heading">
      <div>
        <h2 id="ai-companion-title">{{ t("ai.companion") }}</h2>
        <p>{{ t("ai.companionDescription") }}</p>
      </div>
      <div class="actions-row">
        <button
          v-if="mcpStatus !== 'connected' && mcpStatus !== 'checking'"
          type="button"
          class="secondary"
          :disabled="mcpBusy"
          @click="
            checkMcpConnection(
              !mcpEnabled || mcpStatus === 'permission-required' || !mcpPermission,
              true,
            )
          "
        >
          {{
            mcpPermissionPending
              ? t("mcp.checkPermission")
              : !mcpPermission || mcpStatus === "permission-required"
                ? t("mcp.enable")
                : mcpEnabled
                  ? t("mcp.checkConnection")
                  : t("mcp.enable")
          }}
        </button>
        <button
          v-if="mcpEnabled"
          type="button"
          class="quiet"
          :disabled="mcpBusy"
          @click="disconnectMcp"
        >
          {{ t("mcp.disable") }}
        </button>
      </div>
    </div>
    <div
      class="mcp-status"
      :data-status="mcpStatus"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="mcp-status-heading">
        <LoaderCircle
          v-if="mcpStatus === 'checking'"
          class="mcp-state-icon is-spinning"
          aria-hidden="true"
        />
        <CircleCheck v-else-if="mcpConnected" class="mcp-state-icon" aria-hidden="true" />
        <CircleAlert
          v-else-if="
            mcpStatus === 'disconnected' ||
            mcpStatus === 'permission-required' ||
            mcpStatus === 'awaiting-permission' ||
            mcpStatus === 'not-installed'
          "
          class="mcp-state-icon"
          aria-hidden="true"
        />
        <CircleX
          v-else-if="mcpStatus === 'connection-failed'"
          class="mcp-state-icon"
          aria-hidden="true"
        />
        <strong>{{ mcpStatusLabel }}</strong>
      </div>
      <small>{{ mcpStatusMessage }}</small>
      <small v-if="mcpMessage">{{ mcpMessage }}</small>
    </div>
  </section>

  <section
    class="ai-section ai-shared"
    :class="{ 'mcp-shared-list': mcpConnected }"
    aria-labelledby="ai-shared-title"
  >
    <div class="section-heading">
      <div>
        <h2 id="ai-shared-title">{{ t("mcp.sharedAudits") }}</h2>
        <p>
          {{
            mcpConnected
              ? t("ai.sharedCount", { count: sharedTotal })
              : t("ai.sharedCountUnavailable")
          }}
        </p>
      </div>
      <button
        type="button"
        class="quiet"
        :disabled="mcpBusy || !mcpConnected"
        @click="refreshSharedAudits(permissionRevision, true)"
      >
        {{ t("mcp.refreshList") }}
      </button>
    </div>
    <div v-if="!mcpConnected" class="ai-empty-state" role="status">
      {{ t("ai.sharedNeedsConnection") }}
    </div>
    <div v-else-if="!sharedAudits.length" class="ai-empty-state" role="status">
      {{ t("mcp.noSharedAudits") }}
    </div>
    <div v-else class="ai-audit-list">
      <article
        v-for="item in sharedAudits"
        :key="item.snapshotId"
        class="ai-audit-row mcp-shared-item"
      >
        <div class="ai-audit-main">
          <strong>{{ item.pageTitle || item.pageUrl }}</strong>
          <span>{{ item.pageUrl }}</span>
          <small>{{ t("mcp.fullAudit") }}</small>
          <small
            >{{ t("mcp.analyzedWhen", { date: formatAuditTimestamp(item.analyzedAt) }) }} ·
            {{
              t("mcp.sharedWhen", { date: new Date(item.sharedAtUnixMs).toLocaleString() })
            }}</small
          >
          <small class="mcp-snapshot-id">{{
            t("mcp.snapshotLabel", { id: item.snapshotId.slice(-8) })
          }}</small>
        </div>
        <div v-if="pendingRemove === item.snapshotId" class="actions-row">
          <button
            type="button"
            class="quiet"
            :disabled="mcpBusy"
            @click="confirmRemove(item.snapshotId)"
          >
            {{ t("mcp.confirmRemove") }}
          </button>
          <button type="button" class="quiet" :disabled="mcpBusy" @click="pendingRemove = null">
            {{ t("export.cancel") }}
          </button>
        </div>
        <button
          v-else
          type="button"
          class="quiet"
          :disabled="mcpBusy"
          @click="pendingRemove = item.snapshotId"
        >
          {{ t("mcp.remove") }}
        </button>
      </article>
    </div>
    <div v-if="sharedTotal > 50 && mcpConnected" class="actions-row mcp-list-pagination">
      <button
        type="button"
        class="quiet"
        :disabled="mcpBusy || sharedOffset === 0"
        @click="previousSharedAudits"
      >
        {{ t("mcp.previousPage") }}
      </button>
      <span>{{
        t("mcp.pageCount", {
          first: sharedOffset + 1,
          last: Math.min(sharedOffset + sharedAudits.length, sharedTotal),
          total: sharedTotal,
        })
      }}</span>
      <button
        type="button"
        class="quiet"
        :disabled="mcpBusy || sharedNextOffset == null"
        @click="nextSharedAudits"
      >
        {{ t("mcp.nextPage") }}
      </button>
    </div>
    <p v-if="mcpConnected" class="mcp-privacy-note">{{ t("mcp.deletionNote") }}</p>
  </section>

  <section class="ai-privacy" aria-labelledby="ai-privacy-title">
    <h2 id="ai-privacy-title">{{ t("ai.privacy") }}</h2>
    <p>{{ t("ai.privacyDescription") }}</p>
  </section>
</template>
