import { focusLocalStorage, focusSessionStorage } from "@/lib/browser-storage";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ConfirmDialog";
import { PreviewFrame } from "./DesignPreview";
import { rescueDirections, rescueStudio, type RescueSource } from "@/lib/rescue";
import type { Direction } from "@/lib/design";
import { useDesignFonts } from "@/lib/useDesignFonts";
import { STUDIO_KEY } from "@/lib/projects";
import { saveBaseline, type Inventory } from "@/lib/transfer";

export function RescuePanel({
  source,
  inventory,
}: {
  source: RescueSource;
  inventory?: Inventory;
}) {
  const navigate = useNavigate();
  const [experience, setExperience] = useState<"website" | "app">("website");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [directions, setDirections] = useState<Direction[]>([]);
  const [selected, setSelected] = useState(0);
  const [confirm, setConfirm] = useState(false);
  useDesignFonts(directions.map((d) => d.tokens));
  const generate = () => {
    setBusy(true);
    setError("");
    try {
      const next = rescueDirections(source, experience);
      if (!next.length)
        throw new Error("No redesigns were returned. Your existing design is unchanged.");
      setDirections(next);
      setSelected(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create redesigns.");
    } finally {
      setBusy(false);
    }
  };
  const open = async () => {
    const direction = directions[selected];
    if (!direction) return;
    setError("");
    try {
      if (inventory && !saveBaseline(inventory)) {
        setError(
          "The original page comparison could not be saved in this browser. Your redesign is still here and your current design is unchanged. Free some browser storage, then try opening it again.",
        );
        setConfirm(false);
        return;
      }
      // A pending hand-off leaves the current studio untouched until it can import and offer Undo.
      focusSessionStorage.setItem(
        "refraction:pending-rescue",
        JSON.stringify(rescueStudio(source, direction, experience)),
      );
      await navigate({ to: "/", search: { view: "studio" } });
    } catch {
      toast.error("Couldn't open the redesign. Your current design has not been changed.");
    }
  };
  const requestOpen = () => {
    try {
      const old = JSON.parse(focusLocalStorage.getItem(STUDIO_KEY) ?? "null");
      if (old?.tokens) {
        setConfirm(true);
        return;
      }
    } catch {
      /* unusable storage is not work */
    }
    void open();
  };
  return (
    <section className="space-y-4 border-y border-border py-6" aria-label="Redesign this site">
      <div>
        <p className="eyebrow">Redesign this site</p>
        <h2 className="mt-2 font-display text-3xl">Keep the business. Change the design.</h2>
      </div>
      <div role="group" aria-label="Rescue experience" className="flex flex-wrap gap-2">
        {(["website", "app"] as const).map((kind) => (
          <Button
            key={kind}
            variant={experience === kind ? "secondary" : "outline"}
            aria-pressed={experience === kind}
            disabled={busy}
            onClick={() => {
              setExperience(kind);
              setDirections([]);
            }}
          >
            {kind === "app" ? "App" : "Website"}
          </Button>
        ))}
        <Button onClick={generate} disabled={busy}>
          {busy ? "Creating redesigns…" : "Create three redesigns"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Three curated looks, matched locally from the design library. Your extracted words stay the
        same.
      </p>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {directions.length > 0 && (
        <>
          <div role="group" aria-label="Redesign direction" className="flex flex-wrap gap-2">
            {directions.map((d, i) => (
              <Button
                key={d.name}
                variant={selected === i ? "secondary" : "outline"}
                aria-pressed={selected === i}
                onClick={() => setSelected(i)}
              >
                {d.name}
              </Button>
            ))}
          </div>
          <p>{directions[selected]?.why}</p>
          {directions[selected] && (
            <PreviewFrame
              t={directions[selected].tokens}
              c={source.content}
              experience={experience}
            />
          )}
          <Button onClick={requestOpen}>Open redesign Vision</Button>
          <p className="text-sm text-muted-foreground">
            This preview uses the extracted public copy. The handoff asks your developer to keep
            existing content and behavior. Your live site is unchanged.
          </p>
        </>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Open this redesign?"
        body="Your current studio design will be replaced. Undo will be available when the redesign opens; saved account projects are unchanged."
        confirmLabel="Open redesign"
        onConfirm={() => void open()}
      />
    </section>
  );
}
