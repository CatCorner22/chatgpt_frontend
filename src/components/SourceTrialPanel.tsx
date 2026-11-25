import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SourceTrialChoices } from "@/components/SourceTrialChoices";
import { inspectBookingComparison } from "@/lib/booking-comparison";
import { SourceTrialReturnPanel } from "@/components/SourceTrialReturnPanel";
import { getBrowserOwnerId } from "@/lib/browser-storage";
import { readFileBytes } from "@/lib/read-file-bytes";
import { downloadBlob } from "@/lib/exportPack";
import type { Tokens } from "@/lib/design";
import type { TargetDraft } from "@/lib/target";
import {
  SOURCE_TRIAL_LIMITS,
  sourceTrialActionIssue,
  inspectSourceTrial,
  prepareSourceTrial,
  type PreparedSourceTrial,
  type SourceTrialFile,
  type SourceTrialInspection,
  type SourceTrialOptions,
} from "@/lib/source-trial";
import { buildSourceTrialPackage, SOURCE_TRIAL_KICKOFF } from "@/lib/source-trial-package";

const defaultOptions: SourceTrialOptions = { typography: "preserve", bookingLayout: "compact" };
type ReviewedSource = SourceTrialInspection & {
  booking: ReturnType<typeof inspectBookingComparison>;
};

type InputKind = "component" | "stylesheet";
type SourceInput = {
  path: string;
  name: string;
  bytes: number;
  content: string | null;
  reading: boolean;
};
type Inputs = Record<InputKind, SourceInput>;
type Proposal = {
  value: PreparedSourceTrial;
  verify: () => void;
  revision: number;
  contextKey: string;
};
const emptyInput = (): SourceInput => ({
  path: "",
  name: "",
  bytes: 0,
  content: null,
  reading: false,
});
const emptyInputs = (): Inputs => ({ component: emptyInput(), stylesheet: emptyInput() });
const inputLabels = {
  component: "Page file (.tsx)",
  stylesheet: "Matching style file (.module.css)",
};
const pathLabels = {
  component: "Page file path in the project",
  stylesheet: "Style file path in the project",
};
const fieldClass =
  "mt-2 block min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base";
const fileRequest =
  "Inspect the project without changing files. Confirm whether the intended page uses React with Vite or Next.js. If it is React with Vite and CSS modules, provide the complete .tsx page and its matching .module.css file as UTF-8, plus their exact paths inside the project. Keep secrets, customer records and unrelated files out of this handoff. Do not apply changes or deploy.";
const propertyLabels: Record<string, string> = {
  color: "Text color",
  "background-color": "Background color",
  "font-family": "Font family",
  "border-radius": "Corner radius",
};

export type SourceTrialPanelProps = {
  design: { id: string; tokens: Tokens };
  designTitle: string;
  draft: TargetDraft;
  contextKey: string;
  gardenComparison?: boolean;
  /** Captures and checks the parent's owner, saved design and exact draft revision. */
  captureContext: () => () => void;
};

