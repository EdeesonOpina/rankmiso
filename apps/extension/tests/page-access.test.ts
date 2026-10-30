import { describe, expect, it } from "vitest";
import {
  isHostPermissionError,
  nextAccessRequest,
  permissionPatternMatchesUrl,
  sitePermission,
  webOrigin,
} from "../src/services/page-access";

describe("refresh access after a domain change", () => {
  it("reads an http origin and ignores browser pages", () => {
    expect(webOrigin("https://example.com/pricing")).toBe("https://example.com");
    expect(webOrigin("http://example.com")).toBe("http://example.com");
    expect(webOrigin("chrome://extensions")).toBeNull();
    expect(webOrigin(undefined)).toBeNull();
  });

  it("does not ask on the first open or on the same site", () => {
    expect(
      nextAccessRequest({
        visibleUrl: "https://example.com/",
        tabsPermission: false,
        originPermission: false,
      }),
    ).toEqual({ type: "none" });
    expect(
      nextAccessRequest({
        visibleUrl: "https://example.com/next",
        previousUrl: "https://example.com/start",
        tabsPermission: false,
        originPermission: false,
      }),
    ).toEqual({ type: "none" });
  });

  it("asks for the new site when its address is visible", () => {
    expect(
      nextAccessRequest({
        visibleUrl: "https://news.example/story",
        previousUrl: "https://shop.example/cart",
        tabsPermission: true,
        originPermission: false,
      }),
    ).toEqual({ type: "origin", origin: "https://news.example" });
  });

  it("asks to see the tab address when a domain change hides it", () => {
    expect(
      nextAccessRequest({
        previousUrl: "https://shop.example/cart",
        tabsPermission: false,
        originPermission: false,
      }),
    ).toEqual({ type: "tabs" });
    expect(
      nextAccessRequest({
        previousUrl: "https://shop.example/cart",
        tabsPermission: true,
        originPermission: false,
      }),
    ).toEqual({ type: "none" });
  });

  it("skips the site prompt when that origin was already allowed", () => {
    expect(
      nextAccessRequest({
        visibleUrl: "https://news.example/story",
        previousUrl: "https://shop.example/cart",
        tabsPermission: true,
        originPermission: true,
      }),
    ).toEqual({ type: "none" });
  });

  it("recognizes a missing host permission", () => {
    expect(
      isHostPermissionError(
        new Error(
          "Cannot access contents of the page. Extension manifest must request permission to access the respective host.",
        ),
      ),
    ).toBe(true);
    expect(isHostPermissionError(new Error("No active tab is available."))).toBe(false);
  });

  it("creates an exact scheme and hostname permission pattern without claiming port scope", () => {
    expect(sitePermission("https://www.example.com:8443/path?q=1")).toEqual({
      origin: "https://www.example.com:8443",
      hostname: "www.example.com",
      pattern: "https://www.example.com/*",
    });
    expect(sitePermission("http://example.com/path")?.pattern).toBe("http://example.com/*");
    expect(sitePermission("https://example.com")).not.toEqual(sitePermission("http://example.com"));
  });

  it("rejects browser and non-web URLs for website access", () => {
    for (const url of [
      "about:config",
      "chrome://extensions",
      "moz-extension://id/page",
      "file:///tmp/page",
      "blob:https://example.com/id",
      "data:text/html,x",
    ]) {
      expect(sitePermission(url)).toBeNull();
    }
  });

  it("matches removed exact origins and host wildcards without confusing schemes", () => {
    expect(permissionPatternMatchesUrl("https://example.com/*", "https://example.com/a")).toBe(
      true,
    );
    expect(permissionPatternMatchesUrl("https://example.com/*", "http://example.com/a")).toBe(
      false,
    );
    expect(permissionPatternMatchesUrl("https://*.example.com/*", "https://a.example.com")).toBe(
      true,
    );
    expect(permissionPatternMatchesUrl("https://*.example.com/*", "https://example.org")).toBe(
      false,
    );
  });
});
