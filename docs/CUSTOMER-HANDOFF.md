# Customer handoff

A Focus design is handed over only when the receiving person has the right files and can use them independently. The working website, an editable Focus library, and the Focus application are separate deliveries.

## Give someone the website

In the finished design, verify the words, image description, and **Where should the main action lead?** field. Use an actual destination owned by the customer. The exported page links to its details when no valid destination is supplied; it does not create a contact form, checkout, booking system, or email service.

Choose the delivery that matches the recipient's task:

| Recipient's task | Download | What to do |
| --- | --- | --- |
| Open or review the page | **Download working HTML** | Send `index.html`. It includes the generated CSS and supplied image. Open it in a browser. |
| Edit or host the website | **Download page ZIP** | Extract the whole ZIP. Open `index.html` with `styles.css` beside it. Edit words in the HTML and appearance in the CSS. |
| Continue designing in Focus | **My designs → Back up library** | Send the JSON backup to the intended recipient. In their Focus browser, use **My designs → Restore backup**, open the restored design, and verify its words, composition and image. |

The page ZIP includes `focus-project.json`, an archival source snapshot for a developer. It is **not** a library backup accepted by Restore backup. The snapshot may contain earlier inputs and history. Keep it private. A library backup can include other designs and their images; review its scope before handing it to another person.

For a static host, publish `index.html` and `styles.css` from the extracted page ZIP. The supplied image is embedded in the HTML, so the original image file is not required. If a developer replaces it with a filename, include that image file too. The host, domain, and external action destination require their own setup. Visit the hosted URL and confirm the customer's actual destinations before sharing it.

Selected typefaces use local fallbacks unless the recipient provides licensed fonts. Both downloaded forms initially match the working preview. Editing exported files does not change the saved Focus design or previously downloaded copies.

Keep the original library backup until the receiving browser can open the design and display its image. Restore adds designs and keeps existing work; conflicting identities are copied and repeat imports do not duplicate identical entries. Older backups without image bytes may need the original browser. Recovery downloads preserve damaged original data for repair; they are not ready-to-import backups.

## Improve an existing website or app

Choose **Restyle my existing site or app** before finding a direction, or change the choice at the handoff step. The choice survives reload and can be undone without rewriting the brief. Choose **Download existing-site pack**. This works for private apps too; a public address or source upload is not required. The preview is a style study, and its sample copy is not a replacement for the customer's words.

Give the recipient the entire `focus-restyle/` folder and begin with `START-HERE.md`, `PRESERVE.md` and `UNDO.md`. Extract into a fresh directory first. Stop if the target already contains that folder or either Focus marker; an archive extractor can overwrite files, so a ZIP is not itself an installation safeguard. Keep a named backup that includes uncommitted work and record the original tasks and screenshots.

Load the namespaced tokens and one bridge appropriate to the actual compiled theme. Adding `data-focus-restyle` to one existing page wrapper exposes values; it does not activate theme remapping. Only after checking the affected components' foreground/background pairs, add `data-focus-theme="semantic"` to that same wrapper. Mixed fixed colors and inherited text need individual component work; leave semantic mapping off for them. Fonts, focus indicators, status colors, native controls, root-resolved aliases and outside portals need their own review.

Accept the trial only after the same forms, validation, saved values, navigation, permissions and other customer tasks still work on desktop, phone and keyboard, and the actual rendered contrast and layout are acceptable. Demonstrate rollback: remove the semantic marker, then the trial marker/imports and selectively restore any component edits. Retain unrelated changes. A downloaded pack, passing token ratios, or two screenshots alone does not prove preservation.

The public URL checker is optional and requires a configured account service. Its bounded public-source inventory cannot see private screens or runtime behavior; incomplete comparisons are labelled. For a private project, use the recorded task checks and your existing test suite. Ask the owner to review the one-page result before expanding it.

## Give a developer the Focus application

Extract the app source ZIP to a new directory. Follow the root `README.md` using Node 22.12 or newer, npm, and the included `package-lock.json`. Run `npm ci`, then the documented development or production-preview commands from that directory. An internet connection is needed to install dependencies. No API key, account or database is needed for the local studio.

The app source ZIP does not include anyone's browser data or hosted accounts. Transfer a library separately with **Back up library** and **Restore backup**. Browser data belongs to its exact origin: changing the hostname, scheme, port, browser or device can expose a different empty library. Back up before changing origins or clearing browser storage.

Cloud sync, hosted sharing, monitoring, production credentials and domain configuration are separate deployment work. The portable North Star kit is a separate TypeScript package; its README documents installation, evidence and measurement limits. Neither source package alone provisions a public service.

## Acceptance evidence

`scripts/test-customer-handoff.mjs` downloads the actual page ZIP from the UI for all five compositions, extracts it into a fresh temporary directory, and opens it in a fresh recipient browser context. Firefox uses `file://` in offline mode. Managed Chromium in this test environment prohibits local-file navigation; its extracted files are served by a temporary loopback host with all external requests blocked. No app server, browser storage, existing assets or package installation supplies the recipient page. It verifies retained words, image bytes and descriptions, loaded and editable CSS, editable HTML, working native links/disclosures, 320px reflow, zero remote requests and visual parity with the separately downloaded standalone HTML. Downloaded ZIP fixtures, screenshots and reports are under `artifacts/customer-handoff/<browser>/`.

This customer-page evidence is separate from the image-complete library transfer and recovery receipts, and from the final app-source extraction/install/build test. Consult `LAUNCH-READINESS.md` and `artifacts/VERIFICATION.json` for the final integrated release verdict. Fixture destinations are inspected rather than contacted; public hosting, real customer destinations, connected accounts and independent human review are not established by the fixture test.


Final observation on November 18, 2026: all five composition downloads passed in each engine against the separately extracted, installed and built production app at port 4284, with zero page errors and zero remote requests. The app extraction also passed `npm ci`, 479 tests, type checking, production build and the creation/export smoke flow. The source README and handoff harness passed ESLint. Each engine's `RESULTS.json` records its exact target; `SOURCE-MANIFEST.json` binds the delivered source to the tested installation.

The Root Cause Debugger follow-up also verified older-state migration, usable imported Undo/Redo, unchanged repeat imports, and blocked delivery for damaged images or a chosen image without a description. If image checks fail, replace the image from the original file or explicitly remove it for a text-only page.

The latest existing-project proof is `artifacts/existing-site-hardening/RELEASE.json`: 36 production transfer scenarios across two browsers, plus a fresh-install recipient trial. Guides and receipts are included in the release. Old diagnostic ZIPs and executable diagnostic artifacts are kept in the development workspace, not in the customer source package.
