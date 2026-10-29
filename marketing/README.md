<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../docs/assets/readme/hero-dark.jpg" />
    <img src="../docs/assets/readme/hero-light.jpg" alt="RankMiso promo marquee" width="100%" />
  </picture>
</p>

# 📸 The RankMiso photo studio

This folder makes every RankMiso store picture. It photographs the real, built Chromium extension, then frames those captures for each store. It never touches the extension interface. The fox just poses.

The model page is `fixture/page.html`. Scores in the pictures come from RankMiso analyzing that page. They are not search rankings.

## 🎬 Lights, camera, capture

From the repository root, after the Chrome extension has been built:

```bash
pnpm --filter @rankmiso/extension build
pnpm marketing:capture
pnpm marketing:build
pnpm marketing:validate
```

`pnpm marketing:generate` runs capture, composition, the preview gallery, and validation in one go.

## 🖼️ What comes out

| Path | What it is |
| --- | --- |
| `marketing/captures/` | Raw extension screenshots. Gitignored. |
| `marketing/output/chrome/` | Nine 1280×800 screenshots. The store accepts five; 01–05 are the suggested set and 06–09 can replace any of them. Also 440×280 and 1400×560 promotional images. |
| `marketing/output/firefox/` | Nine 1280×800 frames of the same interface. Firefox can list all nine. Not captured inside Firefox. |
| `marketing/output/safari/macos/` | Nine 2880×1800 frames. Provisional. The Mac listing can take up to ten. |
| `marketing/output/youtube/` | 1280×720 YouTube thumbnail for the promo video, as PNG and JPG (both under YouTube's 2 MB limit). |
| `marketing/output/preview.html` | Local gallery. Open the file in a browser. |

`SOURCE.txt` in each export folder says whether a native runtime was used.

iOS and iPadOS files are not created. RankMiso has no iPhone or iPad app. The sizes Apple lists for those devices are recorded in `src/platforms.ts` and left unused.

## ✨ Promo tiles and thumbnail

<p align="center">
  <img src="../docs/assets/readme/full-report.jpg" alt="Store screenshot: the full report" width="49%" />
  <img src="../docs/assets/readme/schema.jpg" alt="Store screenshot: structured data" width="49%" />
</p>

`templates/promo.html` draws the 440×280 and 1400×560 Chrome promo images and the YouTube thumbnail. They share the look of the promo video: ink background, vermilion dot, Inter 800 with an Instrument Serif italic accent, and the real popup front and center. Both fonts are in `assets/fonts/` (SIL Open Font License) and are embedded at render time, so the output does not depend on fonts installed on the machine.

Each tile is rendered twice: dark (`promo-small.png`, `promo-marquee.png`) and light (`promo-small-light.png`, `promo-marquee-light.png`). The store takes one of each size, so upload whichever pair you prefer. The validator checks the dark pair.

### Main README images

`docs/assets/readme/` holds tracked copies of a few outputs for the repository README: both marquees as `hero-*.jpg`, six screenshots, and `demo.gif`, the popup-click moment from the promo video. They are copied by hand, not by `pnpm marketing:build`. After a rebuild, refresh them from the repository root:

```bash
node -e '
const sharp = require("./marketing/node_modules/sharp");
const S = "marketing/output/chrome/", D = "docs/assets/readme/";
const jobs = [["promo-marquee.png", "hero-dark.jpg"], ["promo-marquee-light.png", "hero-light.jpg"],
  ["02-structured-data.png", "schema.jpg"], ["03-headings.png", "headings.jpg"], ["04-links.png", "links.jpg"],
  ["05-full-report.png", "full-report.jpg"], ["06-images.png", "images.jpg"], ["07-social.png", "social.jpg"]];
for (const [a, b] of jobs)
  sharp(S + a).resize({ width: a.startsWith("promo") ? 1400 : 960 }).jpeg({ quality: 84, mozjpeg: true }).toFile(D + b);'

ffmpeg -y -ss 3.85 -t 4.9 -i marketing/output/videos/rankmiso-promo-16x9.mp4 \
  -vf "hqdn3d=8:8:12:12,fps=12,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle" \
  docs/assets/readme/demo.gif
```

The denoise step matters: the film grain otherwise makes the GIF about three times larger.

## 🌐 Browsers

Chromium capture loads `apps/extension/.output/chrome-mv3`. A temporary copy receives host permission for `127.0.0.1` only, so the sample page can be read. The product manifest is not edited.

Firefox is installed on this machine. Playwright cannot drive that system Firefox without its own patched Firefox build, and the existing browser tests do not load the add-on. These Firefox images use the shared RankMiso interface and do not draw a Chrome window.

Safari images are compositions of that same interface at the Mac App Store size. They are not Safari screenshots. Check them in Safari before any Mac submission.

## 📏 Specs checked

28 October 2026.

- Chrome Web Store images: screenshots 1280×800, small promo 440×280, marquee 1400×560. Square corners, full bleed, no alpha.
- Firefox listing guidance: 1280×800 at a 1.6:1 ratio.
- Apple screenshot specifications: Mac 2880×1800 is an accepted 16:10 size. No alpha.
- YouTube thumbnail: 1280×720, under 2 MB.
