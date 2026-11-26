import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Monitor,
  Smartphone,
  ImagePlus,
  ArrowUpRight,
  Check,
  LayoutTemplate,
} from "lucide-react";
import JSZip from "jszip";
import { Link } from "@tanstack/react-router";
import type { Content, Tokens } from "@/lib/design";
import { pageOptionsWithImages } from "@/lib/page-options-with-images";
import { renderAuthoredPage } from "@/lib/render-authored-page";
import type { BundledFamily } from "@/lib/authored-font-styles";
import {
  EMPTY_RELATED_STORY,
  normalizePageSettings,
  type RelatedStory,
  type PageSettings,
} from "@/lib/page-settings";
import { usePageImage } from "@/hooks/usePageImage";
import { RelatedReadingEditor } from "./RelatedReadingEditor";
import { downloadBlob } from "@/lib/exportPack";
import { needsPublicCodeConfirmation, websiteActionForHandoff } from "@/lib/action-destination";
import { ComparisonPhoneCheck } from "@/components/ComparisonPhoneCheck";
import { CompositionComparison } from "@/components/CompositionComparison";
import { ImageFramingControls } from "@/components/ImageFramingControls";
import { compactImageFraming } from "@/lib/image-framing";
import { ContentEditor } from "@/components/ContentEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PAGE_COMPOSITIONS as COMPOSITIONS } from "@/lib/page-compositions";
import { getBrowserOwnerId } from "@/lib/browser-storage";
import { useUser } from "@/hooks/useSession";
import { useExportReceipt } from "@/hooks/useExportReceipt";
import { ExportReceipt } from "@/components/ExportReceipt";

const DECISION_RECORD_MAX_BYTES = 200_000;

function checkedDecisionRecord(record: string | undefined): string | undefined {
  if (record === undefined) return undefined;
  if (new Blob([record]).size > DECISION_RECORD_MAX_BYTES)
    throw new Error("The decision map exceeds 200 KB. Reduce it before preparing the page ZIP.");
  try {
    JSON.parse(record);
  } catch {
    throw new Error(
      "The decision map is not valid JSON. Correct it before preparing the page ZIP.",
    );
  }
  return record;
}

function checkOwner(owner: string | null) {
  if (getBrowserOwnerId() !== owner)
    throw new Error("Your account changed. Reload before exporting or adding an image.");
}

