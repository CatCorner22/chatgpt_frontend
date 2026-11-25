> **Garden Path and delivery.** Use the [customer walkthrough](docs/GARDEN-TO-DELIVERY.md) to carry decisions into an exported website or a reversible change to an existing React/Vite project. Earlier checkpoints describe their own versions.
>
> **Hosted edition:** This checkout publishes Focus to a private Sites workspace with ChatGPT sign-in, per-user browser storage, and complete online library copies. Start with [HOSTED-HANDOFF.md](docs/HOSTED-HANDOFF.md) and the actual limits in [HOSTED-VERIFICATION.md](docs/HOSTED-VERIFICATION.md). The portable release remains a separate preserved deliverable.
>
> Run `npm ci`, `npm test`, `npx tsc --noEmit`, and `npm run build:sites`. Keep `.openai/hosting.json` tied to the existing Site; its R2 logical binding is the string `BUCKET`. Never copy credentials into this file. Production requires the Sites identity gateway and provisioned storage. The development preview uses isolated browser storage and does not simulate a real account.

# Focus

A design studio for finding a visual direction, making it your own, and checking the result. This version builds on the supplied Focus project and includes an independent North Star kit.

Meet **Reverie**, your gentle guide to Focus, in the welcome session or **Help → About Reverie** (`/reverie`). Her name means "a pleasant daydream."

The app's paths have plain purposes:

- **Vision** is your saved design plan and handoff.
- **Target** (`/target`) prepares a saved design for a real project with guided questions, a validated pack and project-specific prompts. GitHub with React or Next.js is the first supported preparation path; application and verification happen in your own project workflow.
- **Horizon** (`/progress`) shows recorded progress and useful next steps without certifying a release.
- **Telescope** (`/telescope`) inspects bounded local HTML/ZIP files, compares exact-file receipts and prepares manual interaction tests. It does not execute customer code or run a browser test.

The **Made for you** gallery includes six new original starters: Purr & Paper, Velvet Afterglow, Midnight Muse, Wildflower Hour, Cocoa Atelier and Moonlit Mischief. Their sample copy can be customized; existing-site packs keep the customer's original content and behavior as the source of truth.

The project's defined **North Star** is frontend UI and UX as good as the best human coders. See [the current review and priorities](docs/NORTH-STAR-REVIEW.md) for the evidence, remaining gaps and next acceptance criteria.

## Run locally

Use Node 22.12 or newer and npm. No environment file or account is required for the local studio.

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 3000
```

Open http://localhost:3000. The npm lockfile is authoritative; the original Bun lockfile is retained only as part of the supplied project history.

## What works without a backend

- Match a brief against 49 authored design directions.
- Choose and refine colors, fonts, scale, spacing, shape, layout, and detail using deterministic local options.
- Edit your actual business name, headline, services, call to action, and optional customer quote.
- Save designs automatically in this browser, resume them, and use the existing library and undo controls.
- Build a working page in Studio, Editorial, Product, Showcase, or Journal; download the same HTML seen in the preview and editable linked CSS.
- Back up and restore your design library with the actual image files, saved versions, and retained history.
- Download the original design brief and specification ZIP for your coding tool.
- Choose **Restyle my existing site or app** at the start or at handoff. Download a scoped trial pack with preservation and undo guides; no public URL or source upload is needed.
- Use the Quality lab at `/quality` to inspect pasted HTML locally, view measurement limits, and download a JSON receipt.

Local design matching uses the existing design collection. It does not call a model or fabricate customer proof. Font previews may load public web fonts; the core studio does not need AI or account services.

## North Star kit

`north-star-kit/` is a separate strict TypeScript package with 47 evidence-bearing rules, 10 injectable DOM/CSSOM checks, fixtures, content validation, design labels, grading, bounded repair plans, receipts, token/pixel comparison, preference duels, and blind-review scoring.

The kit has only Zod as a runtime dependency. It can be copied out and installed independently. Read its `README.md`, `HONEST-REPORT.md`, `SOURCES.md`, and `BROWSER-TESTS.md` for the public API, evidence, and limitations. Snapshot checks cannot establish keyboard behavior, screen-reader support, temporal behavior, or suitability for intended users. These remain explicit review work.

## Verification

```sh
npm test
npx tsc --noEmit
npm run build
npm test --prefix north-star-kit
npm run typecheck --prefix north-star-kit
```

With the development server running and Chromium installed:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:browser
```

