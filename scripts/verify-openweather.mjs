/**
 * Probes every OpenWeatherMap endpoint the app depends on and reports what
 * came back.
 *
 * Reads OPENWEATHER_API_KEY from .env.local and never prints it. Output is
 * status codes and field names only, so the result is safe to paste anywhere.
 *
 * The main thing this settles is which One Call version the account can
 * actually reach: OWM answers 401 at the gateway for every version, including
 * ones that do not exist, so an invalid key makes them indistinguishable.
 *
 * Run with `npm run verify:owm`.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Guelph, Ontario. Any populated coordinate pair would do. */
const LAT = 43.5448;
const LON = -80.2482;

async function readKey() {
  let contents;

  try {
    contents = await readFile(path.join(root, ".env.local"), "utf8");
  } catch {
    console.error("No .env.local found. Copy .env.example and fill it in.");
    process.exit(1);
  }

  const match = contents.match(/^\s*OPENWEATHER_API_KEY\s*=\s*(.+)$/m);
  const key = match?.[1]?.trim();

  if (!key) {
    console.error("OPENWEATHER_API_KEY is missing or empty in .env.local.");
    process.exit(1);
  }

  return key;
}

/** Redacts the key from anything before it is printed. */
function scrub(text, key) {
  return text.split(key).join("<key>");
}

async function probe(label, url, key, inspect) {
  const started = Date.now();

  try {
    const response = await fetch(url);
    const elapsed = Date.now() - started;
    const body = await response.text();

    let detail = "";

    if (response.ok) {
      try {
        detail = inspect(JSON.parse(body));
      } catch {
        detail = `${body.length} bytes, not JSON`;
      }
    } else {
      // Vendor error bodies are short and carry the useful reason.
      detail = scrub(body.slice(0, 160), key);
    }

    const mark = response.ok ? "OK  " : "FAIL";
    console.log(`${mark} ${label}  ${response.status}  ${elapsed}ms`);
    if (detail) console.log(`     ${detail}`);

    return response.ok;
  } catch (error) {
    console.log(`FAIL ${label}  network  ${scrub(String(error), key)}`);
    return false;
  }
}

const key = await readKey();

console.log(`Probing OpenWeatherMap for ${LAT}, ${LON}\n`);

const oneCallVersions = ["4.0", "3.0"];
const reachable = [];

for (const version of oneCallVersions) {
  const ok = await probe(
    `One Call ${version}      `,
    `https://api.openweathermap.org/data/${version}/onecall?lat=${LAT}&lon=${LON}&units=metric&exclude=minutely&appid=${key}`,
    key,
    (json) => {
      const blocks = ["current", "hourly", "daily", "alerts"].filter(
        (block) => json[block] !== undefined,
      );
      return [
        `blocks: ${blocks.join(", ") || "none"}`,
        `tz: ${json.timezone}`,
        `hourly: ${json.hourly?.length ?? 0}`,
        `daily: ${json.daily?.length ?? 0}`,
        `alerts: ${json.alerts?.length ?? 0}`,
        `code: ${json.current?.weather?.[0]?.id}`,
      ].join("  ");
    },
  );

  if (ok) reachable.push(version);
}

await probe(
  "Geocoding direct  ",
  `https://api.openweathermap.org/geo/1.0/direct?q=Guelph&limit=3&appid=${key}`,
  key,
  (json) => `${json.length} matches, first: ${json[0]?.name}, ${json[0]?.country}`,
);

await probe(
  "Geocoding reverse ",
  `https://api.openweathermap.org/geo/1.0/reverse?lat=${LAT}&lon=${LON}&limit=1&appid=${key}`,
  key,
  (json) => `name: ${json[0]?.name}, ${json[0]?.state ?? ""}`,
);

await probe(
  "Air Pollution     ",
  `https://api.openweathermap.org/data/2.5/air_pollution?lat=${LAT}&lon=${LON}&appid=${key}`,
  key,
  (json) => `aqi: ${json.list?.[0]?.main?.aqi} (1 to 5 scale)`,
);

for (const layer of ["precipitation_new", "wind_new"]) {
  await probe(
    `Tiles ${layer.padEnd(12)}`,
    `https://tile.openweathermap.org/map/${layer}/7/36/44.png?appid=${key}`,
    key,
    () => "png returned",
  );
}

console.log("");

if (reachable.length === 0) {
  console.log(
    "No One Call version responded. The account most likely has no One Call\n" +
      "subscription, which is separate from the free tier. Current, hourly,\n" +
      "daily and alerts will all fail until that is sorted.",
  );
  process.exit(1);
}

console.log(`One Call versions reachable: ${reachable.join(", ")}`);

const configured = "4.0";
if (!reachable.includes(configured)) {
  console.log(
    `The app is set to ${configured}, which did not respond. Change\n` +
      `ONE_CALL_VERSION in lib/weather/openweather/client.ts to ${reachable[0]}.`,
  );
  process.exit(1);
}

console.log("Everything the app needs is reachable.");
