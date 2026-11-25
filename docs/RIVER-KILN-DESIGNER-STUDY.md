# Compare two River Kiln booking pages

**For the organizer.** Give the independent designer only `river-kiln-builder.zip` from the private organizer workspace in Review Room. It contains a working React starter, one phone booking task, both class times and prices, the same local service, and an optional licensed typeface. Keep the full study, Focus build and this guide private.

The Focus candidate replays a previously delivered proposal on the shared starter. Its original designer effort and revision count are unknown. This first pilot compares the resulting pages. Record any difference in tools, time, prior exposure or assistance alongside the designer's returned work.

## Prepare the pair

Use a checkout of the Focus project with its dependencies installed, Node 22.12 or newer, npm and Git. Run this command from the project directory.

```sh
node scripts/build-booking-pilot.mjs --prepare-designer
```

The command prepares `artifacts/booking-pilot/designer/river-kiln-builder.zip` and a private frozen Focus submission. The shareable ZIP must match the one supplied to the designer byte for byte. Each builder starts with the same copy, starter, service and font. The Focus proposal is applied only to its own copy. The two page builders should work independently.

Ask the designer to return the compiled `dist` folder and completed `submission.json` described in the brief. Privately verify their experience, independence, tools and permission. Review their source and the working page against the supplied class data and service. The assembler reads static files and uses the study's own service on both sides. A submitted declaration records what the builder reports.

```sh
node scripts/build-booking-pilot.mjs --designer "/path/to/dist" "/path/to/submission.json" "/path/to/new-local-study.zip"
```

Extract the resulting ZIP into a fresh folder, open a terminal beside `start.mjs`, and run `node start.mjs`. Inspect both pages once for creator names, origin clues, working keyboard input, correct data and retry behavior. End this rehearsal with Ctrl+C. Start again with a fresh service and a unique anonymous code for each participant. Give each person only the printed **Reviewer URL** in a browser on that computer. The URL uses loopback and the two practice services use separate stores.

## Run one visit

1. Keep both pages at the same viewport (target 390 × 844), with the same device and assistance policy. Use the displayed order and a fresh invented address on each page. The launcher shuffles the pair per session. Record the actual order and any deviation. Allow a break between pages.
2. Set **Lose the first confirmation** and collapse **Practice conditions** before handing over the page. Ask the participant, “Find the lower-priced class, say its total, and reserve it. If confirmation is lost, recover the booking.” Start timing after setup. Stop when the participant finishes or chooses to stop. Record the first class and response, price spoken before submission, assistance and time. Check the saved count for that address after the attempt. Leave anything unobserved blank.
3. Have the participant record completion, ratings and any notes for each page, then download the primary answer file. Preserve this file. Afterward they can export a separate preference ballot or skip it. The ballot can name a page, express no preference or say the person could not compare.
4. From the extracted kit, run `node score.mjs "/path/to/answers.json" "/path/to/optional-ballot.json"`, adding every returned file for this pilot. Keep the actual participant count and each measure's paired denominator. Read task completion, first choice, price, help, recovery, duplicate saves and time beside the craft ratings. The separate ballot reports preference after the primary export. This is a descriptive comparison of one task and two pages.

## A separate five-minute walk through Focus

Do this after both primary answers and any preference ballot are saved, or with a different person. The Garden belongs to Focus and showing it before the blind review could influence their judgments. Open Focus in a fresh browser profile. Use an empty practice project.

| Ask the person                                                                                | Record privately                                                                                                                         |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| “Suppose you run this pottery studio. Show me where you'd start to improve its booking page.” | First action, time or help needed to find **Existing app or website** and **Continue**.                                                  |
| “What do you think happens next? What did you notice about your guide?”                       | Their own words about Reverie and the Garden Path, including anything distracting, warm, confusing or helpful.                           |
| “Find more detail about a choice. Come back to the short version when you're ready.”          | Whether they independently open and close **See the choices and tradeoffs** or a **Learn** panel and can name the next step.             |
| “If you wanted finer control over type or spacing, where would you look?”                     | Whether they can follow the path to the relevant controls, return to the Garden, and distinguish exploration from a saved design change. |

Capture exact words with permission, the point where help was requested, the device and anonymous code. Keep these walkthrough notes outside the booking ratings and preference ballot.