Use `FOCUS_TEST_URL` to test another local port. Browser smoke tests exercise the local creation flow, real copy editing, Markdown/ZIP downloads, persistence, skipped-question resume, keyboard skip link, mobile reflow, and quality receipts. They write evidence and screenshots to `artifacts/`.

## Optional cloud features

Accounts, account sync, public sharing, and monitoring require a configured Supabase backend. See `.env.example` and `PORTABILITY.md`. Database migrations and generated backend files are preserved from the supplied project. They were not deployed or tested against a live database here.

Paid AI remains explicitly paused by the existing project policy. Enabling paid services, configuring production credentials, and deploying publicly are separate owner decisions. Missing credentials do not block the local design studio.

Read [Launch verification](docs/LAUNCH-READINESS.md) for the current release scope and evidence. The [Root Cause Debugger report](docs/ROOT-CAUSE-DEBUGGER.md) records the latest reproduced failures, causal evidence, corrections and customer review. Earlier implementation notes remain in `docs/BUILD-REVIEW.md` and `docs/NORTH-STAR-PROGRESS.md`.

For delivery to a customer, follow [Customer handoff](docs/CUSTOMER-HANDOFF.md). It distinguishes editable website files, private source snapshots, and restorable library backups, with checks for the receiving browser.

For an existing project, read [Existing-project hardening](docs/EXISTING-SITE-HARDENING.md). The pack exposes namespaced values first; semantic theme mapping is a separate opt-in after checking the customer's component color pairs. Try one page on a backup or preview, test its original tasks and contrast, and demonstrate undo before expanding the change. The ZIP does not install itself or verify arbitrary customer applications.

## North Star: working output and independent review

Working-page HTML/ZIP exports now include five compositions, owner imagery and real action destinations. In the final studio step, use the working preview; the original specification tools remain available in the expandable handoff section.

```sh
npm run test:authored
npm run audit:browser -- --file artifacts/authored-pages/studio.html --out artifacts/my-audit
npm run test:audit
npm run benchmark -- init benchmark/organizer.json
npm run test:benchmark
```

Quality lab imports rendered browser receipts. The Review room (`/review-room`, under Tools) collects a neutral packet prepared from real benchmark pages. Read [North Star progress](docs/NORTH-STAR-PROGRESS.md), [browser audit instructions](docs/AUDIT-RUNNER.md), and [independent-review instructions](docs/BENCHMARK-REVIEW.md). These additions support the evaluation process; no human-equivalence result has been established.

## Verify the built app locally

The release checks run the generated Cloudflare Worker locally, without deploying it or signing in:

```sh
npm run build
WRANGLER_SEND_METRICS=false npx --yes wrangler@4.164.0 dev --config .output/server/wrangler.json --local --port 4173
```

Stop this preview before rebuilding, then restart it against the new build. Keeping an old Worker process alive while replacing its hashed assets can leave the local preview requesting files from the previous build.

With that preview running, the same browser harnesses accept `FOCUS_TEST_URL=http://localhost:4173`:

```sh
FOCUS_TEST_URL=http://localhost:4173 node scripts/browser-smoke.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-authored-pages.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-reference-editor.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-library-transfer.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-studio-recovery.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-history-transfer.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-local-taste.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-customer-handoff.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-integration-mode.mjs
FOCUS_TEST_URL=http://localhost:4173 node scripts/test-existing-transfer.mjs
```

