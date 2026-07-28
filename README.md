# WeatherWise

Weather PWA, installed to an iPhone home screen via Safari. Next.js App Router,
TypeScript, Tailwind, deployed on Vercel.

`CLAUDE.md` is the canonical spec: constraints, design tokens, data sources,
screens, build phases, and the Decisions Log. Read it before changing anything.

## Running it

```bash
npm run dev
```

The service worker only registers in production builds, so offline behaviour and
install prompts have to be tested against a real build:

```bash
npm run build && npm start
```

iOS specifics (standalone launch, splash screens, safe area insets) cannot be
verified in a desktop browser. They need the deployed URL on a real device.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest, watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run icons` | Regenerate app icons and iOS splash screens from `public/brand/logo-mark-thick.svg` |

## Environment

Copy `.env.example` to `.env.local` and fill in the three keys. None of them may
be exposed to the browser: every vendor call goes through a route handler under
`app/api/`. The same three must be mirrored into the Vercel project settings.

## Layout

```
app/            routes, root layout, manifest
components/     shared client components
lib/            framework-free logic, unit tested
public/brand/   source SVGs plus the thickened icon master
public/icons/   generated icons and splash screens, do not hand edit
public/sw.js    service worker
```
