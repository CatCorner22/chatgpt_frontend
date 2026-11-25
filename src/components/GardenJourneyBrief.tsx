import { useRef, useState } from "react";
import { useDraftExitSave } from "@/hooks/useDraftExitSave";
import { GardenBriefImport } from "@/components/GardenBriefImport";
import { ArrowDownToLine, BookOpen } from "lucide-react";
import { focusLocalStorage, focusSessionStorage, getBrowserOwnerId } from "@/lib/browser-storage";
import { downloadBlob } from "@/lib/download-blob";
import { LIBRARY_KEY, inspectLibrary } from "@/lib/library";
import {
  JOURNEY_FIELDS,
  JOURNEY_NOTE_LIMIT,
  JOURNEY_SCOPE_KEY,
  JOURNEY_STOPS,
  JOURNEY_TEXT_LIMIT,
  gardenJourneyJson,
  newGardenJourney,
  readGardenJourney,
  writeGardenJourney,
  type GardenJourney,
} from "@/lib/garden-journey";
import type { GardenGoal, GardenStep } from "@/lib/garden-content";

function message(cause: unknown) {
  return cause instanceof Error && cause.name === "Error"
    ? cause.message
    : "Browser storage is unavailable. Keep this tab open and download your edits.";
}

export function GardenJourneyBrief({ step, goal }: { step: GardenStep; goal: GardenGoal }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<GardenJourney | null>(null);
  const [designs, setDesigns] = useState<{ id: string; title: string }[]>([]);
  const [issue, setIssue] = useState("");
  const [libraryIssue, setLibraryIssue] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [status, setStatus] = useState("");
  const raw = useRef<string | null>(null);
  const pending = useRef<GardenJourney | null>(null);
  function load(id: string | null) {
    pending.current = null;
    setUnsaved(false);
    setIssue("");
    setStatus("");
    setSaved(false);
    setCanCopy(false);
    raw.current = null;
    let next = newGardenJourney(id, goal);
    try {
      const snapshot = readGardenJourney(id);
      raw.current = snapshot.raw;
      next = snapshot.brief ?? next;
      setSaved(!!snapshot.brief);
      if (id && !snapshot.brief) setCanCopy(!!readGardenJourney(null).brief);
    } catch (cause) {
      setIssue(message(cause));
    }
    setDraft(next);
    try {
      focusSessionStorage.setItem(JOURNEY_SCOPE_KEY, id ?? "");
    } catch {
      /* Selection lasts for this visit. */
    }
  }

  function toggle() {
    if (!open && !draft) {
      let choices: typeof designs = [];
      let selected: string | null = null;
      try {
        const library = inspectLibrary(focusLocalStorage.getItem(LIBRARY_KEY));
        choices = library.entries
          .filter(({ id }) => id.length <= 200)
          .map(({ id, title }) => ({ id, title }));
        setDesigns(choices);
        if (library.needsRecovery)
          setLibraryIssue("Some saved designs need recovery in My designs.");
        const remembered = focusSessionStorage.getItem(JOURNEY_SCOPE_KEY);
        selected = choices.find(({ id }) => id === remembered)?.id ?? null;
      } catch {
        setLibraryIssue("Your saved designs could not be listed in this browser.");
      }
      load(selected);
    }
    setOpen(!open);
  }

  function saveDraft() {
    const next = pending.current;
    if (!next) return true;
    try {
      raw.current = writeGardenJourney(next, raw.current);
      pending.current = null;
      setUnsaved(false);
      setSaved(true);
      setCanCopy(false);
      setIssue("");
      return true;
    } catch (cause) {
      setUnsaved(true);
      setIssue(message(cause));
      return false;
    }
  }
  useDraftExitSave(saveDraft);

  function change(next: GardenJourney) {
    pending.current = next;
    setDraft(next);
    setStatus("");
    saveDraft();
  }

  function download() {
    if (!draft) return;
    try {
      getBrowserOwnerId();
      const json = gardenJourneyJson(draft);
      downloadBlob(new Blob([json], { type: "application/json" }), "focus-garden-journey.json");
      setStatus(
        "Download started. Share this brief with your developer alongside the project files.",
      );
    } catch {
      setStatus(
        "The brief could not be downloaded. Check your session and use ordinary text without private links.",
      );
    }
  }

  const current = draft?.decisions[step.id] ?? { choice: "", note: "" };
  function changeDecision(patch: Partial<typeof current>) {
    if (draft)
      change({ ...draft, decisions: { ...draft.decisions, [step.id]: { ...current, ...patch } } });
  }

  return (
    <section className="garden-journey" aria-label="Your journey brief">
      <button type="button" className="garden-text-action" aria-expanded={open} onClick={toggle}>
        <BookOpen size={17} aria-hidden="true" />
        {open ? "Close my journey brief" : "Open my journey brief"}
      </button>
      {open && draft && (
        <div className="garden-journey-body">
          <p>
            Keep your choices together for a developer or coding assistant. Target includes a linked
            brief when you choose it at handoff.
          </p>
          <label>
            Brief for
            <select
              aria-label="Brief for"
              value={draft.designId ?? ""}
              disabled={unsaved}
              onChange={(event) => load(event.target.value || null)}
            >
              <option value="">Unassigned planning draft</option>
              {designs.map(({ id, title }) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          {libraryIssue && <p>{libraryIssue}</p>}
          {!saved && !unsaved && !issue && (
            <GardenBriefImport
              key={draft.designId ?? ""}
              designId={draft.designId}
              onLoad={change}
            />
          )}
          {canCopy && !unsaved && draft.designId && (
            <button
              type="button"
              className="garden-text-action"
              onClick={() => {
                try {
                  const source = readGardenJourney(null).brief;
                  if (!source) throw new Error("The unassigned brief is empty.");
                  change({ ...source, designId: draft.designId });
                } catch (cause) {
                  setIssue(message(cause));
                }
              }}
            >
              Copy my unassigned brief into this design
            </button>
          )}
          {step.id === "goal" ? (
            <>
              <label>
                Project starting point
                <select
                  aria-label="Project starting point"
                  value={draft.goal}
                  onChange={(event) =>
                    change({ ...draft, goal: event.target.value === "new" ? "new" : "existing" })
                  }
                >
                  <option value="existing">Improve an existing project</option>
                  <option value="new">Start a new project</option>
                </select>
              </label>
              {JOURNEY_FIELDS.map(({ id, label, example }) => (
                <label key={id}>
                  {label}
                  <textarea
                    rows={2}
                    maxLength={JOURNEY_TEXT_LIMIT}
                    value={draft[id]}
                    placeholder={example}
                    onChange={(event) => change({ ...draft, [id]: event.target.value })}
                  />
                </label>
              ))}
            </>
          ) : (
            <>
              <label>
                Preferred approach
                <select
                  aria-label="Preferred approach"
                  value={current.choice}
                  onChange={(event) => changeDecision({ choice: event.target.value })}
                >
                  <option value="">Still deciding</option>
                  {step.choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.title}
                    </option>
                  ))}
                </select>
              </label>
              {current.choice && (
                <p>{step.choices.find((item) => item.id === current.choice)?.tradeoff}</p>
              )}
              <label>
                {JOURNEY_STOPS[step.id].question}
                <textarea
                  rows={2}
                  maxLength={JOURNEY_NOTE_LIMIT}
                  value={current.note}
                  onChange={(event) => changeDecision({ note: event.target.value })}
                />
              </label>
              <p>
                Recheck after this choice changes:{" "}
                {JOURNEY_STOPS[step.id].affects.join(", ").toLowerCase()}.
              </p>
            </>
          )}
          <p>
            {saved && !unsaved ? "Saved in this browser." : "Planning notes."} Your developer still
            needs to apply and check these decisions.
          </p>
          {issue && <p role="alert">{issue}</p>}
          <div className="garden-actions">
            <button type="button" className="garden-text-action" onClick={download}>
              <ArrowDownToLine size={16} aria-hidden="true" />
              Download journey brief
            </button>
            {unsaved && (
              <button type="button" className="garden-text-action" onClick={() => change(draft)}>
                Retry saving
              </button>
            )}
            {(unsaved || issue) && (
              <button
                type="button"
                className="garden-text-action"
                onClick={() => {
                  if (
                    !unsaved ||
                    window.confirm(
                      "Discard the unsaved edits in this tab and reopen the saved brief?",
                    )
                  )
                    load(draft.designId);
                }}
              >
                Reopen saved brief
              </button>
            )}
          </div>
          {status && <p role="status">{status}</p>}
        </div>
      )}
    </section>
  );
}
