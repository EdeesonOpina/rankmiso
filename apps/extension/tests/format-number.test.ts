import { describe, expect, it } from "vitest";
import { formatNumber, translate } from "../src/composables/useI18n";

describe("number display", () => {
  it("adds a thousands separator and leaves smaller numbers unchanged", () => {
    expect(formatNumber(107)).toBe("107");
    expect(formatNumber(1250)).toBe("1,250");
    expect(formatNumber(1200000)).toBe("1,200,000");
  });

  it("formats counts inside translated sentences", () => {
    expect(translate("popup.moreImages", { count: 2400 })).toBe(
      "+2,400 more. Open the full report to see the rest.",
    );
  });
});
