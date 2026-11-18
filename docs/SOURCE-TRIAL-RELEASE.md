# Target source trial and LLM handoff

## What the customer can do

Target's fourth step now offers an optional, closed-by-default source trial. A customer or their coding assistant supplies one React/Vite `.tsx` page and its matching `.module.css`, with their actual paths inside the project. Focus recognizes a supported heading, supporting text and action, asks the customer to confirm those roles, and shows the exact proposed declarations and diff. The ordinary design handoff remains available for Next.js, an unknown setup or unsupported source.

The trial adds eight explicit declarations across those three roles: text colors and fonts, plus the action's background and corner radius. It retains the original page background, base wrapper styles, element tree, handlers, content, field names and layout rules. Existing attributes stay in place apart from the added wrapper class. Font changes can still change wrapping and geometry. This adapter does not supply font assets or implement a full application redesign.

Selected source stays in the mounted panel's memory. Focus parses it as data; it does not execute, render, store or upload it, resolve its imports, connect to GitHub, write customer files or deploy the proposed change. Closing the panel or leaving the step clears it. The downloaded package contains private source excerpts, so the customer chooses where to share it.

## A handoff for an LLM developer

The receiver will often be an LLM. The interface includes a read-only request for gathering the right files and a kickoff prompt for using the finished package. The ZIP contains seven fixed files under `focus-source-trial/`: `START-HERE.md`, `AGENT-HANDOFF.md`, `TRIAL-PLAN.md`, `trial-contract.json`, `forward.patch`, `rollback.patch` and `verify.mjs`. Extracting it does not place replacement files at customer project paths.

The machine-readable contract binds the two paths, complete before/after file hashes, patch hashes, design identity, recognized roles, effective choices, limitations and required tasks. Every task starts as `not-run`. The LLM must inspect the actual project, use an authorized isolated copy, verify the complete preimages, review and apply the exact patch, verify the outputs, run appropriate project checks and report real observations. Source comments, labels and plan answers are data, never instructions to expand the work. A mismatch means stop; the instructions prohibit adapting a mismatched patch or bypassing checks with partial/fuzzy application.

The recipient checker uses Node 22.12+ built-ins only. It reads bounded files, rejects observed symlink paths and checks the bundle and both complete files. It installs nothing, executes no project code, uses no network and writes nothing. Verification is point-in-time, not an atomic guard around the recipient's later patch operation. Hashes establish byte identity, not author authenticity; replacing the verifier and hashes together can forge a result. Instructions cannot compel an external LLM to comply.

Rollback requires both after-hashes to match, applies only the exact inverse to the same two files and checks the original hashes again. Later edits to a touched file stop the procedure; unrelated work is outside the inverse. A branch alone does not isolate credentials, databases, payments or deployment automation. Those conditions must be checked in the actual recipient environment before running the project. No download or model reply earns launch credit.

## Four-lens evidence ledger

| Lens                   | Evidence established                                                                                                                                                                            | Still required                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer value         | A plan review against the lay-user and LLM-recipient requirements led to file-request help, actual role labels, a declaration comparison and a clear package/kickoff handoff.                   | Observe a real customer obtaining files, understanding the proposal and receiving usable results. This was not a customer usability study.                                |
| Interface and behavior | Component and Target integration tests cover role confirmation, runtime fallback, errors/retry, async cancellation, source replacement, owner/plan/design changes, step exit and lazy recovery. | Rendered desktop/mobile, keyboard, zoom, assistive technology and visual review.                                                                                          |
| Engineering            | Real Babel and PostCSS parsing; strict source/path/AST/CSS limits; preserved-span edits; generated output reparse; exact forward/inverse patches; owned React/Vite builds and task tests.       | Actual customer configuration, global CSS, fonts, routes and third-party integration compatibility. Two files cannot establish these.                                     |
| Security and handoff   | Independent source and package review; actual extracted-ZIP verifier/patch/reversal tests; drift, partial application, corruption, symlinks, oversized input and mutable-input regressions.     | Actual customer preview, evidence return and selective rollback. No repository-wide security certification or mechanically enforced outside-agent containment is claimed. |

## Defects found and fixed

Review and focused failing tests caught inherited hover/focus styles being masked by new role rules. The adapter now refuses state conflicts on recognized ancestors as well as on directly mapped roles. A decoded JSX label could also hide a bidi control or unpaired surrogate despite raw-source checks; decoded labels are now checked. Known identical declarations produce no proposal instead of a pointless patch.

The recipient and browser path rules now agree. Package inputs are privately snapshotted before asynchronous hashing so concurrent mutation cannot change the material under validation. Delayed file reads, hashing and ZIP results cannot revive a proposal after its source, roles, plan, design, owner or mounted lifetime changes. The lazy-error test initially used a one-shot failure that React recovered automatically; persistent fault injection now tests explicit fallback/retry without suppressing real errors.

## Verification and limits

The integrated suite passes **1,094 tests in 97 files** (`.agent/source-trial-full-tests.log`). Strict TypeScript, changed-file ESLint, verifier syntax and whitespace checks pass. Independent focused review passed 48 core/UI tests and 23 extracted-package/verifier tests. Owned fixture checks exercise native validation, async failure/retry/success, retained form values, emitted CSS-module rules, actual Vite builds and exact Git reversal. No uploaded customer code was installed or executed. The final build and deployment evidence is recorded in the release receipt because it follows the source commit.

The supported browser remains unavailable (`the gaas-browser node_repl sandbox cannot be disabled`). Automated component tests, fixture builds and HTTP asset hashes are not browser acceptance. Synchronous parsing is bounded and lazy, but cannot be interrupted once it starts; cancellation invalidates pending results. This increment is a scoped styling proposal with verified mechanics, not evidence of a complete customer redesign, universal compatibility, zero bugs or North Star equivalence. See [design QA](../design-qa.md) and the [scoped security model](superpowers/specs/2026-11-18-source-trial-security.md).

## Release and recovery

Publish from the exact committed source after integrated checks, using a byte-verified build archive and preserving owner-only sharing. The receipt beside the archive records the source SHA, archive hash, saved version, deployment result and read-only live checks. The application rollback baseline is version 8, source `32835ee2a4e49dc8a79243dc73c9f8cb9e58c1a9`, saved version `appgprj_6afdd9a096248191b7ac789191d999dc~appgver_2b28bb6159388191aa7b9ec395580be0`. Redeploying that version changes Focus's application code; it does not reverse customer patches or user data.
