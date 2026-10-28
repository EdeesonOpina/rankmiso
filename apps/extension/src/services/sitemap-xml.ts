/** Structural extraction only. SEO judgments stay in Rust. */

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

export interface ExtractedSitemap {
  kind: "urlset" | "index" | "invalid" | "dtd" | "unknown";
  entries: SitemapEntry[];
  children: string[];
  truncated: boolean;
}

export function extractSitemap(xml: string, maxEntries: number): ExtractedSitemap {
  const empty = (kind: ExtractedSitemap["kind"]): ExtractedSitemap => ({
    kind,
    entries: [],
    children: [],
    truncated: false,
  });
  const head = xml.slice(0, 4000);
  if (/<!DOCTYPE/i.test(head) || /<!ENTITY/i.test(head)) return empty("dtd");
  if (typeof DOMParser === "undefined") return empty("invalid");
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.querySelector("parsererror")) return empty("invalid");
  const root = doc.documentElement;
  if (!root) return empty("invalid");
  const name = root.localName.toLowerCase();
  if (name === "urlset") return readUrlset(root, maxEntries);
  if (name === "sitemapindex") return readIndex(root, maxEntries);
  return empty("unknown");
}

function readUrlset(root: Element, maxEntries: number): ExtractedSitemap {
  const entries: SitemapEntry[] = [];
  let truncated = false;
  for (const node of elements(root, "url")) {
    if (entries.length >= maxEntries) {
      truncated = true;
      break;
    }
    entries.push({
      loc: text(node, "loc"),
      lastmod: text(node, "lastmod"),
      changefreq: text(node, "changefreq"),
      priority: text(node, "priority"),
    });
  }
  return { kind: "urlset", entries, children: [], truncated };
}

function readIndex(root: Element, maxEntries: number): ExtractedSitemap {
  const children: string[] = [];
  let truncated = false;
  for (const node of elements(root, "sitemap")) {
    if (children.length >= maxEntries) {
      truncated = true;
      break;
    }
    const loc = text(node, "loc");
    if (loc) children.push(loc);
  }
  return { kind: "index", entries: [], children, truncated };
}

function elements(parent: Element, name: string): Element[] {
  return [...parent.children].filter((node) => node.localName.toLowerCase() === name);
}

function text(parent: Element, name: string): string {
  const node = elements(parent, name)[0];
  return node?.textContent?.trim() ?? "";
}

export async function inflateGzip(
  bytes: Uint8Array,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean } | "unsupported"> {
  const Stream = (
    globalThis as {
      DecompressionStream?: new (format: string) => GenericTransformStream;
    }
  ).DecompressionStream;
  if (!Stream) return "unsupported";
  const stream = new Stream("gzip");
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const writing = writer
    .write(bytes)
    .then(() => writer.close())
    .catch(() => undefined);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    let truncated = false;
    while (size < maxBytes) {
      const step = await reader.read();
      if (step.done) break;
      const room = maxBytes - size;
      const piece = step.value.byteLength > room ? step.value.slice(0, room) : step.value;
      chunks.push(piece);
      size += piece.byteLength;
      if (step.value.byteLength > room) {
        truncated = true;
        await reader.cancel();
        break;
      }
    }
    await writing;
    const out = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { bytes: out, truncated };
  } catch {
    await writing;
    return "unsupported";
  }
}

export function looksGzip(bytes: Uint8Array, contentType: string | null, url: string): boolean {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return true;
  const type = contentType?.toLowerCase() ?? "";
  return type.includes("gzip") || url.toLowerCase().endsWith(".gz");
}
