import { classify_visibility } from "../wasm/pkg/seo_wasm.js";
import { safeFilename, toCsv } from "@rankmiso/report-formats";
import { visibilityPlatforms } from "../config/crawlers.config";
import { ensureEngine } from "./engine";

/**
 * AI answer visibility, recorded by the user. RankMiso never queries AI services: each
 * observation is what the user saw and chose to record, classified by the Rust engine.
 * Stored only in this browser's localStorage, bounded, and removable.
 */
export const VISIBILITY_KEY = "rankmiso.aiVisibility";
export const VISIBILITY_LIMITS = {
  queries: 50,
  observations: 500,
  perQueryPlatform: 20,
  bytes: 400_000,
  excerpt: 1_000,
  notes: 500,
  citations: 20,
} as const;

export type VisibilityStatus = "cited" | "mentioned" | "not-observed" | "unknown" | "not-measured";

export interface VisibilityQuery {
  id: string;
  text: string;
  domain: string;
  brand: string;
  createdAt: string;
}

export interface VisibilityCitation {
  url: string;
  order: number;
  onDomain: boolean;
}

export interface VisibilityObservation {
  id: string;
  queryId: string;
  platformId: string;
  /** Day the user saw the answer (YYYY-MM-DD). */
  observedOn: string;
  recordedAt: string;
  basis: "pasted" | "manual";
  status: VisibilityStatus;
  citations: VisibilityCitation[];
  mentions: string[];
  excerpt: string;
  notes: string;
}

export interface VisibilityStore {
  schemaVersion: 1;
  queries: VisibilityQuery[];
  observations: VisibilityObservation[];
}

export interface Classification {
  domain: string;
  status: VisibilityStatus;
  basis: "pasted" | "manual";
  citations: VisibilityCitation[];
  mentions: string[];
  notes: string[];
}

const STATUSES = new Set<VisibilityStatus>([
  "cited",
  "mentioned",
  "not-observed",
  "unknown",
  "not-measured",
]);
const PLATFORM_IDS = new Set(visibilityPlatforms.map((platform) => platform.id));

export function emptyStore(): VisibilityStore {
  return { schemaVersion: 1, queries: [], observations: [] };
}

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

/** Reads and validates the stored history. Anything malformed is dropped, never trusted. */
export function loadStore(storage: Pick<Storage, "getItem"> = localStorage): {
  store: VisibilityStore;
  damaged: boolean;
} {
  let raw: unknown;
  try {
    const item = storage.getItem(VISIBILITY_KEY);
    if (!item) return { store: emptyStore(), damaged: false };
    raw = JSON.parse(item);
  } catch {
    return { store: emptyStore(), damaged: true };
  }
  const record = raw as Partial<VisibilityStore> | null;
  if (!record || record.schemaVersion !== 1 || !Array.isArray(record.queries)) {
    return { store: emptyStore(), damaged: true };
  }
  const queries = record.queries.flatMap((item): VisibilityQuery[] => {
    const query = item as Partial<VisibilityQuery>;
    const id = text(query.id, 40);
    const value = text(query.text, 300).trim();
    const domain = text(query.domain, 253).trim();
    if (!id || !value || !domain) return [];
    return [
      {
        id,
        text: value,
        domain,
        brand: text(query.brand, 80),
        createdAt: text(query.createdAt, 40),
      },
    ];
  });
  const ids = new Set(queries.map((query) => query.id));
  const observations = (Array.isArray(record.observations) ? record.observations : []).flatMap(
    (item): VisibilityObservation[] => {
      const observation = item as Partial<VisibilityObservation>;
      const status = observation.status as VisibilityStatus;
      const queryId = text(observation.queryId, 40);
      const platformId = text(observation.platformId, 40);
      if (!ids.has(queryId) || !PLATFORM_IDS.has(platformId) || !STATUSES.has(status)) return [];
      return [
        {
          id: text(observation.id, 40),
          queryId,
          platformId,
          observedOn: text(observation.observedOn, 10),
          recordedAt: text(observation.recordedAt, 40),
          basis: observation.basis === "pasted" ? "pasted" : "manual",
          status,
          citations: (Array.isArray(observation.citations) ? observation.citations : [])
            .slice(0, VISIBILITY_LIMITS.citations)
            .flatMap((citation) => {
              const entry = citation as Partial<VisibilityCitation>;
              const url = text(entry.url, 2_000);
              return url
                ? [{ url, order: Number(entry.order) || 0, onDomain: entry.onDomain === true }]
                : [];
            }),
          mentions: (Array.isArray(observation.mentions) ? observation.mentions : [])
            .slice(0, 3)
            .map((mention) => text(mention, 200)),
          excerpt: text(observation.excerpt, VISIBILITY_LIMITS.excerpt),
          notes: text(observation.notes, VISIBILITY_LIMITS.notes),
        },
      ];
    },
  );
  return {
    store: { schemaVersion: 1, queries: queries.slice(0, VISIBILITY_LIMITS.queries), observations },
    damaged: queries.length !== record.queries.length,
  };
}

