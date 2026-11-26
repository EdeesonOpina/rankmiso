import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { platforms, visibilityPlatforms } from "../src/config/crawlers.config";
import { markFor, marks } from "../src/config/platform-marks.config";

const dir = join(__dirname, "../public/platforms");

describe("platform marks", () => {
  it("bundles every mapped mark and nothing else", () => {
    const files = Object.values(marks).map((mark) => mark.file);
    expect(readdirSync(dir).sort()).toEqual([...files].sort());
  });

  it("are small, static SVGs with no scripts or external references", () => {
    for (const file of readdirSync(dir)) {
      const svg = readFileSync(join(dir, file), "utf8");
      expect(svg.length, file).toBeLessThan(10_000);
      expect(svg.startsWith("<svg"), file).toBe(true);
      expect(svg, file).toMatch(/viewBox="/);
      expect(svg, file).not.toMatch(/<script|<foreignObject|<image|href=|javascript:|\son\w+=/i);
      expect(svg, file).not.toMatch(/url\(\s*['"]?(https?:|data:)/i);
    }
  });

  it("maps known platforms and falls back to a letter for the rest", () => {
    expect(markFor("chatgpt")?.file).toBe("openai.svg");
    expect(markFor("google-ai")?.file).toBe("google.svg");
    expect(markFor("duckassist")?.file).toBe("duckduckgo.svg");
    expect(markFor("yahoo")).toBeUndefined();
    const mapped = platforms.filter((item) => markFor(item.id)).length;
    expect(mapped).toBe(platforms.length - 1);
    for (const item of visibilityPlatforms) expect(markFor(item.platformId), item.id).toBeTruthy();
  });
});
