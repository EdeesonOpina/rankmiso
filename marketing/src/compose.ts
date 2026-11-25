import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { capturesDir, foxPath, marketingRoot, outputDir } from "./paths.ts";
import {
  canvas,
  chromePromo,
  storeStatusWord,
  seoShare,
  sets,
  type FrameSize,
  youtubeThumbnail,
} from "./platforms.ts";
import { sampleNote, shots, shotsFor } from "./shots.ts";

const promoThemes = [
  { name: "dark", suffix: "", bg: "#14161c" },
  { name: "light", suffix: "-light", bg: "#f3f5f8" },
] as const;

export async function compose(): Promise<void> {
  const css = await readFile(join(marketingRoot, "templates/shot.css"), "utf8");
  const shotTemplate = await readFile(join(marketingRoot, "templates/shot.html"), "utf8");
  const promoTemplate = await readFile(join(marketingRoot, "templates/promo.html"), "utf8");
  const fox = dataUri(await readFile(foxPath), "image/png");
  const captures = new Map<string, string>();
  for (const name of [...shots.map((shot) => shot.capture), "web-page"]) {
    captures.set(name, dataUri(await readFile(join(capturesDir, `${name}.png`)), "image/png"));
  }
  const overview = captures.get("popup-overview");
  if (!overview) throw new Error("Missing popup overview capture.");

  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    for (const set of sets) {
      const dir = join(outputDir, set.dir);
      await mkdir(dir, { recursive: true });
      for (const shot of shotsFor(set.id)) {
        const product = captures.get(shot.capture);
        if (!product) throw new Error(`Missing capture ${shot.capture}`);
        // The sidebar shot docks the real sidebar beside the sample page in a plain browser window.
        const stage =
          shot.layout === "sidebar"
            ? `<div class="browser"><div class="bar"><i></i><i></i><i></i><span>127.0.0.1/page.html</span></div>` +
              `<div class="panes"><img src="${captures.get("web-page")}" alt="The sample page" /><img src="${product}" alt="RankMiso sidebar" /></div></div>`
            : `<img src="${product}" alt="RankMiso showing the sample page" />`;
        const html = shotTemplate
          .replace("/* __CSS__ */", css)
          .replace("__LAYOUT__", shot.layout)
          .replace("__FOX__", fox)
          .replace("__HEADLINE__", escapeHtml(shot.headline))
          .replace("__SUB__", escapeHtml(shot.sub))
          .replace("__NOTE__", escapeHtml(sampleNote))
          .replace("__STAGE__", stage);
        await render(browser, html, set.size, join(dir, shot.file), canvas);
      }
      await writeFile(
        join(dir, "SOURCE.txt"),
        `${set.note}\nNative runtime: ${set.nativeRuntime ? "yes" : "no"}\nSubmission ready: ${set.submissionReady ? "yes" : "no"}\n`,
      );
    }

    const chromeDir = join(outputDir, "chrome");
    const report = dataUri(await readFile(join(capturesDir, "report-overview.png")), "image/png");
    const fonts = join(marketingRoot, "assets/fonts");
    const fontInter = dataUri(await readFile(join(fonts, "Inter-latin-var.woff2")), "font/woff2");
    const fontSerif = dataUri(
      await readFile(join(fonts, "InstrumentSerif-Italic-latin.woff2")),
      "font/woff2",
    );
    const promo = (theme: string, body: string) =>
      promoTemplate
        .replace("__THEME__", theme)
        .replace("__INTER__", fontInter)
        .replace("__SERIF__", fontSerif)
        .replace("__BODY__", `${body}<div class="grain"></div>`);

    const smallBody = `<main class="small"><div class="bg-dots"></div><div class="bg-glow a"></div><div class="inner"><div class="brand"><img src="${fox}" alt="" /></div><div><b>RankMiso</b><div class="line">SEO insights,<br /><span class="serif">one click away</span><span class="dot"></span></div><div class="meta">Open source · No account</div></div></div></main>`;
    const marqueeBody =
      `<main class="marquee"><div class="bg-dots"></div><div class="bg-glow a"></div><div class="bg-glow b"></div>` +
      `<section class="copy"><div class="brand"><img src="${fox}" alt="" /><b>RankMiso</b><span class="tag">Browser extension</span></div>` +
      `<h1>Your website,<br /><span class="serif">clearly</span> <span class="nw">understood<span class="dot"></span></span></h1>` +
      `<p class="sub">Instant SEO insights for the page you are on. Checked locally, in your browser.</p>` +
      `<div class="chips"><span class="chip"><i></i>Open source</span><span class="chip"><i></i>No account</span><span class="chip"><i></i>No tracking</span></div></section>` +
      `<div class="scene"><div class="win"><div class="bar"><i></i><i></i><i></i></div><img src="${report}" alt="" /></div>` +
      `<div class="pop"><img src="${overview}" alt="RankMiso popup" /></div><span class="dot"></span></div></main>`;
    for (const [name, body] of [
      ["small", smallBody],
      ["marquee", marqueeBody],
    ]) {
      const word = storeStatusWord(body);
      if (word)
        throw new Error(
          `Chrome promo ${name} tile says "${word}"; the store rejects status words.`,
        );
    }
    // Dark is the default file name; the light pair gets a -light suffix.
    const file = (name: string, suffix: string) =>
      join(chromeDir, suffix ? name.replace(".png", `${suffix}.png`) : name);
    for (const theme of promoThemes) {
      await render(
        browser,
        promo(theme.name, smallBody),
        chromePromo.small,
        file(chromePromo.small.file, theme.suffix),
        theme.bg,
      );
      await render(
        browser,
        promo(theme.name, marqueeBody),
        chromePromo.marquee,
        file(chromePromo.marquee.file, theme.suffix),
        theme.bg,
      );
    }

    // SEO share image: the marquee laid out on a 1.91:1 canvas, rendered at 1400×735 and scaled to 1200×630.
    const seoDir = join(outputDir, seoShare.dir);
    await mkdir(seoDir, { recursive: true });
    const shareBody = marqueeBody.replace('<main class="marquee">', '<main class="marquee share">');
    const shareCanvas = {
      width: 1400,
      height: Math.round((1400 * seoShare.height) / seoShare.width),
    };
    for (const theme of promoThemes) {
      const png = join(seoDir, `share-${theme.name}.png`);
      await render(browser, promo(theme.name, shareBody), shareCanvas, png, theme.bg);
      await sharp(png)
        .resize(seoShare.width, seoShare.height)
        .jpeg({ quality: 86, progressive: true, mozjpeg: true })
        .toFile(join(seoDir, `share-${theme.name}.jpg`));
      await rm(png);
    }

    // YouTube thumbnail: 1280×720, under 2 MB. Keep text clear of the bottom-right duration badge.
    const youtubeDir = join(outputDir, youtubeThumbnail.dir);
    await mkdir(youtubeDir, { recursive: true });
    const thumbBody =
      `<main class="thumb"><div class="bg-dots"></div><div class="bg-glow a"></div>` +
      `<section class="copy"><span class="kicker">Free browser extension</span>` +
      `<h1>SEO in<br /><span class="serif">one click</span><span class="dot"></span></h1>` +
      `<div class="name">RankMiso</div></section>` +
      `<div class="scene"><div class="pop"><img src="${overview}" alt="" /></div><img class="fox" src="${fox}" alt="" /><span class="dot"></span></div></main>`;
    const thumbPng = join(youtubeDir, "thumbnail.png");
    await render(
      browser,
      promo("dark", thumbBody),
      { width: youtubeThumbnail.width, height: youtubeThumbnail.height },
      thumbPng,
      promoThemes[0].bg,
    );
    await sharp(thumbPng)
      .jpeg({ quality: 90, mozjpeg: true })
      .toFile(join(youtubeDir, "thumbnail.jpg"));
  } finally {
    await browser.close();
  }
}

async function render(
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  html: string,
  size: FrameSize,
  file: string,
  background: string,
) {
  const page = await browser.newPage({
    viewport: size,
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  try {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const shot = await page.screenshot({ type: "png", animations: "disabled" });
    const flat = await sharp(shot).flatten({ background }).png({ compressionLevel: 9 }).toBuffer();
    const meta = await sharp(flat).metadata();
    if (meta.width !== size.width || meta.height !== size.height) {
      throw new Error(
        `${file} rendered at ${meta.width}×${meta.height}, expected ${size.width}×${size.height}`,
      );
    }
    await writeFile(file, flat);
  } finally {
    await page.close();
  }
}

function dataUri(bytes: Buffer, mime: string) {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

if (process.argv[1]?.endsWith("compose.ts")) {
  compose().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
