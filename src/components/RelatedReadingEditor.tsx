import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageFramingControls } from "./ImageFramingControls";
import { compactImageFraming } from "@/lib/image-framing";
import type { RelatedStory } from "@/lib/page-settings";
import type { usePageImage } from "@/hooks/usePageImage";

export function RelatedReadingEditor({
  story,
  onChange,
  onAdd,
  image,
}: {
  story: RelatedStory | undefined;
  onChange: (story?: RelatedStory) => void;
  onAdd: () => void;
  image: ReturnType<typeof usePageImage>;
}) {
  if (!story)
    return (
      <Button type="button" variant="outline" onClick={onAdd}>
        Add a related story
      </Button>
    );

  return (
    <fieldset className="min-w-0 space-y-3 border-y border-border py-3">
      <legend className="text-sm font-medium">Related reading</legend>
      <Label htmlFor="related-title">Story title</Label>
      <Input
        id="related-title"
        required
        value={story.title}
        maxLength={240}
        onChange={(e) => onChange({ ...story, title: e.target.value })}
      />
      <Label htmlFor="related-url">Story website address</Label>
      <Input
        id="related-url"
        type="url"
        required
        value={story.url}
        maxLength={2000}
        placeholder="https://…"
        onChange={(e) => onChange({ ...story, url: e.target.value })}
      />
      <Label htmlFor="related-placement">When do readers see this story?</Label>
      <select
        id="related-placement"
        className="block min-h-11 w-full rounded-md border border-input bg-background px-3"
        value={story.placement}
        onChange={(e) =>
          onChange({
            ...story,
            placement: e.target.value === "after-intro" ? "after-intro" : "after-article",
          })
        }
      >
        <option value="after-article">After the article</option>
        <option value="after-intro">Just after the introduction</option>
      </select>
      <details className="border-y border-border py-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm">Related story image</summary>
        <div className="space-y-3 pb-2">
          <Label htmlFor="related-photo">Choose a story image</Label>
          <input
            id="related-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full min-w-0 text-xs file:mr-2 file:py-2"
            onChange={(e) => {
              void image.choose(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            Use a PNG, JPEG or WebP you can publish, up to 750 KB.
          </p>
          {image.loading && <p role="status">Checking the story image…</p>}
          {image.error && <p role="alert">{image.error}</p>}
          {story.imageId && (
            <>
              <Label htmlFor="related-alt">Describe the story image</Label>
              <Input
                id="related-alt"
                required
                maxLength={500}
                value={story.imageAlt}
                onChange={(e) => onChange({ ...story, imageAlt: e.target.value })}
              />
              <Label htmlFor="related-credit">Story image credit and license</Label>
              <Input
                id="related-credit"
                required
                maxLength={500}
                value={story.imageCredit ?? ""}
                onChange={(e) => onChange({ ...story, imageCredit: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Use the attribution required by your license, or your own creator credit. This line
                appears underneath the picture.
              </p>
              <ImageFramingControls
                value={story.imageFraming}
                disabled={image.loading || !image.src}
                onChange={(value) => {
                  const next = { ...story };
                  const framing = compactImageFraming(value);
                  if (framing) next.imageFraming = framing;
                  else delete next.imageFraming;
                  onChange(next);
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  image.cancel();
                  const next = { ...story, imageId: null, imageAlt: "" };
                  delete next.imageCredit;
                  delete next.imageFraming;
                  onChange(next);
                }}
              >
                Remove story image
              </Button>
            </>
          )}
        </div>
      </details>
      {(image.error || (story.imageId && !image.loading && !image.src)) && (
        <p className="text-sm" role="status">
          Choose the original story image again or remove it to download the page.
        </p>
      )}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange()}>
        Remove related story
      </Button>
    </fieldset>
  );
}
