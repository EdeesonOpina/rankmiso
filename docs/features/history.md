# History

History is the existing report section. The popup History tab shows how many saves exist for the open page and the latest score. It does not save an audit. Saving happens in the report, and only when you choose **Save current comparison**.

A site crawl is not copied into this history, and the crawl still has no site score.

## What a save stores

New saves use schema version 2. They keep the previous summary fields and add the rule-set version, error, warning, passed, and unavailable counts, measured-check count, category scores, and each check’s identifier, status, category, and short title. They do not store page text, the link list, the image list, cookies, or evidence.

Older saves stay in storage. A field they never had is shown as **Not recorded**. A category the audit marked unavailable is **Not measured**. Neither is shown as zero.

The device keeps 20 saves. The next save removes the oldest. Delete one save, or confirm **Delete all**. Closing the report does not delete them.

## Charts

The score chart plots saved scores for the open page, in save order. The line joins two scores only when they use the same rule set and the same number of measured checks. It does not invent a point for a day that was not saved. One save is one point and is not called a trend. Two saves on the same day stay as two points.

Errors use a solid line and a round mark. Warnings use a dashed line and a square mark. A lower warning count is not described as proof that the page improved.

The category control shows one category at a time. Performance and any other unmeasured category are not drawn as zero.

A second address is not added to this page’s chart. **All saved pages** lists them and says they are not one trend.

## Comparison

The default pair is the two newest saves of the open page, older first. You can change either select. If the later select is actually older, the screen says so.

A score change is shown only when the rule set and the measured-check count match. Otherwise both scores stay visible and the change says **Not comparable**. That is not a ranking, traffic, or indexation claim.

Individual checks are compared only when both saves include check results and the same rule set. A previous error or warning that is now a pass is **Resolved**. A previous pass that is now an error or warning is **New**. The same problem still present is **Unchanged**. A check that was not saved on one side, or that was unavailable, is **Cannot determine**. Counts alone are not turned into a list of resolved checks.

## Export

CSV, JSON, and HTML export the open page’s saves after you confirm the download. They do not include other saved pages. CSV formula characters are prefixed. HTML is escaped.

## What is still separate

M3 permission denial, Firefox as a loaded add-on, and a phone were not rechecked for History. Firefox can save and read local history. It still does not crawl. Visual sign-off remains pending.
