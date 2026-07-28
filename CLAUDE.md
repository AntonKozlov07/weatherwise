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

| Data | Source | Why |
|---|---|---|
| Current conditions, hourly (48h), AQI, astronomy, alerts, city search | **WeatherAPI.com** `forecast.json?aqi=yes&alerts=yes` | Richest current payload |
| Daily forecast, 7 to 10 days | **Open-Meteo** | Free, keyless, unlimited, 16 day range. WeatherAPI's free plan caps daily forecast too low for the Weekly toggle |
| Precipitation radar tiles + timeline | **RainViewer** public API, keyless | Animated frames, past 2h plus nowcast. Attribution link required |
| Wind map tiles | **OpenWeatherMap Weather Maps 1.0**, `wind_new` layer | Free tier. Do not use their 2.0 endpoints, those are paid |
| Map basemap | **MapLibre GL JS** + CARTO Dark Matter style | Free |
| News | see below | |

### Environment variables

```
WEATHER_API_KEY=
OPENWEATHER_API_KEY=
NEWS_API_KEY=
```

`.env*` must be in `.gitignore` in the first commit. Mirror all three into Vercel project settings.

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

**Current phase: 1 complete locally, pending deploy and iPhone install check. Phase 2 not started.**

---

## Never

- Add authentication or a database
- Call a vendor API from a client component
- Put a key in `NEXT_PUBLIC_*`
- Use WeatherAPI's own weather icons
- Add screens, tabs, or features not specified here
- Add animation beyond the budget above
- Use `localStorage` for anything except preferences and cached forecast payloads
