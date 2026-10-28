export function robotsAddress(origin: string): string {
  return new URL("/robots.txt", origin).href;
}
