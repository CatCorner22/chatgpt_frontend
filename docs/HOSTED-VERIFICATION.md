# Hosted release verification

This edition adds private hosted access, owner-scoped browser storage, complete online saved-library backups, and measured URL checks using Sites identity. It preserves the earlier customer exports and existing-site restyle workflow. Paid AI remains paused.

## Evidence

- Full application suite: 678 tests across 71 files passed on 2026-11-18.
- TypeScript: full strict check passed.
- Packaging: six tests passed; every generated server module and public asset is retained and checked byte-for-byte, and static Worker imports resolve inside the package.
- Independent bounded review covered account identity, cloud revisions, storage isolation, transfer preservation, failure states, auth navigation, and misleading service prompts. Confirmed findings were repaired.
- Existing portable kit sources and dependency lockfile are unchanged from the earlier verified release.
- No provider keys or production customer data were used in tests. In-memory storage and synthetic identities do not establish live account behavior.

## Unfinished live acceptance

The managed preview relay timed out. The cloud browser could not initialize because its sandbox was unavailable. Therefore no browser test, real second-account test, or live cross-device image/history restore is claimed for this hosted edition. Native deployment and HTTP probes, when recorded below, prove only their stated boundaries.

The Site remains owner-private until a colleague is identified and deliberately added. Recipient email is still required. The colleague handoff is not fully validated until the clean-account journey in HOSTED-HANDOFF.md is completed.

## Operational limits

Online library saves are explicit copies of saved designs, not live editing or automatic synchronization. Unfinished drafts and other preferences remain in the browser. Ordinary successful saves retain the current and previous snapshot; cleanup failures can retain additional objects. There is no self-service historical restore or online deletion in this edition.

Supabase-dependent public links, live Vision publishing, account profiles, synced progress, badges, and scheduled monitoring are not configured; the UI offers working alternatives. Measured page checks are bounded source inspections, not a test of private customer tasks.

Dependency advisories from the original release remain for picomatch build globs and esbuild serving paths. The dependency lockfile is unchanged; affected public runtime paths were not established by the prior bounded review. This is not a clean dependency audit, managed Codex Security scan, penetration test, or production-readiness certification. Maximum-size Cloudflare Worker memory/CPU use has not been profiled.

## Recovery and rollback

Keep downloaded library backups and the previous portable release. A failed or conflicting online save does not force a retry; check the latest copy, restore/merge it, and deliberately save again. Temporary account-verification failures preserve open work behind a locked screen until the same account is verified. Never clear browser data as a repair step.

The native saved version and exact source commit identify the deployed package. Restore an earlier saved Site version to roll back application code after such a version exists; this does not undo user library writes. Preserve current backups before any data recovery.
