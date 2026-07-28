/**
 * Copies Meteocons into public/weather-icons.
 *
 * They are served from our own origin rather than a CDN, so the service worker
 * can cache them alongside the rest of the shell. The copied files are
 * committed, so a deploy never depends on this having been run.
 *
 * The static export set is used, not the animated production set. CLAUDE.md
 * caps the animation budget at the gradient, route transitions, and the radar
 * timeline, "nothing else", and an animated icon per hourly card is very much
 * something else (Decisions Log 25).
 *
 * The whole set is copied rather than the subset lib/weather/icons.ts maps to.
 * It is around 500K of SVG, and a subset list is one more thing that can
 * silently drift out of step with the mapping.
 *
 * Run with `npm run icons:weather` after upgrading the package.
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(
  root,
  "node_modules/@bybas/weather-icons/design/fill/export",
);
const destination = path.join(root, "public/weather-icons");

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const files = (await readdir(source)).filter((file) => file.endsWith(".svg"));

for (const file of files) {
  // The export set prefixes every file with `wi_`; the mapping does not.
  await cp(
    path.join(source, file),
    path.join(destination, file.replace(/^wi_/, "")),
  );
}

console.log(`Copied ${files.length} static Meteocons to public/weather-icons`);
