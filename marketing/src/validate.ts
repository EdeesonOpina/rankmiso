import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { outputDir } from "./paths.ts";
import { chromePromo, iosTargets, sets } from "./platforms.ts";
import { shots } from "./shots.ts";

interface Issue {
  file: string;
  problem: string;
}

export async function validate(): Promise<number> {
  const issues: Issue[] = [];
  const report: Array<Record<string, unknown>> = [];

  for (const set of sets) {
    const dir = join(outputDir, set.dir);
    const fingerprints: Array<{ file: string; pixels: string }> = [];
    for (const shot of shots) {
      const file = join(dir, shot.file);
      const result = await inspect(file, set.size.width, set.size.height);
      if (result.issue) issues.push({ file, problem: result.issue });
      if (result.pixels) fingerprints.push({ file: shot.file, pixels: result.pixels });
      report.push({
        file: join(set.dir, shot.file),
        ...result.meta,
        nativeRuntime: set.nativeRuntime,
        submissionReady: set.submissionReady,
      });
    }
    issues.push(...duplicates(fingerprints));
    if (!set.nativeRuntime) {
      console.log(`Not submission-ready: ${set.dir}. ${set.note}`);
    }
  }

  const chromeDir = join(outputDir, "chrome");
  for (const promo of [chromePromo.small, chromePromo.marquee]) {
    const file = join(chromeDir, promo.file);
    const result = await inspect(file, promo.width, promo.height);
    if (result.issue) issues.push({ file, problem: result.issue });
    report.push({ file: join("chrome", promo.file), ...result.meta, submissionReady: true });
  }

  const preview = join(outputDir, "preview.html");
  try {
    await stat(preview);
  } catch {
    issues.push({ file: preview, problem: "Preview gallery is missing." });
  }

  await writeFile(join(outputDir, "validation.json"), JSON.stringify({ iosTargets, report, issues }, null, 2));

  if (issues.length) {
    for (const issue of issues) console.error(`${issue.file}: ${issue.problem}`);
    console.error(`${issues.length} marketing file(s) failed validation.`);
    return 1;
  }
  console.log(`Validated ${report.length} images. iOS and iPadOS exports were skipped: ${iosTargets.reason}`);
  return 0;
}

async function inspect(file: string, width: number, height: number) {
  const meta: Record<string, unknown> = {};
  try {
    const info = await stat(file);
    const image = sharp(file);
    const decoded = await image.metadata();
    await image.raw().toBuffer();
    meta.width = decoded.width;
    meta.height = decoded.height;
    meta.format = decoded.format;
    meta.hasAlpha = decoded.hasAlpha === true;
    meta.bytes = info.size;
    const problems: string[] = [];
    if (decoded.format !== "png") problems.push(`format is ${decoded.format}, expected png`);
    if (decoded.width !== width || decoded.height !== height) {
      problems.push(`size is ${decoded.width}×${decoded.height}, expected ${width}×${height}`);
    }
    if (decoded.width && decoded.height && decoded.width / decoded.height !== width / height) {
      problems.push("aspect ratio does not match the preset");
    }
    if (decoded.hasAlpha) problems.push("image has an alpha channel");
    if (info.size < 8_000) problems.push("file is unexpectedly small");
    if (info.size > 8_000_000) problems.push("file is larger than 8 MB");
    const pixels = createHash("sha256")
      .update(await sharp(file).resize(48, 30, { fit: "fill" }).removeAlpha().raw().toBuffer())
      .digest("hex");
    return { issue: problems.join("; "), pixels, meta };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { issue: `could not decode (${message})`, pixels: "", meta };
  }
}

function duplicates(items: Array<{ file: string; pixels: string }>) {
  const issues: Issue[] = [];
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const left = items[i];
      const right = items[j];
      if (left && right && left.pixels && left.pixels === right.pixels) {
        issues.push({ file: left.file, problem: `looks the same as ${right.file}` });
      }
    }
  }
  return issues;
}

export async function writePreview(): Promise<void> {
  const cards: string[] = [];
  for (const set of sets) {
    const files = shots.map((shot) => shot.file);
    cards.push(section(set.dir, files, `${set.size.width}×${set.size.height}`, set.note));
  }
  cards.push(
    section(
      "chrome",
      [chromePromo.small.file, chromePromo.marquee.file],
      "promotional",
      `Small tile ${chromePromo.small.width}×${chromePromo.small.height}. Marquee ${chromePromo.marquee.width}×${chromePromo.marquee.height}.`,
    ),
  );
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>RankMiso marketing preview</title>
  <style>
    body { margin: 0; font: 16px/1.45 ui-sans-serif, system-ui, sans-serif; background: #f3f5f8; color: #17191f; }
    main { max-width: 1400px; margin: 0 auto; padding: 32px 20px 64px; }
    h1 { font-size: 32px; letter-spacing: -0.04em; }
    h2 { margin-top: 36px; }
    p { max-width: 70ch; color: #3d4654; }
    figure { margin: 16px 0 28px; }
    img { width: min(100%, 960px); height: auto; background: #fff; box-shadow: 0 12px 30px rgb(23 25 31 / 12%); }
    figcaption { margin-top: 8px; color: #5c6778; }
  </style>
</head>
<body>
  <main>
    <h1>RankMiso marketing preview</h1>
    <p>Local gallery of the generated store images. Open this file in a browser. iOS and iPadOS images are omitted because RankMiso has no mobile Safari app.</p>
    ${cards.join("\n")}
  </main>
</body>
</html>`;
  await writeFile(join(outputDir, "preview.html"), html);
  const listed = await readdir(outputDir);
  if (!listed.includes("preview.html")) throw new Error("Preview was not written.");
}

function section(dir: string, files: string[], size: string, note: string) {
  const figures = files
    .map(
      (file) => `<figure>
      <img src="${dir}/${file}" alt="${file}" />
      <figcaption>${dir}/${file} · ${size}</figcaption>
    </figure>`,
    )
    .join("\n");
  return `<section><h2>${dir}</h2><p>${note}</p>${figures}</section>`;
}

if (process.argv[1]?.endsWith("validate.ts")) {
  const code = await validate();
  process.exit(code);
}
