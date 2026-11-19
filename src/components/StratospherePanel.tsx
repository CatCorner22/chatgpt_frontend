import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, Download, Network } from "lucide-react";
import { LazyAuthoredPagePanel } from "@/components/LazyAuthoredPagePanel";
import { DesignPreview } from "@/components/DesignPreview";
import { ContentEditor } from "@/components/ContentEditor";
import { InteractionLab } from "@/components/InteractionLab";
import { Button } from "@/components/ui/button";
import { focusLocalStorage, getBrowserOwnerId } from "@/lib/browser-storage";
import { downloadBlob } from "@/lib/exportPack";
import { readGardenPreferences, writeGardenPreferences } from "@/lib/garden-preferences";
import { isStratosphereGroupId } from "@/lib/garden-navigation";
import type { State } from "@/lib/studio-state";
import {
  STRATOSPHERE_GROUPS,
  deriveStratosphereGraph,
  evaluateStratosphereCandidate,
  selectedStratosphereOption,
  type StratosphereGroupId,
} from "@/lib/stratosphere";

function StratosphereIntroduction() {
  return (
    <header className="stratosphere-introduction">
      <div>
        <p className="eyebrow">A little wonder. A lot of craft.</p>
        <h1>Stratosphere</h1>
        <p>
          Make the details work together. Reverie will show what each choice changes, what it
          depends on, and what still needs checking.
        </p>
      </div>
      <img
        src="/brand/reverie-stratosphere.png"
        alt="Reverie riding a little red coin-operated rocket"
        width="1254"
        height="1254"
        decoding="async"
      />
    </header>
  );
}

export function StratosphereStart() {
  return (
    <main id="main-content" className="stratosphere-page">
      <StratosphereIntroduction />
      <section className="stratosphere-start">
        <h2>Bring a design to the workshop.</h2>
        <p>
          Start with your real words and a direction you like. Then explore composition, color,
          type, spacing, and controls together—with a live record of their connections.
        </p>
        <div className="garden-actions">
          <Link to="/" search={{ view: "studio" }} className="garden-primary">
            Start in the studio <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link to="/library" className="garden-text-action">
            Open a saved design
          </Link>
          <Link to="/" search={{}} className="garden-text-action">
            Your journey
          </Link>
        </div>
        <p className="garden-return-note">
          Your existing designs stay intact. Open one, then choose Stratosphere from Tools.
        </p>
      </section>
    </main>
  );
}