/**
 * Applies the limits (oldest observations go first) and saves. Returns how many observations
 * were dropped, or `null` when the browser refused to save.
 */
export function saveStore(
  store: VisibilityStore,
  storage: Pick<Storage, "setItem"> = localStorage,
): number | null {
  const kept = [...store.observations].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  let dropped = 0;
  const perSlot = new Map<string, number>();
  for (let index = kept.length - 1; index >= 0; index -= 1) {
    const slot = `${kept[index]!.queryId}|${kept[index]!.platformId}`;
    const count = (perSlot.get(slot) ?? 0) + 1;
    perSlot.set(slot, count);
    if (count > VISIBILITY_LIMITS.perQueryPlatform) {
      kept.splice(index, 1);
      dropped += 1;
    }
  }
  while (kept.length > VISIBILITY_LIMITS.observations) {
    kept.shift();
    dropped += 1;
  }
  let json = JSON.stringify({ ...store, observations: kept });
  while (json.length > VISIBILITY_LIMITS.bytes && kept.length > 0) {
    kept.shift();
    dropped += 1;
    json = JSON.stringify({ ...store, observations: kept });
  }
  try {
    storage.setItem(VISIBILITY_KEY, json);
  } catch {
    return null;
  }
  store.observations = kept;
  return dropped;
}

export async function classifyObservation(input: {
  domain: string;
  brand: string;
  response: string;
  citations: string[];
  outcome: string;
}): Promise<Classification> {
  await ensureEngine();
  return JSON.parse(
    classify_visibility(JSON.stringify({ schemaVersion: 1, ...input })),
  ) as Classification;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Latest observation first, per platform, for one query. */
export function historyFor(store: VisibilityStore, queryId: string, platformId: string) {
  return store.observations
    .filter((item) => item.queryId === queryId && item.platformId === platformId)
    .sort(
      (a, b) =>
        b.observedOn.localeCompare(a.observedOn) || b.recordedAt.localeCompare(a.recordedAt),
    );
}

/** CSV with formula-leading cells neutralized by the shared report formatter. */
export function visibilityCsv(store: VisibilityStore): string {
  const queries = new Map(store.queries.map((query) => [query.id, query]));
  const names = new Map(visibilityPlatforms.map((platform) => [platform.id, platform.name]));
  return toCsv(
    ["query", "domain", "platform", "observedOn", "status", "basis", "citedUrls", "notes"],
    store.observations.map((item) => [
      queries.get(item.queryId)?.text ?? "",
      queries.get(item.queryId)?.domain ?? "",
      names.get(item.platformId) ?? item.platformId,
      item.observedOn,
      item.status,
      item.basis,
      item.citations
        .filter((citation) => citation.onDomain)
        .map((citation) => citation.url)
        .join(" "),
      item.notes,
    ]),
  );
}

export function exportName(extension: "csv" | "json"): string {
  return safeFilename(`rankmiso-ai-visibility-${new Date().toISOString().slice(0, 10)}`, extension);
}
