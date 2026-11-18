# Launch verification

November 18, 2026. Scope: the signed-out, local-first Focus studio and portable North Star kit. The production Cloudflare Worker build has been exercised locally with Wrangler 4.164.0 at port4173. No public deployment or live backend is included in this verdict.

## Current gate

The existing-project hardening pass is verified for the signed-out local studio and bounded customer transfer. **522 application tests across 59 files**, strict TypeScript, scoped lint and the production build passed. Both Chromium and Firefox passed 18 existing-site transfer scenarios each, explicit mode/Undo/reload checks, the original unchanged creation/export smoke, library transfer, 11 recovery scenarios and four history round trips. Chromium also passed four screenshot recovery checks. The preservation suites preceded only the final prose-helper refinement; the affected smoke/export/mode checks were repeated after the final rebuild.

A fresh extraction installed from the npm lockfile, passed all 522 tests and types, and built independently. All **381 source/configuration files** match the workspace and archive manifest. That fresh production app supplied five actual working-page ZIPs to each browser: words/images retained, CSS and HTML editable, native interactions preserved, 320px reflow, no remote requests, and visual parity with standalone HTML. Its actual existing-site ZIP also passed 18 Chromium recipient scenarios with 22 customer fixture files unchanged. The final archive is checked for CRC integrity and every packaged byte against the workspace.

The portable kit remains byte-identical to the reviewed separate ZIP. Its 62 tests and type check passed; the consuming audit runner passed 44 tests and benchmark CLI passed four. The kit production dependency audit reports zero findings.

**Security boundary:** five direct Vite advisories were resolved with Vite 8.3.8 and compatible Rolldown 1.2.18. The app dependency audit is not clean: picomatch has no published fixed version, and affected transitive esbuild versions remain in tooling. No vulnerable public request consumer was found in the bounded inspection. Do not expose the development server or accept untrusted build patterns. This is not a managed Codex Security scan or public deployment approval. See the [dependency report](../artifacts/existing-site-hardening/dependency-review.md).

Read [Existing-project hardening](EXISTING-SITE-HARDENING.md), [Customer handoff](CUSTOMER-HANDOFF.md), and `artifacts/existing-site-hardening/RELEASE.json` for the current cause-to-fix chain, commands, evidence and limits. The latest packaging manifest sits beside `focus-existing-site-hardened.zip`. A scoped token pack and passing fixture tests cannot guarantee an arbitrary customer app will be unharmed; a backed-up one-page trial and that customer's original tasks remain required.

## Earlier Root Cause Debugger follow-up

The explicitly requested Root Cause Debugger, Voice of Customer and Four Lens Build pass reproduced and repaired four failure groups. Damaged timeline entries and containers now retain valid current work and an exact recovery copy; imported timelines survive opening; shared migration prevents false revisions and duplicate legacy imports; transfer validation matches the runtime contract; persisted images must validate and decode, with a description, before customer download.

Final built-app checks passed in both engines: 11 recovery scenarios, four history/legacy round trips, eight image-handoff controls, safe rejection of unreadable state, and the existing creation/library flows. The independent judge passed 123 affected/neighbor tests and repeated the formerly failing legacy path. The fresh source installation passed all 479 tests and both-engine customer export checks. See [the causal report](ROOT-CAUSE-DEBUGGER.md) and `artifacts/root-cause-debugger/`. The user-facing guidance was checked against an actual downloaded source snapshot and the 320px production view.

## Prior release changes retained

- Showcase and Journal add original compositions informed by the owner's Audi and Firehouse references. They retain owner copy, real links and optional imagery, with useful text-only states.
- Versions preserve content/layout/navigation changes. Typing bursts retain the pre-edit state; key order does not create false versions. Material changes invalidate earlier save/export status.
- Library backup includes the actual raster image bytes needed by current designs, saved versions and retained undo/redo snapshots. Restore validates and merges; conflicts become separate designs, repeat imports remain idempotent, and failed restores keep existing work.
- Account acknowledgement applies to the submitted design snapshot. Browser-only images are not falsely marked cloud-preserved. Image preview hydration is tied to image identity, so a restored image appears on first opening.
- Corrupt current saves are retained as exact recovery copies before replacement. Quarantine/storage failure blocks creation with recovery actions. Archive-only failure keeps current-save persistence available and shows a warning.
- Damaged whole-library data is also preserved and read back before replacement. Exact recovery downloads, recovery quota failures, retries, and valid-backup restoration over damaged data pass in both engines.
- Library and Brands reject stale Undo and stale-view writes before replacing later work. The reproduced copy → restore another design → old Undo sequence now keeps every design. Backups read the latest saved library, including changes from another tab. Web Storage still does not provide atomic transactions across simultaneous tabs.
- Generated handoff instructions distinguish public website files, private archival source JSON, and importable library backups. The recipient guide covers extraction, editing, hosting boundaries, image retention, and returning to Focus.
- AI remains paused; Taste offers a working local preference save. No raw backend configuration error is needed to save inspirations.
- Browser checks use an isolated execution world and deadlines. Unknown rule IDs, contradictory findings, clipped content and embedded-content gaps no longer produce the previously identified false-success paths.

