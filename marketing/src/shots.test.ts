import assert from "node:assert/strict";
import { fixtureFileName } from "./capture.ts";
import {
  chromeScreenshots,
  firefoxScreenshots,
  safariScreenshots,
  storeStatusWord,
} from "./platforms.ts";
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
assert.equal(storeStatusWord('<div class="meta">Free · Open source</div>'), "Free");
assert.equal(storeStatusWord("<span>#1 SEO tool</span>"), "#1");
assert.equal(storeStatusWord("<b>NEW</b>"), "NEW");
assert.equal(storeStatusWord("<span>Open source · No account · No tracking</span>"), undefined);
assert.equal(
  storeStatusWord('<img alt="" src="data:image/png;base64,freeNEW" /><p>Newsletter-free</p>'),
  "free",
);
assert.equal(
  storeStatusWord('<img alt="" src="data:image/png;base64,freeNEW" /><p>Renewal</p>'),
  undefined,
);
console.log("Marketing shot definitions and fixture path checks passed.");
