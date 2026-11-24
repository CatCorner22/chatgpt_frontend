import { useEffect, useState } from "react";
import {
  gardenJourneyKey,
  gardenSuggestedComposition,
  readGardenJourney,
} from "@/lib/garden-journey";
import { PAGE_COMPOSITIONS, type PageComposition } from "@/lib/page-compositions";

type Suggestion = NonNullable<ReturnType<typeof gardenSuggestedComposition>>;

export function GardenLayoutSuggestion({
  designId,
  current,
  onApply,
}: {
  designId: string;
  current: PageComposition;
  onApply: (id: PageComposition) => void;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [issue, setIssue] = useState("");
  useEffect(() => {
    const read = () => {
      try {
        setSuggestion(gardenSuggestedComposition(readGardenJourney(designId).brief));
        setIssue("");
      } catch {
        setSuggestion(null);
      }
    };
    read();
    function storage(event: StorageEvent) {
      if (event.key === null || event.key.endsWith(gardenJourneyKey(designId))) read();
    }
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [designId]);
  if (!suggestion && !issue) return null;
  const layout = PAGE_COMPOSITIONS.find((item) => item.id === suggestion?.layout);
  return (
    <aside className="stratosphere-custom" aria-label="Layout from your Garden brief">
      {suggestion && layout && (
        <>
          <p>
            Your Garden brief favors “{suggestion.approach}”. {layout.description}
          </p>
          {current === layout.id ? (
            <p>This website already uses {layout.title}.</p>
          ) : (
            <button
              type="button"
              className="garden-text-action"
              onClick={() => {
                try {
                  const latest = gardenSuggestedComposition(readGardenJourney(designId).brief);
                  if (latest?.layout !== suggestion.layout) {
                    setSuggestion(latest);
                    setIssue("Your Garden choice changed. Review its current recommendation.");
                    return;
                  }
                  onApply(suggestion.layout);
                  setIssue("");
                } catch {
                  setIssue("Your saved brief could not be checked. Reopen it on the Garden Path.");
                }
              }}
            >
              Apply {layout.title} from my brief
            </button>
          )}
        </>
      )}
      {issue && <p role="status">{issue}</p>}
    </aside>
  );
}
