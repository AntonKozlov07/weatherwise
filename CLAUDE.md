# WeatherWise

Weather PWA, installed to an iPhone home screen via Safari. Port of an Android app originally written in Kotlin with XML layouts. No App Store submission, no Mac, no native code.

Read this file at the start of every session. Append to the Decisions Log rather than re-litigating settled choices.

---

## Hard constraints

- **No authentication.** No login, signup, OAuth, accounts, or user table. Single user.
- **No database.** Preferences and cached payloads live in `localStorage`.
- **No third party API calls from the client.** Every vendor call goes through a Next.js route handler under `app/api/`. Keys never reach the browser.
- **390px viewport first.** Degrade gracefully wider. This is a phone app.
- Target: iOS Safari, installed standalone. Test there, not in desktop Chrome.

## Stack

- Next.js App Router, TypeScript strict
- Tailwind CSS
- `next/font/google` for Albert Sans
- MapLibre GL JS for the map screen
- Service worker for offline shell and cached forecast
- Deployed on Vercel

Node 20+. Commit at the end of every phase.

---

## Design tokens

```
--bg              #12151A   page background (Dark theme)
--bg-midnight     #000000   page background (Midnight theme)
--surface         #1C2027   card
--surface-raised  #242932   nested card, active segment
--hairline        #2E343E   1px borders, dividers
--text            #F2F4F7   primary
--text-dim        #8A919C   secondary, labels, units
--accent          #7C5CFF   progress dots, active states, toggles
```

Radius: cards `20px`, inner elements `12px`, pills `999px`.
No drop shadows anywhere. Separation comes from background contrast only.

### Type

**Albert Sans** (Google Fonts, variable 100 to 900). Load via `next/font/google` with `display: 'swap'`.

| Role | Weight | Notes |
|---|---|---|
| Wordmark | 200 | uppercase, `letter-spacing: 0.3em` |
| Current temperature | 200 | very large, degree symbol at 45% size, raised |
| Screen headings / greeting | 500 | |
| Body | 400 | |
| Labels, units, captions | 500 | uppercase, `letter-spacing: 0.08em`, `--text-dim` |
| Numeric data in cards | 300 | |

The contrast between hairline-thin display type and medium-weight labels is the typographic signature. Do not flatten everything to 400/600.

### Brand assets

Place in `public/brand/`:

| File | Contents | Use |
|---|---|---|
| `Logo_Larger_Version.svg` | W monogram with cloud, 60x57, white strokes | App icon, splash, favicon |
| `WeatherWise_Text_Logo.svg` | Full WEATHERWISE wordmark, 232x19 | App header |
| `Special_Text_Version.svg` | Wordmark with a 26px leading gap where the monogram sits, 256x20 | Onboarding and splash lockup, paired with the monogram |

All three are white paths on transparent background. They require a dark backing plate.

**Icon generation.** The monogram uses 2.5 and 3.5 stroke widths at 60px, which reads thin at small sizes. Before generating icons, produce a variant with strokes scaled up roughly 1.5x. Then:

```
npx pwa-asset-generator public/brand/logo-mark-thick.svg public/icons \
  -b "#12151A" -p 22% --favicon --type png
```

22% padding is required so maskable icons are not cropped. Generate 192, 512, and 512-maskable, plus a 180x180 `apple-touch-icon`, plus iOS splash screens.

---

## Signature feature: reactive gradient greeting

The greeting text ("Good Afternoon, Anton!") is filled with a left-to-right linear gradient computed from local time, then modified by current conditions. This is the identity of the app. Build it as an isolated, unit tested pure function:

```ts
getGreetingGradient(now: Date, sunrise: Date, sunset: Date, conditionCode: number)
  => { from: string; to: string }
```

Keep it in `lib/gradient/` with zero React imports so it can be tuned independently.

### Base stops

| Window | From | To |
|---|---|---|
| Dawn | `#2B3A67` | `#FF9E7A` |
| Morning | `#FFB347` | `#FFF3D6` |
| Midday | `#FFD84D` | `#FFFFFF` |
| Golden hour | `#FFFFFF` | `#FF7B54` |
| Dusk | `#FF7B54` | `#6B4A8F` |
| Night | `#9AA3AE` | `#4A5158` |

Windows are anchored to **real sunrise and sunset** for the active location, not fixed clock times:

- Dawn: sunrise minus 90min, to sunrise plus 45min
- Morning: to midpoint between sunrise and solar noon
- Midday: to sunset minus 150min
- Golden hour: to sunset plus 15min
- Dusk: to sunset plus 90min
- Night: remainder

Interpolate continuously in **OKLCH** between the current window and the next based on elapsed fraction. No hard switching at boundaries. Recompute every 60 seconds.

### Condition modifier

| Condition | Modifier |
|---|---|
| Clear, sunny | none |
| Partly cloudy | desaturate 15% |
| Overcast | desaturate 35%, blend 20% toward `#8A919C` |
| Rain, drizzle | blend 30% toward `#5B7A99` |
| Snow, sleet | blend 30% toward `#D9E8F5` |
| Thunderstorm | blend 25% toward `#6B5BA8` |
| Fog, mist | desaturate 50%, compress lightness delta between stops |

Map WeatherAPI condition codes to these seven buckets in one lookup table in `lib/gradient/conditions.ts`.

