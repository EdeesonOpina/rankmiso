import { isBlockedProbeHost } from "./site-probe";

const MAX_BYTES = 512_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 8_000;

export type HtmlFetch =
  | { ok: true; html: string; finalUrl: string; status: number; hops: string[] }
  | {
      ok: false;
      reason:
        "blocked" | "redirect" | "type" | "size" | "timeout" | "status" | "network" | "aborted";
    };

export async function fetchComparisonHtml(
  pageUrl: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<HtmlFetch> {
  let current: URL;
  try {
    current = new URL(pageUrl);
  } catch {
    return { ok: false, reason: "blocked" };
  }
  if (current.protocol !== "http:" && current.protocol !== "https:") {
    return { ok: false, reason: "blocked" };
  }
  const origin = current.origin;
  const startHost = current.hostname;
  const hops: string[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal.addEventListener("abort", onAbort);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      const response = await fetcher(current.href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal,
      });
      if (response.type === "opaqueredirect" || response.status === 0) {
        await response.body?.cancel();
        return { ok: false, reason: "redirect" };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location || hop === MAX_REDIRECTS) return { ok: false, reason: "redirect" };
        let next: URL;
        try {
          next = new URL(location, current);
        } catch {
          return { ok: false, reason: "redirect" };
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return { ok: false, reason: "redirect" };
        }
        if (isBlockedProbeHost(next.hostname) && next.hostname !== startHost) {
          return { ok: false, reason: "blocked" };
        }
        if (next.origin !== origin) return { ok: false, reason: "redirect" };
        hops.push(`${response.status} ${next.href}`);
        current = next;
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      const declared = Number(response.headers.get("content-length") || "0");
      if (declared > MAX_BYTES) {
        await response.body?.cancel();
        return { ok: false, reason: "size" };
      }
      const read = await readLimited(response, MAX_BYTES);
      if (read.overflow) return { ok: false, reason: "size" };
      if (response.status >= 400) return { ok: false, reason: "status" };
      const htmlLike =
        type.toLowerCase().includes("html") ||
        /^<!doctype html|^<html/i.test(read.text.trimStart());
      if (!htmlLike) return { ok: false, reason: "type" };
      return { ok: true, html: read.text, finalUrl: current.href, status: response.status, hops };
    }
    return { ok: false, reason: "redirect" };
  } catch {
    if (signal.aborted) return { ok: false, reason: "aborted" };
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    return { ok: false, reason: "network" };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function readLimited(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return { text: text.slice(0, maxBytes), overflow: text.length > maxBytes };
  }
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (received <= maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return { text: "", overflow: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), overflow: false };
}