/** Source is ephemeral. Previews render only recognized text as React children. */
export function SourceTrialPanel({
  design,
  designTitle,
  draft,
  contextKey,
  gardenComparison = false,
  captureContext,
}: SourceTrialPanelProps) {
  const id = useId();
  const [runtime, setRuntime] = useState("");
  const [githubBase, setGithubBase] = useState("");
  const invalidBase = Boolean(githubBase && !/^[0-9a-f]{40}$/.test(githubBase));
  const [inputs, setInputs] = useState<Inputs>(emptyInputs);
  const [inspection, setInspection] = useState<ReviewedSource | null>(null);
  const [options, setOptions] = useState<SourceTrialOptions>(defaultOptions);
  const [confirmed, setConfirmed] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState<"prepare" | "download" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const inputsNow = useRef(inputs);
  const confirmedNow = useRef(false);
  const proposalNow = useRef<Proposal | null>(null);
  const sourceRevision = useRef(0);
  const generation = useRef(0);
  const readJobs = useRef({ component: 0, stylesheet: 0 });
  const mounted = useRef(false);
  const latestContext = useRef(contextKey);
  latestContext.current = contextKey;
  const panelOwner = useRef<{ id: string | null } | null>(null);
  const errorHeading = useRef<HTMLDivElement>(null);
  const rolesHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const operationGeneration = generation;
    const inputJobs = readJobs.current;
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationGeneration.current++;
      inputJobs.component++;
      inputJobs.stylesheet++;
    };
  }, []);
  useEffect(() => {
    if (error) errorHeading.current?.focus();
  }, [error]);
  useEffect(() => {
    if (inspection) rolesHeading.current?.focus();
  }, [inspection]);

  function checkOwner() {
    const owner = getBrowserOwnerId();
    if (panelOwner.current && panelOwner.current.id !== owner)
      throw new Error(
        "Your account changed. Close this panel and reload before selecting source files again.",
      );
    panelOwner.current ??= { id: owner };
  }
  function capture() {
    checkOwner();
    const verifyParent = captureContext();
    const expectedContext = contextKey;
    return () => {
      if (!mounted.current || latestContext.current !== expectedContext)
        throw new Error(
          "The trial plan changed. Review the current files before preparing another proposal.",
        );
      checkOwner();
      verifyParent();
    };
  }
  function invalidateProposal() {
    sourceRevision.current++;
    generation.current++;
    proposalNow.current = null;
    confirmedNow.current = false;
    setProposal(null);
    setConfirmed(false);
    setBusy(null);
    setError("");
    setNotice("");
  }
  function invalidate() {
    invalidateProposal();
    setInspection(null);
    setGithubBase("");
    setOptions(defaultOptions);
  }
  function changeOptions(next: SourceTrialOptions) {
    invalidateProposal();
    setOptions(next);
  }
  function updateInput(kind: InputKind, patch: Partial<SourceInput>) {
    inputsNow.current = { ...inputsNow.current, [kind]: { ...inputsNow.current[kind], ...patch } };
    setInputs(inputsNow.current);
  }
  function clearFiles() {
    invalidate();
    readJobs.current.component++;
    readJobs.current.stylesheet++;
    inputsNow.current = emptyInputs();
    setInputs(inputsNow.current);
  }
  async function selectFile(kind: InputKind, files: FileList | null) {
    if (!files?.length) return; // A cancelled picker keeps the previous selection.
    invalidate();
    const job = ++readJobs.current[kind];
    const file = files[0]!;
    const expectedContext = contextKey;
    updateInput(kind, { name: file.name, bytes: file.size, content: null, reading: true });
    const current = () =>
      mounted.current &&
      readJobs.current[kind] === job &&
      latestContext.current === expectedContext;
    try {
      const verify = capture();
      const limit =
        kind === "component"
          ? SOURCE_TRIAL_LIMITS.componentBytes
          : SOURCE_TRIAL_LIMITS.stylesheetBytes;
      if (
        files.length !== 1 ||
        !(kind === "component" ? /\.tsx$/i : /\.module\.css$/i).test(file.name)
      )
        throw new Error(
          `Choose one ${kind === "component" ? ".tsx page" : ".module.css style"} file.`,
        );
      if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > limit)
        throw new Error(
          `${inputLabels[kind]} must be nonempty and no larger than ${Math.round(limit / 1024)} KiB.`,
        );
      const bytes = await readFileBytes(file, {
        failed: "The selected file could not be read. Choose it again.",
        cancelled: "The file read was cancelled.",
        invalidResult: "The selected file could not be read.",
      });
      if (!current()) return;
      verify();
      if (bytes.byteLength !== file.size || bytes.byteLength > limit)
        throw new Error("The file size changed while reading. Choose the original file again.");
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        throw new Error("Choose a UTF-8 source file. This file contains unreadable text.");
      }
      if (content.startsWith("\uFEFF"))
        throw new Error(
          "Save this source as UTF-8 without a byte-order mark, then choose it again.",
        );
      updateInput(kind, { content, reading: false });
    } catch (cause) {
      if (!current()) return;
      updateInput(kind, { content: null, reading: false });
      setError(cause instanceof Error ? cause.message : "This source file could not be read.");
    }
  }
  function filesForTrial(): SourceTrialFile[] {
    return (["component", "stylesheet"] as const).map((kind) => {
      const input = inputsNow.current[kind];
      if (input.content === null || input.reading || !input.path)
        throw new Error("Choose both source files and enter their paths inside the project.");
      return { path: input.path, content: input.content };
    });
  }
  function inspect() {
    invalidate();
    try {
      const verify = capture();
      if (runtime !== "vite")
        throw new Error("This source-change format supports React with Vite only.");
      const files = filesForTrial();
      const found = inspectSourceTrial(files);
      const booking = inspectBookingComparison(files[0]!.content);
      verify();
      setInspection({ ...found, booking });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "This page needs a developer-guided integration.",
      );
    }
  }
  async function prepare() {
    const job = ++generation.current;
    const revision = sourceRevision.current;
    const expectedContext = contextKey;
    proposalNow.current = null;
    setProposal(null);
    setError("");
    setNotice("");
    setBusy("prepare");
    const current = () =>
      mounted.current &&
      generation.current === job &&
      sourceRevision.current === revision &&
      latestContext.current === expectedContext;
    try {
      const verify = capture();
      if (runtime !== "vite" || !inspection || !confirmedNow.current)
        throw new Error("Check the page and confirm its recognized parts before preparing edits.");
      const prepared = await prepareSourceTrial(filesForTrial(), design, options);
      if (!current()) return;
      verify();
      const result = { value: prepared, verify, revision, contextKey: expectedContext };
      proposalNow.current = result;
      setProposal(result);
      setNotice(
        "Proposed edits prepared. Review the differences below; the customer page has not been run or changed.",
      );
    } catch (cause) {
      if (current())
        setError(
          cause instanceof Error ? cause.message : "The source proposal could not be prepared.",
        );
    } finally {
      if (current()) setBusy(null);
    }
  }
  async function download() {
    const selected = proposalNow.current;
    if (!selected) return;
    const job = ++generation.current;
    setError("");
    setNotice("");
    setBusy("download");
    const current = () =>
      mounted.current &&
      generation.current === job &&
      proposalNow.current === selected &&
      sourceRevision.current === selected.revision &&
      latestContext.current === selected.contextKey;
    try {
      selected.verify();
      if (!current() || !confirmedNow.current) return;
      const blob = await buildSourceTrialPackage(selected.value, {
        draft,
        designTitle,
        githubBase,
      });
      if (!current()) return;
      selected.verify();
      downloadBlob(blob, "focus-source-trial-proposal.zip");
      if (!current()) return;
      selected.verify();
      setNotice(
        "Download started. Your coding assistant or developer can review these edits in the separate preview. Your project has not been changed.",
      );
    } catch (cause) {
      if (!current()) return;
      proposalNow.current = null;
      setProposal(null);
      setError(
        cause instanceof Error
          ? cause.message
          : "The proposal could not be downloaded. Prepare it again and retry.",
      );
    } finally {
      if (mounted.current && generation.current === job) setBusy(null);
    }
  }
  function cancel() {
    generation.current++;
    readJobs.current.component++;
    readJobs.current.stylesheet++;
    for (const kind of ["component", "stylesheet"] as const)
      if (inputsNow.current[kind].reading) updateInput(kind, { reading: false, content: null });
    setBusy(null);
    setError("");
    setNotice("Preparation cancelled. No project files have been changed.");
  }
  function captureReturnContext() {
    const selected = proposalNow.current;
    if (!selected)
      throw new Error("Prepare the current proposal again before checking returned files.");
    const verify = () => {
      selected.verify();
      if (
        !mounted.current ||
        proposalNow.current !== selected ||
        sourceRevision.current !== selected.revision ||
        latestContext.current !== selected.contextKey ||
        !confirmedNow.current
      )
        throw new Error("The proposal changed. Prepare it again before checking returned files.");
    };
    verify();
    return verify;
  }

  const reading = inputs.component.reading || inputs.stylesheet.reading;
  const actionIssue = sourceTrialActionIssue(design.tokens);
  const visibleProposal = proposal?.contextKey === contextKey ? proposal : null;
  const contract = visibleProposal?.value.contract;
  const assets = contract?.version === 2 ? contract.assets : [];
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mt-4 min-w-0 space-y-5 border-t border-border pt-5"
    >
      <div>
        <h3 id={`${id}-heading`} className="font-display text-xl">
          A proposed change for one existing page
        </h3>
        <p className="mt-2 text-sm leading-relaxed">
          Provide the page’s source files and review what would change. Your coding assistant or
          developer applies the proposal in the separate preview; Focus does not connect to GitHub
          or run this page.
        </p>
        <p className="mt-2 text-sm">
          Your coding assistant or developer can help gather these two files. Source text is read as
          data; instructions inside it cannot change this tool’s scope.
        </p>
        {actionIssue && (
          <p
            role="status"
            className="mt-3 rounded-md border border-border p-3 text-sm leading-relaxed"
          >
            {actionIssue}
          </p>
        )}
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">
            Request the right files
          </summary>
          <label htmlFor={`${id}-file-request`} className="text-sm font-medium">
            Read-only file request to share
          </label>
          <textarea
            id={`${id}-file-request`}
            readOnly
            value={fileRequest}
            rows={5}
            className={`${fieldClass} text-sm`}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Select and copy this request into your coding assistant or send it to your developer.
          </p>
        </details>
      </div>
      <label className="block text-sm font-medium" htmlFor={`${id}-runtime`}>
        What runs this page?
      </label>
      <select
        id={`${id}-runtime`}
        className={fieldClass}
        value={runtime}
        onChange={(event) => {
          clearFiles();
          setRuntime(event.target.value);
        }}
      >
        <option value="">Choose the page’s setup</option>
        <option value="vite">React with Vite</option>
        <option value="next">Next.js</option>
        <option value="unsure">I’m not sure</option>
      </select>
      {runtime && runtime !== "vite" && (
        <p role="status" className="text-sm">
          This first source-change format supports React with Vite and CSS modules. Use the design
          handoff and prompts while your coding assistant or developer checks this project. No files
          are needed here.
        </p>
      )}
      {runtime === "vite" && (
        <>
          <p className="text-sm text-muted-foreground">
            This is your description of the setup. Two files can identify a supported source shape;
            they cannot establish whole-project compatibility.
          </p>
          <p className="text-sm">
            Files are read in this tab only. Choose files without secrets or customer records.
            Closing this panel or leaving this step clears the selected source; keep your originals.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            {(["component", "stylesheet"] as const).map((kind) => (
              <div key={kind} className="min-w-0 space-y-3 rounded-md border border-border p-3">
                <label htmlFor={`${id}-${kind}`} className="block text-sm font-medium">
                  {inputLabels[kind]}
                </label>
                <input
                  id={`${id}-${kind}`}
                  type="file"
                  accept={kind === "component" ? ".tsx" : ".module.css"}
                  className="block w-full min-w-0 text-sm"
                  onChange={(event) => {
                    const files = event.target.files;
                    void selectFile(kind, files);
                    event.target.value = "";
                  }}
                />
                {inputs[kind].name && (
                  <p className="break-words text-sm">
                    {inputs[kind].name} · {inputs[kind].bytes} bytes
                    {inputs[kind].reading
                      ? " · Reading…"
                      : inputs[kind].content !== null
                        ? " · Read in this tab"
                        : " · Needs a readable file"}
                  </p>
                )}
                <label htmlFor={`${id}-${kind}-path`} className="block text-sm font-medium">
                  {pathLabels[kind]}
                </label>
                <input
                  id={`${id}-${kind}-path`}
                  type="text"
                  value={inputs[kind].path}
                  maxLength={240}
                  spellCheck={false}
                  autoCapitalize="none"
                  autoComplete="off"
                  className={fieldClass}
                  placeholder={
                    kind === "component" ? "src/pages/Booking.tsx" : "src/pages/Booking.module.css"
                  }
                  aria-describedby={`${id}-path-help`}
                  onChange={(event) => {
                    invalidate();
                    updateInput(kind, { path: event.target.value });
                  }}
                />
              </div>
            ))}
          </div>
          <p id={`${id}-path-help`} className="text-sm text-muted-foreground">
            Enter where each file lives inside the project. Your coding assistant or developer can
            find this in the file list. These paths are provided by you; Focus has not fetched files
            from GitHub.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={inspect} disabled={reading || !!busy}>
              Check whether this page is supported
            </Button>
            <Button type="button" variant="ghost" onClick={clearFiles}>
              Clear selected files
            </Button>
          </div>
          {inspection && (
            <section
              aria-labelledby={`${id}-roles`}
              className="space-y-4 rounded-lg bg-secondary/40 p-4"
            >
              <h4 id={`${id}-roles`} ref={rolesHeading} tabIndex={-1} className="font-medium">
                Source shape recognized
              </h4>
              <p className="text-sm">
                Page area: {inspection.componentName}. The page background stays {inspection.ground}
                . Other controls still need review in the actual page.
              </p>
              <dl className="space-y-3 text-sm">
                {(["heading", "body", "action"] as const).map((role) => (
                  <div key={role}>
                    <dt className="font-medium">
                      {role === "heading"
                        ? "Main heading"
                        : role === "body"
                          ? "Supporting text"
                          : "Main action"}
                    </dt>
                    <dd className="break-words">
                      {inspection.roles[role].label}
                      <span className="block text-xs text-muted-foreground">
                        Style class: {inspection.roles[role].className}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              <SourceTrialChoices
                headingFont={design.tokens.headingFont}
                bodyFont={design.tokens.bodyFont}
                options={options}
                onChange={changeOptions}
                booking={inspection.booking}
                gardenComparison={gardenComparison}
              />
              <label className="flex min-h-11 items-start gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0"
                  checked={confirmed}
                  onChange={(event) => {
                    generation.current++;
                    proposalNow.current = null;
                    setProposal(null);
                    setBusy(null);
                    setError("");
                    setNotice("");
                    confirmedNow.current = event.target.checked;
                    setConfirmed(event.target.checked);
                  }}
                />
                These are the page parts I want my coding assistant or developer to review.
              </label>
              <Button
                type="button"
                onClick={() => void prepare()}
                disabled={!confirmed || !!busy || reading || !!actionIssue}
              >
                {busy === "prepare" ? "Preparing proposed edits…" : "Prepare proposed edits"}
              </Button>
            </section>
          )}
          {visibleProposal && (
            <section aria-labelledby={`${id}-proposal`} className="min-w-0 space-y-4">
              <h4 id={`${id}-proposal`} className="font-medium">
                Proposed source changes — page not run here
              </h4>
              <p className="text-sm">
                For {designTitle}, review the two edited source files with your developer.
                {assets.length > 0
                  ? " The ZIP also includes the selected fonts and their licenses. Check the rendered type and line breaks on the actual page."
                  : " The existing page keeps its fonts."}
                {contract?.version === 2 &&
                  contract.bookingLayout === "compare" &&
                  " The proposal replaces the compact class picker with a choice for each class showing its time and total."}
              </p>
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Declared style changes"
                tabIndex={0}
              >
                <table className="w-full min-w-96 border-collapse text-left text-sm">
                  <caption className="mb-2 text-left text-xs text-muted-foreground">
                    Before values are declarations found in this CSS file, not measured browser
                    styles.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col" className="p-2">
                        Page part
                      </th>
                      <th scope="col" className="p-2">
                        Property
                      </th>
                      <th scope="col" className="p-2">
                        Before
                      </th>
                      <th scope="col" className="p-2">
                        Proposed
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProposal.value.changes.map((change) => (
                      <tr
                        key={`${change.role}-${change.property}`}
                        className="border-t border-border"
                      >
                        <th scope="row" className="p-2 font-medium">
                          {change.role === "heading"
                            ? "Heading"
                            : change.role === "body"
                              ? "Supporting text"
                              : "Main action"}
                        </th>
                        <td className="p-2">
                          {propertyLabels[change.property] ?? change.property}
                        </td>
                        <td className="max-w-64 break-words p-2">
                          {change.before ?? "Not resolved from these declarations"}
                        </td>
                        <td className="max-w-64 break-words p-2">{change.after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="list-inside list-disc break-words text-sm">
                {visibleProposal.value.files.map((file) => (
                  <li key={file.path}>{file.path}</li>
                ))}
              </ul>
              {assets.length > 0 && (
                <details>
                  <summary className="min-h-11 cursor-pointer py-3 font-medium">
                    Included fonts and licenses ({assets.length} files)
                  </summary>
                  <ul className="list-inside list-disc break-words text-sm">
                    {assets.map((asset) => (
                      <li key={asset.path}>{asset.path}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm">
                    The handoff verifier checks these files separately from the two source edits.
                  </p>
                </details>
              )}
              <details>
                <summary className="min-h-11 cursor-pointer py-3 font-medium">
                  Review exact forward and undo patches
                </summary>
                <p className="my-2 text-sm">
                  These are text proposals. Applying a patch still requires checking the complete
                  original file hashes; a patch tool’s normal checks alone do not enforce those
                  hashes.
                </p>
                <label htmlFor={`${id}-forward`} className="text-sm font-medium">
                  Forward patch
                </label>
                <textarea
                  id={`${id}-forward`}
                  readOnly
                  value={visibleProposal.value.patch}
                  rows={10}
                  spellCheck={false}
                  className={`${fieldClass} font-mono text-xs`}
                />
                <label htmlFor={`${id}-inverse`} className="mt-4 block text-sm font-medium">
                  Undo patch
                </label>
                <textarea
                  id={`${id}-inverse`}
                  readOnly
                  value={visibleProposal.value.inversePatch}
                  rows={8}
                  spellCheck={false}
                  className={`${fieldClass} font-mono text-xs`}
                />
              </details>
              <details>
                <summary className="min-h-11 cursor-pointer py-3 font-medium">
                  Review in a separate GitHub branch
                </summary>
                <p id={`${id}-base-help`} className="my-2 text-sm">
                  Your developer can use the download to rehearse the edits in a fresh local copy,
                  then share a draft pull request for review. To tie it to one saved version, copy
                  the full commit ID from that version’s page on GitHub.
                </p>
                <label htmlFor={`${id}-base`} className="text-sm font-medium">
                  Starting GitHub commit (optional)
                </label>
                <input
                  id={`${id}-base`}
                  value={githubBase}
                  onChange={(event) => setGithubBase(event.target.value.trim().toLowerCase())}
                  aria-invalid={invalidBase}
                  aria-describedby={`${id}-base-help${invalidBase ? " " + id + "-base-error" : ""}`}
                  maxLength={80}
                  disabled={!!busy}
                  spellCheck={false}
                  autoComplete="off"
                  className={`${fieldClass} font-mono text-sm`}
                />
              </details>
              {invalidBase && (
                <p id={`${id}-base-error`} className="text-sm">
                  Paste all 40 characters from GitHub or clear this field to choose the version
                  later.
                </p>
              )}
              <Button
                type="button"
                onClick={() => void download()}
                disabled={!!busy || invalidBase}
              >
                {busy === "download"
                  ? "Preparing proposal download…"
                  : "Download proposed code change"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Give focus-source-trial-proposal.zip to your coding assistant or developer. It
                includes your trial plan, private source excerpts, exact edits, GitHub branch
                helper, and checks and stop conditions in AGENT-HANDOFF.md. It is not a public
                website package, test certificate or release approval.
              </p>
              <label htmlFor={`${id}-kickoff`} className="block text-sm font-medium">
                Message to include with the proposal
              </label>
              <textarea
                id={`${id}-kickoff`}
                readOnly
                value={SOURCE_TRIAL_KICKOFF}
                rows={5}
                className={`${fieldClass} text-sm`}
              />
              <p className="text-sm">
                Ask for the isolated preview, before-and-after views, exact changed files, actual
                task and undo results, and anything not run. A written claim alone is not proof that
                those checks happened.
              </p>
              <SourceTrialReturnPanel
                prepared={visibleProposal.value}
                captureContext={captureReturnContext}
              />
            </section>
          )}
          {(reading || busy) && (
            <Button type="button" variant="outline" onClick={cancel}>
              Cancel source preparation
            </Button>
          )}
        </>
      )}
      {error && (
        <div
          ref={errorHeading}
          tabIndex={-1}
          role="alert"
          className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm"
        >
          <p>{error}</p>
          <p>
            Your Target answers and project files are unchanged. You can replace the source files or
            use the ordinary design handoff.
          </p>
          <p>
            This adapter may not support the page’s format; that does not mean the app is broken.
          </p>
          <a href="#target-prompts-heading" className="inline-flex min-h-11 items-center underline">
            Use the design handoff prompts
          </a>
        </div>
      )}
      <p role="status" aria-live="polite" className="text-sm">
        {notice}
      </p>
    </section>
  );
}
