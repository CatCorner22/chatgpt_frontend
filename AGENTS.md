<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Focus architecture (formerly Refraction)
- **North Star** is the user's defined project goal: "vibe-coded frontend UI, UX, etc. that is as good as the best human coders." Use that meaning consistently. Technical correctness, visual craft, task usability, responsive and interaction behavior, and a reliable customer handoff all matter; passing tests alone does not establish human-quality equivalence. See `docs/NORTH-STAR-REVIEW.md` for the current priorities and evidence limits.
- Design values are tokens (`src/lib/design.ts`); AI output always passes `normalizeTokens` before use — never trust raw AI values.
- The decision engine (`src/lib/engine.ts`) holds all cross-decision rules in one table; rules point only from earlier to later layers so no loops form; each rule has a test in `src/test/engine.test.ts`.
- AI calls live in `src/lib/design.functions.ts` via `src/lib/ai.server.ts` (Responses API, structured output); the browser never sees prompts or keys.
- Studio state is saved in the browser with a `version` and passed through `migrate()` on load, so older saves keep working.
- Preview fonts load on demand (`useDesignFonts`, URLs from `fonts.ts`, shared with packs).
- Saved projects live in `public.projects` (owner-only RLS) and profiles in `public.profiles` (auto-created on signup from name/business_name metadata); the studio keeps working signed out via browser storage.
- The Design Critic measures pages with pure functions in `src/lib/critic.ts` (tested) and fetches only public addresses via `safeUrl`; the AI review is optional so measured findings still return when AI fails.
- Critic downloads use `public-page.server.ts` with manually validated redirect hops, a shared timeout, and byte-bounded streaming so remote pages cannot silently redirect into private addresses or consume unbounded memory.
- Clipboard success and save/export status require an actual successful operation; failed copies remain unsaved and project updates must return the saved row to avoid false success.
- The quality scale (`qualityGrade` in engine.ts) and the /proof comparison reuse the same measured checks as the Critic, so one rule change updates every score.
- Pages use `AppHeader`; `ConfirmDialog` only when work would be lost (`hasUnsavedWork`), else Undo toast; help text from `glossary.ts`/knowledge cards.
- Fine-tune nudges (`refine.ts`) re-run `normalizeTokens` and restore contrast if a nudge breaks it, so tweaks can never ship unreadable text.
- Taste memory and Critic history are browser-only (`taste.ts`, `report.ts`) with parse-and-validate on load, so corrupt storage never breaks the studio.
- Screenshot reviews are labelled AI opinion; images are shrunk in-browser, never stored.
- Public share pages read through the `get_share(id)` function; `public.shares` has owner-only reads so links can't be enumerated.
- App previews are local interactive specimens selected by purpose; app interaction rules are appended to the same Prescription so app and website exports stay compatible.
- Rescue uses bounded public-page extraction and the existing direction generator, ignores generated replacement copy, and imports via a pending browser hand-off with Undo to protect the current studio.
- Filled accents and text accents are distinct: derive link colors per ground with signalText so the selected palette remains unchanged while text reaches 4.5:1.
- Taste Portrait is browser-versioned and validated; Duels vary one decision at a time and feed the same preference context into design generation so comparisons are attributable.
- Browser library autosaves designs by stable identity, preserving metadata and archiving before a hand-off; titles never identify a design because unrelated designs may share names.
- Watchtower uses owner-only rows and authenticated managed scheduling, bounded measured-only checks and database leases; recurring checks cannot spend AI credits or overlap on a page.
- Advisor reports label measured evidence versus screenshot opinion and include task-based acceptance checks so scores are never presented as a full usability or legal audit.
- Launch evidence is bound to a stable design identity and token fingerprint; changed design values reset launch confirmation, while repeat reviews never inflate completion totals.
- Account progress is owner-scoped and records confirmed writes only; browser progress remains usable signed out and screenshot evidence stores opinion text, never image bytes.
- The gallery's original Directions are generated data in src/lib/directions.data.json, extracted from the owner's DESIGN-DIRECTIONS.md; regenerate rather than hand-edit so values stay engine-exact.
- The design matcher (matcher.ts) and site inspiration (inspire.ts) are pure and tested; site inspiration reuses grabSiteSources, makes no AI calls and never copies the source site's words.
- Skins (skins.ts) change only hues in OKLCH, keep lightness/chroma and every non-colour token, and restore contrast, so a Skin can never break readability or layout.
- Fix-until-it-passes (fixPlan in launch.ts) derives each round from stored review evidence of the same page; Prescription mismatches rank before measured failures.
- Brands (brands.ts) are derived from the browser library: a brand is the entry's collection (else its brand name); the earliest build is the main build whose look others are compared to.
- Built pages are recognised by a short design code (designId in launch.ts) read from a generator meta tag or tokens.css comment; matching happens in the browser so codes cannot be probed server-side.
- Page downloads resolve A/AAAA over DNS-over-HTTPS on every hop and refuse private ranges (`netguard.ts`, tested), since hostname checks alone let public names point at private machines.
- Design IDs are labels; proof comes from a server HMAC (`signing.server.ts`, FOCUS_SIGNING_KEY) appended as `f-<id>.<sig>`, so copied or hand-edited tags read as unsigned/forged.
- The short version and resume wording use `afterAnswer`/`questionCount` (design.ts) and `resumeLabel` (library.ts) so question counts stay consistent everywhere.
- Undo (`undo.ts`, max 30) and saved-design versions (max 10, on look change) persist so reloads keep them.
- Badges (`badge.ts`) issue/re-check on measured evidence only, weekly via the Site monitor job; public reads use `get_badge(id)` so badges can't be listed.
- Packs: pure `packFiles` + `validatePack` before download; existing-site packs expose scoped `--focus-*` values under `data-focus-restyle`. Semantic pairs require separate `data-focus-theme="semantic"` opt-in after component review. Preserve customer files, test actual tasks/contrast, and demonstrate selective rollback; the ZIP cannot prevent an extractor or coding tool from overwriting files.
- Provider-specific AI code only in src/lib/ai.server.ts; swap via AI_PROVIDER.