Build a `/dev/gradient` route (dev only) with sliders for time of day and a condition picker, rendering live sample text. This is for tuning.

---

## Data sources

Split deliberately. Do not consolidate.

**Superseded.** Every weather field now comes from OpenWeatherMap (Decisions Log 41). WeatherAPI.com, Open-Meteo, and RainViewer are all removed. The table below records the current sources.

| Data | Source | Why |
|---|---|---|
| Current, hourly, daily, alerts | **OpenWeatherMap One Call** | One vendor for the whole forecast. Needs a One Call subscription on the account, separate from the free tier |
| City search and place names | **OpenWeatherMap Geocoding** `/geo/1.0/direct` and `/reverse` | One Call takes coordinates only and returns no place name |
| Air quality | **OpenWeatherMap Air Pollution** `/data/2.5/air_pollution` | One Call carries no air quality. Free tier |
| Precipitation and wind map tiles | **OpenWeatherMap Weather Maps 1.0** | Free tier. Do not use their 2.0 endpoints, those are paid |
| Map basemap | **MapLibre GL JS** + CARTO Dark Matter style | Free |
| News | see below. **Not** part of the weather migration | |

### Environment variables

```
OPENWEATHER_API_KEY=
NEWS_API_KEY=
```

`WEATHER_API_KEY` is gone. `.env*` must be in `.gitignore`. Mirror both into Vercel project settings.

### News provider

Before writing the Explore page, make one test request to identify the provider from the key format and response shape. The key is 40 mixed alphanumeric characters, which suggests **thenewsapi.com** rather than newsapi.org.

**If it turns out to be newsapi.org, stop and switch providers.** Their free tier restricts CORS to localhost and forbids production use, so the page will work in dev and break on deploy. Production-safe free alternatives, in order of preference: Currents API, NewsData.io, APITube.

Free news tiers run 100 to 1,000 requests per day. With seven category tabs that is trivially exhaustible, so **cache each category server side for 30 minutes**. Non-negotiable.

---

## Screens

The Figma design is the source of truth for layout and is pasted separately. Two mandatory deviations from it:

1. **All login and signup screens are cut.** Onboarding is three steps: Welcome, Personalize, Location.
2. **Main page middle element is replaced.** Delete the element containing arrows. In its place put open space and a two-option segmented control: `Hourly | Weekly`.

### Main page structure

- Header: hamburger (opens side menu), centered wordmark
- Greeting with reactive gradient
- Date line
- **Pinned "now" card on the left. It does not scroll.** Current temp, condition, feels like, wind, chance of rain.
- **Horizontal scroll rail to the right of the pinned card.** The only horizontally scrolling element. Snap to card, momentum scroll, hidden scrollbar, no page overflow, keyboard accessible.
- The `Hourly | Weekly` control swaps the rail contents:
  - Hourly: next 24h, one card per hour, time / icon / temp / precip chance
  - Weekly: one card per day, day name / icon / high-low / condition / precip chance
- Severe weather alert banner above the greeting when active, dismissible
- Bottom nav: Home, Explore, Map

### Explore page

Tabs: World, Sports, Business, Technology, Science, Health, Climate. The Climate tab queries weather and climate keywords.

Card per article: headline, source, relative time, thumbnail if present. Opens in a new tab.

### Map page

Full screen dark map, centered on the saved location. Layer switcher (Precipitation / Wind / Off), opacity slider, radar timeline scrubber with play and pause. RainViewer attribution visible.

### Side menu

Name, Guide, Settings. Settings holds units, font size, theme, notifications, saved locations, reset onboarding.

---

## Required weather features

Current temp, feels like, condition text and icon, high/low, hourly 24h, daily 7d, precipitation chance and amount, wind speed with compass direction and gusts, humidity, dew point, pressure, visibility, UV index with plain language severity, AQI with severity and dominant pollutant, sunrise, sunset, moonrise, moonset, moon phase, severe alerts, multiple saved locations with switcher, city search, pull to refresh, "updated Nm ago" timestamp, live units toggle.

**Weather icons: Meteocons** (MIT, animated SVG). Do not use the icon URLs WeatherAPI returns in its response, they do not match this design.

---

## PWA requirements

- `manifest.json`: name, short_name `WeatherWise`, `display: standalone`, `theme_color` and `background_color` `#12151A`, icons 192 / 512 / 512-maskable
- Explicit `<link rel="apple-touch-icon">`. iOS does not reliably read the manifest for this.
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding, so layout clears the Dynamic Island and home indicator
- iOS splash screen meta tags
- `overscroll-behavior: none` on the document
- `user-select: none` on chrome, allowed on content
- Service worker: cache app shell, cache last successful forecast, show stale data behind an "Offline, showing last update" banner when the network fails
- Service worker versioning strategy so iOS does not serve a stale shell forever

**Pull to refresh must be custom.** `overscroll-behavior: none` kills the native gesture, so implement it on the scroll container with a translate and a spinner.

---

## Quality bar

- Skeleton loaders, not spinners
- Real empty and error states with a retry action, plain language, no apologising
- `prefers-reduced-motion` respected: the gradient stops drifting, the radar does not autoplay
- Visible keyboard focus rings
- No layout shift on data load
- All API responses typed. No `any`.
- Animation budget: gradient drift, route transitions, radar timeline. Nothing else.

---

## Decisions Log

Settled. Do not revisit without being asked.

