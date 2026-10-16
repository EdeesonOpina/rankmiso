import { describe, expect, it } from "vitest";
import { brandConfig } from "../src/config/brand.config";
import { messages } from "../src/locales/en";

describe("brand", () => {
  it("keeps the RankMiso identity in one config", () => {
    expect(brandConfig.identity.name).toBe("RankMiso");
    expect(brandConfig.identity.tagline).toBe("Every page. Every detail.");
    expect(brandConfig.identity.ecosystem).toBe("Miso Ecosystem");
    expect(brandConfig.assets.icon).toBe("/brand/icon.png");
    expect(brandConfig.browser.geckoId).toBe("rankmiso@rankmiso.extension");
    expect(messages["brand.tagline"]).toBe(brandConfig.identity.tagline);
    expect(messages["field.titleLength"]).toBe("Title length");
    expect(messages["status.pass"]).toBe("Passed");
  });
});
