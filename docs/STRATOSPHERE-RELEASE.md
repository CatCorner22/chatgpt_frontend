# Stratosphere, Garden Path and Field Guide

## Result and scope

Focus now follows nine decisions: purpose, content, structure, direction, craft, behavior, responsive/accessibility work, handoff and review. Eighteen optional lessons explain why those decisions matter. Visiting a stop is navigation, not completion evidence.

Stratosphere lives inside the original Studio state, preserving Undo, saved versions and recovery. A single typed registry supplies six groups of controls and their deterministic dependencies. New websites use the same authored HTML for preview and download. Existing sites/apps show a style study and require scoped integration into their actual source. No writable GitHub integration, customer-code execution or automatic production replacement is added.

The decision map distinguishes enforced scope/color/value constraints, advisory relationships and unknown customer-specific behavior. Its current values follow edits and Undo. It is a bounded model of implemented choices, not an exhaustive proof that every possible frontend combination works. Fonts, content wrapping and renderer limitations remain explicit.

The Field Guide explains terminology with source links and three practice decisions. Selecting a practice choice reveals its benefits, tradeoffs and downstream work. Practice stays in local component memory and does not write project, handoff or launch records. See [research notes](FIELD-GUIDE-SOURCES.md).

Reverie’s red coin-operated rocket uses the established character artwork. The interface retains white, cool blue-green and deep ink rather than beige.

## Customer-perspective review

A source review used two explicitly assumed contexts: a first-time project owner and a developer receiving the package. These are not interviews or observed usability results. The review found and corrected an initially disabled Stratosphere entry point for existing apps, a misleading global scope banner, and a Garden behavior link that led to artifact inspection instead of the local interaction exercise. The guide clearly distinguishes practice, changes to a Focus design, and implementation work in a customer project. Live customer behavior remains untested.

## Delivery protections

- Asynchronous page ZIP preparation binds to the current design, mounted panel and verified owner. A stale or locked operation cannot download or mark export success.
- Optional decision-record JSON is validated and byte-bounded. The ZIP identifies project source and decision records as private material, not public website files or release certificates.
- Protective hosted-session checks lock owner-scoped browser storage immediately; only fresh same-owner verification resumes access. Drafts remain mounted behind the gate.
- The interaction lab has real local buttons, email-format validation, tooltip keyboard behavior and manual feedback states. It sends/saves nothing, does not add components to output and does not test customer code.
- Static component examples are labeled as examples; they no longer imply an actual save or publication.

## Research

Fourteen glossary entries are grounded in fourteen inspected pages from MDN, W3C WAI, React, GOV.UK, the Design Tokens Community Group and GitHub. Seven Focus names are explicitly product definitions, separate from the external terminology. The three practice scenarios are editorial examples, not user-study results or guaranteed outcomes.

## Requirement ledger

| Requirement | Evidence status |
| --- | --- |
| Decisions and dependency map share one registry | Proved by engine and component regressions in the passing integrated suite |
| Studio remains the single state owner | Proved for tested state/lifetime paths; independent source review passed |
| Stale/locked/unmounted exports rejected | Proved by stale/locked/unmounted export regression cases |
| Immediate owner lock during protective session checks | Real-storage regression tests pass |
| Intro definitions and useful consequences | 14 sources inspected; 9 practice/guide tests pass |
| Nine stops retain old saved preference IDs | Preference/navigation tests pass |
| Rendered desktop/mobile and real keyboard acceptance | Blocked by browser infrastructure |
| Customer React/Next.js redesign and rollback | Blocked pending an actual customer repository and isolated trial |

## Verification

- `npm test`: **984 tests pass in 91 files**. This includes 11 Studio cache/lifetime regressions and 9 Field Guide interaction cases. See [cache root-cause report](STRATOSPHERE-CACHE-FIX.md).
- `npx tsc --noEmit`: passes.
- ESLint on all 26 changed TypeScript files: passes after correcting test-import formatting; the existing HostedBoundary fast-refresh export warning remains.
- `npm run test:sites-build`: **8 packaging tests pass**.
- `npm run test:audit`: **44 audit-runner regression tests pass** against controlled fixtures. Some execute Chromium on fixtures; these are not acceptance tests of Focus or a customer app.
- `npm run test:benchmark`: **4 benchmark CLI tests pass**. These verify tooling, not human-quality equivalence.
- Release build/package command: `npm run build:sites`. Publication must use the exact committed source and byte-checked archive. Final build, archive, deployment and live-asset evidence are recorded in the release receipt beside the deliverable archive.
- Independent source reviews found and resolved stale option caches, abandoned request completion, cached-question busy state, existing-app entry friction and interaction-demo color disclosure.

No customer-release, zero-defect or human-equivalence claim is made. See [design QA](../design-qa.md) for the browser blocker and outstanding acceptance steps.

## Rollback baseline

The previous verified owner-private release is v6, source `cf35f04946152221133e940f31c00daae6aaf80f`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_ebdd618fb1e48191bf389b132c16e9f2`. It can be redeployed through Sites without rewriting source history. This update does not migrate customer data or alter the Site audience.
