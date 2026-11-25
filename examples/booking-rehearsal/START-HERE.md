# Rehearse a Focus handoff with River Kiln

This small pottery booking app runs on your own computer. It uses made-up class availability and a local practice service. No account, customer records, payment, or email service is involved. A colleague or coding assistant can run the commands with Node 22.12 or newer, npm, and Git installed.

## 1. Open the original

Extract the ZIP into a fresh folder. Open a terminal in the extracted `river-kiln` folder and run these commands. The first command downloads the locked development tools and React from npm.

```sh
npm ci --ignore-scripts
npm run build
npm run preview
```

Open the printed address beginning with `http://127.0.0.1`. Leave the terminal running. The preview includes the local booking service. Restarting it clears practice reservations.

Pick Wheel basics and read the total. Reserve a place using `river@example.test`. A reference number appears after the service accepts the request.

## 2. Choose a Focus design

In Focus, save a Vision, then open Target. Choose the saved design, **Improve an existing project**, and **GitHub · React or Next.js**. Describe the change and keep the original booking behavior on your list of things to protect. For backup, preview, and undo, use this separate practice copy, its local preview, and the proposal’s reverse patch.

At **Prepare the handoff**, open **Include a proposed code change** and choose **React with Vite**. Select the following two files from this project and enter their paths exactly.

| File               | Path in this project   |
| ------------------ | ---------------------- |
| Booking.tsx        | src/Booking.tsx        |
| Booking.module.css | src/Booking.module.css |

Inspect the heading, paragraph, and booking button. Choose whether to keep the page’s type or bring the saved Vision’s available typefaces. Try both class pickers. The compact version shows the selected class's total. The comparison shows each class with its time and total before anyone chooses. For a first rehearsal, select the portable type and the comparison. Confirm the parts and prepare the edits. Download the proposed changes and extract that ZIP into a separate empty folder beside `river-kiln`.

## 3. Apply, use, and undo

Give your colleague or coding assistant the proposal's `START-HERE.md`. It has the exact verifier and patch commands. Use those checks before and after applying and reversing. Run `npm run build` after each change. Restart `npm run preview` and reload the page to see the current version. The app prints its local address each time.

At the original, changed, and restored versions, use the same checks.

1. Use the keyboard to choose Glaze studio. Read its $56 total and submit a made-up address. When the class fills, select Wheel basics. Your address stays and the total changes to $48.
2. Open **Practice conditions** and select **Lose the first confirmation**. Use a fresh made-up address and reserve Wheel basics. The first reply reports uncertainty. Submit again with the same details. You receive one reference. Reload, repeat the same booking and check that the reference stays the same. Under **Practice conditions → Check saved reservations**, count reservations for that address. The count must be exactly one. Record a failed trial if it differs. Restarting the preview clears its records, so check before you restart.
3. Compare the heading, body, and button on a phone-sized and wide screen. Verify that you can see keyboard focus and reach the booking result. For a portable font trial, use the browser's rendered-fonts inspector to check the selected typeface on all three elements. The CSS family name alone can still appear when a browser draws a fallback.
4. After applying the change, add a line to a new file named `studio-notes.txt`. Run the proposal’s verifier before undo. Confirm that the original picker and appearance return, the added font and license files are removed, and your new line survives. If a touched file has changed since the proposal was made, stop and review the differences with your colleague.

## 4. See how someone uses the design

For a human comparison, open **Review Room** in Focus and use the booking pilot. Use the same task on each version: choose the lower-priced class, state the total, and finish one booking after a lost confirmation. Keep the recovery setting, content, and device equivalent. Use fresh made-up addresses. Let the participant work, then record what happened, including help and first-attempt mistakes. Check the saved count afterward. The technical rehearsal and a person’s observations are separate results.

The practice page uses local reservations only. Success here is evidence for this sample. A customer project needs its own private preview, test service, and acceptance checks.
