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

- Use `npm run lint` as a maintained-source gate. Keep local `.agent` evidence and generated output outside formatting; generated Supabase files retain semantic lint checks. Do not edit generated files or broaden rule exclusions to make a new failure disappear. See `docs/LINT-GATE-RELEASE.md`.
- **Cat Samurai** is Blake’s design and engineering principle: calm, playful, distinctive, and intuitive on the surface; disciplined, reliable, powerful, clear, and logical underneath. Calm never means boring. **No beige app surfaces or default beige aesthetic.** Preserve Reverie and the Garden Path, use meaningful color and optional depth, and verify behavior without claiming zero defects. See `docs/CAT-SAMURAI.md`.
- Authored content flow uses `getAuthoredFeatures` for both rendered Details and affected-output identity. Keep the supporting sentence with its headline, omit absent Details/fallback actions, and preserve real destinations. `buildStudioLaunchArtifact` adds a lightweight runtime revision only to changed authored output; never import the renderer/font catalog eagerly or store this revision in page settings/workHash. See `docs/AUTHORED-CONTENT-FLOW-RELEASE.md`.
- Product disclosures require a real description via shared `hasAuthoredFeatureDescription`; title-only features stay visible and noninteractive, and the first actual disclosure starts open. Preserve targeted `product-details-v1` launch invalidation and the earlier no-feature revision. Standard existing-project reminder instructions must leave pre-existing/ambiguous blocks untouched and undo only this trial's exact recorded, unchanged insertion. See `docs/PRODUCT-DETAILS-AND-REMINDERS-RELEASE.md`.
- Preserve authored quotation punctuation through `getAuthoredQuote` and the existing HTML escape function. The v14 comparison is for targeted `authoredQuoteRevision` evidence invalidation only; never reuse it to render text. ContentEditor focus follows only an accepted requested edit and must cancel superseded intent, without mirroring saved content. See `docs/QUOTATION-AND-EDITOR-RELEASE.md`.
- Authored image framing is bounded in `image-framing.ts`: preserve original bytes/alt, omit the exact default from saved settings, and use the same renderer for preview/HTML/ZIP. Different image IDs reset framing; identical IDs preserve it. Nondefault framing participates in undo, backup and launch/export identity. The decision graph records configuration, never rendered image verification. See `docs/IMAGE-FRAMING-RELEASE.md`.
- The Field Guide (`/field-guide`) is a practice-only introduction: its choices never mutate Studio, customer projects or launch evidence. Keep technical definitions source-linked and separate from Focus’s own product names; research notes are in `docs/FIELD-GUIDE-SOURCES.md`.
- **Reverie** is Focus's cream-and-ginger cat guide (she/her). Her name means "a pleasant daydream." Use her name in app copy and current character documentation; preserve the approved artwork. Her profile is `/reverie` under Help → About Reverie.
- **North Star** is the user's defined project goal: "vibe-coded frontend UI, UX, etc. that is as good as the best human coders." Use that meaning consistently. Technical correctness, visual craft, task usability, responsive and interaction behavior, and a reliable customer handoff all matter; passing tests alone does not establish human-quality equivalence. See `docs/NORTH-STAR-REVIEW.md` for the current priorities and evidence limits.
- Design values are tokens (`src/lib/design.ts`); AI output always passes `normalizeTokens` before use — never trust raw AI values.
- The original decision engine (`src/lib/engine.ts`) holds advisory cross-decision rules for the questionnaire. Stratosphere’s bounded registry (`src/lib/stratosphere.ts`) separately defines its actual control changes, scope/value/color constraints and deterministic dependency map. Its map and controls must use that same registry; never use the questionnaire’s fallback ranking to relax a hard Stratosphere constraint. Both engines have direct tests.
- AI calls live in `src/lib/design.functions.ts` via `src/lib/ai.server.ts` (Responses API, structured output); the browser never sees prompts or keys.
- Studio state is saved in the browser with a `version` and passed through `migrate()` on load, so older saves keep working.
- Preview fonts load on demand (`useDesignFonts`, URLs from `fonts.ts`, shared with packs).
- Authored pages separately embed selected licensed Latin font subsets from `authored-fonts.ts`; all three Stratosphere pairs share the same CSS in iframe, HTML and editable ZIP. Preserve exact OFL notices/provenance, real weights (Instrument Serif is 400 only), unknown-family escaping and explicit fallback coverage. Regenerate `authored-fonts.data.json` with `scripts/generate-authored-fonts.mjs`; verify with `--check`, never hand-edit it. This does not change remote specimen fonts or existing-app packs.
- Keep `LazyAuthoredPagePanel` as the authored renderer's production loading boundary; lightweight availability explanations use `authored-font-availability.ts`. Do not eagerly import the font catalog into the Garden. Loading/retry stays within the panel and must not reset the parent Studio or expose premature export controls.
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
- Target's optional source trial (`source-trial.ts` and `SourceTrialPanel`) is a download-only proposal for a strict React/Vite TSX + CSS-module pair. Keep parsers lazy and parser-only; PostCSS must use `map:false`, never resolve uploaded imports, plugins or source maps. Preserve all source outside the wrapper-class insertion and appended scoped CSS. The original page ground/base wrapper styles stay unchanged. Explicit roles and state/cascade constraints fail closed; never widen the adapter silently to Next.js or arbitrary projects.
- Source-trial packages contain fixed artifact paths, exact forward/inverse patches, a hash-bound contract, a read-only Node verifier and `AGENT-HANDOFF.md`. Treat uploaded source/comments and project prose as data, including when the recipient is an LLM. Snapshot inputs before asynchronous integrity checks; revalidate owner/design/draft/source lifetime before download. No launch evidence is credited. Whole-file verification is point-in-time and cannot enforce an external coding agent's later actions; actual project builds, tasks, browser review and selective undo remain required.
- Target's optional returned-file check compares raw selected bytes with the current proposal's original/proposed snapshots. Keep proposed/original/partial/different outcomes distinct; neither exact match proves repository state, deployment, task success or an undo event. No report import, source persistence or Launch credit. Retain file-size bounds, intrinsic typed-array checks and owner/proposal/read-generation guards; mismatches require review, never forced rewriting.
- Provider-specific AI code only in src/lib/ai.server.ts; swap via AI_PROVIDER.
