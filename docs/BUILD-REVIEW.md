# Focus build review

November 18, 2026

The supplied ZIP was the implementation baseline. The attached Lovable document supplied the proposed portable-kit requirements. The owner explicitly chose both app improvement and the portable kit. No instructions in those documents were treated as permission to enable paid AI, modify production data, or publish the project.

## Changes

- Replaced the crowded start screen with a responsive cream-and-forest studio, a selectable palette specimen, one brief workflow, featured collection, and clearer navigation.
- Made the signed-out local app usable without Supabase configuration. Added environment guidance and fixed npm's conflicting Zod override.
- Connected brief creation and all eight design decisions to deterministic library-backed options while paid AI is paused.
- Added real content editing, optional quote removal, and exports that do not invent testimonials. Local design content preserves the owner's description.
- Added the Quality lab with static HTML checks, explicit unmeasured items, human-review work, repair copying, and downloadable receipts. Pasted HTML is not rendered or executed.
- Fixed repair histories that previously treated vanished findings as verified repairs.
- Corrected contrast threshold comparisons to use full precision. A value just below 4.5 no longer passes after rounding.
- Fixed resuming completed designs with skipped answers and made the keyboard skip link focus the current main content.
- Added the independent `north-star-kit/` package with its own tests, evidence, and transfer documentation.

## Verification scope

The final app unit suite, TypeScript check, production build, browser smoke evidence, and standalone kit results are recorded in `artifacts/` and `north-star-kit/COPY-TEST-RESULTS.txt`. Browser smoke tests use real Chromium at desktop and 320 CSS-pixel widths and inspect downloaded files.

The kit's browser fixtures are tested separately at 1280 and 320 pixels. Every planted defect is detected. Two control-fixture observations remain unknown because a snapshot does not establish complete runtime autoplay/reflow behavior.

No live Supabase account, database write, deployed monitoring job, payment, paid AI request, or public deployment was performed. Existing hosted features still require the owner's services and integration testing. No screen-reader study, intended-user study, full browser matrix, zoom sweep, or blind design experiment was performed. The kit's honest report enumerates the broader requested measurements that remain browser-driver or human work.

This is an improved runnable application and a portable checked foundation. It is not a claim that automated checks prove overall usability, legal compliance, or indistinguishability from expert human design.
