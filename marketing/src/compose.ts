import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { capturesDir, foxPath, marketingRoot, outputDir } from "./paths.ts";
import { canvas, chromePromo, sets, type FrameSize } from "./platforms.ts";
import { sampleNote, shots } from "./shots.ts";

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
  for (const shot of shots) {
    captures.set(shot.capture, dataUri(await readFile(join(capturesDir, `${shot.capture}.png`)), "image/png"));
  }
  const overview = captures.get("popup-overview");
  if (!overview) throw new Error("Missing popup overview capture.");

  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    for (const set of sets) {
      const dir = join(outputDir, set.dir);
      await mkdir(dir, { recursive: true });
      for (const shot of shots) {
        const product = captures.get(shot.capture);
        if (!product) throw new Error(`Missing capture ${shot.capture}`);
        const html = shotTemplate
          .replace("/* __CSS__ */", css)
          .replace("__LAYOUT__", shot.layout)
          .replace("__FOX__", fox)
          .replace("__HEADLINE__", escapeHtml(shot.headline))
          .replace("__SUB__", escapeHtml(shot.sub))
          .replace("__NOTE__", escapeHtml(sampleNote))
          .replace("__PRODUCT__", product);
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
    const fontSerif = dataUri(await readFile(join(fonts, "InstrumentSerif-Italic-latin.woff2")), "font/woff2");
    const promo = (theme: string, body: string) =>
      promoTemplate
        .replace("__THEME__", theme)
        .replace("__INTER__", fontInter)
        .replace("__SERIF__", fontSerif)
        .replace("__BODY__", `${body}<div class="grain"></div>`);

    const smallBody = `<main class="small"><div class="bg-dots"></div><div class="bg-glow a"></div><div class="inner"><div class="brand"><img src="${fox}" alt="" /></div><div><b>RankMiso</b><div class="line">SEO insights,<br /><span class="serif">one click away</span><span class="dot"></span></div><div class="meta">Free · Open source</div></div></div></main>`;
    const marqueeBody =
      `<main class="marquee"><div class="bg-dots"></div><div class="bg-glow a"></div><div class="bg-glow b"></div>` +
      `<section class="copy"><div class="brand"><img src="${fox}" alt="" /><b>RankMiso</b><span class="tag">Browser extension</span></div>` +
      `<h1>Your website,<br /><span class="serif">clearly</span> <span class="nw">understood<span class="dot"></span></span></h1>` +
      `<p class="sub">Instant SEO insights for the page you are on. Checked locally, in your browser.</p>` +
      `<div class="chips"><span class="chip"><i></i>Free</span><span class="chip"><i></i>Open source</span><span class="chip"><i></i>No account</span></div></section>` +
      `<div class="scene"><div class="win"><div class="bar"><i></i><i></i><i></i></div><img src="${report}" alt="" /></div>` +
      `<div class="pop"><img src="${overview}" alt="RankMiso popup" /></div><span class="dot"></span></div></main>`;
    // Dark is the default file name; the light pair gets a -light suffix.
    for (const theme of promoThemes) {
      const file = (name: string) => join(chromeDir, theme.suffix ? name.replace(".png", `${theme.suffix}.png`) : name);
      await render(browser, promo(theme.name, smallBody), chromePromo.small, file(chromePromo.small.file), theme.bg);
      await render(browser, promo(theme.name, marqueeBody), chromePromo.marquee, file(chromePromo.marquee.file), theme.bg);
    }

    // YouTube thumbnail: 1280×720, under 2 MB. Keep text clear of the bottom-right duration badge.
    const youtubeDir = join(outputDir, "youtube");
    await mkdir(youtubeDir, { recursive: true });
    const thumbBody =
      `<main class="thumb"><div class="bg-dots"></div><div class="bg-glow a"></div>` +
      `<section class="copy"><span class="kicker">Free browser extension</span>` +
      `<h1>SEO in<br /><span class="serif">one click</span><span class="dot"></span></h1>` +
      `<div class="name">RankMiso</div></section>` +
      `<div class="scene"><div class="pop"><img src="${overview}" alt="" /></div><img class="fox" src="${fox}" alt="" /><span class="dot"></span></div></main>`;
    const thumbPng = join(youtubeDir, "thumbnail.png");
    await render(browser, promo("dark", thumbBody), { width: 1280, height: 720 }, thumbPng, promoThemes[0].bg);
    await sharp(thumbPng).jpeg({ quality: 90, mozjpeg: true }).toFile(join(youtubeDir, "thumbnail.jpg"));
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