1. **Auth cut entirely.** Original Figma had four login and signup screens. Single user app, no store submission.
2. **Theme options are `Dark` and `Midnight`.** Figma listed a second theme as "N/A". Dark is `#12151A`. Midnight is true `#000000` for OLED. Only the page background and card surfaces shift; accent and type stay identical.
3. **Language selector cut** from onboarding. English only. Re-add when a second language actually exists.
4. **Font size** maps to a root font size: Small `15px`, Medium `16px` (default), Large `18px`. Everything else in `rem`.
5. **Name is captured in onboarding step 2.** If blank, greeting renders without a name ("Good Afternoon!"). There is no account to read it from.
6. **Daily forecast comes from Open-Meteo**, not WeatherAPI. Decided up front to avoid a mid-build rewrite when the free plan's day cap is hit.
7. **Push notifications cut from v1.** Needs VAPID keys, a subscription store, and a scheduled poller. That is a backend, not a client feature. The notifications toggle in onboarding controls in-app alert banners only, and its label must say so.
8. **Units default to Metric** (Celsius, km/h). Canadian user.
9. **Meteocons for weather icons.**
10. **Gradient interpolates in OKLCH**, anchored to real sunrise and sunset, not fixed hours.
11. **Next 16 / React 19, Turbopack by default.** Next 16 has breaking changes against older training data. `AGENTS.md` at the repo root points at `node_modules/next/dist/docs/`, which is the version-accurate reference. Read it before writing framework code.
12. **Main page stacks, it does not sit side by side.** The now card is full width and fixed at the top; the segmented control and the rail sit below it. "Pinned on the left" and "the row beside it" in this file described a side-by-side arrangement that the Figma does not show and that leaves roughly 140px for the rail at 390px. Figma wins as the layout source of truth. Only the rail scrolls horizontally.
13. **Midnight surfaces.** This file fixed Midnight's page background at `#000000` but left the card surfaces open. They are `--surface #0C0F13`, `--surface-raised #14181F`, `--hairline #23272F`, which keeps the same contrast steps as Dark against a true black page.
14. **Service worker is hand written**, not `next-pwa` or Serwist. `next-pwa` is unmaintained for App Router and Serwist needs a webpack config, which conflicts with Turbopack being the default in Next 16. The caching rules here are specific enough that a library would be fought rather than used.
15. **Vitest is the test runner.** This file required unit tests for the gradient engine without naming a framework. Vitest needs no Babel config and shares Vite's TS handling.
16. **`Special_Text_Version.svg` is a complete lockup, not a gapped wordmark.** This file described it as having a 26px leading gap to pair with the monogram. The actual file already contains the monogram at x 0 to 24. It is used alone; pairing it would draw the mark twice.
17. **Icon thickening covers the filled strokes too.** This file called for scaling the 2.5 and 3.5 stroke widths by 1.5x. The monogram's left diagonal and inner slash are filled paths roughly 3px wide, which read equally thin, so they get a 1.5 stroke in the same colour to widen them by the same ratio. Source in `public/brand/logo-mark-thick.svg`, regenerate icons with `npm run icons`.
18. **The API is metric only.** Route handlers always return Celsius, km/h, mm, km, hPa, and the units toggle is a client-side formatting concern. Converting on the server would make a "live" toggle cost a round trip and break while offline.
19. **Sunrise and sunset come from Open-Meteo, moon data from WeatherAPI.** WeatherAPI returns astro times as local wall clock strings ("06:06 AM") with no offset, which the gradient cannot anchor to without reconstructing the zone. Open-Meteo returns real epochs under `timeformat=unixtime`, verified against the live API. Moonrise, moonset, and phase stay on WeatherAPI because Open-Meteo does not carry them, and they are display strings only.
20. **One `/api/forecast` endpoint merges both sources, `/api/search` is separate.** The sources stay split; the round trips do not. WeatherAPI failing propagates because nothing renders without current conditions. Open-Meteo failing degrades: 200 with `daily: []` and `sources.openMeteo.ok === false`, so a dead weekly forecast does not take down the home screen.
21. **Vendor condition codes are not unified at the edge.** `ConditionRef` carries `system` alongside `code`, because WeatherAPI codes and WMO codes are different vocabularies. Phase 3 maps to gradient buckets, phase 4 to Meteocons. Collapsing them early would lose information both mappings need.
22. **Fog compresses lightness by 0.7 and unknown codes fall back to clear.** This file asked fog to "compress lightness delta between stops" without a strength, so both stops move 70% of the way to their mean, which flattens the gradient without erasing it. Condition codes outside the seven buckets get no modifier at all: a wrong tint reads as a bug, a missing tint reads as a clear day.
23. **Gradient window boundaries are clamped to be non-decreasing.** At high latitudes `sunset - 150min` can fall before `sunrise + 45min`, which would produce a negative window span and an unbounded fraction. Squeezed windows collapse to zero length and are skipped. Saved locations make this reachable, so it is handled rather than assumed away.
24. **The home screen uses a fixed default location until onboarding exists.** `lib/location.ts` points at Guelph. Onboarding step 3 replaces it in phase 5. Asking for the geolocation permission on first paint, with no onboarding to explain why, is the wrong first impression.
25. **Static Meteocons, not the animated set.** The package ships both. The animation budget in this file is "gradient drift, route transitions, radar timeline. Nothing else", and 24 animated icons in a scroll rail is very much something else. It also sidesteps `prefers-reduced-motion`, which cannot pause SMIL inside an `<img>`. Swap `scripts/sync-weather-icons.mjs` to `production/fill/all` to reverse this.
26. **Card headings keep the Figma's title case.** The type table calls for uppercase labels, and the Figma shows "2pm" and "Monday" in the hourly and daily cards. Those are values, not labels, so `.type-label` is reserved for actual captions. "2PM" reads as a column header rather than a time.
27. **`/guide` and `/settings` exist from phase 4.** The hamburger is part of the main page structure, and a control that opens a menu of dead links is worse than no menu. Guide carries its final copy, which this file already specifies verbatim. Settings is a placeholder until phase 5.
28. **The type scale runs on Thin and ExtraLight.** Anton's instruction, overriding the weight column in the type table above: body and headings are 200, display numerals and the temperature are 100. The one exception is the smallest uppercase captions, which stay at 300 because below about 12px the 100 and 200 weights lose their stems and stop being readable on a phone.
29. **The animation budget is widened.** Anton asked for motion beyond the original "gradient drift, route transitions, radar timeline. Nothing else." Added: staggered entrances for cards and sections, press feedback on controls, a shimmer on skeletons, and the pull to refresh spinner. All of it is transform and opacity only, and all of it is removed under `prefers-reduced-motion`.
30. **Pull to refresh landed in this batch, not phase 8.** Requested early because there was no way to refresh in the installed app. It is custom, as required: `overscroll-behavior: none` removes the native gesture.
31. **Rail cards carry the full Figma detail set and size in vw.** Day or hour, temperature with high/low, precipitation chance, then condition, humidity, and wind rows. Width is `min(11.5rem, 52vw)`, so two sit comfortably with a third peeking on any phone. The earlier fixed 88px card was drawn for 390px and left a 15 Pro Max looking sparse.
32. **Preferences are an external store, not React context.** `lib/preferences-store.ts` is read through `useSyncExternalStore`. Reading localStorage in an effect and calling setState cascades a render on every mount and trips React's own lint rules; this also picks up cross-tab changes for free. The onboarding gate reads the store directly rather than the rendered value, because the first commit after hydration can still hold the server snapshot.
33. **The news provider is assumed, not identified.** This file requires one test request to confirm the provider before writing the Explore page. `NEWS_API_KEY` is not set, so that request has not been made. `lib/news/client.ts` is written against thenewsapi.com, and `/api/news/identify` (development only) settles it in one call once the key exists. If the answer is newsapi.org, the module gets replaced rather than patched.
34. **Weather glyphs use the Meteocons line set, not the fill set.** The Figma draws its weather icons as line art; the fill set's solid three-dimensional artwork reads as a different design language beside it. Still Meteocons, still static (Decisions Log 25).
35. **Surfaces are lifted and de-blued from the token list.** The tokens above produce near-black blues; the Figma render sits on neutral greys. Matching the Figma, which this file names the source of truth for visual style: `--bg #1E2024`, `--surface #2B2D31`, `--surface-raised #313338`, `--hairline #3A3D43`, `--text-dim #9BA1A9`. Accent and primary text are unchanged. App icons, splash screens, `theme_color`, and `background_color` were regenerated to match.
36. **Cards are lit and seated, against the no-shadow rule.** The original spec said separation comes from background contrast only. Anton asked for a floating, premium read, so cards carry a one-stop top-lit gradient, a hairline top highlight, and a shadow wide enough not to register as one. The bottom nav also floats on a blur.
37. **The pinned rail card sits outside the scroller.** `position: sticky` does not hold for a flex item inside a horizontally scrolling container, verified with an isolated probe in the target browser. The first card is absolutely positioned above the rail, and the rail is padded by exactly one card width plus the gap, so the remaining cards begin beside it and pass underneath as it scrolls.
38. **The `Hourly | Weekly` control is an underline, not a pill.** A filled pill is a second heavy surface stacked directly above the cards, which is what removing the Figma's arrow strip was meant to avoid.
39. **The app fills the viewport and never scrolls as a page.** `.app-shell` has a definite `height: 100dvh` rather than `min-height`, and screens are flex children of it. Requested, to remove the dead space below the fold. It also fixed the map, which needs a real height handed to it. Screens with more content than height (settings, guide, explore) scroll inside their own region. The tradeoff: at the Large text size on a short phone, the home screen has no room to grow into, so anything that does not fit is clipped rather than scrolled.
40. **The map container is sized directly, not with `absolute inset-0`.** `maplibre-gl.css` sets `position: relative` on `.maplibregl-map` and loads after Tailwind, so the absolute positioning lost and the container collapsed to zero height. That, plus a style-ready guard that bailed without ever retrying, is why the map never appeared.
41. **All weather data moved to OpenWeatherMap One Call.** WeatherAPI.com, Open-Meteo, and RainViewer are removed, along with `WEATHER_API_KEY`. This supersedes Decisions Log 6, 19, 20 and 21. `ConditionRef` now carries a single OWM numeric code plus a label resolved from `lib/weather/openweather/conditions.ts`, which is the one table mapping code to label, gradient bucket, and icon. The vendor's own lowercase `description` is not displayed anywhere.
42. **Field losses from the migration, all deliberate.** One Call does not carry: a place name (reverse geocoding fills it, falling back to the timezone's city segment), city search (Geocoding API), air quality (Air Pollution API, 1 to 5 index rather than the 1 to 6 US EPA scale), `is_day` (read from the icon suffix `01d` against `01n`), moon illumination percentage (a phase label is derived from the 0 to 1 cycle position), and alert `severity`, `urgency`, `areas` or `instruction` (the banner shows the first sentence of the description plus the issuing office). Wind arrives in m/s and is converted to km/h; OWM offers no km/h option.
43. **One Call has no multi-location batching.** It takes a single lat/lon per request, so saved locations cost one call each. They are fetched on demand for the active location rather than all at once, which keeps that linear cost off the home screen.
44. **One Call 4.0, and 4.0 is not 3.0 with a version bump.** It splits the forecast across endpoints and wraps every payload in a `{ lat, lon, timezone, timezone_offset, data: [...] }` envelope instead of returning named `current`, `hourly` and `daily` blocks. Paths are `/data/4.0/onecall/current`, `/timeline/1h`, `/timeline/1day`, and `/alert/{id}`. Calling `/data/4.0/onecall` directly, which is what 3.0 wanted, 404s. The earlier version-fallback machinery was removed: a fallback cannot work across incompatible response shapes.
46. **Alerts cost an extra request each.** 4.0 puts alert *ids* on the weather records, not text, so each has to be resolved through `/onecall/alert/{id}`. Capped at three, deduped, and each failure is swallowed on its own: a banner that cannot be filled in is worth losing, a forecast is not. 4.0 also drops the `tags` field. A home screen is therefore three weather requests plus one per active alert, plus geocoding and air quality.
47. **The safe-area inset is applied in exactly one place, `.app-shell`.** The bottom nav applied it a second time, so the home indicator was counted twice and left a band of dead space below the nav on any device reporting one. Desktop reports zero, which is why measuring locally never showed it. Nothing inside the shell should add `env(safe-area-inset-*)` again.
48. **Both brand wordmark SVGs had their viewBox cropped to the artwork.** `WeatherWise_Text_Logo.svg` drew its art from x 0.8 to 160.4 inside a 232-wide viewBox, and `Special_Text_Version.svg` from 0 to 169.6 inside 256. That trailing emptiness meant a perfectly centred element still rendered the wordmark 15 to 17% left of centre, which is why it kept looking off after the element itself measured dead centre. Measured with `getBBox()`, not by eye. Component width and height props now match the cropped aspect ratio.
49. **The map is full screen with the nav floating over it.** It fills the shell rather than sitting in a pane above the nav, so the canvas runs edge to edge. Overlay controls and the attribution are lifted clear of the nav.

45. **`/api/health` is available in production.** Diagnosing a blank screen should not need a local checkout. It reports whether each key is set, which One Call version answered, and a sample of what came back. It never returns a key or any part of one.





---

## Guide page copy

Use as written.

> **Reading WeatherWise**
>
> The greeting at the top of the home screen changes colour through the day. It runs cool and blue before sunrise, warms through amber and gold by mid-morning, whitens at midday, and burns orange through golden hour before cooling to violet at dusk and grey overnight. It follows the actual sunrise and sunset where you are, so it drifts through the year.
>
> Weather shifts it too. Rain pulls it toward slate blue, snow toward pale ice, overcast drains the colour out of it, and a thunderstorm pushes it violet. On a clear day you see the time of day undiluted.
>
> **The cards.** The large card stays put and always shows conditions right now. The row beside it scrolls. Switch it between Hourly and Weekly with the control above it.
>
> **UV index.** Below 3 is low. 3 to 7 means cover up. Above 8, limit time outside around midday.
>
> **Air quality.** Below 50 is good. 51 to 100 is acceptable. Above 100, people with asthma or heart conditions should take it easy outdoors.
>
> **Feels like** accounts for wind and humidity. Wind makes cold air feel colder. Humidity makes warm air feel warmer.

---

## Build phases

Stop for review at the end of each. Commit before moving on.

1. Scaffold, Tailwind tokens, Albert Sans, manifest, icons, service worker. Deploy and confirm it installs on iPhone and shows the right icon and splash.
2. WeatherAPI and Open-Meteo route handlers, typed clients, error handling.
3. Gradient engine plus `/dev/gradient` tuning page. No app UI yet.
4. Main page: pinned card, horizontal rail, Hourly/Weekly toggle, alert banner.
5. Onboarding, settings, saved locations, units and font size wiring.
6. Explore page. Identify the news provider first.
7. Map page.
8. Polish: offline handling, pull to refresh, accessibility pass, reduced motion.

**Current phase: all eight complete.**

**Live deployment: https://weatherwise-sable.vercel.app**

**Verified against the live API on 2026-07-29** via `/api/health` and the deployed routes. One Call 4.0 answers, and the endpoint paths and response shapes taken from the documentation were correct. Confirmed working: place name via reverse geocoding ("Guelph"), condition code mapping (800 to "Clear"), air quality (index 2), sunrise resolved, 10 daily points, both tile layers returning real PNGs through the proxy, `/api/forecast` and `/api/search`. The migration is no longer unverified.

Two things that verification turned up:

- **The 1h timeline returns about 20 to 24 points, not 48.** `HOURLY_POINTS` caps at 48 and the rail asks for 24, so the Hourly rail is as long as the data allows and no longer. 4.0 pages its timelines and exposes `next`; following it would extend the window if that is ever wanted.
- **A precipitation tile on a clear day is a near-empty PNG** (571 bytes against 18kB for wind). The overlay is legitimately invisible in clear weather, which is easy to mistake for a broken map. Worth remembering before debugging the map again.

### Pick up here next session

**Content is still cut off on device, and I have not reproduced it.** This has now
failed several rounds of fixes, so start by getting evidence rather than
attempting another fix.

What is already ruled out, with measurements:

- Not the safe-area insets alone. Simulating a 15 Pro Max (59 top, 34 bottom,
  839px usable) at 430x932 shows Home, all three onboarding steps, Explore and
  Settings fitting with nothing clipped and every primary button visible.
- Not `overflow: hidden` any more. `.app-shell` scrolls vertically as a safety
  net, so nothing should be permanently unreachable even if it does overflow.
- Not `min-h-dvh`. Both remaining uses (onboarding, the map loading placeholder)
  were converted to `.screen`.

The gap is that every measurement here runs in a browser with zero real insets
and no compositing, so it cannot see what the device sees.

**Ask for, before changing anything:** a screenshot of the cut-off, which screen
it is on, and whether the region can be scrolled to. That distinguishes a layout
overflow from something painting outside its box, which need opposite fixes.

Also worth confirming he has deleted and re-added the home screen app: an old
service worker keeps serving cached assets, and that already caused one round of
"still not fixed" on the wordmark.

### Decisions Log, continued

64. **The condition theme is confined to the hero's gradient bar.** It previously
    also washed the page background. Two decimal points of tint across a whole
    screen reads as a palette accident rather than a signal, and it fought the
    card separation the layout depends on. Backgrounds, surfaces and cards are
    neutral graphite; the bar and the accent are the only places the sky shows.
    `themeVariables` therefore sets `--grad-0/1/2` and `--accent`, and no longer
    touches `--bg`.

65. **Hourly and weekly are one continuous timeline.** The segmented control and
    the horizontal rail are both deleted. A tab bar makes you choose a mode
    before it shows you anything, and the interesting part of a forecast is
    exactly where hour-by-hour stops mattering and days take over. The list runs
    straight through with no header at the join. Row height is a constant so the
    spine SVG is laid out from it, which is what makes the curve right on first
    paint rather than after a measuring pass.

66. **The scrubber returns to now by itself,** 4.5 seconds after the last touch.
    Left parked at 9pm it turns a live weather app into a stale one showing
    yesterday's evening, and nobody remembers they moved it. Keyboard steps use
    a functional state update, because autorepeat delivers several presses in one
    React batch and reading the prop moved one step for ten presses.

67. **Tilt effects are off by default and opt in from Settings.** iOS only
    releases device orientation after a permission prompt, and that prompt can
    only be raised from a user gesture and can never be raised twice. The toggle
    is the gesture. Without permission the glint still drifts on a slow
    Lissajous path: most users will never grant motion access, and a highlight
    that sits dead still looks like a gradient someone forgot to finish.

68. **The hero expands in place rather than navigating.** It is the same object
    showing more of itself, not a different screen, and a push transition brings
    a back gesture that is the wrong shape for something you dismiss. Implemented
    as a FLIP so only transform and opacity move. Two things this cost: the
    release needs a timer as well as `requestAnimationFrame`, because a
    backgrounded page never runs frames and the panel froze at the collapsed
    size with no way out; and the overlay must be portalled to the body, because
    `fixed` resolves against the nearest ancestor with a transform and the
    entrance animation has one, which sized the backdrop to the hero instead of
    the screen.

69. **Threshold rules fire on the transition, never the state.** A rule for
    "below zero" that notified every poll for as long as it stayed cold is the
    fastest possible route to push being switched off. Previous truth per rule
    is stored per subscription and merged, not replaced, so re-enabling a rule
    does not fire it for a condition that never changed. They are also kept
    visibly apart from severe weather alerts in both the UI and the payload: a
    rule about laundry weather dressed as a government warning makes the real
    warning easier to ignore.

70. **Feature 7, weekly context, was deferred by the user** and is deliberately
    absent. It would also have needed history One Call 4.0's timeline endpoints
    do not carry.

71. **Weather motion lives on the hero card and nowhere else,** by request.
    Rain, snow, wind and fog, as CSS-animated spans with staggered delays rather
    than a canvas: a render loop running whenever the app is open is a poor
    trade for an effect measured in single-digit opacity. Particle positions come
    from an index-seeded pseudo-random, not `Math.random`, or the server and
    client disagree and React replaces the layer on every load. Wind scales with
    the actual gust, so it carries information instead of being decoration.

72. **Sunrise and sunset are stated on the card, rounded to ten minutes.** The
    timeline only carries a sun row while the event is still ahead, so from
    mid-morning the day appeared to have no sunrise at all. Ten minutes rather
    than the minute because sunset to the minute is false precision: it moves
    with your horizon and it is never the number anyone acts on.

73. **Tilt drives the gradient, not only the glint,** and the greeting moves
    with the card from a single lifted hook. When tilt is live the looping
    animation is switched off: a keyframe animation on `background-position`
    overrides an inline value for the same property, so leaving both on makes
    the phone appear to do nothing.

74. **Explore uses the timeline's vocabulary.** It was the last screen still on
    filled pills and filled cards, which made it read as a different app bolted
    on. Rows separated by hairlines, labels in small caps, selection shown by an
    underline that scales from the centre.

75. **Correction to 65: the daily records do carry sun times.** The timeline
    originally placed sun rows only inside the hourly window, on my claim that
    the daily payload had none. It has `sunrise` and `sunset` per day, and I did
    not check before writing that down. The consequence was visible: from
    mid-morning the timeline showed a lone "Sunset" and no sunrise anywhere,
    because the morning's event was already behind the start of the list. Every
    day now carries its own pair, read from that day's record rather than
    inferred from a 24-hour offset.

76. **Sun rows show minutes, rounded to ten.** The hour alone rendered a 8:41
    sunset as "8PM", on the one row of the timeline where the minutes are the
    entire point of the row existing.

77. **The bottom safe-area inset belongs on the dock, not the shell.** Reserving
    it on `.app-shell` shrank the content box, so every screen's background
    stopped above the home indicator and left a black band under the floating
    dock. On the map that read as the map being cut off, because the tiles simply
    ended. The shell now runs to the physical bottom edge and the dock carries
    the inset, since it is the only element that has to clear the indicator.
    This is the cut-off that survived three earlier attempts, and it was only
    diagnosable from a photograph of a real device: every measurement here
    reports a zero inset, which is exactly the case where the bug disappears.

78. **Haptics are not possible here. Built, tested on the device, removed.**
    Safari has never shipped the Vibration API, so `navigator.vibrate` does
    nothing on iOS. The documented workaround is a side effect of toggling an
    `<input type="checkbox" switch>`, and it was implemented and shipped. It
    produced nothing on the device.

    The reason is worth recording so this is not attempted a third time: that
    haptic fires from a genuine tap on the switch itself. Driving it with a
    programmatic `.click()` from another element's handler is not user
    interaction as far as iOS is concerned. Making it fire would mean an
    invisible switch physically overlaying every button in the app, intercepting
    the taps meant for the real controls underneath, which is a worse app in
    exchange for a tick.

    Do not add a haptics setting that silently does nothing. If this app ever
    targets Android, `navigator.vibrate` works there and is a ten-line addition.

79. **The UV line states strength and timing, never advice.** It says when the
    sun is strongest and how strong. What to do about that is the reader's
    business; a weather app telling someone how long to spend in the sun would
    be giving health advice it is in no position to give.

80. **Sharing is text, not a rendered card.** Drawing the hero to a canvas
    cannot reuse any of the CSS that makes it look the way it does, so it would
    be a second implementation of the same design, quietly drifting from the
    first. A sentence survives being pasted anywhere.

81. **Locations switch from the home screen.** They were saveable for weeks with
    no way to change which one you were looking at except a trip into Settings,
    which made the feature close to unusable. Push follows the switch, or alerts
    would keep arriving for a city you had left.

82. **Sun rows belong to the hourly stretch, not to every weekly day.** Hanging
    a pair off each day turned six rows into eighteen and told you nothing you
    would act on: a day that far out is a high, a low and a symbol. The daily
    records are still what make a later sunrise available, since 48 hours of
    hourly data legitimately reaches the following morning.

83. **The expanded hero has no close button.** It sat behind the temperature
    card and could not be reached. Removed rather than restacked: the panel is
    dismissed by tapping the card again, tapping outside, swiping down, or
    Escape, which is three more ways than a single X offered.

84. **The written line is generated, with the rules engine as the floor.** A
    model writes it where it can; the deterministic sentence ships whenever
    generation fails, times out, or produces something that does not survive
    validation. The rules engine is not a degraded mode: it runs offline, it
    cannot invent weather, and it is what makes generated copy safe to show at
    all. Nothing in the interface names or hints at how the line was produced,
    by request. Cached by a digest that collapses a degree of drift, so a
    location generates one line per meaningful change rather than one per poll.

85. **Every number in a generated line must be one the model was given.** Not
    similar to one, not within a degree: present in the digest, or the line is
    rejected and the deterministic one is used. A model stating "rain around
    4pm" when no rain is coming reads exactly as well as a true line, which is
    what makes this the one check that cannot be skipped. Clock hours derived
    from the offsets are permitted, since turning "in 4 hours" into "around 4pm"
    is the model doing its job.

86. **CSP needs a per-request nonce, and a policy that looks right can still be
    fatal.** `script-src 'self'` was written, reviewed and shipped into a build
    before being tested. It broke the entire app: Next streams hydration as
    inline script tags, so React never hydrated and the page rendered its markup
    and then did nothing. It was caught only by loading a production build and
    checking for hydration, never by reading the policy. The nonce is set in
    middleware, applied by Next to its own scripts and by hand to the theme
    bootstrap, with `strict-dynamic` covering the chunks those load.

    The cost is that every route is now rendered per request. Acceptable here:
    content is client-fetched anyway and the service worker is what makes the
    shell fast.

    CARTO is named in `connect-src` because MapLibre fetches raster tiles rather
    than loading them as images. Without it the map is a blank grid.

87. **The privacy policy describes this app, not a template.** Boilerplate
    claiming data collection that does not happen would be inaccurate about the
    one subject where accuracy is the whole point. Everything it states is true
    of the code: no analytics, no accounts, preferences on the device only, and
    one server-side record which exists solely if push is enabled.

88. **The Guide screen is removed.** It explained an interface that no longer
    needs explaining, and the legal notices that replaced it in the menu are
    reference material people occasionally need rather than a tour nobody reads.

89. **Every generated field has a deterministic one behind it.** Clothing and
    activity advice are not exceptions to the rule that governs the voice line.
    A failed call is invisible rather than a gap on the screen, and the offline
    version of the app loses nothing.

90. **Haiku, one call, three fields.** The copy is short and formulaic from a
    small structured input, which is exactly what the cheapest model is best at.
    Asking separately for the line, the clothing and the activity would re-send
    the forecast three times, and input tokens dominate the cost of a request
    this small. The response is prefilled with `{` so it cannot open with a
    preamble, `max_tokens` is capped tightly because an unbounded limit is an
    unbounded bill, and the cache key already collapses small drift so a
    location generates one response per meaningful change rather than one per
    poll.

    Validation is all-or-nothing across the three fields. A response where the
    clothing advice is sound but the line invents a temperature is not a partial
    success: it means the model was willing to make something up, and the other
    fields have no better claim to being right than the one that was caught.

91. **Adding a location happens in place.** The button opened Settings, which
    answered the request by sending the user somewhere else and leaving them to
    find their way back. A sheet that closes itself when the job is done is the
    shorter path, and the new location is switched to immediately, because
    adding a place and then having to tap it as well is a step nobody wants.

92. **Case is decided by the role, not applied everywhere.** Short-form labels
    are upper case: day abbreviations and the meridiem. Prose is not, because
    "rain around 3PM" inside a sentence is shouting. Most labels get there
    through `.type-label`, which already capitalises, so `formatHour` and
    `formatDayShort` stay lower case at the source and only `formatTime`
    normalises, since en-CA renders "p.m." with stops and that was the one form
    no class could fix.

    `formatDayShort` exists because call sites were slicing the full day name to
    three characters, which rendered "Today" as "Tod". Abbreviating is the
    formatter's job, not the caller's. Found by a test written for the casing
    pass, not by looking.

93. **The drawer opens onto its own name.** The safe-area inset left a band of
    empty surface above the first line on a phone with a notch. Filled with the
    mark and wordmark rather than by closing the gap, since the space exists
    because of the hardware: a drawer that opens onto its own identity reads as
    deliberate where an empty strip reads as a mistake.

94. **Prompt caching is not used, and adding it would cost more.** Haiku 4.5
    requires 4,096 tokens before anything is cacheable; the system prompt is
    around 250. `cache_control` on it would be silently ignored, with no error
    and no caching. Padding the prompt to qualify would mean paying for 4,096
    tokens on every call, and since calls are roughly hourly the five-minute
    window would expire between them, making each one a cache write at 1.25x.
    Roughly twenty times the current cost. The response cache keyed by weather
    digest is what actually removes the repeat calls, and it already exists.

Outstanding:

- **Map rendering is unconfirmed.** Every server-side piece is verified: both tile layers return real PNGs through the proxy, and the basemap is keyless and reachable. Whether MapLibre paints them has never been observed, because the only browser available here runs with `visibilityState: hidden`, so it never composites a frame and never requests overlay tiles. This needs a real screen.
- **The news provider is unconfirmed** (Decisions Log 33). `NEWS_API_KEY` is set in Vercel but `/api/news` has not been exercised against a real response. Open the Explore page on the deployment: if articles load, the thenewsapi.com assumption was right. If it errors, the key belongs to newsapi.org and the module gets replaced.
- **Alerts have never been seen with real data.** The verification ran during clear weather with zero alerts in effect, so `fetchAlerts` and the banner are still only covered by tests.
- **Safe-area behaviour is verified by simulation only.** Desktop reports zero insets. The fix in 77 was measured with the device's real insets injected as overrides, which showed zero overflow and the dock clearing the indicator exactly, but no browser here reports a genuine inset.
- **Pull to refresh** has been exercised with synthetic touch events only. It needs a real finger on iOS Safari, standalone.
- **Nothing in the redesign has been seen rendered.** The timeline, scrubber and expanded hero are verified through the DOM only: geometry, overflow, dismissal, focus and the absence of clipping at 375x667 and 393x852 with simulated insets, at both text sizes. The browser available here does not composite, so no screenshot exists and no animation has been watched. Motion, the glint, and the FLIP in flight all need a real screen.
- **The gradient palette was rebuilt around a contrast floor.** 37 of 72 stops failed WCAG AA against the text on them, the worst at 1.17:1, which is what "the gradient makes the text invisible" was. Stops are now darkened programmatically until both weights of on-band text clear 4.5:1, and the test asserts it for all 24 combinations, so a future palette edit cannot quietly reintroduce it. The band is darker and more saturated than before as a direct result.
- **Generated lines have never been seen.** `ANTHROPIC_API_KEY` is not set anywhere yet, so every line rendered so far is the deterministic one, which is exactly what should happen without a key. The validator has no coverage against real model output.
- **Threshold rules have never fired against a real forecast.** The engine and the transition logic are covered by tests, but the cron path that evaluates them runs only on Vercel with `DATABASE_URL` and `CRON_SECRET` set.

---

## Never

- Add authentication
- Call a vendor API from a client component
- Put a key in `NEXT_PUBLIC_*`
- Use WeatherAPI's own weather icons
- Add screens, tabs, or features not specified here
- Add animation beyond the budget above
- Use `localStorage` for anything except preferences and cached forecast payloads

