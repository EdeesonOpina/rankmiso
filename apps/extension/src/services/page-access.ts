export type AccessRequest =
  { type: "none" } | { type: "tabs" } | { type: "origin"; origin: string };

export function webOrigin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function nextAccessRequest(input: {
  visibleUrl?: string;
  previousUrl?: string;
  tabsPermission: boolean;
  originPermission: boolean;
}): AccessRequest {
  if (!input.previousUrl) return { type: "none" };
  const origin = webOrigin(input.visibleUrl);
  if (!origin) return input.tabsPermission ? { type: "none" } : { type: "tabs" };
  if (origin === webOrigin(input.previousUrl) || input.originPermission) return { type: "none" };
  return { type: "origin", origin };
}

export function isHostPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cannot access contents|missing host permission|permission to access the respective host/i.test(
    message,
  );
}

export function isGestureError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /user gesture/i.test(message);
}
