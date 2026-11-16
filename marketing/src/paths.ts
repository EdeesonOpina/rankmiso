import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const marketingRoot = resolve(here, "..");
export const repoRoot = resolve(marketingRoot, "..");
export const capturesDir = resolve(
  marketingRoot,
  process.env.RANKMISO_MARKETING_CAPTURES_DIR ?? "captures",
);
export const outputDir = resolve(
  marketingRoot,
  process.env.RANKMISO_MARKETING_OUTPUT_DIR ?? "output",
);
export const fixtureDir = resolve(marketingRoot, "fixture");
export const extensionDir = resolve(
  process.env.RANKMISO_EXTENSION_OUT_DIR ?? resolve(repoRoot, "apps/extension/.output"),
  "chrome-mv3",
);
export const foxPath = resolve(marketingRoot, "assets/fox-head.png");
