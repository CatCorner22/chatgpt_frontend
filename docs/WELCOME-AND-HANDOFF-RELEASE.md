# Welcome guide, Reverie identity, and customer handoff hardening

Release status: prepared for acceptance; held from production while browser testing is unavailable.

## Experience

The approved Focus archer and Vision painter replace the old geometric logo. Reverie also appears with a design book and handoff parcel. These illustrations belong to Focus, never to the customer's exported website.

The home page and Explore menu open `/welcome`, an eight-step guide from first use through public-page review, existing-project design, pack extraction, a staged trial, task testing and selective rollback, and an owner-reviewed release. Each step explains the next action, with links to the relevant tool and an optional downloadable trial checklist. Reading progress resumes locally within the hosted owner's storage namespace. Storage denial leaves the session usable and visibly reports that progress cannot be saved. Tour completion does not create release evidence or mark a customer project safe.

Focus's existing-site review reads bounded public HTML and stylesheets. It does not attach a writable CMS/repository account, execute the customer's scripts, submit forms, install the exported files or deploy the customer site. Private apps can use the design handoff without making staging public. Applying changes happens in the customer's own authorized tool on an isolated copy, with sandbox integrations.

## Confirmed fixes

- Export validation rejects additional global selectors, direct visual properties and removed semantic opt-in. Only the intended scoped custom-property contract passes.
- Exported/pasted restyle styles cannot activate on `html` or `body`, even if a caller mistakenly puts the opt-in markers there. `:where` retains the original specificity on legitimate wrappers.
- Muted text falls back to the validated body-text color when the secondary-surface pair would fall below 4.5:1.
- Relative stylesheets use the validated final page URL after redirects.
- Guides and tool messages explicitly require isolated staging/local previews, test integrations, customer-file preservation, task evidence, selective rollback and owner-reviewed deployment.

## Verification boundaries

Pass 1: independent code and safeguard review, plus regressions that failed before the confirmed fixes.

Pass 2: real generated ZIP bytes are checked and extracted into a disposable customer fixture; original source/config/rules/auth/data hashes remain unchanged. An exclusive fresh-folder procedure refuses repeat extraction before writes. Selective rollback preserves unrelated later edits. Mocked network tests confirm GET-only public HTML/CSS requests without customer credentials, script execution, form submissions or unlimited stylesheet fan-out. These tests verify the documented procedure; they do not make generic ZIP extractors overwrite-proof.

Pass 3: **blocked**. The managed preview relay timed out and the supported browser failed initialization. No current rendered-page, real browser download, real colleague sign-in, customer-specific authenticated workflow or cross-device test is claimed. `design-qa.md` records the blocker and acceptance checklist. The previous live version remains in place; saving a candidate version is not production deployment.

Before production release, test the guide and export from the actual browser, verify desktop/phone/tablet and keyboard operation, exercise the complete transfer on an isolated representative customer app, and demonstrate selective rollback. Before using any transfer on a customer's live app, repeat the task-specific checks for that app and obtain its owner's release acceptance. No automated score or generic test suite can guarantee an arbitrary app has no defects.

Runtime keys, Site audience, customer storage and database schemas are unchanged. Paid AI remains paused. Existing dependency advisories and hosted-edition limits in `HOSTED-VERIFICATION.md` still apply; this update is not a new penetration test or a clean security-audit claim.
