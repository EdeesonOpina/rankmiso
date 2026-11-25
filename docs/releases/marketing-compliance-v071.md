# Marketing compliance correction (Chrome Web Store, 25 November 2026)

## What the store reported

Chrome Web Store Developer Support warned that the listing for item `gdklhfalmmahhgimegjlfnhmacimeonl` breaks the "Impersonation and Intellectual Property" policy (violation reference **Red Nickel**). The small promo tile and the marquee showed the word "Free", which the store treats as a status claim. The listing has 30 days to replace them, counted from 25 November 2026.

The warning covers promotional image text only. RankMiso stays free and open source. The listing name ("RankMiso — Free, Open-Source SEO Analyzer") and the manifest description were not cited. They are unchanged here and are an owner decision.

## Change

Source: `master` at `0b2bc1dfd2fbb97d841dc4818e9fda62d7dc35e9` (extension 0.7.0), branch `fix/marketing-compliance-v071`.

| Image                               | Before                          | After                                  |
| ----------------------------------- | ------------------------------- | -------------------------------------- |
| Small tile 440×280 (dark and light) | Free · Open source              | Open source · No account               |
| Marquee 1400×560 (dark and light)   | Free / Open source / No account | Open source / No account / No tracking |
| Share images 1200×630               | same as marquee                 | same as marquee                        |

`storeStatusWord` in `marketing/src/platforms.ts` makes `pnpm marketing:build` fail when a Chrome tile's visible text contains a status word. `marketing/src/shots.test.ts` covers it.

The YouTube thumbnail still says "Free browser extension". It is not a Chrome Web Store asset, so it was left as is.

## Capture repair

On `master`, `marketing/src/capture.ts` could not produce v0.7.0 images. It waited for a "Site Explorer" heading that the v0.7.0 report no longer has, and it never saved the seven `site-*` captures that `shots.ts` expects. Those captures were probably lost with the earlier disk-full recovery. This branch restores them: it crawls an earlier version of the sample page, saves that crawl, crawls the current version, and compares the two, so the Compare shot shows a real change (2 resolved findings).

## Verification (25 November 2026)

- `pnpm --filter @rankmiso/marketing test`: 1 passed, 0 failed.
- `pnpm marketing:generate` against a fresh Chrome build of the source above (manifest 0.7.0): 80 images validated, 0 issues.
- Inspected by eye: both dark tiles and the Overview, Issues, Pages, Links, Compare, crawl-controls, and dark-mode Site Explorer shots.
- Firefox images are Chromium-rendered compositions; Safari images are provisional. Same as before.

Checksums of the dark promo pair handed over for upload:

```
ab667d1ed735322914d99e0447384be1ab3fe3061a80bd8d1b676238dc974d24  chrome/promo-small.png
64983d33b1aa51db96bca7265b08bd5608719c959b7a4016f64cfdbdb037b828  chrome/promo-marquee.png
```

The full list is `marketing/output/SHA256SUMS.txt` (git-ignored, local).

## Store outcome

The owner uploaded the corrected small tile and marquee in a new Chrome Web Store draft, and Google approved them. The warning is resolved. This record and the source change keep future builds from bringing the wording back. No further submission or appeal is needed.
