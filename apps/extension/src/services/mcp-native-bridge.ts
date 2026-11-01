import { browser } from "wxt/browser";
import { serializeAuditJson } from "./export";
import type { AuditResult } from "../types/audit";

export const RANKMISO_NATIVE_HOST = "com.misoecosystem.rankmiso";
export const MCP_BRIDGE_PROTOCOL_VERSION = 1;
export const MAX_NATIVE_MESSAGE_BYTES = 900 * 1024;
const RESPONSE_TIMEOUT_MS = 15_000;
const PERMISSION_DECISION_TIMEOUT_MS = 10_000;

export interface SharedAudit {
  snapshotId: string;
  pageUrl: string;
  pageTitle: string | null;
  analyzedAt: string;
  sharedAtUnixMs: number;
  auditType: "audit";
}

interface NativeResponse<T> {
  protocolVersion: number;
  requestId: string;
  ok: boolean;
  result?: T;
  error?: string;
}

interface NativeMessagingPort {
  onMessage: {
    addListener(callback: (message: unknown) => void): void;
    removeListener(callback: (message: unknown) => void): void;
  };
  onDisconnect: {
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  };
  postMessage(message: unknown): void;
  disconnect(): void;
}

interface NativeMessagingRuntime {
  connectNative?: (application: string) => NativeMessagingPort;
  lastError?: { message?: string };
  reload?: () => void;
}

let pendingRequest = false;
let pendingPermissionRequest: Promise<boolean> | null = null;
let companionCheck: Promise<boolean> | null = null;
let companionCheckedAt = 0;
let permissionGeneration = 0;
export const MCP_STATUS_FRESH_MS = 15_000;
const sharedAuditLists = new Map<
  number,
  { checkedAt: number; result: Awaited<ReturnType<typeof fetchSharedAudits>> }
>();
browser.permissions.onRemoved.addListener((permissions) => {
  if (permissions.permissions?.includes("nativeMessaging")) {
    permissionGeneration++;
    companionCheckedAt = 0;
    companionCheck = null;
    sharedAuditLists.clear();
  }
});

export type NativeCompanionErrorCode =
  "permission-required" | "not-installed" | "connection-failed";

export class NativeCompanionError extends Error {
  constructor(
    readonly code: NativeCompanionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NativeCompanionError";
  }
}

export function isNativeMessagingPermissionRequestPending(): boolean {
  return pendingPermissionRequest !== null;
}

export async function hasNativeMessagingPermission(): Promise<boolean> {
  return browser.permissions.contains({ permissions: ["nativeMessaging"] });
}

/** Must be called directly from a user-initiated button action. */
export async function requestNativeMessagingPermission(): Promise<boolean | null> {
  if (pendingPermissionRequest) return null;

  let onAdded: ((permissions: { permissions?: string[] }) => void) | undefined;
  const permissionAdded = new Promise<boolean>((resolve) => {
    onAdded = (permissions) => {
      if (!permissions.permissions?.includes("nativeMessaging")) return;
      resolve(true);
    };
    browser.permissions.onAdded.addListener(onAdded);
  });
  let request: Promise<boolean>;
  try {
    request = browser.permissions.request({ permissions: ["nativeMessaging"] });
  } catch {
    if (onAdded) browser.permissions.onAdded.removeListener(onAdded);
    throw new NativeCompanionError(
      "permission-required",
      "The browser could not start the Native Messaging permission request.",
    );
  }
  pendingPermissionRequest = request;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    request.then(
      (granted) => ({ kind: "request" as const, granted }),
      (error: unknown) => ({ kind: "error" as const, error }),
    ),
    permissionAdded.then(() => ({ kind: "added" as const })),
    new Promise<{ kind: "timeout" }>((resolve) => {
      timeout = setTimeout(() => resolve({ kind: "timeout" }), PERMISSION_DECISION_TIMEOUT_MS);
    }),
  ]);

  if (timeout) clearTimeout(timeout);
  if (onAdded) browser.permissions.onAdded.removeListener(onAdded);

  if (result.kind === "timeout") {
    void request.then(
      () => {
        if (pendingPermissionRequest === request) pendingPermissionRequest = null;
      },
      () => {
        if (pendingPermissionRequest === request) pendingPermissionRequest = null;
      },
    );
    return null;
  }
  if (pendingPermissionRequest === request) pendingPermissionRequest = null;
  if (result.kind === "error") {
    throw new NativeCompanionError(
      "permission-required",
      "The browser could not complete the Native Messaging permission request.",
    );
  }
  return result.kind === "added" || result.granted;
}

