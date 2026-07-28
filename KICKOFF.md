# Claude Code kickoff message

Paste this as your first message in Claude Code, after committing `CLAUDE.md`
to the repo root and dropping the three SVGs into `public/brand/`.

---

Read `CLAUDE.md` at the repo root in full before doing anything. It is the
canonical spec for this project and it overrides your defaults.

Short version: we are building WeatherWise, a weather PWA that I install on my
iPhone home screen via Safari. Next.js App Router, TypeScript, Tailwind,
deployed to Vercel. No authentication, no database, no vendor API calls from
the client.

I am pasting my Figma design below. It is the source of truth for layout and
visual style, with two mandatory changes already recorded in `CLAUDE.md`:

1. Every login and signup screen is cut. Onboarding is three steps only.
2. On the main page, delete the middle element with the arrows. Replace it with
   open space and a two-option segmented control, `Hourly | Weekly`, that swaps
   what the horizontal scroll rail shows. The large current-conditions card on
   the left stays fixed and never scrolls. Only the rail beside it scrolls.

Work through the build phases in `CLAUDE.md` in order. Stop at the end of each
phase, summarise what you did, and wait for my review before starting the next.
Commit at each phase boundary with a real message. Append any new decisions to
the Decisions Log in `CLAUDE.md` and update the "Current phase" line as you go.

Start with phase 1 only. Before you write code, tell me your plan for phase 1
and list anything in the spec you find ambiguous or contradictory.

--- FIGMA DESIGN BELOW ---

[paste your Figma here]