export function StratospherePanel({
  state,
  onChange,
  onExport,
  requestedGroup,
}: {
  state: State;
  onChange: (patch: Partial<State>) => void;
  onExport: () => void;
  requestedGroup?: StratosphereGroupId | undefined;
}) {
  const authored = state.integration === "new" && state.purpose.experience !== "app";
  const [groupId, setGroupId] = useState<StratosphereGroupId>(() =>
    isStratosphereGroupId(requestedGroup)
      ? requestedGroup
      : authored
        ? STRATOSPHERE_GROUPS[0]!.id
        : "palette",
  );
  const [brief, setBrief] = useState(true);
  const [preferenceIssue, setPreferenceIssue] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [downloadError, setDownloadError] = useState("");
  const groupHeading = useRef<HTMLHeadingElement>(null);
  const moveFocus = useRef(false);
  const previousRequest = useRef(requestedGroup);
  useEffect(() => {
    // A changed URL (including Back) selects its group; removing it restores the
    // profile default. Manual choices survive all unrelated state rerenders.
    if (previousRequest.current === requestedGroup) return;
    previousRequest.current = requestedGroup;
    const next = isStratosphereGroupId(requestedGroup)
      ? requestedGroup
      : authored
        ? STRATOSPHERE_GROUPS[0]!.id
        : "palette";
    moveFocus.current = next !== groupId;
    setGroupId(next);
    setAnnouncement("");
  }, [requestedGroup, authored, groupId]);
  useEffect(() => {
    const saved = readGardenPreferences(focusLocalStorage);
    setBrief(saved.value.brief);
    setPreferenceIssue(saved.issue);
  }, []);
  useEffect(() => {
    if (moveFocus.current) {
      groupHeading.current?.focus();
      moveFocus.current = false;
    }
  }, [groupId]);
  const input = useMemo(
    () => ({
      tokens: state.tokens!,
      content: state.content!,
      page: state.page,
      purpose: state.purpose,
      integration: state.integration,
      nav: state.nav,
    }),
    [state.tokens, state.content, state.page, state.purpose, state.integration, state.nav],
  );
  const graph = useMemo(() => deriveStratosphereGraph(input), [input]);
  const decisionRecord = useMemo(
    () =>
      JSON.stringify(
        {
          kind: "focus-decision-map",
          version: 1,
          evidence:
            "Declared dependencies and current values; not a browser or customer-release certificate.",
          source: input,
          graph,
        },
        null,
        2,
      ),
    [input, graph],
  );
  const group = STRATOSPHERE_GROUPS.find((candidate) => candidate.id === groupId)!;
  const selected = selectedStratosphereOption(input, group.id);
  const currentBlockers = graph.issues.filter(
    (issue) => issue.severity === "block" && issue.kind !== "scope",
  );
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const setLearning = (value: boolean) => {
    setBrief(value);
    const latest = readGardenPreferences(focusLocalStorage);
    setPreferenceIssue(
      writeGardenPreferences(focusLocalStorage, { ...latest.value, brief: value }),
    );
  };
  const choose = (optionId: string) => {
    const candidate = evaluateStratosphereCandidate(input, group.id, optionId);
    if (!candidate.accepted) {
      setAnnouncement(
        candidate.issues
          .filter((issue) => issue.severity === "block")
          .map((issue) => issue.message)
          .join(" "),
      );
      return;
    }
    if (candidate.changedFields.length)
      onChange({ tokens: candidate.tokens, page: candidate.page });
    setAnnouncement(
      candidate.changedFields.length
        ? `Updated ${group.label.toLowerCase()}. The preview and decision map now use these values. Undo is available in the studio toolbar.`
        : "This choice already matches your design.",
    );
    setDownloadError("");
  };
  const downloadDecisions = () => {
    setDownloadError("");
    setAnnouncement("");
    try {
      getBrowserOwnerId();
      downloadBlob(
        new Blob([decisionRecord], { type: "application/json;charset=utf-8" }),
        "focus-decision-map.json",
      );
      setAnnouncement("Decision-map download started. This records choices, not completed tests.");
    } catch {
      setDownloadError(
        "The decision map could not be downloaded. Your design has not been changed.",
      );
    }
  };

  return (
    <main id="main-content" className="stratosphere-page">
      <StratosphereIntroduction />
      <div className="stratosphere-topline">
        <Link to="/" search={{ view: "studio" }} className="garden-text-action">
          <ArrowLeft size={16} aria-hidden="true" /> Return to your design
        </Link>
        <Link to="/" search={{}} className="garden-text-action">
          Your journey
        </Link>
        <label className="garden-brief-toggle">
          <input
            type="checkbox"
            checked={brief}
            onChange={(event) => setLearning(event.target.checked)}
          />{" "}
          Keep it brief
        </label>
      </div>
      {preferenceIssue && (
        <p className="garden-storage-note" role="status">
          {preferenceIssue}
        </p>
      )}
      <div className="stratosphere-workbench">
        <section className="stratosphere-decisions" aria-labelledby="stratosphere-choice-heading">
          <nav aria-label="Stratosphere decisions" className="stratosphere-stops">
            {STRATOSPHERE_GROUPS.map((step, index) => (
              <button
                key={step.id}
                type="button"
                aria-current={step.id === groupId ? "step" : undefined}
                onClick={() => {
                  moveFocus.current = step.id !== groupId;
                  setGroupId(step.id);
                  setAnnouncement("");
                }}
              >
                <span aria-hidden="true">{index + 1}</span>
                {step.label}
              </button>
            ))}
          </nav>
          <h2 id="stratosphere-choice-heading" ref={groupHeading} tabIndex={-1}>
            {group.label}
          </h2>
          <p className="stratosphere-description">{group.description}</p>
          {group.authoredOnly && !authored && (
            <p className="stratosphere-custom">
              Your existing structure stays in place. Explore color, typography, spacing, and
              controls here; plan changes to your app’s structure in the scoped handoff.
            </p>
          )}
          {currentBlockers.length > 0 && (
            <aside className="stratosphere-blocked" aria-label="Current design constraints">
              <p>Resolve these constraints before continuing with affected choices.</p>
              <ul>
                {currentBlockers.map((issue) => (
                  <li key={issue.id}>{issue.message}</li>
                ))}
              </ul>
              {currentBlockers.some((issue) => issue.kind === "measured") &&
                group.id !== "palette" && (
                  <button
                    className="garden-text-action"
                    type="button"
                    onClick={() => {
                      moveFocus.current = true;
                      setGroupId("palette");
                    }}
                  >
                    Choose readable colors
                  </button>
                )}
            </aside>
          )}
          {!selected && (
            <p className="stratosphere-custom">
              Your current custom values stay in place until you choose an option.
            </p>
          )}
          <fieldset className="stratosphere-choices">
            <legend className="sr-only">Choose {group.label.toLowerCase()}</legend>
            {group.options.map((option) => {
              const result = evaluateStratosphereCandidate(input, group.id, option.id);
              const blockers = result.issues.filter((issue) => issue.severity === "block");
              const hintId = `stratosphere-${group.id}-${option.id}-help`;
              return (
                <div key={option.id} className="stratosphere-option">
                  <label>
                    <input
                      type="radio"
                      name={`stratosphere-${group.id}`}
                      checked={selected === option.id}
                      disabled={!result.accepted}
                      onChange={() => choose(option.id)}
                      aria-describedby={hintId}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </span>
                  </label>
                  <div id={hintId}>
                    {blockers.map((issue) => (
                      <p className="stratosphere-blocked" key={issue.id}>
                        {issue.message}
                      </p>
                    ))}
                    {!brief && (
                      <p className="stratosphere-lesson">
                        <BookOpen size={15} aria-hidden="true" />
                        {option.lesson}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </fieldset>
          <p className="stratosphere-status" role="status" aria-live="polite">
            {announcement}
          </p>
          <p className="stratosphere-fineprint">
            Choices use the studio’s existing Undo, saved versions, and recovery. They do not change
            a customer’s live site.
          </p>
        </section>
        <section
          className="stratosphere-preview"
          aria-label={authored ? "Live authored page" : "Style study"}
        >
          {authored ? (
            <LazyAuthoredPagePanel
              key={state.libraryId ?? "draft"}
              tokens={state.tokens!}
              content={state.content!}
              settings={state.page}
              onSettings={(page) => onChange({ page })}
              onContent={(content) => onChange({ content })}
              onExport={onExport}
              projectState={state as unknown as Record<string, unknown>}
              decisionRecord={decisionRecord}
              compact
            />
          ) : (
            <div className="stratosphere-style-study">
              <p className="eyebrow">Style study · not your live app</p>
              <h2>Explore the visual language.</h2>
              <p>
                This specimen shows your design choices. Your existing pages, workflows, responsive
                behavior, and component states still need implementation and testing in a separate
                project preview.
              </p>
              <DesignPreview t={state.tokens!} c={state.content!} />
              <ContentEditor
                content={state.content!}
                onChange={(content) => onChange({ content })}
              />
              <Link to="/target" className="garden-text-action">
                Prepare a scoped handoff <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>

      <details className="stratosphere-map-details stratosphere-interaction-details">
        <summary>Try the interaction lab · buttons, forms, and feedback</summary>
        <InteractionLab tokens={state.tokens!} />
      </details>

      <section className="stratosphere-map-section" aria-labelledby="stratosphere-map-heading">
        <div className="stratosphere-map-heading">
          <div>
            <p className="eyebrow">Your decisions, connected</p>
            <h2 id="stratosphere-map-heading">
              <Network size={24} aria-hidden="true" /> A live decision map
            </h2>
            <p>
              Derived from the current design and the same rules used by the controls. Change a
              choice or use Undo, and the map changes with it.
            </p>
          </div>
          <Button variant="outline" onClick={downloadDecisions}>
            <Download size={16} aria-hidden="true" /> Download decision map
          </Button>
        </div>
        {downloadError && (
          <p role="alert" className="stratosphere-blocked">
            {downloadError}
          </p>
        )}
        <p className="stratosphere-map-key">
          Hard constraints can block a choice. Recommendations explain a tradeoff. Neither replaces
          testing the customer’s actual page.
        </p>
        <p className="stratosphere-fineprint">
          The downloaded map includes your design’s words and settings. Keep it with your private
          project files.
        </p>
        <details className="stratosphere-map-details">
          <summary>
            Show connections and current values{" "}
            <span>{graph.edges.length} declared relationships</span>
          </summary>
          <div
            className="stratosphere-table-scroll"
            role="region"
            aria-label="Decision connections"
            tabIndex={0}
          >
            <table>
              <caption className="sr-only">
                Live connections between current decisions and their declared effects
              </caption>
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">To</th>
                  <th scope="col">Why it matters</th>
                </tr>
              </thead>
              <tbody>
                {graph.edges.map((edge) => (
                  <tr key={edge.id}>
                    <th scope="row">
                      {nodes.get(edge.from)?.label ?? edge.from}
                      <small>{nodes.get(edge.from)?.value}</small>
                    </th>
                    <td>
                      {edge.kind}
                      {edge.blocked && (
                        <small className="stratosphere-attention">Needs attention</small>
                      )}
                    </td>
                    <td>
                      {nodes.get(edge.to)?.label ?? edge.to}
                      <small>{nodes.get(edge.to)?.value}</small>
                    </td>
                    <td>{edge.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
        <details className="stratosphere-map-details">
          <summary>Review guardrails and output limits</summary>
          <ul>
            {graph.issues.map((issue) => (
              <li key={issue.id}>
                <strong>
                  {issue.kind === "measured"
                    ? "Measured rule"
                    : issue.kind === "advisory"
                      ? "Recommendation"
                      : "Output rule"}
                  :
                </strong>{" "}
                {issue.message}
              </li>
            ))}
          </ul>
          <ul>
            {graph.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
        <div className="garden-footer">
          <Link to="/" search={{}}>
            Return to your journey
          </Link>
          <Link to="/quality">Plan component and usability checks</Link>
        </div>
      </section>
    </main>
  );
}