export async function checkNativeCompanion(force = false): Promise<boolean> {
  if (!(await hasNativeMessagingPermission())) {
    companionCheckedAt = 0;
    throw new NativeCompanionError(
      "permission-required",
      "Native Messaging permission is not enabled.",
    );
  }
  if (!force && Date.now() - companionCheckedAt < MCP_STATUS_FRESH_MS) return true;
  if (companionCheck) return companionCheck;
  const generation = permissionGeneration;
  const pending = nativeRequest<{ status: string }>("ping")
    .then((result) => {
      if (!result || typeof result !== "object" || result.status !== "ready") {
        throw new Error("The local companion returned an invalid status.");
      }
      if (generation === permissionGeneration) companionCheckedAt = Date.now();
      return true;
    })
    .finally(() => {
      if (companionCheck === pending) companionCheck = null;
    });
  companionCheck = pending;
  return pending;
}

export async function shareAudit(audit: AuditResult): Promise<{ snapshot: SharedAudit }> {
  // Send the exact full-audit representation used by the existing JSON export.
  const result = await nativeRequest<{ snapshot: unknown }>("share_audit", {
    audit: JSON.parse(serializeAuditJson(audit)) as AuditResult,
  });
  if (!result || !isSharedAudit(result.snapshot)) {
    throw new Error("The local companion returned invalid audit metadata.");
  }
  sharedAuditLists.clear();
  return { snapshot: result.snapshot };
}

export async function listSharedAudits(
  offset = 0,
  force = false,
): Promise<{ snapshots: SharedAudit[]; total: number; offset: number; nextOffset: number | null }> {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 500)
    throw new Error("Invalid shared audit list offset.");
  if (!(await hasNativeMessagingPermission())) {
    sharedAuditLists.clear();
    throw new NativeCompanionError(
      "permission-required",
      "Native Messaging permission is not enabled.",
    );
  }
  const cached = sharedAuditLists.get(offset);
  if (!force && cached && Date.now() - cached.checkedAt < MCP_STATUS_FRESH_MS) {
    return cached.result;
  }
  const generation = permissionGeneration;
  const result = await fetchSharedAudits(offset);
  if (generation === permissionGeneration) {
    sharedAuditLists.set(offset, { checkedAt: Date.now(), result });
  }
  return result;
}

async function fetchSharedAudits(
  offset: number,
): Promise<{ snapshots: SharedAudit[]; total: number; offset: number; nextOffset: number | null }> {
  const result = await nativeRequest<{
    snapshots: unknown;
    total: number;
    offset: number;
    limit: number;
    nextOffset: number | null;
  }>("list_shared_audits", { offset, limit: 50 });
  if (
    !result ||
    !Array.isArray(result.snapshots) ||
    result.snapshots.length > 50 ||
    !result.snapshots.every(isSharedAudit)
  ) {
    throw new Error("The local companion returned an invalid shared-audit list.");
  }
  if (
    !Number.isSafeInteger(result.total) ||
    result.total < 0 ||
    result.offset !== offset ||
    result.limit !== 50 ||
    (result.nextOffset !== null &&
      (!Number.isSafeInteger(result.nextOffset) ||
        result.nextOffset <= offset ||
        result.nextOffset > 500))
  ) {
    throw new Error("The local companion returned invalid shared-audit pagination metadata.");
  }
  return {
    snapshots: result.snapshots,
    total: result.total,
    offset: result.offset,
    nextOffset: result.nextOffset,
  };
}

export async function removeSharedAudit(snapshotId: string): Promise<{ removed: true }> {
  if (!/^rankmiso-shared-[0-9]+-[0-9]+$/.test(snapshotId)) {
    throw new Error("Invalid shared audit identifier.");
  }
  const result = await nativeRequest<{ removed: unknown }>("remove_shared_audit", { snapshotId });
  if (result?.removed !== true)
    throw new Error("The local companion did not confirm audit removal.");
  sharedAuditLists.clear();
  return { removed: true };
}

