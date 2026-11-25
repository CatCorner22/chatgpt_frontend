import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BookOpen, ChevronDown } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { GardenJourneyBrief } from "@/components/GardenJourneyBrief";
import { GardenStudioAction } from "@/components/GardenStudioAction";
import { GardenDecisionGuide } from "@/components/GardenDecisionGuide";
import { focusLocalStorage } from "@/lib/browser-storage";
import { useDraftExitSave } from "@/hooks/useDraftExitSave";
import { GARDEN_STEPS, getGardenStep, type GardenStepId } from "@/lib/garden-content";
import { GARDEN_FORMULA } from "@/lib/garden-formula";
import {
  GARDEN_DEFAULTS,
  readGardenPreferences,
  writeGardenPreferences,
  type GardenPreferences,
} from "@/lib/garden-preferences";

type PreferencePatch = Partial<Omit<GardenPreferences, "version">>;

const stops = [60, 34, 64, 34, 64, 34, 64, 34, 60].map((left, index) => ({
  left: `${left}%`,
  top: `${9 + index * 10.5}%`,
  catLeft: left > 50 ? "0%" : "63%",
  catTop: `${Math.max(0, index * 10.5 - 8)}%`,
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
  const [openBriefDesign, setOpenBriefDesign] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const lessonSummary = useRef<HTMLElement>(null);
  const focusOnStep = useRef(false);
  const pendingPreferences = useRef<PreferencePatch>({});
  const preferenceBase = useRef<PreferencePatch>({});
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

  function flushPreferences(snapshot?: ReturnType<typeof readGardenPreferences>) {
    const pending = pendingPreferences.current;
    const keys = Object.keys(pending) as (keyof PreferencePatch)[];
    if (!keys.length) return true;
    const latest = snapshot ?? readGardenPreferences(focusLocalStorage);
    if (latest.issue) {
      setIssue(
        "Garden preferences could not be confirmed as saved. Your choices remain in this tab.",
      );
      return false;
    }
    // Only retry fields that still match their original value or this edit.
    if (
      keys.some(
        (key) =>
          latest.value[key] !== preferenceBase.current[key] && latest.value[key] !== pending[key],
      )
    ) {
      setIssue(
        "Another tab changed a Garden choice. Revisit that choice here or reload to use the saved version.",
      );
      return false;
    }
    const saveIssue = keys.every((key) => latest.value[key] === pending[key])
      ? ""
      : writeGardenPreferences(focusLocalStorage, { ...latest.value, ...pending });
    if (!saveIssue) {
      pendingPreferences.current = {};
      preferenceBase.current = {};
    }
    setIssue(saveIssue);
    return !saveIssue;
  }

  useDraftExitSave(() => flushPreferences());

  const change = (patch: PreferencePatch) => {
    if (!ready) return;
    const latest = readGardenPreferences(focusLocalStorage);
    const base = latest.issue ? preferences : latest.value;
    for (const key of Object.keys(patch) as (keyof PreferencePatch)[])
      Object.assign(preferenceBase.current, { [key]: base[key] });
    pendingPreferences.current = { ...pendingPreferences.current, ...patch };
    const next = { ...base, ...pendingPreferences.current };
    // Keep this tab on the route and starting point it shows while merging unrelated saved choices.
    setPreferences({
      ...next,
      step: patch.step ?? preferences.step,
      goal: patch.goal ?? preferences.goal,
    });
    flushPreferences(latest);
  };
  const visit = (step: GardenStepId) => {
    focusOnStep.current = step !== preferences.step;
    change({ step });
  };
  const index = GARDEN_STEPS.findIndex((step) => step.id === preferences.step);
  const step = getGardenStep(preferences.step);
  const formula = GARDEN_FORMULA[step.id];
  const position = stops[index]!;
  const isGoal = step.id === "goal";
  const studio = step.action === "studio" || step.action === "gallery";

  const introduction = (
    <>
      <div className="garden-work-top">
        <div className="garden-step-navigation">
          <p className="eyebrow">
            Step {index + 1} of {GARDEN_STEPS.length}
          </p>
          {!isGoal && (
            <button type="button" className="garden-text-action" onClick={() => visit("goal")}>
              Change starting point
            </button>
          )}
        </div>
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
        Hide the longer lessons. Your preference is saved in this browser when storage is available.
      </span>
      {issue && (
        <p role="status" className="garden-storage-note">
          {issue} You can keep exploring in this tab.
        </p>
      )}
      <h1 ref={heading} id="garden-heading" tabIndex={-1}>
        {isGoal ? "Where do we start?" : step.title}
      </h1>
      <p className="garden-intro">{isGoal ? "I’m Reverie, your design guide." : step.intro}</p>
    </>
  );

  return (
    <div className="garden-page">
      <AppHeader />
      <main
        id="main-content"
        className={isGoal ? "garden-layout garden-entry-layout" : "garden-layout"}
        aria-busy={!ready}
      >
        {isGoal && (
          <section className="garden-work garden-entry" aria-labelledby="garden-heading">
            {introduction}
            <fieldset className="garden-goals garden-entry-choices" disabled={!ready}>
              <legend className="sr-only">Choose a starting point</legend>
              {step.choices.map((choice) => (
                <label key={choice.id} className="garden-goal">
                  <input
                    type="radio"
                    name="garden-goal"
                    value={choice.id}
                    checked={preferences.goal === choice.id}
                    onChange={() => change({ goal: choice.id === "existing" ? "existing" : "new" })}
                    aria-labelledby={`garden-choice-${choice.id}`}
                    aria-describedby={`garden-choice-help-${choice.id}`}
                  />
                  <span>
                    <strong id={`garden-choice-${choice.id}`}>{choice.title}</strong>
                    <span id={`garden-choice-help-${choice.id}`}>{choice.benefit}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="garden-actions">
              <button
                className="garden-primary"
                type="button"
                disabled={!ready}
                onClick={() => visit("content")}
              >
                Continue <ArrowRight size={18} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}
        <aside className="garden-landscape" aria-label="Your journey with Reverie">
          <p className="garden-motto">A little clarity. A calmer path.</p>
          <div className="garden-map">
            <img
              className="garden-river"
              src="/brand/garden-river.webp"
              width="1024"
              height="1536"
              alt=""
              decoding="async"
            />
            <img
              className="garden-reverie"
              src="/brand/reverie-kite.webp"
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

        <section
          className="garden-work garden-step-body"
          aria-label={isGoal ? "Planning your project" : undefined}
          aria-labelledby={isGoal ? undefined : "garden-heading"}
        >
          {!isGoal && introduction}
          <div className="garden-formula-row">
            <dl className="garden-formula" aria-label="Your next small step">
              <div>
                <dt>Do</dt>
                <dd>{formula.do}</dd>
              </div>
              <div>
                <dt>Changes</dt>
                <dd>{formula.changes}</dd>
              </div>
              <div>
                <dt>Check</dt>
                <dd>{formula.check}</dd>
              </div>
            </dl>
            <figure className="garden-map-guide">
              <img
                src="/brand/reverie-map-guide.webp"
                width="1254"
                height="1254"
                loading="lazy"
                alt="Reverie reading a map"
                decoding="async"
              />
              <figcaption>One small step, then a real check.</figcaption>
            </figure>
          </div>
          {isGoal && (
            <p className="garden-scope-note">
              {step.choices.find((choice) => choice.id === preferences.goal)?.tradeoff}
            </p>
          )}
          {isGoal && (
            <Link to="/field-guide" className="garden-text-action garden-field-guide-link">
              <BookOpen size={18} aria-hidden="true" />
              New to this? Learn the words and try a practice trail.
            </Link>
          )}

          {!isGoal && (
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
                    : "Your starting point: a new app or website. Make room for real content as you explore."}
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

          <GardenJourneyBrief
            step={step}
            goal={preferences.goal}
            onOpenDesignChange={setOpenBriefDesign}
          />

          <p className="garden-evidence">
            {isGoal ? "Your live site stays unchanged while you plan." : step.evidenceNote}
          </p>
          {formula.scopeNote && <p className="garden-scope-note">{formula.scopeNote}</p>}
          {!isGoal && (
            <div className="garden-actions">
              {formula.primaryGroup || studio ? (
                <GardenStudioAction
                  key={openBriefDesign ?? step.id}
                  designId={openBriefDesign}
                  group={formula.primaryGroup}
                  start={preferences.goal}
                  className="garden-primary"
                >
                  {formula.primaryLabel ?? step.actionLabel}{" "}
                  <ArrowRight size={18} aria-hidden="true" />
                </GardenStudioAction>
              ) : (
                <Link
                  to={destinations[step.action as keyof typeof destinations]}
                  className="garden-primary"
                >
                  {step.actionLabel} <ArrowRight size={18} aria-hidden="true" />
                </Link>
              )}
              {index < GARDEN_STEPS.length - 1 && (
                <button
                  className="garden-text-action"
                  type="button"
                  onClick={() => visit(GARDEN_STEPS[index + 1]!.id)}
                >
                  Visit next stop <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          {formula.details && (
            <nav className="garden-detail-links" aria-label="Other craft details">
              <span>Then explore</span>
              {formula.details.map((detail) => (
                <GardenStudioAction
                  key={detail.group}
                  designId={openBriefDesign}
                  group={detail.group}
                  className="garden-text-action"
                >
                  {detail.label}
                </GardenStudioAction>
              ))}
            </nav>
          )}
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
              {!preferences.brief && <GardenDecisionGuide key={step.id} stepId={step.id} />}
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
