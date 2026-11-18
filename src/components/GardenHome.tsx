import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { focusLocalStorage } from "@/lib/browser-storage";
import { GARDEN_STEPS, getGardenStep, type GardenStepId } from "@/lib/garden-content";
import {
  GARDEN_DEFAULTS,
  readGardenPreferences,
  writeGardenPreferences,
  type GardenPreferences,
} from "@/lib/garden-preferences";

const stops = [58, 32, 64, 30, 64, 30, 64, 30, 58].map((left, index) => ({
  left: `${left}%`,
  top: `${9 + index * 10.5}%`,
  catLeft: left > 50 ? "1%" : "48%",
  catTop: `${index * 10.5}%`,
}));

const destinations = {
  target: "/target",
  telescope: "/telescope",
  stratosphere: "/stratosphere",
  quality: "/quality",
} as const;

export function GardenHome() {
  const [preferences, setPreferences] = useState<GardenPreferences>({ ...GARDEN_DEFAULTS });
  const [ready, setReady] = useState(false);
  const [issue, setIssue] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const lessonSummary = useRef<HTMLElement>(null);
  const focusOnStep = useRef(false);
  useEffect(() => {
    const restored = readGardenPreferences(focusLocalStorage);
    setPreferences(restored.value);
    setIssue(restored.issue);
    setReady(true);
  }, []);
  useEffect(() => {
    if (focusOnStep.current) {
      heading.current?.focus();
      focusOnStep.current = false;
    }
  }, [preferences.step]);

  const change = (patch: Partial<Omit<GardenPreferences, "version">>) => {
    if (!ready) return;
    const next = { ...preferences, ...patch };
    setPreferences(next);
    setIssue(writeGardenPreferences(focusLocalStorage, next));
  };
  const visit = (step: GardenStepId) => {
    focusOnStep.current = step !== preferences.step;
    change({ step });
  };
  const index = GARDEN_STEPS.findIndex((step) => step.id === preferences.step);
  const step = getGardenStep(preferences.step);
  const position = stops[index]!;
  const isGoal = step.id === "goal";
  const studio = step.action === "studio" || step.action === "gallery";

  return (
    <div className="garden-page">
      <AppHeader />
      <main id="main-content" className="garden-layout" aria-busy={!ready}>
        <aside className="garden-landscape" aria-label="Your journey with Reverie">
          <p className="garden-motto">A little clarity. A calmer path.</p>
          <div className="garden-map">
            <img
              className="garden-river"
              src="/brand/garden-river.png"
              width="1024"
              height="1536"
              alt=""
              decoding="async"
            />
            <img
              className="garden-reverie"
              src="/brand/reverie-kite.png"
              width="1254"
              height="1254"
              alt="Reverie walking with her kite"
              style={{ left: position.catLeft, top: position.catTop }}
              decoding="async"
            />
            <nav aria-label="Garden Path steps">
              <ol>
                {GARDEN_STEPS.map((stop, i) => (
                  <li key={stop.id} style={{ left: stops[i]!.left, top: stops[i]!.top }}>
                    <button
                      type="button"
                      onClick={() => visit(stop.id)}
                      disabled={!ready}
                      aria-current={stop.id === step.id ? "step" : undefined}
                      aria-label={`${i + 1}. ${stop.title}`}
                    >
                      <span className="garden-stop-number" aria-hidden="true">
                        {i + 1}
                      </span>
                      <span className="garden-full-label" aria-hidden="true">
                        {stop.title}
                      </span>
                      <span className="garden-short-label" aria-hidden="true">
                        {stop.shortTitle}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <p className="garden-map-caption">
            Follow the path at your pace. Every stop is yours to revisit.
          </p>
        </aside>

        <section className="garden-work" aria-labelledby="garden-heading">
          <div className="garden-work-top">
            <p className="eyebrow">
              Step {index + 1} of {GARDEN_STEPS.length}
            </p>
            <label className="garden-brief-toggle">
              <input
                type="checkbox"
                checked={preferences.brief}
                disabled={!ready}
                onChange={(event) => change({ brief: event.target.checked })}
                aria-describedby="garden-brief-help"
              />
              Keep it brief
            </label>
          </div>
          <span id="garden-brief-help" className="sr-only">
            Hide the longer lessons. Your preference is saved in this browser when storage is
            available.
          </span>
          {issue && (
            <p role="status" className="garden-storage-note">
              {issue} You can keep exploring in this tab.
            </p>
          )}
          <h1 ref={heading} id="garden-heading" tabIndex={-1}>
            {isGoal ? "What are we working on?" : step.title}
          </h1>
          <p className="garden-intro">
            {isGoal ? "I’m Reverie. We’ll take this one thoughtful step at a time." : step.intro}
          </p>
          {isGoal && (
            <Link to="/field-guide" className="garden-text-action garden-field-guide-link">
              <BookOpen size={18} aria-hidden="true" />
              New to this? Learn the words and try a practice trail.
            </Link>
          )}

          {isGoal ? (
            <fieldset className="garden-goals" disabled={!ready}>
              <legend className="sr-only">Choose a starting point</legend>
              {step.choices.map((choice) => (
                <label key={choice.id} className="garden-goal">
                  <input
                    type="radio"
                    name="garden-goal"
                    value={choice.id}
                    checked={preferences.goal === choice.id}
                    onChange={() => change({ goal: choice.id === "existing" ? "existing" : "new" })}
                  />
                  <span>
                    <strong>
                      {choice.id === "existing" ? "An existing app or website" : "A new page"}
                    </strong>
                    <span>{choice.benefit}</span>
                    <span className="garden-tradeoff">{choice.tradeoff}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : (
            <div className="garden-task">
              <p className="garden-purpose">{step.purpose}</p>
              <ul>
                {step.essentials.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {step.id === "direction" && (
                <p className="garden-context">
                  {preferences.goal === "existing"
                    ? "Your starting point: an existing app or website. Keep its useful features as you explore."
                    : "Your starting point: a new page. Make room for real content as you explore."}
                </p>
              )}
              <details className="garden-options">
                <summary>
                  See the choices and tradeoffs <ChevronDown size={16} aria-hidden="true" />
                </summary>
                <dl>
                  {step.choices.map((choice) => (
                    <div key={choice.id}>
                      <dt>{choice.title}</dt>
                      <dd>
                        {choice.benefit} <span>{choice.tradeoff}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            </div>
          )}

          <p className="garden-evidence">
            {isGoal ? "Your live site stays unchanged while you plan." : step.evidenceNote}
          </p>
          <div className="garden-actions">
            {isGoal ? (
              <button
                className="garden-primary"
                type="button"
                disabled={!ready}
                onClick={() => visit("content")}
              >
                Continue <ArrowRight size={18} aria-hidden="true" />
              </button>
            ) : studio ? (
              <Link to="/" search={{ view: "studio" }} className="garden-primary">
                {step.actionLabel} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to={destinations[step.action as keyof typeof destinations]}
                className="garden-primary"
              >
                {step.actionLabel} <ArrowRight size={18} aria-hidden="true" />
              </Link>
            )}
            {!isGoal && index < GARDEN_STEPS.length - 1 && (
              <button
                className="garden-text-action"
                type="button"
                onClick={() => visit(GARDEN_STEPS[index + 1]!.id)}
              >
                Visit next stop <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
          {!isGoal && (
            <p className="garden-return-note">
              Use “Your journey” in the menu to return here. Visiting a stop does not mark its work
              as done.
            </p>
          )}

          <details className="garden-learn" open={!preferences.brief}>
            <summary
              ref={lessonSummary}
              onClick={(event) => {
                event.preventDefault();
                change({ brief: !preferences.brief });
              }}
              aria-expanded={!preferences.brief}
            >
              <BookOpen size={21} aria-hidden="true" />
              <span>Learn: {step.lessons[0]!.title.toLowerCase()}</span>
              <ChevronDown className="garden-lesson-chevron" size={18} aria-hidden="true" />
            </summary>
            <div className="garden-lessons">
              {step.lessons.map((lesson) => (
                <article key={lesson.id}>
                  <h2>{lesson.title}</h2>
                  {lesson.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  <aside className="garden-example">
                    <h3>{lesson.example.title}</h3>
                    <p>{lesson.example.text}</p>
                  </aside>
                </article>
              ))}
              <button
                className="garden-text-action"
                type="button"
                onClick={() => {
                  change({ brief: true });
                  lessonSummary.current?.focus();
                }}
              >
                Hide the longer lessons
              </button>
            </div>
          </details>
          <div className="garden-footer">
            {index > 0 ? (
              <button
                type="button"
                className="garden-text-action"
                onClick={() => visit(GARDEN_STEPS[index - 1]!.id)}
              >
                <ArrowLeft size={15} aria-hidden="true" /> Previous stop
              </button>
            ) : (
              <Link to="/reverie">Meet Reverie</Link>
            )}
            <Link to="/welcome">Detailed walkthrough</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
