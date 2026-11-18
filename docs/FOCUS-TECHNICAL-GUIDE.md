# Focus — Technical Guide

*Last updated: 17 Nov 2026. Written from the current source code.*

---

## 1. What Focus is

Focus is a guided, LLM-assisted frontend design studio. Instead of letting an AI coding tool invent a generic look ("AI slop"), Focus walks the user through a short series of plain-language design decisions, enforces design rules between them, and produces a **Vision** — a precise, tool-ready design specification (tokens, rules, component states, copy-ready prompts) that any AI coding tool (Lovable, Cursor, Claude Code, v0, Bolt, etc.) can build from.

It then closes the loop: **Check a site** measures the page that was actually built, compares it to the Vision, and generates repair instructions until it passes. **Site monitor** keeps checking over time.

**North Star:** beautiful, sophisticated, non-fungible frontend output, guided by an LLM but governed by deterministic, tested design rules.

Key product principles:
- Plain, literal language (no jargon; "Vision", "Check a site", "Redesign this site", "Report for a client").
- Measured evidence is always separated from AI opinion.
- Works fully signed out (browser storage); an account adds cross-device sync.
- Never ship unreadable text: contrast is re-checked after every change.

---

## 2. Tech stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start v1 (React 19, SSR, server functions) |
| Build | Vite 8 (with @tanstack/react-start 1.168.60) |
| Styling | Tailwind CSS v4 (tokens in `src/styles.css`), shadcn/Radix UI components |
| Runtime | Edge (Cloudflare Workers / workerd) |
| Backend | Lovable Cloud (Postgres database, email+password auth, row-level security, scheduled jobs) |
| AI | Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1`) via `@ai-sdk/openai`, Responses API with structured output |
| Tests | Vitest (`bun run test`) — 21 test files, 179 tests (all passing) |
| Fonts | Studio chrome: Fraunces + Manrope; preview fonts load on demand |

---

## 3. Architecture

```text
 Browser (React)                          Server (edge)                     Lovable Cloud
 ─────────────────                         ──────────────                     ─────────────
 Studio UI  ──► engine.ts (rules)          design.functions.ts ──► ai.server.ts ──► AI Gateway
            ──► design.ts (tokens)         critic.functions.ts ──► public-page.server.ts ──► public web
            ──► skins / refine / matcher   inspire.functions.ts
            ──► library / taste (local)    launch.functions.ts
            ──► exportPack (zip)           watchtower.functions.ts / .server.ts
                                           api/public/watchtower (scheduled)  ──► watched_sites
 supabase client (RLS as user) ─────────────────────────────────────────────► projects, profiles,
                                                                              shares, brand_builds,
                                                                              design_progress
