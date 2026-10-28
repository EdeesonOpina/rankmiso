export function nextTabId(current: string, ids: readonly string[], key: string): string | null {
  const index = ids.indexOf(current);
  if (index < 0 || ids.length === 0) return null;
  if (key === "ArrowRight") return ids[(index + 1) % ids.length] ?? null;
  if (key === "ArrowLeft") return ids[(index - 1 + ids.length) % ids.length] ?? null;
  if (key === "Home") return ids[0] ?? null;
  if (key === "End") return ids[ids.length - 1] ?? null;
  return null;
}

export function scrollThumb(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): { size: number; start: number } | null {
  if (scrollWidth <= clientWidth + 4) return null;
  const size = Math.max(18, (clientWidth / scrollWidth) * 100);
  const max = scrollWidth - clientWidth;
  const start = max <= 0 ? 0 : (scrollLeft / max) * (100 - size);
  return { size, start };
}
