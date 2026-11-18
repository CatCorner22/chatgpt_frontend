import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  FIELD_GUIDE_AREAS,
  FIELD_GUIDE_CHOICES,
  FIELD_GUIDE_SOURCES,
  FIELD_GUIDE_TERMS,
} from "@/lib/field-guide";

const practiceDestinationLabels: Record<string, string> = {
  "/target": "Open Target to prepare a handoff",
  "/?view=studio": "Open the design studio",
  "/quality": "Open the quality lab",
};

/** Learning choices stay in this mounted guide; they never change a design or a project. */
export function FieldGuide() {
  const id = useId();
  const [brief, setBrief] = useState(true);
  const [query, setQuery] = useState("");
  const [stationIndex, setStationIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const stationHeading = useRef<HTMLHeadingElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const focusStation = useRef(false);
  const station = FIELD_GUIDE_CHOICES[stationIndex]!;
  const selected = station.options.find((option) => option.id === selections[station.id]);
  const explored = FIELD_GUIDE_CHOICES.filter((choice) => selections[choice.id]).length;
  const search = query.trim().toLocaleLowerCase();
  const terms = FIELD_GUIDE_TERMS.filter((term) =>
    [term.term, term.plain, term.example, term.whyItMatters].some((text) =>
      text.toLocaleLowerCase().includes(search),
    ),
  );

  useEffect(() => {
    if (!focusStation.current) return;
    stationHeading.current?.focus();
    focusStation.current = false;
  }, [stationIndex]);

  function visitStation(index: number) {
    if (index === stationIndex) {
      stationHeading.current?.focus();
      return;
    }
    focusStation.current = true;
    setStationIndex(index);
  }

  function resetPractice() {
    setSelections({});
    setNotice("Practice choices cleared.");
    visitStation(0);
  }

  return (
    <main id="main-content" className="field-guide">
      <header className="field-guide-hero">
        <div className="field-guide-intro">
          <p className="field-guide-eyebrow">Learn with Reverie</p>
          <h1>Your design field guide</h1>
          <p className="field-guide-lead">
            A few useful words. A little room to play. You don’t need to know the jargon to make
            thoughtful choices for your project.
          </p>
          <p>Start with the practice trail, or look up a word whenever you need it.</p>
          <div className="field-guide-actions">
            <a href="#practice-trail" className="field-guide-primary">
              Try the practice trail
            </a>
            <a href="#guide-words" className="field-guide-secondary">
              Browse the words
            </a>
          </div>
        </div>
        <figure className="field-guide-reverie">
          <img
            src="/brand/cat-library.png"
            width="384"
            height="351"
            alt="Reverie reading her little field guide"
            decoding="async"
          />
          <figcaption>One useful idea at a time.</figcaption>
        </figure>
      </header>

      <details className="field-guide-area-legend">
        <summary>What do Focus’s feature names mean?</summary>
        <p>
          These are the names used inside Focus. They are separate from the general design terms
          below.
        </p>
        <dl>
          {FIELD_GUIDE_AREAS.map((area) => (
            <div key={area.id}>
              <dt>{area.name}</dt>
              <dd>{area.plain}</dd>
            </div>
          ))}
        </dl>
      </details>

      <section
        id="practice-trail"
        className="field-guide-trail"
        aria-labelledby={`${id}-trail-title`}
      >
        <div className="field-guide-section-heading">
          <div>
            <p className="field-guide-eyebrow">Practice only</p>
            <h2 id={`${id}-trail-title`}>Three small choices. See what follows.</h2>
            <p>
              Try either route at each station. There are no right answers or scores, and these
              choices do not change your project.
            </p>
          </div>
          <button type="button" className="field-guide-text-button" onClick={resetPractice}>
            Reset practice
          </button>
        </div>

        <div className="field-guide-trail-progress">
          <p>
            {explored} of {FIELD_GUIDE_CHOICES.length} choices explored
          </p>
          <span>Your practice resets when you leave this guide.</span>
        </div>
        <nav aria-label="Practice stations" className="field-guide-stations">
          <ol>
            {FIELD_GUIDE_CHOICES.map((choice, index) => (
              <li key={choice.id}>
                <button
                  type="button"
                  aria-current={index === stationIndex ? "step" : undefined}
                  aria-label={`${index + 1}. ${choice.title}`}
                  onClick={() => visitStation(index)}
                >
                  <span className="field-guide-station-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span>
                    {choice.title}
                    <small>{selections[choice.id] ? "Choice explored" : "Open to explore"}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="field-guide-station">
          <p className="field-guide-eyebrow">
            Station {stationIndex + 1} of {FIELD_GUIDE_CHOICES.length}
          </p>
          <h3 ref={stationHeading} tabIndex={-1}>
            {station.title}
          </h3>
          <fieldset>
            <legend>{station.question}</legend>
            <div className="field-guide-options">
              {station.options.map((option) => (
                <label
                  key={`${station.id}-${option.id}`}
                  className={`field-guide-option${selected?.id === option.id ? " is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`${id}-${station.id}`}
                    value={option.id}
                    checked={selected?.id === option.id}
                    onChange={() => {
                      setSelections((current) => ({ ...current, [station.id]: option.id }));
                      setNotice(`${option.label} selected for ${station.title}.`);
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {selected ? (
            <section className="field-guide-consequences" aria-labelledby={`${id}-consequences`}>
              <h4 id={`${id}-consequences`}>What this choice changes</h4>
              <dl>
                <div>
                  <dt>Benefit</dt>
                  <dd>{selected.benefit}</dd>
                </div>
                <div>
                  <dt>Tradeoff</dt>
                  <dd>{selected.tradeoff}</dd>
                </div>
              </dl>
              <h5>Downstream effects</h5>
              <ul>
                {selected.downstream.map((effect) => (
                  <li key={effect}>{effect}</li>
                ))}
              </ul>
              {selected.route && (
                <p className="field-guide-tool-link">
                  <a href={selected.route}>
                    {practiceDestinationLabels[selected.route] ?? "Explore this in Focus"}
                  </a>
                  <span>Opens the tool; your practice choice is not applied.</span>
                </p>
              )}
            </section>
          ) : (
            <p className="field-guide-pick-hint">
              Pick either route to see what it changes. You can change your mind.
            </p>
          )}

          <p className="field-guide-related">
            Words you’ll meet:{" "}
            {station.termIds
              .map((termId) => FIELD_GUIDE_TERMS.find((term) => term.id === termId)?.term)
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="field-guide-station-actions">
            <button
              type="button"
              className="field-guide-secondary"
              disabled={stationIndex === 0}
              onClick={() => visitStation(stationIndex - 1)}
            >
              Previous station
            </button>
            <button
              type="button"
              className="field-guide-primary"
              disabled={stationIndex === FIELD_GUIDE_CHOICES.length - 1}
              onClick={() => visitStation(stationIndex + 1)}
            >
              Next station
            </button>
          </div>
        </div>
        <p role="status" aria-live="polite" className="sr-only">
          {notice}
        </p>
        {explored === FIELD_GUIDE_CHOICES.length && (
          <p className="field-guide-explored">
            You’ve explored all three choices. Revisit any station, or bring your questions to the
            Garden Path.
          </p>
        )}
      </section>

      <section id="guide-words" className="field-guide-words" aria-labelledby={`${id}-words-title`}>
        <div className="field-guide-section-heading">
          <div>
            <p className="field-guide-eyebrow">A pocketful of useful words</p>
            <h2 id={`${id}-words-title`}>What does that mean?</h2>
            <p>Plain explanations, practical examples, and sources you can check.</p>
          </div>
          <label className="field-guide-depth">
            <input
              type="checkbox"
              checked={brief}
              onChange={(event) => setBrief(event.target.checked)}
              aria-describedby={`${id}-depth-help`}
            />
            <span>Keep it brief</span>
          </label>
        </div>
        <p id={`${id}-depth-help`} className="field-guide-depth-help">
          Turn off “Keep it brief” to open the examples and why each term matters. Practice outcomes
          always stay visible.
        </p>
        <div className="field-guide-search">
          <label htmlFor={`${id}-search`}>Find a term</label>
          <div>
            <input
              ref={searchInput}
              id={`${id}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try contrast or preview"
              aria-describedby={`${id}-search-result`}
            />
            {query && (
              <button
                type="button"
                className="field-guide-secondary"
                onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
              >
                Clear search
              </button>
            )}
          </div>
          <p id={`${id}-search-result`} role="status" aria-live="polite">
            {terms.length
              ? `${terms.length} ${terms.length === 1 ? "term" : "terms"} shown`
              : "No terms match this search. Try a different word or clear your search."}
          </p>
        </div>
        <div className="field-guide-term-grid">
          {terms.map((term) => (
            <article
              key={term.id}
              id={`term-${term.id}`}
              className="field-guide-term"
              aria-labelledby={`${id}-${term.id}-title`}
            >
              <h3 id={`${id}-${term.id}-title`}>{term.term}</h3>
              <p>{term.plain}</p>
              <details key={`${term.id}-${brief ? "brief" : "deeper"}`} open={!brief}>
                <summary>
                  Example and why it matters<span className="sr-only">: {term.term}</span>
                </summary>
                <div className="field-guide-term-detail">
                  <h4>For example</h4>
                  <p>{term.example}</p>
                  <h4>Why it matters</h4>
                  <p>{term.whyItMatters}</p>
                </div>
              </details>
              <p className="field-guide-term-sources">
                Sources:{" "}
                {term.sourceIds.map((sourceId, index) => {
                  const source = FIELD_GUIDE_SOURCES.find((item) => item.id === sourceId);
                  return source ? (
                    <span key={sourceId}>
                      {index > 0 && " · "}
                      <a href={`#source-${source.id}`}>{source.publisher}</a>
                    </span>
                  ) : null;
                })}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="field-guide-next" aria-labelledby={`${id}-next-title`}>
        <div>
          <p className="field-guide-eyebrow">Whenever you’re ready</p>
          <h2 id={`${id}-next-title`}>Bring one idea back to your project.</h2>
          <p>
            Use the Garden Path for a guided next step, or open the studio to work on your design.
          </p>
        </div>
        <div className="field-guide-actions">
          <Link to="/" search={{}} className="field-guide-primary">
            Back to the Garden Path
          </Link>
          <Link to="/" search={{ view: "studio" }} className="field-guide-secondary">
            Open the design studio
          </Link>
        </div>
      </section>

      <section className="field-guide-sources" aria-labelledby={`${id}-sources-title`}>
        <h2 id={`${id}-sources-title`}>Where these explanations come from</h2>
        <p>
          These short explanations adapt the ideas in the references below. Open a source for the
          fuller guidance.
        </p>
        <ul>
          {FIELD_GUIDE_SOURCES.map((source) => (
            <li id={`source-${source.id}`} key={source.id}>
              <span>{source.publisher}</span>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