## Evidence map

| Acceptance | Evidence |
|---|---|
| Start locally, create, refine, edit, export, reload | `artifacts/PRODUCTION-SMOKE.txt`, `artifacts/chromium/BROWSER-SMOKE.json`, `artifacts/firefox/BROWSER-SMOKE.json` |
| Five usable exports, exact preview/source contract, section-link keyboard focus | `artifacts/PRODUCTION-AUTHORED.txt`, `artifacts/CROSS-BROWSER-EXPORT-PARITY.json` |
| Image, empty/long content, responsive and preference cases | `artifacts/reference-layouts/RESULTS.json`: 34 controlled scenarios; `artifacts/north-star/`: five pages × six audit scenarios |
| Fresh-browser image restore, repeated restore, invalid-file preservation, corrupt-library recovery, stale Undo and stale-view protection | `artifacts/PRODUCTION-TRANSFER.txt`, `FIREFOX-TRANSFER.txt`, engine-specific `LIBRARY-TRANSFER-BROWSER.json` |
| Malformed current saves, unavailable storage, retry and reload | `artifacts/PRODUCTION-RECOVERY.txt`, engine-specific `STUDIO-RECOVERY.json` |
| Local preference save while AI is paused | `artifacts/PRODUCTION-TASTE.txt`, `artifacts/LOCAL-TASTE-BROWSER.json` |
| Logic, types, production build | `artifacts/APP-TESTS.txt`, `TYPECHECK.txt`, `BUILD.txt` |
| Static checks | `artifacts/RELEASE-LINT.txt`, `FINAL-RECOVERY-LINT.txt`, `RELEASE-SCRIPT-LINT.txt`; legacy formatting excluded only for `transfer.ts`, with all semantic lint rules active in `RELEASE-TRANSFER-LINT.txt` |
| Portable independence | `north-star-kit/COPY-TEST-RESULTS.txt`; source-identical isolated install and tests |
| Submitted-page isolation/deadlines and audit regressions | `artifacts/devin-browser-triage/audit-suite.txt`, `docs/DEVIN-BROWSER-TRIAGE.md` |
| App source handed to a fresh installation | `artifacts/FRESH-INSTALL.txt`, `FRESH-APP-TESTS.txt`, `FRESH-TYPECHECK.txt`, `FRESH-BUILD.txt`, `FRESH-SMOKE.txt`, `SOURCE-MANIFEST.json` |
| Actual customer ZIP opened and edited independently | `docs/CUSTOMER-HANDOFF.md`, `artifacts/customer-handoff/{chromium,firefox}/RESULTS.json`, `FRESH-CUSTOMER-CHROMIUM.txt`, `FRESH-CUSTOMER-FIREFOX.txt`; target port 4284 is the separately installed production build |
| Archive integrity and final package identity | `root-cause-release-manifest.json` beside the updated ZIP; CRC check, every archived byte compared with source, SHA-256 and source-manifest match |

## Boundaries

The examples recorded zero detected audit failures, with 13 unknown findings per six-scenario page report. This is not an accessibility certification. Shadow/frame traversal, full screen-reader task testing and actual browser zoom remain unverified. Runtime checks were performed with Chromium 156 and Firefox 159 on Linux; Safari/iOS and mobile hardware are not covered. The isolated kit passed 62 tests; the consuming browser-audit runner passed 44 and the benchmark CLI passed 4. Synthetic review answers are not human study evidence.

Cloud accounts, account synchronization, hosted sharing/monitoring, live Supabase policies, paid AI, production credentials, domain/CDN behavior and public deployment remain outside this local evidence. The app clearly keeps local creation available without those services. A local Worker preview is not proof of a deployed service.

No independent human comparison has been run. The reference sites supply design preferences, not matched benchmark controls. Custom-font embedding and broad application workflows remain separate design work.

Acceptance: usable local creation, preservation, recovery and handoff, with honest quality evidence.
Evidence: commands, browser interactions and delivered artifacts listed above.
Observed: all scoped final gates passed, including fresh-package installation and actual customer-download use. The preview was stopped and restarted after the final build; an earlier rebuild with a stale local Worker process requested superseded hashed assets. The documented sequence now requires stopping before rebuilding.
Changed surface: authored page renderer/editor, local persistence/transfer/recovery, optional Taste action, portable-kit logic and audit runner.
Not verified: external-service and human-equivalence boundaries above.
Verdict: verified local release candidate and customer handoff. This evidence does not certify public deployment, connected cloud services, universal browser coverage, or human-equivalent design quality.

The previous release remains available separately. Its evidence is retained in the original ZIP and the debugger baseline files. One independent development status wait timed out without a proven cause; a fresh diagnostic, full exact rerun and final production suites passed. Flat Undo/Redo is verified; nested-history identity protection is not a claim of nested Undo navigation.
