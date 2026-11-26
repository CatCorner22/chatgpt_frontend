# Run a River Kiln booking comparison

For the organizer. The kit contains two working practice booking pages and a review room. It records observations from people who actually use both pages. Bookings use made-up addresses and stay on the computer running the study. You can disconnect from the internet after downloading the kit and installing Node.js 22.12 or newer.

## Set up a participant

1. Extract the entire ZIP into a writable folder. Open a terminal in the extracted folder, where you can see `start.mjs`.
2. Run `node start.mjs`. The launcher checks the supplied files, starts both practice services, and prints a **Reviewer URL**. Keep the terminal open.
3. Open the Reviewer URL in a browser on that same computer. Give the participant a unique anonymous code. Keep their real name, contact information, and the organizer files out of the review. For a remote colleague, have a facilitator run their copy on the colleague’s own computer. The loopback address printed by your computer works only on your computer.
4. Give the participant the browser window and the directions inside the review room. The two pages are presented in shuffled order. For each page, use a different invented address ending in `@example.test`. Under **Practice conditions**, turn on **Lose the first confirmation** before starting the timer. Keep the same device, viewport, task and assistance policy for both pages.
5. When the participant finishes each visit, record their observations. To check how many reservations were saved for the practice address, open **Practice conditions → Check saved reservations** on that same page. Leave unavailable measurements blank. Have the participant export the answers JSON before closing the terminal. Give that file to the organizer.
6. Press **Ctrl+C** to stop the servers. To start a new participant, run the launcher again and use a new anonymous code. A new launch creates fresh practice reservations, URLs and a shuffled sample order. Browser drafts belong to the session address, so preserve the exported file before relaunching.

The full kit is intended for the organizer or local facilitator. The private folder, source files, scoring tool and archive contents identify the two samples. During a blinded session the participant needs only the browser and their anonymous code. Neutral labels cannot guarantee that someone familiar with the project will be unable to recognize a design.

## Read the results

After downloading the primary answers, participants can optionally say which booking page they would use again. They can choose either sample, express no preference, or mark that they could not compare them. The ballot downloads separately. Keep the primary JSON file exactly as downloaded. If you include ballots in the scoring command, include each ballot’s matching primary file too. The scorer reports counts for both samples, both abstention choices, and eligible reviewers who returned no ballot. A preference does not establish success on the booking task or identify who designed a page.

From the same extracted kit, pass the saved answers files to the bundled scoring tool. Quote each path containing spaces.

```sh
node score.mjs "/path/to/first-answers.json" "/path/to/second-answers.json"
```

The command prints the paired observations and saves a new report under `private/`. It leaves the exported answers available for later checks. Keep original answer files and use the same kit version for everyone in a given study. The results describe the participants who used both pages. A separate study is needed to compare the redesign with an independent expert build.

## Reproduce the two pages

The original and the Focus redesign were built from the existing River Kiln colleague kit. The redesign applies its verified Git patch to the original. Both run the same local booking service. The study has a common frozen input ZIP, an archive of each served build, a source receipt and the organizer mapping under `private/`. Type, font license and booking retry evidence for the source trial travel with the separate redesign handoff kit. The organizer file records unknown authoring effort as unmeasured.
