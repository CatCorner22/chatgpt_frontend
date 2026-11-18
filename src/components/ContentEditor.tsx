import { useId, useLayoutEffect, useRef } from "react";
import { Plus, Minus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Content } from "@/lib/design";

type FocusTarget = number | "add" | "quote";
type PendingFocus = {
  source: Content;
  before: string;
  expected: string;
  origin: HTMLButtonElement;
  target: FocusTarget;
  stopListening: () => void;
};

const contentSnapshot = (content: Content) =>
  JSON.stringify([
    content.brand,
    content.headline,
    content.sub,
    content.cta,
    content.quote,
    content.features.map(({ title, body }) => [title, body]),
  ]);

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
  const editorRef = useRef<HTMLDetailsElement>(null);
  const featureRefs = useRef<Array<HTMLInputElement | null>>([]);
  const addRef = useRef<HTMLButtonElement>(null);
  const quoteRef = useRef<HTMLTextAreaElement>(null);
  const pendingFocus = useRef<PendingFocus | null>(null);
  const cancelFocus = () => {
    pendingFocus.current?.stopListening();
    pendingFocus.current = null;
  };

  // The parent owns content. Focus acknowledges only this exact accepted edit,
  // never a guessed feature count or a later unrelated parent update.
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    const current = contentSnapshot(content);
    if (content === pending.source && current === pending.before) return;
    pending.stopListening();
    pendingFocus.current = null;
    const document = pending.origin.ownerDocument;
    const stillHere = document.activeElement === pending.origin;
    const removedControl =
      document.activeElement === document.body &&
      (!pending.origin.isConnected || pending.origin.disabled);
    if (current !== pending.expected || !editorRef.current?.open || (!stillHere && !removedControl))
      return;
    const target =
      pending.target === "add"
        ? addRef.current
        : pending.target === "quote"
          ? quoteRef.current
          : featureRefs.current[pending.target];
    if (target?.isConnected) target.focus();
  });

  useLayoutEffect(
    () => () => {
      pendingFocus.current?.stopListening();
      pendingFocus.current = null;
    },
    [],
  );

  const changeAndFocus = (next: Content, target: FocusTarget, origin: HTMLButtonElement) => {
    cancelFocus();
    const document = origin.ownerDocument;
    const view = document.defaultView;
    const pending: PendingFocus = {
      source: content,
      before: contentSnapshot(content),
      expected: contentSnapshot(next),
      origin,
      target,
      stopListening: () => {},
    };
    const cancel = () => {
      if (pendingFocus.current === pending) cancelFocus();
    };
    const movedFocus = (event: FocusEvent) => {
      if (event.target !== origin) cancel();
    };
    pending.stopListening = () => {
      document.removeEventListener("focusin", movedFocus);
      document.removeEventListener("pointerdown", cancel, true);
      document.removeEventListener("keydown", cancel, true);
      view?.removeEventListener("blur", cancel);
    };
    pendingFocus.current = pending;
    document.addEventListener("focusin", movedFocus);
    document.addEventListener("pointerdown", cancel, true);
    document.addEventListener("keydown", cancel, true);
    view?.addEventListener("blur", cancel);
    try {
      onChange(next);
    } catch (error) {
      cancel();
      throw error;
    }
  };
  const change = (field: Exclude<keyof Content, "features">, value: string) => {
    cancelFocus();
    onChange({ ...content, [field]: value });
  };
  const changeFeature = (index: number, field: "title" | "body", value: string) => {
    cancelFocus();
    onChange({
      ...content,
      features: content.features.map((feature, at) =>
        at === index ? { ...feature, [field]: value } : feature,
      ),
    });
  };

  return (
    <details
      ref={editorRef}
      open={defaultOpen}
      onToggle={(event) => {
        if (!event.currentTarget.open) cancelFocus();
      }}
      className="group border-y border-border py-5"
    >
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
                  onClick={(event) => {
                    const features = content.features.filter((_, at) => at !== index);
                    changeAndFocus(
                      {
                        ...content,
                        features,
                      },
                      features.length ? Math.min(index, features.length - 1) : "add",
                      event.currentTarget,
                    );
                  }}
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
              <Input
                ref={(element) => {
                  featureRefs.current[index] = element;
                }}
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
            ref={addRef}
            type="button"
            variant="outline"
            size="sm"
            disabled={content.features.length >= 8}
            onClick={(event) => {
              if (content.features.length >= 8) return;
              changeAndFocus(
                { ...content, features: [...content.features, { title: "", body: "" }] },
                content.features.length,
                event.currentTarget,
              );
            }}
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
            ref={quoteRef}
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(event) =>
                changeAndFocus({ ...content, quote: "" }, "quote", event.currentTarget)
              }
            >
              Remove quote
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}
