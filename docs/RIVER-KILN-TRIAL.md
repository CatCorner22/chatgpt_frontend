# Try the River Kiln redesign

This kit lets a colleague run a working booking app, apply a Focus redesign, and undo it. All bookings use made-up addresses on the colleague’s computer. You need Git, npm, and Node 22.12 or newer.

1. Extract `01-original.zip` and `02-focus-proposal.zip` into sibling folders. Keep the original and the proposal separate. The original contains `river-kiln`. The proposal contains `focus-source-trial`.
2. Open `river-kiln/START-HERE.md` and follow **Open the original**. You’ll see the compact class picker. To use the included redesign, go directly to **Apply, use, and undo**. To make a different proposal, use **Choose a Focus design** first.
3. Use the commands in `focus-source-trial/START-HERE.md` on a fresh copy of River Kiln. Rebuild and open that copy. You can now compare both class times and totals before choosing. The sample proposal brings Instrument Sans for the heading, introduction, and booking button.
4. Turn on the lost-confirmation practice condition, reserve the lower-priced class, and retry. Under **Practice conditions → Check saved reservations**, look up your practice address. The count must be exactly one. Record a failed trial if it differs. Check before stopping the preview because its practice records are held in memory.
5. Before undo, add a line of your choice to a new file named `studio-notes.txt` and record its exact text. Follow **Selective undo** in the proposal guide and rebuild. The compact picker returns. The verifier checks the two original source files and the absence of the added font and license. Open `studio-notes.txt` and compare it with the line you recorded. Mark the trial failed if the file is missing or the text differs.

The `evidence` folder shows what happened in the automated Chromium rehearsal. To find out how people fare, open **Review Room → Open private organizer workspace → Compare original and redesigned booking** in Focus. Give each person the same brief and neutral sample addresses. Keep this answer guide and the screenshots with the organizer.
