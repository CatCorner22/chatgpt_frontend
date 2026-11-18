import { useId } from "react";
import { Plus, Minus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Content } from "@/lib/design";

/** Real owner content stays separate from design decisions and sample starter copy. */
export function ContentEditor({
  content,
  onChange,
  defaultOpen = false,
  autoFocus = false,
}: {
  content: Content;
  onChange: (content: Content) => void;
  defaultOpen?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const change = (field: Exclude<keyof Content, "features">, value: string) =>
    onChange({ ...content, [field]: value });
  const changeFeature = (index: number, field: "title" | "body", value: string) =>
    onChange({
      ...content,
      features: content.features.map((feature, at) =>
        at === index ? { ...feature, [field]: value } : feature,
      ),
    });

  return (
    <details open={defaultOpen} className="group border-y border-border py-5">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-3">
          <PenLine className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Make the words yours</span>
        </span>
        <span className="text-xs text-muted-foreground group-open:hidden">Edit content +</span>
        <span className="hidden text-xs text-muted-foreground group-open:inline">Close −</span>
      </summary>
      <div className="space-y-6 pt-5">
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          Use your actual business name, offer, and words. Changes appear in the preview and your
          design export.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${id}-brand`}>Business or project name</Label>
            <Input
              id={`${id}-brand`}
              value={content.brand}
              maxLength={120}
              onChange={(e) => change("brand", e.target.value)}
              autoComplete="organization"
              autoFocus={autoFocus}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-cta`}>Main button text</Label>
            <Input
              id={`${id}-cta`}
              value={content.cta}
              maxLength={80}
              onChange={(e) => change("cta", e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-headline`}>Headline</Label>
          <Textarea
            id={`${id}-headline`}
            value={content.headline}
            maxLength={240}
            rows={2}
            onChange={(e) => change("headline", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-sub`}>Supporting sentence</Label>
          <Textarea
            id={`${id}-sub`}
            value={content.sub}
            maxLength={700}
            rows={3}
            onChange={(e) => change("sub", e.target.value)}
          />
        </div>
        <fieldset className="space-y-4">
          <legend className="font-medium text-sm">What you offer</legend>
          <p className="text-xs text-muted-foreground">
            Add up to eight real features or services.
          </p>
          {content.features.map((feature, index) => (
            <div key={index} className="border-b border-border pb-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label htmlFor={`${id}-feature-${index}`}>Feature {index + 1}</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove feature ${index + 1}`}
                  onClick={() =>
                    onChange({
                      ...content,
                      features: content.features.filter((_, at) => at !== index),
                    })
                  }
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              <Input
                id={`${id}-feature-${index}`}
                value={feature.title}
                maxLength={120}
                onChange={(e) => changeFeature(index, "title", e.target.value)}
              />
              <Label
                htmlFor={`${id}-feature-body-${index}`}
                className="mb-2 mt-3 block text-xs text-muted-foreground"
              >
                Feature {index + 1} description
              </Label>
              <Textarea
                id={`${id}-feature-body-${index}`}
                value={feature.body}
                maxLength={700}
                rows={2}
                onChange={(e) => changeFeature(index, "body", e.target.value)}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={content.features.length >= 8}
            onClick={() =>
              onChange({ ...content, features: [...content.features, { title: "", body: "" }] })
            }
          >
            <Plus className="size-4" aria-hidden="true" />
            Add a feature
          </Button>
        </fieldset>
        <div className="space-y-2">
          <Label htmlFor={`${id}-quote`}>
            Real customer quote{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id={`${id}-quote`}
            value={content.quote}
            maxLength={1000}
            rows={3}
            onChange={(e) => change("quote", e.target.value)}
            aria-describedby={`${id}-quote-help`}
          />
          <p
            id={`${id}-quote-help`}
            className="max-w-xl text-xs leading-relaxed text-muted-foreground"
          >
            Starter quotes are sample copy, not customer evidence. Replace this with someone’s
            actual words, used with permission, or leave it empty. Never publish an invented
            testimonial.
          </p>
          {content.quote && (
            <Button type="button" variant="ghost" size="sm" onClick={() => change("quote", "")}>
              Remove quote
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
