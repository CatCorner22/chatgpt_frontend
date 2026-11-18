import { useId } from "react";
import type { Integration } from "@/lib/design";

export function IntegrationChoice({
  value,
  onChange,
}: {
  value: Integration;
  onChange: (value: Integration) => void;
}) {
  const id = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={`${id}-help`}>
      <legend className="eyebrow">Where will this design go?</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["new", "A new site or app", "Start a project from your chosen design."],
            [
              "existing",
              "Restyle my existing site or app",
              "Keep your working pages. Try a reversible visual update.",
            ],
          ] as const
        ).map(([mode, label, help]) => (
          <label
            key={mode}
            className="flex min-h-11 cursor-pointer items-start gap-2 rounded-sm border border-border bg-card p-3 text-sm has-[:checked]:border-accent"
          >
            <input
              type="radio"
              name={id}
              className="mt-1 h-4 w-4"
              checked={value === mode}
              onChange={() => onChange(mode)}
            />
            <span>
              <span className="font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">{help}</span>
            </span>
          </label>
        ))}
      </div>
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        {value === "existing"
          ? "Works with private apps too—no URL or source upload needed. Your pack includes a one-page trial, checks for your existing tasks, and an undo guide. Apply it to a backup or preview first; Focus does not edit your live project."
          : "Already have working pages? Choose Restyle for a pack designed to preserve them."}
      </p>
    </fieldset>
  );
}
