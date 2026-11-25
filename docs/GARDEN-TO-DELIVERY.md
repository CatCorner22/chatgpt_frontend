# From a Garden decision to a working redesign

## Start in the Garden

Open a Garden stop and write a journey brief. Record who will use the page, what they need to accomplish, what happens today, and what must keep working. Attach the brief to a saved design. Each stop lets you record an approach and its consequences. The learning preference stays in this browser. The brief travels through its own JSON download, My designs backups, and the saved library’s online copy. If two incoming copies of a design have different briefs, restore preserves both.

In Vision or Stratosphere, compare compositions with your own material at phone and desktop sizes. Selecting a composition changes the authored page and supports Studio Undo. The editable website ZIP and standalone HTML use the same renderer. The related-reading editor supports a second image, an actual destination, credit text and separate phone framing. In Vision, open **Study a two-image editorial example** to find a self-contained Hokusai library sample made with Open Access images from The Metropolitan Museum of Art.

## Practice the existing-app handoff

A colleague can start with the [ready-to-use River Kiln kit](examples/river-kiln-colleague-kit.zip). It includes the original app, the exact Focus proposal used in the rehearsal, phone and desktop screenshots, and a read-only receipt. [Recipient rehearsal results](examples/river-kiln-recipient.json)

1. Open Target and expand **Practice with a pottery booking app**. Download and extract the River Kiln project. Its guide starts a local booking service using made-up customer details.
2. In Target, choose your saved design and the existing-project path. Bring the changes you want and the behavior you need to preserve from your Garden brief. The standard handoff can include this brief for a colleague or coding assistant.
3. Select the page and its CSS module. For a supported React/Vite page, Target offers to keep the page’s type or package the Vision’s licensed Latin font files. In the recognized River Kiln form, preview the compact picker and the comparison showing both times and totals. Select the treatment and prepare the proposal. Its guide verifies the original files and any new asset paths before applying to an isolated copy.
4. Build the changed app. Look up Wheel basics, read the price, and reserve a place. Select a full class and exercise the lost-response scenario in the practice guide. Use **Practice conditions → Check saved reservations** to read the stored count for the made-up address. Check keyboard operation at a narrow width. For portable type, inspect the heading, paragraph and action in Chromium’s **Computed → Rendered Fonts** section.
5. Rehearse reversing the change while preserving other work. The optional GitHub helper can open a draft pull request when the recipient explicitly shares the reviewed change. A hosted preview requires the repository’s own preview workflow. Next.js uses the developer-guided handoff.

## Check what a colleague actually receives

Quality Lab imports the browser runner’s reports. The runner can sample widths on both sides of layout changes, record where keyboard focus went, and collect mobile timings. A file comparison matches a standalone HTML download to the bytes the runner received. A page with external assets needs separate checks of those assets. [Browser runner](AUDIT-RUNNER.md)

In Review room, the organizer can prepare a matched comparison between a one-shot build, a guided build, and independent expert work. Give each builder the same brief and assets. Mask the finished samples for reviewers. The resulting report shows each task and its observed gap, including how many comparable observations support it. Actual participants, independent work, and running the original customer tasks are required for a claim about people. [Benchmark guide](BENCHMARK-REVIEW.md)

For this booking change, use the two-version booking pilot. Present the original and the Focus version at neutral addresses, with the same content, device and practice conditions. Ask the participant to pick the lower-priced class, state its total and finish one booking after a lost confirmation. Have an observer record choices, time, help and the stored count. Missing observations stay unmeasured. The three-way pilot adds an independent expert build when one is available.

**Ready to run a session?** In Review Room, open the private organizer and choose **Download the ready-to-run study**. Extract the ZIP and run `node start.mjs` on the participant’s computer. The launcher prints a local reviewer link, opens two separate practice services, and provides a shuffled reviewer packet. An organizer can combine the downloaded answer files with the included scoring command. [Download the study](../public/examples/river-kiln-booking-pilot.zip) · [Organizer instructions](RIVER-KILN-PILOT.md)

To repeat the automated recipient checks, start Focus on a local preview bound to `127.0.0.1`, then run `npm run test:booking` and `npm run test:pilot` in another terminal. Set `FOCUS_TEST_URL` to the preview’s address if its port differs from 3000. The booking rehearsal retrieves both ZIPs from Target, builds and uses the customer's project in three states, checks actual glyph rendering, and saves its receipt and screenshots under `artifacts/booking-rehearsal/`. The pilot rehearsal uses synthetic answers to verify the review workflow.
