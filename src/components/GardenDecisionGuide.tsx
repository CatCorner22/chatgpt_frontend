import { useEffect, useId, useState } from "react";
import type { GardenStepId } from "@/lib/garden-content";

type Guide = typeof import("@/lib/garden-decisions.data.json");

const actors: Record<string, string> = {
  owner: "You decide",
  "owner-and-developer": "You and your developer",
  developer: "Your developer implements this",
  reviewer: "Your reviewer checks this",
};
const modes: Record<string, string> = {
  single: "Choose a policy for this project.",
  combine: "These approaches can work together.",
  contextual: "Use the approach that fits each part of the task.",
};

/** Optional learning only. No project writes, capability toggles or completion credit. */
export function GardenDecisionGuide({ stepId }: { stepId: GardenStepId }) {
  const [guide, setGuide] = useState<Guide | null>(null);
  const [problem, setProblem] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState("");
  const selectId = useId();

  useEffect(() => {
    let active = true;
    setProblem(false);
    import("@/lib/garden-decisions.data.json")
      .then((data) => {
        if (active) setGuide(data.default);
      })
      .catch(() => {
        if (active) setProblem(true);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const decisions = guide?.decisions.filter((item) => item.region === stepId) ?? [];
  const decision = decisions.find((item) => item.id === selected) ?? decisions[0];
  return (
    <section className="garden-decision-guide" aria-label="Design decision field notes">
      <h2>One question at a time</h2>
      <p>
        Explore the decisions behind this stop. These are planning notes for you and your developer,
        who may be an AI tool. Reading them changes no project and proves no test.
      </p>
      {problem ? (
        <div role="status">
          <p>
            The field notes could not load. Your work and the rest of the path are still available.
          </p>
          <button
            type="button"
            className="garden-text-action"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Load the field notes again
          </button>
        </div>
      ) : !decision ? (
        <p role="status">Loading the field notes…</p>
      ) : (
        <>
          <label htmlFor={selectId}>Explore a question ({decisions.length} at this stop)</label>
          <select
            id={selectId}
            value={decision.id}
            onChange={(event) => setSelected(event.target.value)}
          >
            {decisions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.question}
              </option>
            ))}
          </select>
          <article key={decision.id}>
            <h3>{decision.question}</h3>
            <p className="garden-decision-meta">
              {actors[decision.actor]} · {modes[decision.mode]}
            </p>
            <p>
              <strong>When it applies:</strong> {decision.applies} If this is unknown, clarify it
              before acting.
            </p>
            <ol className="garden-approaches">
              {decision.approaches.map((approach, index) => (
                <li key={approach.id}>
                  <h4>Approach {index + 1}</h4>
                  <p>{approach.consequence}</p>
                  <p>
                    <strong>Check the result:</strong> {approach.checks.join(" ")}
                  </p>
                </li>
              ))}
            </ol>
            <details className="garden-decision-sources">
              <summary>Sources and limits</summary>
              <ul>
                {decision.sources.map((source) => (
                  <li key={source.title}>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">
                        {source.title} (opens a new tab)
                      </a>
                    ) : (
                      <strong>{source.title}</strong>
                    )}
                    <p>{source.limit}</p>
                  </li>
                ))}
              </ul>
              <p>
                Questions and approaches are Focus’s research synthesis. They are not a
                certification or a promise that every capability is built.
              </p>
            </details>
          </article>
        </>
      )}
    </section>
  );
}
