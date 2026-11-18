import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DesignPreview } from "@/components/DesignPreview";
import { questionCount, STEPS, type Content, type Pick, type Tokens } from "@/lib/design";
import { useDesignFonts } from "@/lib/useDesignFonts";

// One screen, one task: confirm the answers before the Vision is made. Each row has a Change link.
export function ReviewAnswers({
  tokens,
  content,
  picks,
  quick,
  onChange,
  onCreate,
  onAnswerRest,
}: {
  tokens: Tokens;
  content: Content;
  picks: Pick[];
  quick: boolean;
  onChange: (index: number) => void;
  onCreate: () => void;
  onAnswerRest: (total: number) => void;
}) {
  const s = { tokens, content, picks, quick };
  useDesignFonts([s.tokens]);
  const total = questionCount(s.quick);
  const asked = STEPS.slice(0, total);
  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-5 py-10 md:px-10 lg:grid-cols-[1fr_24rem]">
      <section>
        <p className="eyebrow">Before your Vision</p>
        <h1 className="mt-2 font-display text-4xl leading-tight md:text-5xl">
          Check your {total} answers
        </h1>
        <p className="mt-3 max-w-prose text-muted-foreground">
          Your Vision is made from these choices. Change any of them now, or create your Vision.
        </p>
        <ol className="mt-6 divide-y divide-border rounded-sm border border-border bg-card">
          {asked.map((st, i) => {
            const pick = s.picks.find((p) => p.step === st.title);
            return (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    Question {i + 1} · {st.title}
                  </p>
                  <p className="font-medium">{pick ? pick.label : "Kept as it was"}</p>
                  {pick?.reason && <p className="text-sm text-muted-foreground">“{pick.reason}”</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Change your answer for ${st.title}`}
                  onClick={() => onChange(i)}
                >
                  <Pencil />
                  Change
                </Button>
              </li>
            );
          })}
        </ol>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button size="lg" onClick={onCreate}>
            Create my Vision
            <ArrowRight />
          </Button>
          {s.quick && (
            <Button variant="outline" size="lg" onClick={() => onAnswerRest(total)}>
              Answer the other {STEPS.length - total} questions first
            </Button>
          )}
        </div>
      </section>
      <aside className="h-80 overflow-hidden rounded-sm border border-border lg:sticky lg:top-24">
        <DesignPreview t={s.tokens} c={s.content} compact />
      </aside>
    </main>
  );
}