async function nativeRequest<T>(type: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (pendingRequest) throw new Error("A RankMiso companion request is already in progress.");
  pendingRequest = true;
  try {
    if (!(await hasNativeMessagingPermission())) {
      throw new NativeCompanionError(
        "permission-required",
        "Native Messaging permission is not enabled.",
      );
    }

    const requestId = crypto.randomUUID();
    const request = {
      protocolVersion: MCP_BRIDGE_PROTOCOL_VERSION,
      requestId,
      type,
      ...payload,
    };
    const size = new TextEncoder().encode(JSON.stringify(request)).byteLength;
    if (size + 4 > MAX_NATIVE_MESSAGE_BYTES) {
      throw new Error(
        "This audit is too large to share through Native Messaging. Use the JSON export instead.",
      );
    }
    const nativeRuntime = getNativeMessagingRuntime();

    return await new Promise<T>((resolve, reject) => {
      let settled = false;
      let port: NativeMessagingPort | undefined;
      const finish = (error?: Error, result?: T) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        port?.onMessage.removeListener(onMessage);
        port?.onDisconnect.removeListener(onDisconnect);
        try {
          port?.disconnect();
        } catch {
          // The browser may already have closed the one-shot native process.
        }
        if (error) reject(error);
        else resolve(result as T);
      };
      const onMessage = (message: unknown) => {
        if (!isNativeResponse<T>(message, requestId)) {
          finish(new Error("The local companion returned an invalid response."));
          return;
        }
        if (!message.ok) {
          finish(new Error(safeNativeError(message.error)));
          return;
        }
        finish(undefined, message.result);
      };
      const onDisconnect = () => {
        const lastError = nativeRuntime.lastError?.message;
        const missingHost =
          /native messaging host not found|no such native application|host is forbidden/i.test(
            lastError ?? "",
          );
        finish(
          new NativeCompanionError(
            missingHost ? "not-installed" : "connection-failed",
            lastError
              ? `Local companion unavailable: ${lastError}`
              : "Local companion disconnected.",
          ),
        );
      };
      const timeout = window.setTimeout(
        () =>
          finish(
            new NativeCompanionError(
              "connection-failed",
              "The local companion did not respond in time.",
            ),
          ),
        RESPONSE_TIMEOUT_MS,
      );

      try {
        port = nativeRuntime.connectNative!(RANKMISO_NATIVE_HOST);
        port.onMessage.addListener(onMessage);
        port.onDisconnect.addListener(onDisconnect);
        port.postMessage(request);
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "Unknown native-host startup error.";
        const missingHost =
          /native messaging host.*(?:not found|forbidden)|no such native application/i.test(detail);
        finish(
          new NativeCompanionError(
            missingHost ? "not-installed" : "connection-failed",
            `The local companion could not be started: ${detail}`,
          ),
        );
      }
    });
  } finally {
    pendingRequest = false;
  }
}

function getNativeMessagingRuntime(): NativeMessagingRuntime & {
  connectNative: (application: string) => NativeMessagingPort;
} {
  const browserRuntime = browser.runtime as unknown as NativeMessagingRuntime;
  if (typeof browserRuntime.connectNative === "function")
    return browserRuntime as Required<NativeMessagingRuntime>;

  // Some Chromium versions expose a partial `browser` alias. WXT selects it
  // when present, even if it omits Chrome's native messaging method.
  const chromeRuntime = (
    globalThis as typeof globalThis & { chrome?: { runtime?: NativeMessagingRuntime } }
  ).chrome?.runtime;
  if (typeof chromeRuntime?.connectNative === "function") {
    return chromeRuntime as Required<NativeMessagingRuntime>;
  }

  if (typeof chromeRuntime?.reload === "function") {
    chromeRuntime.reload();
    throw new NativeCompanionError(
      "connection-failed",
      "Chrome is reloading RankMiso to apply the Native Messaging permission. Check the companion again after it reloads.",
    );
  }

  throw new Error("This browser does not expose Native Messaging to RankMiso.");
}

function isNativeResponse<T>(value: unknown, requestId: string): value is NativeResponse<T> {
  if (!value || typeof value !== "object") return false;
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_NATIVE_MESSAGE_BYTES)
      return false;
  } catch {
    return false;
  }
  const candidate = value as Partial<NativeResponse<T>>;
  if (
    candidate.protocolVersion !== MCP_BRIDGE_PROTOCOL_VERSION ||
    candidate.requestId !== requestId ||
    typeof candidate.ok !== "boolean"
  )
    return false;
  if (candidate.ok) return candidate.result !== undefined;
  return typeof candidate.error === "string";
}

function isSharedAudit(value: unknown): value is SharedAudit {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SharedAudit>;
  return (
    typeof item.snapshotId === "string" &&
    /^rankmiso-shared-[0-9]+-[0-9]+$/.test(item.snapshotId) &&
    typeof item.pageUrl === "string" &&
    new TextEncoder().encode(item.pageUrl).byteLength <= 1024 &&
    (typeof item.pageTitle === "string" || item.pageTitle === null) &&
    (item.pageTitle === null || new TextEncoder().encode(item.pageTitle).byteLength <= 1024) &&
    typeof item.analyzedAt === "string" &&
    item.analyzedAt.length <= 128 &&
    typeof item.sharedAtUnixMs === "number" &&
    Number.isFinite(item.sharedAtUnixMs) &&
    item.auditType === "audit"
  );
}

function safeNativeError(error: unknown): string {
  if (typeof error !== "string" || error.length > 180) {
    return "The local companion could not complete the request.";
  }
  return error;
}
