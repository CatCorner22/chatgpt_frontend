# Using your hosted Focus workspace

Open the private URL supplied by the workspace owner and sign in with your ChatGPT account. The account menu shows the available email address. You do not need a separate Focus password, API key, terminal, or existing design file.

## Make your first design

1. In **Design studio**, choose a new site or **Restyle my existing site or app**, describe the project, and select a direction.
2. Complete the short choices and create your Vision. Edit your words and choose a composition.
3. If you add an image, choose PNG, JPEG, or WebP up to 750 KB and add its description. Set the real destination for the page's main action.
4. Open **My designs** and verify the design appears. Editing is kept in this browser automatically; unfinished work has not necessarily become a saved library design.
5. Choose **Save library online** to keep a private copy of the saved library, including its referenced images and history. Wait for the success message. Keep a downloaded **Back up library** file as an independent copy.

An online library is a saved copy, not live automatic synchronization. An unfinished studio draft, taste preferences, review sessions and unrelated browser settings are not included. Changes made after an online save need another save. Image upload, validation, or storage failure must be resolved before a complete backup can be saved.

## Continue on another device

Sign in to the same account, open **My designs**, and choose **Restore online library**. This adds saved work to that browser and keeps its existing designs. Different versions sharing an identity become separate copies; an identical repeat restore does not duplicate designs. Open the restored design and check its words, image, composition and action destination.

Opening My designs checks the online revision but does not import or replace browser work. If an online copy exists, restore it before saving an updated copy. If another device changes the online library meanwhile, Focus stops the save. Choose **Check online library**, restore the newest copy, review the combined designs, then save again. There is no force-overwrite button.

If the connection fails during a save, keep your browser copy and downloaded backup. Check the online library before retrying: the server may have received the save even if its acknowledgement did not reach this browser. Never clear site storage to resolve a network error.

## Bring in prior work safely

Use **My designs → Restore backup** with a `focus-design-library.json` file made by **Back up library**. Restore keeps existing designs and includes validated images and history. Older backups that omit image files may need the original browser before a complete backup can be made. Corrupt or incomplete images block restoration rather than silently dropping the image.

The working-page ZIP's `focus-project.json` is a developer source archive, not a library backup accepted by Restore backup. Online storage and downloaded backups share the current limits: 20 MB per library, 200 designs, 128 referenced images, and 750 KB per PNG/JPEG/WebP image. Browser storage limits can be lower. Keep downloaded originals when a restore cannot fit.

## Deliver the customer result

| Recipient task               | Delivery                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Open the website             | **Download working HTML** gives a single `index.html` with styles and the selected image embedded.                                                                                         |
| Edit or host the website     | **Download page ZIP** includes editable `index.html` and `styles.css`. Publish those website files; keep source archives and private history out of public hosting.                        |
| Continue editing in Focus    | **Back up library**, then **Restore backup** in the intended person's own workspace. A library may contain several designs and private history; review it before sharing.                  |
| Restyle an existing app/site | **Download existing-site pack**, then follow its `START-HERE.md`, preservation checks and `UNDO.md`. Trial one audited page and prove the same customer tasks still work before expanding. |

The website download does not create a booking service, payment system or contact backend. Its action leads to the real destination you provide. See `CUSTOMER-HANDOFF.md` for standalone page hosting and existing-site acceptance.

## Prepare an existing React or Next.js project with Target

Open **Target** from the main navigation. Choose a saved design and **Restyle an existing app or website**, then the GitHub React/Next.js path. Describe one page, the improvement a visitor should notice, the tasks that must keep working, the named backup, the isolated preview, and how the trial will be undone.

Target prepares one validated ZIP containing your selected design's actual tokens and project-specific instructions in `DESIGN.md`. Its prompts guide your coding tool through inspecting the repository, making a scoped change, testing and fixing it, demonstrating selective rollback, and preparing the change for owner review. Follow the included folder-collision instructions before extracting anything. A branch needs a preview with test accounts and sandbox integrations; it must not write to production data.

Target has no writable GitHub or hosting connection. **Prepared for a trial** means the pack is ready to be tried; it does not mean a change was applied, a task passed, or a release was approved. Target answers remain in this browser and are not included in online library copies. Download the pack and keep your project test evidence separately.

Use **Telescope** for a local built-file inventory and an exact-file receipt. Its files stay in the tab and are never executed or uploaded. Download its task plan before leaving. Use **Horizon** for previously recorded project progress; historical records do not certify the current app.

## Account and storage behavior

Use **Your account → Sign out** for full sign-out navigation. Your browser work is retained in a namespace belonging to that verified account. Returning under another account does not import it. Returning under the original account makes it available again. This isolation is not encryption against someone with access to the browser profile or device storage.

Focus verifies the signed-in identity before opening saved work. If verification is temporarily unavailable, it hides the workspace and pauses storage while preserving the current screen's work. Choose **Retry account verification** to resume only under the same account. A confirmed sign-out or account change requires a secure reload. Keep the same private app URL; another origin or browser has separate local storage. Do not use a personal backup to populate someone else's account without deliberately choosing to share that work.

Online saves contain full library snapshots in private hosted object storage. Normally the current and previous successful snapshot are retained; interrupted writes or cleanup failures may leave more. Removing browser work or signing out does not delete online copies. This version has no online-library deletion control or automatic expiry; contact the workspace operator for removal. The Privacy page describes these data boundaries.

## Available services

The studio, curated directions, page editor, local quality/review tools, signed-in measured public-site checks, library transfer, hosted online library, and customer downloads are available in this hosted edition when their respective service is reachable. Online storage failure is shown explicitly; downloadable backups remain available.

Paid AI generation and AI screenshot review are paused. Public share links, live Vision publishing, separate account profiles, synced progress and scheduled monitoring need a separately configured backend and are not configured here. Their absence does not prevent creating, refining, saving or exporting designs. Measured checks inspect bounded public source; they do not prove private app behavior or replace customer task testing.

## Release acceptance

Before handing over the URL, verify a clean signed-in recipient can create a design, upload a described image, save the library online, restore it in a second browser context, and download an independently working page. Test two identities on the same browser, stale revision conflicts, failed storage, invalid backups and account changes during requests. Verify both Chromium and Firefox plus a narrow screen. A local test server or fake identity response is not evidence that the deployed identity gateway and storage authorization work.

This document describes the intended workflow. It does not itself certify a deployed service or a completed test by the recipient. Keep the release's actual verification receipts alongside it.