```

Folder layout:
- `src/routes/` — pages (file-based routing).
- `src/lib/` — all logic. Pure modules (`*.ts`) are tested; `*.functions.ts` are server functions callable from the browser; `*.server.ts` are server-only.
- `src/components/` — UI (AppHeader, ConfirmDialog, DesignPreview, AppPreview, Help, SkinBar, QuickStart, RescuePanel, LaunchPanel, FixList, ShotReview, AdvisorPanel, ComponentSheet, Gallery).
- `src/lib/directions.data.json` — 38 original Directions (generated data).
- `src/test/` — Vitest suites.
- `public/samples/` — sample built page used to test design-ID recognition.

---

## 4. Pages

| Route | Name in app | Purpose |
|---|---|---|
| `/` | Studio (home) | Brief → pick a Direction (or quick start / matcher / site inspiration) → 8 questions → Vision. Also hosts Redesign this site, Skins, fine-tune, exports. |
| `/critic` | Check a site | Measure a public page (or screenshot) against design rules and your Vision; repair brief; Focus tag recognition. |
| `/watchtower` | Site monitor | Owner's watched pages, recurring measured checks, tag-change warnings. |
| `/library` | Saved designs | Browser library of designs (autosaved by stable identity). |
| `/brands` | Brands | Groups builds (website + app) by brand; drift vs the main build; "Match main look"; account sync. |
| `/taste` | Taste | Taste Portrait and Design Duels. |
| `/progress` | Progress | Launch/proof progress per design. |
| `/proof` | Proof | Side-by-side: Focus design vs a generic AI page, scored with the same checks. |
| `/s/$id` | Shared design | Public read-only share via `get_share(id)`. |
| `/auth`, `/reset-password` | Sign in | Email + password, name and business name on signup. |
| `/_authenticated/projects` | My projects | Account-saved projects (guarded layout). |
| `/api/public/watchtower` | (endpoint) | Scheduled monitor runner; verifies its caller. |

Every page uses `AppHeader`; navigation is defined in `src/lib/nav.ts`.

---

## 5. Core design engine

### 5.1 Tokens — `design.ts`
All design values (colours, fonts, type scale, spacing, radius, header style, finishing detail, plus optional effects: `accent2`, card `plain|glass`, buttonFinish `flat|glow|gloss`) are **tokens**. Any AI output passes through `normalizeTokens`, which clamps, validates and fills defaults. Raw AI values are never trusted.

### 5.2 The eight questions (Lenses)
1. Background and text colors 2. Button and link color 3. Fonts 4. Headline size 5. Space between things 6. Corner and button shape 7. Top of the page 8. One finishing detail.
Plus five optional purpose questions (audience, tone, goal, device, reading) that feed both the AI and engine rules.

### 5.3 Decision engine — `engine.ts`
- One rule table holds every cross-decision rule (e.g. a heavy display font narrows headline sizes; phone-first visitors change spacing).
- Rules only point from earlier to later questions, so there are no loops.
- The engine narrows and ranks options with stated reasons, and flags later answers for re-check when an earlier one changes.
- `qualityGrade` → *Below floor / Meets floor / Crafted*, using the same measured checks as Check a site and Proof.
- Each rule has a test in `src/test/engine.test.ts`.

### 5.4 Contrast
Filled accents and text accents are separate; link colours are derived per background with `signalText` so text reaches 4.5:1 without changing the chosen palette.

### 5.5 Fine-tune — `refine.ts`
Small nudges (warmer, roomier, etc.) re-run `normalizeTokens` and restore contrast automatically.

### 5.6 Skins — `skins.ts`
12 one-click colour variations. They rotate only **hue** in OKLCH, keep lightness/chroma and every non-colour token, shift `accent2` keeping its hue gap, then repair contrast. Undo and "Original" reset are provided.

---

## 6. Design data

- **Directions** — 38 owner-authored Directions from `DESIGN-DIRECTIONS.md`, converted into engine-exact tokens in `directions.data.json` (regenerate, don't hand-edit), plus five app-created gallery designs (`gallery.ts`). Grouped and searchable, with "best for" and "risk" notes.
- **Matcher** — `matcher.ts`: pure ranking of Directions against the brief/purpose answers.
- **Site inspiration** — `inspire.ts` + `inspire.functions.ts`: reads a public site's colours/fonts via `grabSiteSources`, no AI calls, never copies its words.
- **Knowledge** — `knowledge.ts` (43 cards: 8 Lenses + elements), `techniques.ts` (technique cards), `glossary.ts` (all help text; no inline copies).
- **App designs** — `appDesign.ts`: interactive app specimens chosen by purpose; app interaction rules append to the same Vision.

---

## 7. AI layer

- `ai.server.ts` creates the gateway provider (Responses API, current model `openai/gpt-6.1-sol`) and returns structured (schema-validated) output.
- `design.functions.ts` — direction generation, Lens suggestions, explanations. Prompts and keys stay server-side.
- Taste Portrait and Duel results are passed as preference context so generation reflects measured preferences.
- AI is always optional where measurement exists: if the AI review fails, measured findings still return.
- Screenshot reviews are labelled **AI opinion**; images are shrunk in the browser and never stored.

---

## 8. Check a site and Site monitor

### 8.1 Safe fetching — `public-page.server.ts`
- `safeUrl` blocks private/local addresses.
- Every redirect hop is validated manually (no silent redirect into private networks).
- One shared timeout and byte-bounded streaming cap memory and time.

### 8.2 Measurement — `critic.ts` (pure, tested)
`analyzePage` extracts facts (colours, contrast, fonts, type scale, spacing, headings, etc.) and scores them with the same checks used by `qualityGrade`. It compares facts with the saved Vision, lists mismatches, and builds a repair brief for the coding tool.

### 8.3 Focus design ID
- `designId()` in `launch.ts`: FNV-1a hash of the token fingerprint → `f-` + 10 hex chars. This is an identifier, not proof of origin: anyone can copy the tag. Proof comes from the server-signed code (see below).
- Design packs stamp the ID in `tokens.css` and instruct the AI tool to add `<meta name="generator" content="Focus f-…">`.
- `readFocusTag()` in `critic.ts` reads it; the page shows "Says it was built from a Focus design" and "Compare with this design". Matching against the library happens **in the browser** so IDs can't be probed server-side.

### 8.4 Fix until it passes — `fixPlan` in `launch.ts`
Each round is built from stored review evidence of the same page; Vision mismatches rank before generic measured failures.

### 8.5 Site monitor — `watchtower.*`
Owner-only `watched_sites` rows; scheduled runs via `/api/public/watchtower`; measured-only checks (no AI credits); database leases prevent overlapping checks; `tagChange` warns when the design-ID tag disappears or changes.

---

## 9. Exports — `exportPack.ts`
- Copy Vision (markdown) and a ZIP design pack (tokens.css, Vision, component/states sheet, prompts).
- 12 tool-specific formats (website and app variants).
- Short prompt allows glass/second-colour only when the design has them.
- Provenance stamp and design ID embedded.

---

## 10. Storage and accounts

### 10.1 Browser (primary)
- Studio state saved with a `version`; `migrate()` upgrades older saves.
- `library.ts` — designs saved by stable identity (never by title); archived before a hand-off.
- `taste.ts`, `portrait.ts`, `report.ts` — taste memory, Portrait, Check-a-site history; parse-and-validate on load so corrupt storage can't break anything.

### 10.2 Account (Lovable Cloud)
| Table | Contents | Access |
|---|---|---|
| `profiles` | name, business name (auto-created on signup) | owner |
| `projects` | saved studio projects | owner-only RLS |
| `shares` | shared designs | owner reads; public via `get_share(id)` only |
| `brand_builds` | build_id, title, collection, favorite, state | owner-only RLS |
| `design_progress` | confirmed launch/proof progress | owner-only |
| `watched_sites` | monitored URLs, history, design_id, leases | owner-only |

Brand sync (`brandSync.ts`, `brandCloud.ts`) merges local and remote by build ID; remote is fetched before reading the local library to avoid upload races. Writes only count as saved once the database returns the row.

---

## 11. Other features
- **Redesign this site** (`rescue.ts`) — bounded extraction of a public page → existing direction generator → pending hand-off with Undo.
- **Launch / proof loop** (`launch.ts`, `proof.ts`) — evidence bound to design identity + token fingerprint; changing design values resets confirmation; repeat reviews don't inflate totals.
- **Report for a client** (`advisor.ts`) — measured vs opinion clearly labelled, task-based acceptance checks; never presented as a full usability or legal audit.
- **Taste Portrait & Duels** — Duels change one decision at a time so preferences are attributable.
- **Brands** (`brands.ts`) — brand = collection (else brand name); earliest build is the main look; drift detection and "Match main look".

---

## 12. Security and anti-copy
- Row-level security on every table; no enumeration of shares.
- Server-only AI prompts and keys.
- SSRF-safe page fetching.
- Design ID in every pack and built page (an identifier only; signed codes provide proof).
- Page downloads resolve A and AAAA records over DNS-over-HTTPS on every redirect hop and refuse private, local and IPv4-mapped addresses (`netguard.ts`). Known remaining risk: DNS rebinding between lookup and fetch, since there is no egress proxy.
- Skins gamut-map rotated OKLCH colours into sRGB (binary search on chroma at fixed lightness and hue), then contrast is checked on the mapped values.
- Moat: owned Directions, verification of built output, per-account taste history and Brands. Planned: keep full Directions values server-side for paid accounts; per-account AI limits.

---

## 13. Testing
`bun run test` (Vitest). Suites in `src/test/`: engine, design, directions, gallery, skins, critic, critic-hardening, public-page, designTag, launch, report, rescue, brands, brandSync, portrait-library, projects, quickstart, stages-next5, ux, copy (wording rules, e.g. no "eye exam"/"Prescription"), app-routing.

---

## 14. Engineering conventions (summary of AGENTS.md)
- Tokens + `normalizeTokens` for all values; one rule table; forward-only rules.
- Confirmations only when work would be lost (`hasUnsavedWork`); otherwise Undo toast.
- Success messages only after a real successful operation.
- Help text from `glossary.ts`/knowledge cards only.
- Generated data (Directions, database types) is regenerated, not hand-edited.

---

## 15. Open items
- Price and billing model (no free plan; paid = unlimited designs) — owner decision.
- Five-person first-use test; client case study (needs permission); email sending domain.
- Publish; library backup/versions; server-side Directions for paid accounts; per-account AI limits; split large studio page; full accessibility/slow-network pass.
