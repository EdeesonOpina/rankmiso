import assert from "node:assert/strict";
import { fixtureFileName } from "./capture.ts";
import { chromeScreenshots, firefoxScreenshots, safariScreenshots } from "./platforms.ts";
import { shots, shotsFor } from "./shots.ts";

assert.equal(shots.length, chromeScreenshots.count);
assert.equal(shotsFor("firefox").length, firefoxScreenshots.count);
assert.equal(shotsFor("safari-macos").length, safariScreenshots.count);
assert.ok(shotsFor("firefox").every((shot) => !shot.chromiumOnly));
assert.ok(shotsFor("safari-macos").every((shot) => !shot.chromiumOnly));

assert.equal(fixtureFileName("/"), "page.html");
assert.equal(fixtureFileName("/sitemap.xml"), "sitemap.xml");
assert.equal(fixtureFileName("/drafts/winter.html"), undefined);
assert.equal(fixtureFileName("/../README.md"), undefined);
assert.equal(fixtureFileName("/%2e%2e/README.md"), undefined);
console.log("Marketing shot definitions and fixture path checks passed.");