export function AuthoredPageEditor({
  families,
  tokens,
  content,
  settings,
  onSettings,
  onContent,
  onExport,
  projectState,
  decisionRecord,
  layoutWorkshop,
  compact = false,
}: {
  families: readonly BundledFamily[];
  tokens: Tokens;
  content: Content;
  settings: PageSettings;
  onSettings: (settings: PageSettings) => void;
  onContent: (content: Content) => void;
  onExport: () => void;
  projectState: Record<string, unknown>;
  decisionRecord?: string;
  layoutWorkshop?: { choose: (id: PageSettings["composition"]) => void; blocked: boolean };
  compact?: boolean;
}) {
  const imageIdentity = JSON.stringify([projectState["libraryId"], projectState["projectId"]]);
  const leadImage = usePageImage(settings.imageId, imageIdentity, (id) => {
    const next = { ...settings, imageId: id };
    if (id !== settings.imageId) {
      delete next.imageFraming;
      delete next.imageCredit;
    }
    onSettings(next);
  });
  const story = settings.relatedStory;
  const storyImage = usePageImage(
    story?.imageId ?? null,
    JSON.stringify([imageIdentity, !!story]),
    (id) => {
      if (!story) return;
      const next = { ...story, imageId: id };
      if (id !== story.imageId) {
        next.imageAlt = "";
        delete next.imageFraming;
        delete next.imageCredit;
      }
      onSettings({ ...settings, relatedStory: next });
    },
  );
  const image = leadImage.src;
  const imageLoading = leadImage.loading;
  const imageError = leadImage.error;
  const [previewSize, setPreviewSize] = useState<"fit" | "wide" | "phone">("fit");
  const [packing, setPacking] = useState(false);
  const [editor, setEditor] = useState(false);
  const mounted = useRef(false);
  const packingNow = useRef(false);
  const exportSnapshot = JSON.stringify([
    tokens,
    content,
    settings,
    projectState,
    decisionRecord,
    image,
    imageLoading,
    storyImage.src,
    storyImage.loading,
  ]);
  const user = useUser();
  const receipt = useExportReceipt(exportSnapshot, user?.id ?? null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pageOptions = useMemo(
    () => pageOptionsWithImages(settings, image, storyImage.src),
    [settings, image, storyImage.src],
  );
  const built = useMemo(
    () => renderAuthoredPage(tokens, content, pageOptions, families),
    [tokens, content, pageOptions, families],
  );
  const missingImage = settings.imageId && !image;
  const needsImageDescription = !!image && !settings.imageAlt.trim();
  const storyIssue = built.readiness.find(
    (item) => item.id === "story-link" || item.id === "story-image",
  );
  const comparisonAssetsBlocked =
    imageLoading ||
    !!missingImage ||
    needsImageDescription ||
    storyImage.loading ||
    !!(story?.imageId && !storyImage.src) ||
    !!storyIssue;
  const downloadPage = () => {
    if (comparisonAssetsBlocked) return;
    try {
      receipt.begin();
      downloadBlob(new Blob([built.html], { type: "text/html" }), "index.html");
      toast.success("Working HTML download started. Check your downloads.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "The working HTML could not be downloaded.",
      );
    }
  };
  const downloadZip = async () => {
    if (packingNow.current || comparisonAssetsBlocked) return;
    packingNow.current = true;
    setPacking(true);
    try {
      const request = receipt.begin();
      const owner = getBrowserOwnerId();
      const record = checkedDecisionRecord(decisionRecord);
      const zip = new JSZip();
      for (const [name, text] of Object.entries(built.files)) zip.file(name, text);
      if (record !== undefined) {
        zip.file("focus-decision-map.json", record);
        zip.file(
          "README.txt",
          `${built.files["README.txt"] ?? ""}\nDECISION RECORD\nfocus-decision-map.json records the selected design decisions and source values.\nIt may contain project inputs. Keep it private with focus-project.json rather\nthan uploading it to the public website. It is not proof of rendered-page tests\nor an importable library backup.\n`,
        );
      }
      zip.file(
        "focus-project.json",
        JSON.stringify(
          {
            kind: "focus-project-source",
            version: 1,
            studio: projectState,
            embeddedImage: image
              ? {
                  id: settings.imageId,
                  src: image,
                  alt: settings.imageAlt,
                  ...(settings.imageCredit ? { credit: settings.imageCredit } : {}),
                }
              : null,
            ...(storyImage.src && story
              ? {
                  embeddedStoryImage: {
                    id: story.imageId,
                    src: storyImage.src,
                    alt: story.imageAlt,
                    credit: story.imageCredit,
                  },
                }
              : {}),
          },
          null,
          2,
        ),
      );
      const blob = await zip.generateAsync({ type: "blob" });
      if (!mounted.current) return;
      if (!receipt.isCurrent(request))
        throw new Error(
          "Your design changed while the ZIP was being prepared. Download the current version again.",
        );
      checkOwner(owner);
      downloadBlob(blob, "focus-working-page.zip");
      receipt.offer(request, "focus-working-page.zip", onExport);
    } catch (error) {
      if (mounted.current)
        toast.error(
          error instanceof Error
            ? error.message
            : "The page ZIP could not be prepared. Your design is still here.",
        );
    } finally {
      packingNow.current = false;
      if (mounted.current) setPacking(false);
    }
  };
  function changeStory(nextStory?: RelatedStory) {
    const next = { ...settings };
    if (nextStory) next.relatedStory = nextStory;
    else {
      storyImage.cancel();
      delete next.relatedStory;
    }
    onSettings(next);
  }
  const supportingControls = (
    <>
      <div className="space-y-2">
        <Label htmlFor="page-language">Page language</Label>
        <select
          id="page-language"
          className="block min-h-11 w-full rounded-md border border-input bg-background px-3"
          value={settings.language ?? "en"}
          aria-describedby="page-language-help"
          onChange={(event) => {
            onSettings(normalizePageSettings({ ...settings, language: event.target.value }));
          }}
        >
          <option value="en">English</option>
          <option value="ja">Japanese (日本語)</option>
        </select>
        <p id="page-language-help" className="text-xs leading-relaxed text-muted-foreground">
          Choose the language your visitors will read. Focus sets the built-in labels and tells
          screen readers which language to use. Your own wording stays as you wrote it.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="page-action-url">Where should the main action lead?</Label>
        <Input
          id="page-action-url"
          value={settings.actionUrl}
          maxLength={2000}
          onChange={(e) =>
            onSettings(
              normalizePageSettings({
                ...settings,
                actionUrl: e.target.value,
                publicCodeUrl: undefined,
              }),
            )
          }
          placeholder="https://… or mailto:hello@…"
          aria-describedby="page-action-help"
        />
        {needsPublicCodeConfirmation(settings.actionUrl) && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.publicCodeUrl === settings.actionUrl}
              onChange={(event) =>
                onSettings(
                  normalizePageSettings({
                    ...settings,
                    publicCodeUrl: event.target.checked ? settings.actionUrl : undefined,
                  }),
                )
              }
            />
            This code is public, like a coupon. Include this link in my developer guides.
          </label>
        )}
        <p id="page-action-help" className="text-xs leading-relaxed text-muted-foreground">
          Use your actual booking page, contact address, or destination. Without a valid address,
          the page links to supplied feature details; when there are none, no main action is shown.
          {settings.actionUrl && !websiteActionForHandoff(settings)
            ? " Give your developer the destination separately. This address is omitted from developer guides."
            : " Developer guides include the full web address. Use a link you can share."}
        </p>
      </div>
      <details className="border-y border-border py-2">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <ImagePlus size={16} />
          Add your own image
        </summary>
        <div className="space-y-3 py-3">
          <Label htmlFor="page-image">PNG, JPEG, or WebP · up to 750 KB</Label>
          <input
            id="page-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              void leadImage.choose(e.target.files?.[0]);
              e.target.value = "";
            }}
            className="block w-full min-w-0 text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-3 file:py-2"
          />
          <Label htmlFor="page-image-alt">Describe the image</Label>
          <Input
            id="page-image-alt"
            value={settings.imageAlt}
            maxLength={500}
            aria-required={!!settings.imageId}
            aria-describedby="page-image-description-help"
            onChange={(e) => onSettings({ ...settings, imageAlt: e.target.value })}
            placeholder="What should someone know about it?"
          />
          <p
            id="page-image-description-help"
            className="text-xs leading-relaxed text-muted-foreground"
          >
            Required to include your image. Describe its subject or what it adds to the page.
          </p>
          {settings.imageId && (
            <>
              <Label htmlFor="lead-credit">Public image credit or license</Label>
              <Input
                id="lead-credit"
                value={settings.imageCredit ?? ""}
                maxLength={500}
                onChange={(e) => {
                  const next = { ...settings };
                  if (e.target.value) next.imageCredit = e.target.value;
                  else delete next.imageCredit;
                  onSettings(next);
                }}
              />
            </>
          )}
          {settings.imageId && (
            <ImageFramingControls
              value={settings.imageFraming}
              disabled={imageLoading || !!missingImage || needsImageDescription}
              onChange={(value) => {
                const next = { ...settings };
                const framing = compactImageFraming(value);
                if (framing) next.imageFraming = framing;
                else delete next.imageFraming;
                onSettings(next);
              }}
            />
          )}
          {settings.imageId && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                leadImage.cancel();
                const next = { ...settings, imageId: null };
                delete next.imageCredit;
                delete next.imageFraming;
                onSettings(next);
              }}
            >
              Remove image
            </Button>
          )}
          {imageLoading && (
            <p role="status" className="text-xs">
              Checking and saving the image…
            </p>
          )}
          {(imageError || (missingImage && !imageLoading)) && (
            <p role="alert" className="text-xs text-destructive">
              {imageError ||
                "This image is missing from this browser. Choose the file again, or remove it to export a text-only page."}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Saved in this browser and embedded in your download. Use an image you have permission to
            publish.
          </p>
        </div>
      </details>
      <RelatedReadingEditor
        story={story}
        onChange={changeStory}
        onAdd={() => changeStory({ ...EMPTY_RELATED_STORY })}
        image={storyImage}
      />
      <details className="text-sm">
        <summary className="min-h-11 cursor-pointer py-3">
          Study a two-image editorial example
        </summary>
        <p className="leading-relaxed text-muted-foreground">
          Looking Room pairs two Hokusai prints from The Met’s Open Access collection. Download the
          example, then choose My designs → Restore backup to open your own editable copy.
        </p>
        <a
          className="inline-flex min-h-11 items-center underline"
          download="looking-room.focus.json"
          href={`${import.meta.env.BASE_URL}examples/looking-room.focus.json`}
        >
          Download Looking Room
        </a>
      </details>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-between gap-3 text-sm font-medium"
        onClick={() => setEditor(!editor)}
        aria-expanded={editor}
      >
        <span>Edit the page’s words</span>
        <ArrowUpRight size={16} />
      </button>
      {compact && editor && (
        <ContentEditor content={content} onChange={onContent} defaultOpen autoFocus />
      )}
    </>
  );

  return (
    <section
      aria-labelledby="authored-page-title"
      className={compact ? "authored-workspace authored-workspace--compact" : "authored-workspace"}
    >
      <div className="authored-heading">
        <div>
          <p className="eyebrow">From a direction to a real page</p>
          <h2 id="authored-page-title">See it. Use it. Take it with you.</h2>
          <p>
            This preview and your download use the same page. Your words, working links, and a
            layout that responds to its screen.
          </p>
          <p>
            Working HTML is a single-file page. The page ZIP includes editable HTML and CSS. To
            continue editing in Focus, use My designs → Back up library.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPage} disabled={comparisonAssetsBlocked}>
            <Download size={16} /> Download working HTML
          </Button>
          <Button
            variant="outline"
            onClick={() => void downloadZip()}
            disabled={packing || comparisonAssetsBlocked}
          >
            {packing ? "Preparing…" : "Download page ZIP"}
          </Button>
        </div>
      </div>
      <ExportReceipt receipt={receipt.pending} />
      {(!compact || layoutWorkshop) && (
        <CompositionComparison
          key={imageIdentity}
          tokens={tokens}
          content={content}
          options={pageOptions}
          families={families}
          assetsBlocked={comparisonAssetsBlocked}
          applyBlocked={layoutWorkshop?.blocked ?? false}
          onChoose={(id) => {
            if (layoutWorkshop) layoutWorkshop.choose(id);
            else onSettings({ ...settings, composition: id });
          }}
        />
      )}
      <div className="authored-layout">
        <aside className="authored-controls">
          {!compact && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium">Choose the composition</legend>
              <div className="space-y-2">
                {COMPOSITIONS.map((choice) => (
                  <label
                    key={choice.id}
                    className={`composition-choice ${settings.composition === choice.id ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="page-composition"
                      value={choice.id}
                      checked={settings.composition === choice.id}
                      onChange={() => onSettings({ ...settings, composition: choice.id })}
                    />
                    <span>
                      <strong>{choice.title}</strong>
                      <span>{choice.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          {compact ? (
            <details className="authored-supporting-controls">
              <summary className="min-h-11 cursor-pointer py-3 font-medium">
                Content, image and action
              </summary>
              <div className="space-y-4 py-3">{supportingControls}</div>
            </details>
          ) : (
            supportingControls
          )}
          <div className="authored-readiness">
            <p className="mb-3 flex items-center gap-2 text-xs font-medium">
              <LayoutTemplate size={15} />
              Before you publish
            </p>
            {built.readiness.length || missingImage ? (
              <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
                {built.readiness
                  .filter((item) => !(needsImageDescription && item.id === "image"))
                  .map((item) => (
                    <li key={item.id}>{item.message}</li>
                  ))}
                {needsImageDescription && (
                  <li>Add an image description to include it in the preview and download.</li>
                )}
                {story?.imageId && !storyImage.loading && !storyImage.src && (
                  <li>
                    The related story image is missing or unreadable. Choose the original photo
                    again, or remove it to download your page.
                  </li>
                )}
                {missingImage && !imageLoading && (
                  <li>
                    Your chosen image is missing or unreadable. Add it again, or remove it under
                    “Add your own image” to download a text-only page.
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">
                The content fields are filled. Review the words, destinations, and page with your
                intended users.
              </p>
            )}
            <Link
              to="/quality"
              className="mt-4 inline-flex min-h-9 items-center gap-2 text-xs underline underline-offset-4"
            >
              Check a rendered page <ArrowUpRight size={13} />
            </Link>
          </div>
        </aside>
        <div className="authored-preview-area">
          <div className="authored-preview-toolbar">
            <span className="inline-flex items-center gap-2">
              <Check size={14} />
              Exact export preview
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                aria-pressed={previewSize === "fit"}
                onClick={() => setPreviewSize("fit")}
              >
                <Monitor size={15} />
                Fit
              </button>
              <button
                type="button"
                aria-pressed={previewSize === "wide"}
                onClick={() => setPreviewSize("wide")}
              >
                <Monitor size={15} />
                1024 px
              </button>
              <button
                type="button"
                aria-pressed={previewSize === "phone"}
                onClick={() => setPreviewSize("phone")}
              >
                <Smartphone size={15} />
                320 px
              </button>
            </div>
          </div>
          <div
            className="authored-frame-stage"
            role="region"
            aria-label="Page preview canvas"
            tabIndex={previewSize === "fit" ? undefined : 0}
          >
            <iframe
              key={`${settings.imageId ?? "none"}:${image ? "loaded" : "empty"}`}
              title="Working page preview"
              srcDoc={built.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className={`authored-frame${previewSize === "fit" ? "" : ` is-${previewSize}`}`}
            />
          </div>
          {settings.composition === "comparison" && (
            <ComparisonPhoneCheck key={built.html} html={built.html} />
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Fit uses the available space. The fixed 1024 px and 320 px previews may scroll sideways
            inside the canvas. Section links work here. Test contact and booking destinations in the
            downloaded page. Supported fonts travel with the page; other families or characters use
            local fallbacks. No font service or script is required.
          </p>
        </div>
      </div>
      {!compact && editor && (
        <div className="mt-6 border-t border-border pt-3">
          <ContentEditor content={content} onChange={onContent} defaultOpen autoFocus />
        </div>
      )}
    </section>
  );
}
