import { DEFAULT_PAGE_SETTINGS } from "@/lib/page-settings";
import { migrate, type State } from "@/lib/studio-state";
import { StudioWelcome, StarterCollection } from "@/components/StudioWelcome";
import { AI_SPENDING_ENABLED } from "@/lib/ai-policy";
import { hasCloudBackend } from "@/lib/runtime-config";
import { createLocalDirections } from "@/lib/local-design";
import { ArrowRight, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useLeaveGuard, useWait } from "@/hooks/useUx";
import { toast } from "sonner";
import { DesignPreview } from "@/components/DesignPreview";
import { readProfile, profileText } from "@/lib/portrait";
import { readLibrary, resumeLabel, type LibraryEntry } from "@/lib/library";
import type { OpenMode } from "@/components/QuickStart";
import type { GalleryItem } from "@/lib/gallery";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { questionCount } from "@/lib/design";
import { proposeDirections } from "@/lib/design.functions";
import { AUDIENCES, TONES, type Purpose, GOALS, DEVICES, READING } from "@/lib/engine";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { purposeText, type StudioStageProps } from "./stage";

const EXAMPLES = [
  "A neighborhood ceramics studio in Portland offering wheel classes and selling small-batch tableware.",
  "A bookkeeping service for independent tattoo artists who hate spreadsheets.",
  "A climate-tech startup that turns restaurant food waste into compost for city farms.",
];

export function Brief({ s, update }: StudioStageProps) {
  const run = useServerFn(proposeDirections);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const req = useRef(0);
  useEffect(() => {
    const requests = req;
    return () => {
      requests.current++;
    };
  }, []);
  const wait = useWait(busy, "Designing three directions");
  useLeaveGuard(busy);
  const go = async () => {
    const id = ++req.current;
    setBusy(true);
    setErr("");
    try {
      const r =
        AI_SPENDING_ENABLED && hasCloudBackend()
          ? await run({
              data: {
                brief: s.brief,
                purpose: purposeText(s.purpose),
                taste: profileText(readProfile()),
              },
            })
          : createLocalDirections(s.brief, s.purpose);
      if (id !== req.current) return; // cancelled
      update({
        stage: "directions",
        content: r.content,
        page: { ...DEFAULT_PAGE_SETTINGS },
        directions: r.directions,
        aiCalls: s.aiCalls + (AI_SPENDING_ENABLED && hasCloudBackend() ? 1 : 0),
        cache: {},
        tokens: null,
        libraryId: crypto.randomUUID(),
        projectId: null,
        savedHash: null,
      });
    } catch (e) {
      if (id === req.current) setErr((e as Error).message);
    } finally {
      if (id === req.current) setBusy(false);
    }
  };
  const openGallery = (g: GalleryItem, mode: OpenMode = "exam") => {
    const before = { ...s };
    update({
      stage: mode,
      brief: g.brief,
      content: g.content,
      page: { ...DEFAULT_PAGE_SETTINGS },
      directions: [g.direction],
      direction: g.direction.name,
      tokens: g.direction.tokens,
      stepIndex: 0,
      picks: [],
      history: [],
      cache: {},
      recheck: [],
      projectId: null,
      savedHash: null,
      libraryId: crypto.randomUUID(),
    });
    if (before.tokens)
      toast(`Opened ${g.direction.name}`, {
        duration: 8000,
        action: { label: "Undo", onClick: () => update(before) },
      });
  };
  const previousStage = [...s.past]
    .reverse()
    .find((p) => p.libraryId === s.libraryId && p.stage !== "brief")?.stage;
  const resumeStage =
    previousStage === "rx" || previousStage === "review"
      ? previousStage
      : s.stepIndex >= questionCount(s.quick)
        ? "review"
        : "exam";
  return (
    <>
      <StudioWelcome
        brief={s.brief}
        onBrief={(brief) => update({ brief })}
        onStart={() => void go()}
        busy={busy}
        error={err}
        quick={s.quick}
        onQuick={(quick) => update({ quick })}
        experience={s.purpose.experience ?? "website"}
        integration={s.integration}
        onIntegration={(integration) => update({ integration })}
        onExperience={(experience) => update({ purpose: { ...s.purpose, experience } })}
        resume={
          s.tokens ? (
            <div className="resume-current">
              <span>
                Keep going with <strong>{s.content?.brand}</strong>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  update({
                    stage: resumeStage,
                  })
                }
              >
                Continue design <ArrowRight size={14} />
              </Button>
            </div>
          ) : (
            <ResumeList onOpen={(st) => update(migrate(st as Partial<State>))} />
          )
        }
        settings={
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Choice
              label="Audience"
              value={s.purpose.audience}
              list={AUDIENCES}
              onChange={(v) =>
                update({ purpose: { ...s.purpose, audience: v as Purpose["audience"] } })
              }
            />
            <Choice
              label="Feeling"
              value={s.purpose.tone}
              list={TONES}
              onChange={(v) => update({ purpose: { ...s.purpose, tone: v as Purpose["tone"] } })}
            />
          </div>
        }
      />
      <details className="studio-collection-disclosure">
        <summary>Or browse the design collection</summary>
        <StarterCollection onOpen={(g) => openGallery(g)} />
      </details>
    </>
  );
}

function Choice({
  label,
  value,
  list,
  onChange,
}: {
  label: string;
  value: string;
  list: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="eyebrow">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-sm border border-input bg-background px-2"
      >
        <option value="">No preference</option>
        {list.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Directions({ s, update }: StudioStageProps) {
  useDesignFonts(s.directions.map((d) => d.tokens));
  if (!s.content) return null;
  return (
    <main className="mx-auto max-w-7xl px-5 py-10 md:px-10">
      <p className="eyebrow">Your starting point</p>
      <h2 className="mt-2 font-display text-4xl md:text-5xl">Which direction is closest?</h2>
      <p className="mt-2 max-w-xl text-muted-foreground">
        Three looks from the collection, using your words. Pick a direction, then make it your own.
      </p>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {s.directions.map((d, i) => (
          <button
            key={i}
            onClick={() =>
              update({
                stage: "exam",
                direction: d.name,
                tokens: d.tokens,
                stepIndex: 0,
                picks: [],
                history: [],
                cache: {},
                recheck: [],
              })
            }
            className="lens group overflow-hidden rounded-sm border border-border bg-card text-left"
          >
            <div className="h-72 overflow-hidden border-b border-border">
              <DesignPreview t={d.tokens} c={s.content!} compact />
            </div>
            <div className="p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-2xl">{d.name}</h3>
                <span className="eyebrow">{i + 1}</span>
              </div>
              <p className="mt-1 text-sm">{d.mood}</p>
              <p className="mt-2 text-sm text-muted-foreground">{d.why}</p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

// Up to three recent saved designs, so people can pick up where they left off.
function ResumeList({ onOpen }: { onOpen: (state: Record<string, unknown>) => void }) {
  const [list, setList] = useState<LibraryEntry[]>([]);
  useEffect(() => {
    try {
      setList([...readLibrary()].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, 3));
    } catch {
      setList([]);
    }
  }, []);
  if (!list.length) return null;
  return (
    <section
      aria-label="Continue a saved design"
      className="mb-4 rounded-sm border border-border bg-card p-3"
    >
      <p className="eyebrow mb-2">Continue a saved design</p>
      <ul className="space-y-1">
        {list.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{e.title}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpen({ ...e.state, libraryId: e.id })}
            >
              {resumeLabel(e.state)}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
