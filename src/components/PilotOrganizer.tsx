import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createPilotPacket,
  createPilotPlan,
  pilotManifestSchema,
  pilotGroups,
  scorePilot,
  type PilotManifest,
} from "../../north-star-kit/blind-test/pilot";
import {
  blindEvaluationBundleSchema,
  bookingProtocol,
  qualityDimensions,
  type BlindEvaluation,
} from "../../north-star-kit/blind-test/reviewer";
import {
  MAX_REVIEW_PACKET_BYTES,
  parseReviewerPacket,
  safeReviewUrl,
  secureReviewIndex,
  shuffleReviewOrder,
} from "@/lib/review-room";
import { downloadBlob } from "@/lib/download-blob";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";

const control =
  "block w-full min-w-0 min-h-11 mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm";
const groups = {
  original: "Original page",
  "one-shot": "One-shot build",
  guided: "Focus-guided build",
  expert: "Independent expert build",
} as const;
type Sample = PilotManifest["samples"][number];
type Report = ReturnType<typeof scorePilot>;

function saveJson(name: string, value: unknown) {
  downloadBlob(
    new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" }),
    name,
  );
}
async function readJson(file: File) {
  if (file.size > MAX_REVIEW_PACKET_BYTES) throw new Error("Each JSON file must fit within 2 MB.");
  try {
    return JSON.parse(await file.text()) as unknown;
  } catch {
    throw new Error("This file could not be read as JSON.");
  }
}
async function fileDigest(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || !value.size || value.size > 32 * 1024 * 1024)
    throw new Error("Choose both frozen files, each between one byte and 32 MB.");
  const digest = await crypto.subtle.digest("SHA-256", await value.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function checkManifest(value: unknown) {
  const result = pilotManifestSchema.safeParse(value);
  if (!result.success)
    throw new Error(
      "Choose a valid private organizer file with tasks, submissions and file fingerprints.",
    );
  if (result.data.samples.some((sample) => !safeReviewUrl(sample.assetRef)))
    throw new Error("Every sample needs an HTTP or HTTPS address without embedded credentials.");
  return result.data;
}

function SubmissionFields({
  manifest,
  save,
  busy,
}: {
  manifest: PilotManifest;
  save: (data: FormData) => Promise<boolean>;
  busy: boolean;
}) {
  const sources = pilotGroups(manifest.protocol);
  const first = sources[0]!;
  const [taskId, setTaskId] = useState(manifest.tasks[0]!.id);
  const selected = manifest.tasks.find((task) => task.id === taskId) ?? manifest.tasks[0]!;
  const interactive = selected.observationProtocol === bookingProtocol;
  const [group, setGroup] = useState<Sample["group"]>(first);
  const [unknownWork, setUnknownWork] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (await save(new FormData(form))) {
      form.reset();
      setGroup(first);
      setUnknownWork(false);
      setTaskId(manifest.tasks[0]!.id);
    }
  }
  return (
    <details className="my-5 border-y border-border py-3">
      <summary className="cursor-pointer py-2 font-medium">Add a real submission</summary>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy} className="mt-3 grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <legend className="sr-only">Submission details</legend>
          <label>
            Task
            <select
              name="task"
              className={control}
              value={selected.id}
              onChange={(e) => setTaskId(e.target.value)}
            >
              {manifest.tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select
              name="group"
              className={control}
              value={group}
              onChange={(e) => setGroup(e.target.value as Sample["group"])}
            >
              {sources.map((id) => (
                <option key={id} value={id}>
                  {groups[id]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Neutral sample address
            <input name="url" type="url" required maxLength={2000} className={control} />
          </label>
          <label>
            Sample format
            <select key={String(interactive)} name="kind" className={control}>
              <option value="interactive">Interactive page</option>
              {!interactive && <option value="image">Image</option>}
            </select>
          </label>
          <label>
            Creator code
            <input name="creator" required maxLength={120} className={control} />
          </label>
          <label>
            Source and permission
            <input name="provenance" required maxLength={4000} className={control} />
          </label>
          {manifest.protocol === "booking-pair-v1" && group === "guided" && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="unknownWork"
                checked={unknownWork}
                onChange={(event) => setUnknownWork(event.target.checked)}
              />
              Build time and revision counts are unavailable
            </label>
          )}
          {group !== "original" && !(manifest.protocol === "booking-pair-v1" && unknownWork) && (
            <>
              <label>
                Tools used
                <input name="tools" required maxLength={2000} className={control} />
              </label>
              <label>
                Time spent in minutes
                <input
                  name="minutes"
                  type="number"
                  min={0}
                  max={1000000}
                  step="any"
                  required
                  className={control}
                />
              </label>
              <label>
                Revision passes
                <input
                  key={group}
                  name="passes"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={group === "one-shot" ? 0 : undefined}
                  readOnly={group === "one-shot"}
                  required
                  className={control}
                />
              </label>
            </>
          )}
          <p className="self-end text-muted-foreground">
            Use the same brief and asset bundle for every submission to a task. Focus fingerprints
            the files locally.
          </p>
          <label>
            Frozen brief and assets · up to 32 MB
            <input name="inputs" type="file" required className={control} />
          </label>
          <label>
            Finished build or image · up to 32 MB
            <input name="artifact" type="file" required className={control} />
          </label>
          <div>
            <Button type="submit" disabled={busy}>
              Record submission
            </Button>
          </div>
        </fieldset>
      </form>
    </details>
  );
}

function Findings({ pilot, report }: { pilot: PilotManifest; report: Report }) {
  const pair = pilot.protocol === "booking-pair-v1";
  const columns = pair
    ? (["original", "guided"] as const)
    : (["oneShot", "guided", "expert"] as const);
  const labels = { original: "Original", oneShot: "One-shot", guided: "Focus", expert: "Expert" };
  return (
    <section className="mt-6 space-y-3" aria-label="Matched findings">
      <h2 className="font-display text-2xl">Matched findings</h2>
      <p>
        Reviewers: {report.counts.reviewers} · Answers: {report.counts.evaluations} · Reviewed every
        sample: {report.counts.completeReviewers}
      </p>
      {report.tasks.map((task) => (
        <details key={task.taskId} className="border-t border-border py-3">
          <summary className="cursor-pointer font-medium">
            {pilot.tasks.find((item) => item.id === task.taskId)?.title} · {task.matchedReviewers}{" "}
            matched {task.matchedReviewers === 1 ? "reviewer" : "reviewers"}
          </summary>
          {task.matchedReviewers ? (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-left text-sm">
                <caption className="text-left text-muted-foreground">
                  Craft ratings use a seven-point scale. Each observation includes only reviewers
                  who supplied that measure for every treatment.
                </caption>
                <thead>
                  <tr>
                    {["Measure", "Matched reviewers", ...columns.map((key) => labels[key])].map(
                      (col) => (
                        <th key={col} scope="col" className="p-2">
                          {col}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...qualityDimensions.map(({ id, title }) => ({
                      title,
                      measure: task.quality[id]!,
                      percent: false,
                    })),
                    {
                      title: "Self-reported task completion",
                      measure: task.taskCompletion,
                      percent: true,
                    },
                    ...(task.bookingObservations
                      ? [
                          {
                            title: "Confirmation visible on first submission",
                            measure: task.bookingObservations.firstSubmissionConfirmed,
                            percent: true,
                          },
                          {
                            title: "First submission reached planned confirmation loss",
                            measure: task.bookingObservations.encounteredPlannedLossFirst,
                            percent: true,
                          },
                          {
                            title: "First submission chose the lower price",
                            measure: task.bookingObservations.firstChoiceCorrect,
                            percent: true,
                          },
                          {
                            title: "Price stated correctly",
                            measure: task.bookingObservations.priceCorrect,
                            percent: true,
                          },
                          {
                            title: "Received help",
                            measure: task.bookingObservations.helpUsed,
                            percent: true,
                          },
                          {
                            title: "Time until finished or stopped (seconds)",
                            measure: task.bookingObservations.elapsedSeconds,
                            percent: false,
                          },
                          {
                            title: "Recovered after a lost confirmation",
                            measure: task.bookingObservations.recovered,
                            percent: true,
                          },
                          {
                            title: "Exactly one saved reservation",
                            measure: task.bookingObservations.oneReservation,
                            percent: true,
                          },
                          {
                            title: "More than one saved reservation",
                            measure: task.bookingObservations.duplicateReservations,
                            percent: true,
                          },
                        ]
                      : []),
                  ].map(({ title, measure, percent }) => (
                    <tr key={title}>
                      <th scope="row" className="p-2">
                        {title}
                      </th>
                      <td className="p-2">{measure.reviewers}</td>
                      {columns.map((key) => (
                        <td key={key} className="p-2">
                          {measure[key] == null
                            ? "Unmeasured"
                            : percent
                              ? `${(measure[key]! * 100).toFixed(0)}%`
                              : measure[key]!.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm">
              A reviewer must finish {pair ? "both samples" : "all three samples"} for this task to
              contribute a matched comparison.
            </p>
          )}
        </details>
      ))}
      <p className="text-sm text-muted-foreground">{report.statement}</p>
    </section>
  );
}

export function PilotOrganizer({ onClose }: { onClose: () => void }) {
  const [pilot, setPilot] = useState<PilotManifest | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  const [pending, setPending] = useState<
    "leave" | { remove: string } | { replace: PilotManifest } | null
  >(null);
  const generation = useRef(0);
  function confirm() {
    if (pending === "leave") onClose();
    else if (pending && "replace" in pending) {
      setPilot(pending.replace);
      setReport(null);
      setEdited(false);
      setStatus("Private organizer file opened.");
    } else if (pending && pilot) {
      setPilot({
        ...pilot,
        samples: pilot.samples.filter((sample) => sample.id !== pending.remove),
      });
      setReport(null);
      setEdited(true);
      setStatus("Submission removed. Packets made earlier still refer to the original sample.");
    }
    setPending(null);
  }
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  async function run(task: (current: () => boolean) => Promise<string>) {
    const id = ++generation.current;
    const current = () => id === generation.current;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const message = await task(current);
      if (current()) setStatus(message);
      return current();
    } catch (cause) {
      if (current())
        setError(cause instanceof Error ? cause.message : "The operation could not finish.");
      return false;
    } finally {
      if (current()) setBusy(false);
    }
  }
  function begin(protocol: PilotManifest["protocol"]) {
    void run(async () => {
      setPilot(createPilotPlan(crypto.randomUUID(), protocol));
      setReport(null);
      return "Private draft created. Add the real submissions, then download a copy.";
    });
  }
  function load(file: File | undefined) {
    if (file)
      void run(async (current) => {
        const next = checkManifest(await readJson(file));
        if (current()) {
          if (edited) {
            setPending({ replace: next });
            return "";
          }
          setPilot(next);
          setReport(null);
        }
        return "Private organizer file opened.";
      });
  }
  async function record(data: FormData) {
    return run(async (current) => {
      if (!pilot) throw new Error("Start a pilot first.");
      const text = (key: string) => String(data.get(key) ?? "").trim();
      if (!safeReviewUrl(text("url")))
        throw new Error("Use an HTTP or HTTPS sample address without embedded credentials.");
      if (pilot.samples.some((s) => s.group === text("group") && s.taskId === text("task")))
        throw new Error("This task already has a submission from that source.");
      const inputsSha256 = await fileDigest(data.get("inputs")),
        artifactSha256 = await fileDigest(data.get("artifact"));
      const sample = {
        id: crypto.randomUUID(),
        taskId: text("task"),
        group: text("group"),
        kind: text("kind"),
        assetRef: text("url"),
        creatorCode: text("creator"),
        provenance: text("provenance"),
        inputsSha256,
        artifactSha256,
        work:
          text("group") === "original" ||
          (pilot.protocol === "booking-pair-v1" && data.has("unknownWork"))
            ? null
            : {
                tools: text("tools"),
                minutes: Number(text("minutes")),
                revisionPasses: Number(text("passes")),
              },
      };
      const next = checkManifest({ ...pilot, samples: [...pilot.samples, sample] });
      if (current()) {
        setPilot(next);
        setEdited(true);
        setReport(null);
      }
      return "Submission recorded. Download the private draft to keep your change.";
    });
  }
  function packet() {
    if (pilot)
      void run(async () => {
        const order = shuffleReviewOrder(
          pilot.samples.map((sample) => sample.id),
          secureReviewIndex,
        );
        const masked = parseReviewerPacket(JSON.stringify(createPilotPacket(pilot, order)));
        saveJson("reviewer-packet.json", masked);
        return "Reviewer packet download started. Share only this packet with the reviewer.";
      });
  }
  function answers(files: File[]) {
    if (!pilot || !files.length) return;
    setReport(null);
    void run(async (current) => {
      if (files.length > 40 || files.reduce((sum, file) => sum + file.size, 0) > 8 * 1024 * 1024)
        throw new Error("Choose up to 40 answer files totaling at most 8 MB.");
      const rows: BlindEvaluation[] = [];
      for (const file of files) {
        const value = blindEvaluationBundleSchema.safeParse(await readJson(file));
        if (!current()) return "";
        if (!value.success || !value.data.evaluations.length || value.data.benchmarkId !== pilot.id)
          throw new Error("Each file must contain real completed answers for this pilot.");
        rows.push(...value.data.evaluations);
      }
      const scored = scorePilot(pilot, rows);
      if (current()) setReport(scored);
      return "Results calculated from the selected answer files.";
    });
  }
  const sourceCount = pilot ? pilotGroups(pilot.protocol).length : 0;
  return (
    <main id="main-content" className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-8">
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => (edited ? setPending("leave") : onClose())}
      >
        Return to reviewer room
      </Button>
      <h1 className="font-display text-3xl">Private pilot organizer</h1>
      {!pilot && (
        <section
          aria-labelledby="practice-pilot-title"
          className="space-y-2 rounded-lg border border-border p-4"
        >
          <h2 id="practice-pilot-title" className="font-display text-xl">
            Try a booking comparison with a colleague
          </h2>
          <p className="max-w-2xl text-sm">
            This kit contains two working versions of River Kiln and a private review form. Run it
            on one computer with Node 22.12 or newer. Participants can book a practice class and
            download their answers.
          </p>
          <Button asChild variant="outline">
            <a href="/examples/river-kiln-booking-pilot.zip" download>
              Download the ready-to-run study
            </a>
          </Button>
        </section>
      )}
      <p className="max-w-2xl text-muted-foreground">
        Prepare masked reviewer packets and compare returned answers. Work stays in this tab.
        Download the private draft before leaving and keep it with the organizer.
      </p>
      {!pilot && (
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} onClick={() => begin("booking-pair-v1")}>
            Compare original and redesigned booking
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => begin("matched-three-v1")}>
            Start booking and editorial pilot
          </Button>
        </div>
      )}
      <label className="block text-sm">
        Open private organizer file · JSON, up to 2 MB
        <input
          className={control}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            load(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {pilot && (
        <>
          <h2 className="font-display text-2xl">{pilot.title}</h2>
          <p>
            {pilot.tasks.length} {pilot.tasks.length === 1 ? "task" : "tasks"} ·{" "}
            {pilot.samples.length} of {pilot.tasks.length * sourceCount} submissions recorded.
          </p>
          <p className="text-sm text-muted-foreground">
            {pilot.protocol === "booking-pair-v1"
              ? "Supply the original booking page and its Focus redesign, both using the same classes, prices and lost-confirmation scenario."
              : "Collect a one-shot build, a Focus-guided build and a permissioned, independently made expert build for each task."}{" "}
            Use neutral sample links. Shuffle a separate packet for each reviewer to vary which
            version they see first.
          </p>
          {pilot.samples.length > 0 && (
            <details className="border-y border-border py-3">
              <summary className="cursor-pointer py-2 font-medium">
                Manage recorded submissions
              </summary>
              <ul>
                {pilot.samples.map((sample) => (
                  <li
                    key={sample.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-2 text-sm"
                  >
                    <span>
                      {pilot.tasks.find((task) => task.id === sample.taskId)?.title} ·{" "}
                      {groups[sample.group]} · {sample.creatorCode}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setPending({ remove: sample.id })}
                    >
                      Remove submission
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <SubmissionFields
            key={pilot.id + pilot.protocol}
            manifest={pilot}
            save={record}
            busy={busy}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  saveJson("private-pilot.json", pilot);
                  return "Private draft download started.";
                })
              }
            >
              Download private draft
            </Button>
            <Button
              disabled={busy || pilot.samples.length !== pilot.tasks.length * sourceCount}
              onClick={packet}
            >
              Download shuffled reviewer packet
            </Button>
          </div>
          <label className="block text-sm">
            Calculate results from answer files
            <input
              disabled={!pilot.samples.length || busy}
              multiple
              type="file"
              accept=".json,application/json"
              className={control}
              onChange={(e) => {
                answers(Array.from(e.currentTarget.files ?? []));
                e.currentTarget.value = "";
              }}
            />
          </label>
          <p className="text-sm text-muted-foreground">
            Choose all answer files together each time. Each file can contain up to 2 MB.
          </p>
          {report && (
            <>
              <Findings pilot={pilot} report={report} />
              <Button
                disabled={busy}
                variant="outline"
                onClick={() =>
                  void run(async () => {
                    saveJson("pilot-findings.json", report);
                    return "Pilot findings download started.";
                  })
                }
              >
                Download findings
              </Button>
            </>
          )}
        </>
      )}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
        onConfirm={confirm}
        title={
          pending === "leave"
            ? "Leave this private draft?"
            : pending && "replace" in pending
              ? "Replace the open draft?"
              : "Remove this submission?"
        }
        body={
          pending === "leave" || (pending && "replace" in pending)
            ? "Keep a downloaded copy of your recorded changes before continuing."
            : "This removes the submission from the open draft. A replacement gets its own sample ID so earlier answers cannot count toward it."
        }
        confirmLabel={
          pending === "leave"
            ? "Leave organizer"
            : pending && "replace" in pending
              ? "Replace draft"
              : "Remove"
        }
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </main>
  );
}