The editor harness uses the screenshots generated by `test-authored-pages.mjs`. The library/recovery harnesses create their own fixtures. Core smoke, authored-page, library-transfer, studio-recovery and customer-handoff harnesses also accept `FOCUS_BROWSER=firefox` after `npx playwright-core install firefox`. The customer-handoff harness extracts actual UI downloads and opens them in a fresh browser context. The audit runner itself uses Chromium's isolated execution world. In managed environments, follow the available browser/preview capability instructions; do not use these harnesses to bypass unavailable browser infrastructure. See the launch report for covered browsers and remaining external-service checks.

The latest Lovable kit and Devin's judge report were compared against this code rather than copied over it. Findings and dispositions are in [the kit comparison](docs/LOVABLE-KIT-COMPARISON.md) and [browser triage](docs/DEVIN-BROWSER-TRIAGE.md). Neither automated checks nor the Audi/Firehouse references establish human indistinguishability.

## Garden Path and Cat Samurai

Focus opens on a nine-stop Garden Path with Reverie and her kite. The existing editor remains at `/?view=studio`; saved designs, undo history and pending imports retain their existing contracts. Tools stay accessible under Tools, and Help contains Reverie’s introductory field guide, the walkthrough and About Reverie. The welcome field guide has source-linked vocabulary and five local practice decisions, with a revisable choices summary and optional deeper explanations; its examples never change a project.

Ten optional lessons explain the choices and tradeoffs. “Keep it brief” hides the lessons and remembers the preference in owner-scoped browser storage; failure to persist is shown honestly. Map visits do not certify completed work. Customer implementation and browser acceptance remain separate from design-file preparation.

[Cat Samurai](docs/CAT-SAMURAI.md) is Blake’s design and engineering principle, including no beige app surfaces. See [Garden Path release evidence](docs/GARDEN-PATH-RELEASE.md) for scope and limits.

## Stratosphere and the decision map

`/stratosphere` opens a workshop inside the existing Studio state. Six decision groups change composition, paired colors, fonts, hierarchy, spacing and control form through the same Undo and recovery system. A deterministic registry supplies controls, constraints and the live dependency map. New-website output shares the authored HTML preview/export renderer. Target can turn a saved direction into a scoped trial on a supported React/Vite page. It can package licensed fonts and offer a compact or comparative class picker on the recognized River Kiln form. Other structures use the developer-guided handoff. [Walk through a working redesign](docs/GARDEN-TO-DELIVERY.md)

An optional local interaction lab exercises buttons, form validation, a tooltip and feedback states. It does not install those components or certify a customer's app. An authored ZIP can include the current decision map; private source records are not public deploy files. Asynchronous exports reject a changed design or locked owner before delivery. See [Stratosphere release evidence](docs/STRATOSPHERE-RELEASE.md) and [field-guide sources](docs/FIELD-GUIDE-SOURCES.md).

Authored pages embed licensed Latin subsets for Instrument Serif / Instrument Sans, Space Grotesk / IBM Plex Sans, and Newsreader / Literata. Preview, standalone HTML and editable ZIP use the same selected-only stylesheet; license notices and source provenance travel with the output. Other families and characters use local fallbacks. Existing-app packs and specimen font loading retain their separate contracts. Regenerate the checked-in catalog with `node scripts/generate-authored-fonts.mjs` and verify it with `--check`. See [portable typography evidence and limits](docs/PORTABLE-TYPOGRAPHY-RELEASE.md); browser font rendering has not yet been accepted.

Target's final step also offers an optional source trial for a supported React/Vite page and matching CSS module. The user selects two local files and their actual project paths, confirms recognized roles, and reviews exact proposed changes. The download contains forward/inverse patches, a hash-bound contract, a read-only Node checker and an LLM-ready agent handoff. Source stays in the mounted panel; Focus does not execute it, write GitHub or apply/deploy the patch. Next.js keeps the developer-guided handoff path. Read [source-trial scope and evidence](docs/SOURCE-TRIAL-RELEASE.md) before relying on the proposal.

The same proposal can [check the two files returned by a coding assistant](docs/SOURCE-RETURN-RELEASE.md), distinguishing exact proposed bytes, originals, mixed stages and unexpected differences. This local comparison does not certify the recipient's report, tests or deployment. Keep the original files to recreate the proposal after leaving Target.
