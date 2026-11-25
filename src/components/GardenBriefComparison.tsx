import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import type { GardenGoal } from "@/lib/garden-content";
import { stratosphereSearch } from "@/lib/garden-navigation";
import { inspectLibrary, LIBRARY_KEY, type LibraryEntry } from "@/lib/library";
import { focusLocalStorage } from "@/lib/browser-storage";
import { normalizePageSettings } from "@/lib/page-settings";
import { requestLibraryOpen } from "@/lib/library-open";
import { OptionComparisonPreview } from "./OptionComparisonPreview";

export function GardenBriefComparison({
  goal,
  designId,
}: {
  goal: GardenGoal;
  designId: string | null;
}) {
  if (goal === "existing")
    return (
      <p>
        To try this with an existing booking form, select its files in{" "}
        <Link to="/target" className="underline">
          Target
        </Link>
        . The styling-only handoff keeps your current picker.
      </p>
    );
  if (!designId)
    return (
      <p>
        Choose a saved website under “Brief for” to preview its offers with its colors and type.
      </p>
    );
  return <SavedWebsiteComparison key={designId} designId={designId} />;
}

function SavedWebsiteComparison({ designId }: { designId: string }) {
  const navigate = useNavigate();
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [issue, setIssue] = useState("");
  useEffect(() => {
    function refresh() {
      try {
        const library = inspectLibrary(focusLocalStorage.getItem(LIBRARY_KEY));
        const selected = library.entries.find(({ id }) => id === designId);
        if (!selected || library.needsRecovery) throw new Error();
        setEntry(selected);
        setIssue("");
      } catch {
        setEntry(null);
        setIssue("The saved website could not be read. Open My designs to check the current copy.");
      }
    }
    function onStorage(event: StorageEvent) {
      if (!event.key || event.key.endsWith(LIBRARY_KEY)) refresh();
    }
    refresh();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [designId]);
  const settings = useMemo(() => normalizePageSettings(entry?.state["page"]), [entry]);
  if (!entry) return <p role="status">{issue || "Opening your saved website…"}</p>;
  if (
    entry.state["integration"] === "existing" ||
    (entry.state["purpose"] as { experience?: string } | undefined)?.experience === "app"
  )
    return <p>Choose a new website design to try this authored layout.</p>;
  return (
    <div className="space-y-2">
      <OptionComparisonPreview
        content={entry.state.content}
        tokens={entry.state.tokens}
        settings={settings}
      />
      <button
        type="button"
        className="garden-text-action"
        onClick={async () => {
          try {
            await navigate({
              to: "/",
              search: stratosphereSearch("composition"),
              state: requestLibraryOpen(entry.id),
            });
          } catch {
            setIssue(
              "Open this saved website from My designs and choose Page layout in Stratosphere.",
            );
          }
        }}
      >
        Review and apply in Studio
      </button>
      {issue && <p role="alert">{issue}</p>}
    </div>
  );
}
