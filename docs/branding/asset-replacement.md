# Replacing the logo

The installed extension does not pick up a new icon until the package is rebuilt and the browser reloads the extension.

## Extension icon

1. Replace `apps/extension/public/brand/icon.png` with your PNG.
2. The file must exist and be at least 128 by 128 pixels. A square image is the right source. The generator uses ImageMagick `convert` and does not crop to a circle.
3. From the repository root, run `pnpm brand:icons`.
4. The script writes `apps/extension/public/icon-16.png`, `icon-32.png`, `icon-48.png`, and `icon-128.png`.
5. Rebuild the browser package you are testing, then reload the extension.

`pnpm brand:icons` fails with a path when the source PNG is missing, and with the measured size when the PNG is smaller than 128 pixels. ImageMagick `identify` and `convert` must be on `PATH`.

The manifest already points at `/icon-16.png`, `/icon-32.png`, `/icon-48.png`, and `/icon-128.png`. You do not edit the manifest to change the artwork.

## Interface logos

Replace these files and reload the extension page:

- `apps/extension/public/brand/logo-light.png` for light surfaces
- `apps/extension/public/brand/logo-dark.png` for dark surfaces

`BrandMark.vue` reads the paths from `brand.config.ts`. Do not import those paths from individual screens.

## Recreating the placeholder

`pnpm icons` redraws the three source PNGs from `apps/extension/assets/brand/*.svg`, then runs the same size step as `pnpm brand:icons`. That replaces the current fox artwork with the geometric M. Use it only when you want that placeholder back.
