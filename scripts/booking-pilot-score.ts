import { createHash, randomUUID } from "node:crypto";
import { open, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  blindEvaluationBundleSchema,
  type BlindEvaluationBundle,
} from "../north-star-kit/blind-test/reviewer";
import {
  bookingPreferenceSchema,
  type BookingPreference,
} from "../north-star-kit/blind-test/booking-preference";
import { pilotManifestSchema, scorePilot } from "../north-star-kit/blind-test/pilot";

const usage = 'node score.mjs "/path/to/answers.json" [other-answer-or-preference-files.json]';

async function readJson(path: string | URL) {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || !info.size || info.size > 2 * 1024 * 1024)
      throw new Error("Choose a nonempty JSON file of up to 2 MB.");
    const bytes = await file.readFile();
    return {
      data: JSON.parse(bytes.toString("utf8")) as unknown,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    await file.close();
  }
}

async function score(paths: string[]) {
  if (!paths.length || paths.includes("--help")) {
    console.log(usage + "\nUse the answer files downloaded at the end of the review.");
    return;
  }
  const organizer = pilotManifestSchema.safeParse(
    (await readJson(new URL("./private/organizer-template.json", import.meta.url))).data,
  );
  if (!organizer.success || organizer.data.protocol === "matched-three-v1")
    throw new Error("Open the scoring tool from the original River Kiln study kit.");

  const answers = [];
  const originals = new Map<string, BlindEvaluationBundle>();
  const ballots: BookingPreference[] = [];
  for (const path of paths) {
    const { data, sha256 } = await readJson(path);
    const preference = bookingPreferenceSchema.safeParse(data);
    if (preference.success) {
      ballots.push(preference.data);
      continue;
    }
    const bundle = blindEvaluationBundleSchema.safeParse(data);
    if (!bundle.success || bundle.data.benchmarkId !== organizer.data.id)
      throw new Error("An answer file is invalid or belongs to a different study.");
    if (!bundle.data.evaluations.length)
      throw new Error("This answer file contains no completed reviews.");
    originals.set(sha256, bundle.data);
    answers.push(...bundle.data.evaluations);
  }
  const report = scorePilot(organizer.data, answers);
  const comparisonGroup = organizer.data.protocol === "booking-designer-v1" ? "expert" : "original";
  const preferences = { [comparisonGroup]: 0, guided: 0, noPreference: 0, couldNotCompare: 0 };
  const voters = new Set<string>();
  for (const ballot of ballots) {
    if (voters.has(ballot.reviewerCode))
      throw new Error("Each reviewer can cast only one preference ballot.");
    const bundle = originals.get(ballot.answersSha256);
    if (
      ballot.benchmarkId !== organizer.data.id ||
      bundle?.evaluations.length !== 2 ||
      !bundle.evaluations.every(
        (row, i) =>
          row.reviewerCode === ballot.reviewerCode && row.sampleId === ballot.sampleIds[i],
      )
    )
      throw new Error(
        "Include the exact completed answers file that accompanied each preference ballot.",
      );
    voters.add(ballot.reviewerCode);
    const choice = ballot.choice;
    if (choice.kind === "sample") {
      const group = organizer.data.samples.find((sample) => sample.id === choice.sampleId)?.group;
      if (group !== comparisonGroup && group !== "guided")
        throw new Error("The preference names an unknown sample.");
      preferences[group] = (preferences[group] ?? 0) + 1;
    } else if (choice.kind === "no-preference") preferences.noPreference++;
    else preferences.couldNotCompare++;
  }
  const output = new URL("./private/results-" + randomUUID() + ".json", import.meta.url);
  const eligible = report.counts.completeReviewers;
  const reportPreference = ballots.length > 0 || comparisonGroup === "expert";
  const result = reportPreference
    ? {
        ...report,
        secondaryPreference: {
          eligibleReviewers: eligible,
          ballots: ballots.length,
          unanswered: eligible - ballots.length,
          ...preferences,
        },
      }
    : report;
  await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  console.log("\nRiver Kiln booking comparison");
  console.log(report.counts.completeReviewers + " reviewer codes with both versions recorded.\n");
  const measures = report.tasks[0]?.bookingObservations;
  if (measures) {
    const rows = [
      ["Completed the task (self-report)", report.tasks[0]!.taskCompletion, true],
      ["Chose the lower price first", measures.firstChoiceCorrect, true],
      ["Stated the correct price", measures.priceCorrect, true],
      ["Needed help", measures.helpUsed, true],
      ["Seconds until finished or stopped", measures.elapsedSeconds, false],
      ["Recovered after a lost confirmation", measures.recovered, true],
      ["Saved exactly one reservation", measures.oneReservation, true],
      ["Saved duplicate reservations", measures.duplicateReservations, true],
    ] as const;
    console.table(
      rows.map(([observation, measure, percent]) => {
        const display = (n?: number | null) =>
          n == null ? "Unmeasured" : percent ? Math.round(n * 100) + "%" : Number(n.toFixed(1));
        return {
          observation,
          [comparisonGroup]: display(measure[comparisonGroup]),
          Focus: display(measure.guided),
          pairs: measure.reviewers,
        };
      }),
    );
  }
  console.log(report.statement);
  if (reportPreference) {
    console.log(
      "Optional preference after primary export: " +
        ballots.length +
        " of " +
        eligible +
        " eligible reviewer codes returned a ballot.",
    );
    console.table(preferences);
  }
  console.log("Private report saved at " + fileURLToPath(output));
}

score(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The study could not be scored.");
  process.exitCode = 1;
});
