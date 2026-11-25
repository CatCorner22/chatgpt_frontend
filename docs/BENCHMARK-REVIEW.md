# Run a real blinded review

The review room at `/review-room` collects ratings for supplied samples. It does not contain pretend human references or pretend participant results. The organizer CLI prepares files and combines real downloaded answers after collection.

Run commands from the application directory after `npm install`. The application requires Node 22.12 or later. The CLI uses the application's existing Rolldown installation to compile the trusted TypeScript helpers temporarily; it adds no dependency to the portable kit and does not execute imported JSON as code.

## 1. Start with the six-task draft

```sh
node scripts/north-star-benchmark.mjs init benchmark/organizer.json
```

This writes a draft with six matched tasks: service booking, editorial reading, product comparison, a workspace action, form-error recovery and data investigation. It includes proposed pilot counts and decision thresholds. They are builder recommendations, not validated standards or proof of study power. The `samples` array starts empty.

Obtain each candidate and a genuinely independent human reference built from the same task brief, content, data, assets and viewport. Record actual permission and provenance. Edit `samples` in the organizer file to add two records for every task. Each sample needs:

| Field            | What to record                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| `id`             | A unique opaque identifier that does not reveal source group             |
| `taskId`         | The matching task ID in the draft                                        |
| `assetRef`       | An actual HTTP/HTTPS address reachable by reviewers, with a neutral path |
| `kind`           | `interactive` for a working page or `image` for a static image           |
| `group`          | `spec` for the candidate or `human` for the independent reference        |
| `creatorCode`    | An organizer-only creator code                                           |
| `provenance`     | Actual source, permission and evidence of how the work was made          |
| `artifactSha256` | The frozen artifact's SHA-256 digest before registered collection        |

The same artifact hash or creator code cannot stand in for both groups of a registered pair. The CLI validates recorded hashes but does not download or hash remote assets; compute the hash from the actual fixed artifact through your existing build process. For a multi-file interactive build, define and record a consistent archive/build-hash procedure.

Keep this organizer file private: it contains the source-group mapping and study criteria. Before a confirmatory study, settle recruitment, sample selection, thresholds, fixed collection size, missing-data handling and stopping rule; freeze the artifacts and record an external preregistration. Setting `status` to `registered` requires those fields, but cannot itself prove preregistration occurred honestly. A practical pilot should remain a draft while you debug the process.

## 2. Make neutral reviewer packets

```sh
node scripts/north-star-benchmark.mjs packet benchmark/organizer.json benchmark/reviewer-01.json
```

The default uses system randomness to shuffle sample IDs. It exports only neutral sample references, tasks and rating anchors; creator codes, group labels, provenance, hashes and thresholds are omitted. Each reviewer can receive a separately ordered packet for the same benchmark. For a preplanned counterbalanced order, write a JSON array containing every sample ID exactly once, then run:

```sh
node scripts/north-star-benchmark.mjs packet benchmark/organizer.json benchmark/reviewer-02.json --order benchmark/order-02.json
```

The review room preserves the supplied packet order when creating a session and stores that order with the local draft for reloads. It does not reshuffle a planned order. The organizer defines the actual allocation and counterbalancing plan. Inspect IDs, URLs, images, browser titles and visible page content for origin clues. The schema rejects some obvious source words in sample identifiers and paths, but cannot certify successful blinding.

## 3. Collect actual answers

Start the app and open `/review-room`. Give a reviewer only the neutral packet. They import it, enter an arbitrary unique reviewer code, inspect each sample individually and save their ratings. Six dimensions use anchors at 1, 4 and 7. An interactive page can receive an interaction score and a reported task outcome; an image leaves interaction unscored and task outcome untested.

Before any optional side-by-side discussion, download the completed primary answer bundle and have the organizer retain that file unchanged. The review room allows draft answers to be edited; preserving the exported primary record is an organizer responsibility. A reviewer code is not a person's name or proof of independence; the organizer manages recruitment and code allocation separately. Do not reuse a code for two people. The room keeps its local draft in the current browser and does not send participant answers to a server.

## 4. Merge and evaluate after the fixed endpoint

```sh
node scripts/north-star-benchmark.mjs score benchmark/organizer.json benchmark/report.json benchmark/answers-01.json benchmark/answers-02.json
```

Pass every collected answer file explicitly. The CLI rejects foreign benchmark IDs, unknown samples and duplicate reviewer/sample ratings. It never silently drops duplicates or invents missing answers. It also refuses to overwrite any existing output file; choose a new filename to preserve the original record.

The JSON report separates quality noninferiority, absolute quality floors, reported task completion, and attribution-rate equivalence. It reports reviewer counts separately from rating counts and shows individual task differences. Missing reviewers, incomplete records, a draft protocol, the wrong fixed sample count or missing primary evidence prevent confirmation.

The conservative simultaneous intervals will ordinarily leave a small pilot inconclusive even if ratings look similar. Inconclusive is not a poor-quality verdict. Use the pilot to identify weak tasks and estimate variation, then preregister an appropriately planned confirmatory analysis with reviewer and page dependence addressed. A result for this panel cannot prove that all future frontends are indistinguishable from work by talented people.

Detailed design and statistical assumptions: [benchmark protocol](../north-star-kit/blind-test/PROTOCOL.md). Pure APIs and data contracts: [kit README](../north-star-kit/README.md).

## Verify the tooling

```sh
node --test scripts/benchmark/cli.test.mjs
cd north-star-kit
npm test
npm run typecheck
```

Regression tests use clearly synthetic fixtures to check software behavior. Their fabricated numbers are never used as participant-study evidence.

## Compare one-shot, Focus, and independent expert work

Run `npm run benchmark -- init-pilot organizer.json` for the booking and editorial briefs. The draft has a unique study ID and empty samples. Prepare one folder of approved words, images, rules and constraints per task, archive it once, and give the exact same archive to each builder. Retain the archive and its SHA-256. Start a new pilot ID for a subsequent brief or revised set of builds.

For each task add three samples with the usual neutral ID, taskId, web address, presentation kind, creatorCode, provenance, and frozen artifactSha256. Use the group values `one-shot`, `guided` (Focus), and `expert`. Set `inputsSha256` to the digest of the shared input archive. In `work` record `tools` (text), `minutes` (elapsed production minutes) and `revisionPasses` (a whole number). A one-shot build has zero revision passes. The expert works independently of both other builds. Document permissions and any differences in time or tools in provenance.

Use the existing packet and score commands above. The Review room accepts these packets and hides the group, time, tools and hashes. The organizer report compares ratings within one task and reviewer across all three builds. A positive remaining gap measures how far the expert scored above Focus. Missing task observations stay empty. Each metric reports its own reviewer count. Use a fresh matched brief after repairing a weakness. The registered two-group procedure remains available for a separate confirmatory study.

## Compare Focus with one independent designer

The River Kiln organizer guide prepares a two-page booking pilot. Give the designer only the shared starter and brief. Their returned build and permission record complete the pair. Use the bundled scorer for primary observations and the optional preference ballot. [Organizer guide](RIVER-KILN-DESIGNER-STUDY.md) · [Shared starter](examples/river-kiln-builder.zip)
