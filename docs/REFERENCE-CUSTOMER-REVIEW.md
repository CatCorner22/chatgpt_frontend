# Customer review for the reference-design pass

The current page/export path works; the next pass should remove two observed editing snags and make recovery and handoff clearer.

Reviewed on 2026-11-18 for the person building the next version of Focus. This is a simulated customer review, not interviews, customer research, or evidence that a page works for a particular neurodivergent person. No application code changed during this review.

## Evidence and assumed customers

**Real task facts:** the user supplied Audi.com and Firehouse.com as quality references. This reviewer did not inspect those sites; no finding below claims anything about their design. The root review owns that comparison. Existing project documentation and the current editor/export code were read. No customer interviews, support messages, or usage data were supplied for this pass.

| Customer perspective | Facts and expectations |
| --- | --- |
| Small-business owner | **Assumed:** uses a laptop, has little web-development experience, wants a finished page and fears losing work. Uses words such as “photo,” “page,” “button,” and “publish.” May leave when an action appears to do nothing or a download leaves the next step unclear. |
| Receiving frontend engineer | **Assumed:** edits the exported files and deploys to existing hosting. Expects named source files, working relative paths, truthful content, and findings tied to the reviewed version. May distrust unexplained differences between preview, source, and review evidence. |

These perspectives were reviewed independently before comparing them with implementation evidence. Their expectations are assumptions, not observations of actual customers.

## Findings

| Severity / evidence | Customer and exact step | Expected result | Observed result | Recommended change and acceptance check |
| --- | --- | --- | --- | --- |
| **Friction — browser observed** | Owner, completed design; clicks **Edit the page’s words**. | An editor appears where the owner can see or reach it. | The first field opened at viewport y=1550 in a 1000px-tall window. Focus and scrolling did not move to the editor. | Move focus to the first field and reveal the editor without unexpected motion. Verify with pointer and keyboard at desktop and 320px. Preserve the preview position when closing. |
| **Friction — browser observed** | Owner, valid small PNG; uploads before writing its description. | The photo appears, or the missing requirement is stated next to the field. | The file was saved, but the preview contained no image until a description was entered. The label did not say it was required. The readiness note said **2 MiB**, while the upload control accepts **750 KB**. | Label the description requirement clearly and use the uploader’s actual size limit. Give a specific next step: “Add an image description to show this photo.” Verify that entering it reveals the same saved image without another upload. |
| **Friction — observed UI, assumed comprehension risk** | Owner or engineer, ready to export. | Understand which download fits the next task and whether the page is public. | Buttons say **Download working HTML** and **Download page ZIP**. The ZIP contains useful instructions, but the choice is unexplained before downloading. No publishing action happens. | Explain beside the buttons: one HTML file opens on its own; editable ZIP contains HTML, CSS, and project source. State that downloading saves files and does not publish the page. Verify that a reviewer can choose the correct format from the visible text. |
| **Friction — code-reviewed recovery gap** | Owner moves to another browser or loses browser storage after exporting. | Reopen the design and its image for further editing. | The ZIP includes `focus-project.json` and its embedded image. No importer for this format was found in the reviewed app; the library offers downloads and restoration of versions already stored in that browser. | Either add a validated project import, or clearly describe the JSON as source for an engineer and the current recovery limit. Test restoration in a fresh browser, including a missing image and an unsupported file version. Do not imply that a source backup can already be reopened. |
| **Friction — browser observed** | Owner enters `booking.example.com` as the main destination. | Learn why the button is not using that address and how to correct it. | The page fell back to `#details`, with a general readiness note naming accepted URL schemes. Entering `https://example.com/book` corrected the export. | Put the message beside the destination field, connect it with `aria-describedby`, and give an example with `https://`. Preserve the entered value so it can be corrected. |
| **Polish / future acceptance criterion — code-reviewed** | Engineer imports an audit receipt, then changes or re-exports the page. | Know which export the observations describe. | The import correctly labels caller-supplied evidence and shows target/date; the reviewed format does not bind findings to the exported content. | Include an export identifier or content hash in the handoff and audit workflow. Keep old receipts readable, but describe them as observations of that recorded version. Never infer a repair from a missing finding. |

Evidence: [browser observations](../artifacts/reference-customer-review/observations.json), [desktop capture](../artifacts/reference-customer-review/desktop.png), [320px capture](../artifacts/reference-customer-review/mobile.png). Relevant implementation: `src/components/AuthoredPagePanel.tsx`, `src/components/ContentEditor.tsx`, `src/lib/page-settings.ts`, `src/lib/authored-page.ts`, `src/routes/library.tsx`, and `src/components/BrowserAuditPanel.tsx`.

## Customer done-when results

| Observable result | This pass |
| --- | --- |
| Start signed out, choose a direction, complete the short flow, and reach a working page. | **Observed.** Fresh browser session completed the flow without page errors. |
| Change composition and retain entered words and the selected image. | **Observed.** Editorial → Product retained both. |
| Recover from an invalid image replacement without losing the last valid photo. | **Observed.** A 750,001-byte replacement produced a useful error and retained the previous image. |
| Add a valid action address and find it in the output. | **Observed.** Invalid-address fallback and correction both behaved as described. |
| Receive usable source, with real words and image data. | **Observed.** Standalone HTML included the edited brand, headline, image, destination, and stylesheet. ZIP contained `index.html`, `styles.css`, `README.txt`, and `focus-project.json`; its HTML linked to its CSS. |
| Reload and continue editing. | **Observed.** Product composition, words, and image remained. Recovery in a different browser is not supported by the reviewed import UI. |
| Use the editor at 320px without page-wide sideways scrolling. | **Observed.** Document width and viewport width were both 320 CSS px. This is not a complete mobile usability assessment. |
| Make a correction, export again, and know which audit matches it. | **Not established.** Add version binding and test the full correction loop. |

## Conditions for adding showcase or journal layouts

Give each choice a purpose and a short description of its sections. Preserve entered content and images when switching; show any content the new layout does not use. A new composition should change structure meaningfully, not just color or spacing.

For a showcase, verify image placement and crops on phone and desktop, allow an image to be replaced or removed, and keep the main action useful without a photo. For a journal, model article destinations and any byline/date/category fields explicitly; omit missing metadata instead of inventing it. Keep sample content labelled. Do not promise a publishing system if the output is a static page.

Before release, repeat the same content-to-download check for every new composition, open both exports independently, test a local CSS edit, and run the browser audit on that exact exported file. Follow with human review of content, imagery, reading order, and the intended task.

## Not tested

No actual customer sessions, assistive-technology task study, intended neurodivergent-user study, production publishing, real booking/email action, cross-browser visual comparison, full storage-quota failure, or imported-project recovery was performed. The supplied reference sites were not inspected by this reviewer. The screenshots document editor state, not a claim that the result matches those references.
