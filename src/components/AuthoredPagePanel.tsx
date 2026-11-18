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
import { buildAuthoredPage } from "@/lib/authored-page";
import { readPageImage, savePageImage, type PageSettings } from "@/lib/page-settings";
import { validatePageImageAsset } from "@/lib/page-image-asset";
import { downloadBlob } from "@/lib/exportPack";
import { ContentEditor } from "@/components/ContentEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PAGE_COMPOSITIONS as COMPOSITIONS } from "@/lib/page-compositions";

export function AuthoredPagePanel({
  tokens,
  content,
  settings,
  onSettings,
  onContent,
  onExport,
  projectState,
}: {
  tokens: Tokens;
  content: Content;
  settings: PageSettings;
  onSettings: (settings: PageSettings) => void;
  onContent: (content: Content) => void;
  onExport: () => void;
  projectState: Record<string, unknown>;
}) {
  const [imageSnapshot, setImageSnapshot] = useState<{ id: string | null; src: string | null }>({
    id: null,
    src: null,
  });
  const image = imageSnapshot.id === settings.imageId ? imageSnapshot.src : null;
  const [imageUploading, setImageUploading] = useState(false);
  const [imageHydrating, setImageHydrating] = useState(false);
  const imageLoading = imageUploading || imageHydrating;
  const [imageError, setImageError] = useState("");
  const [phone, setPhone] = useState(false);
  const [packing, setPacking] = useState(false);
  const [editor, setEditor] = useState(false);
  const imageRequest = useRef(0);
  useEffect(
    () => () => {
      imageRequest.current++;
    },
    [],
  );
  const latestSettings = useRef(settings);
  latestSettings.current = settings;
  useEffect(() => {
    let current = true;
    const id = settings.imageId;
    setImageError("");
    if (!id) {
      setImageSnapshot({ id: null, src: null });
      setImageHydrating(false);
      return;
    }
    setImageHydrating(true);
    void validatePageImageAsset(id, readPageImage(id))
      .then((src) => {
        if (current) setImageSnapshot({ id, src });
      })
      .catch((error: unknown) => {
        if (!current) return;
        setImageSnapshot({ id, src: null });
        setImageError(
          error instanceof Error
            ? error.message
            : "This saved image could not be checked. Choose the file again or remove it to export.",
        );
      })
      .finally(() => {
        if (current) setImageHydrating(false);
      });
    return () => {
      current = false;
    };
  }, [settings.imageId]);
  const built = useMemo(
    () =>
      buildAuthoredPage(tokens, content, {
        composition: settings.composition,
        actionUrl: settings.actionUrl,
        ...(image ? { image: { src: image, alt: settings.imageAlt } } : {}),
      }),
    [tokens, content, settings.composition, settings.actionUrl, settings.imageAlt, image],
  );

  async function chooseImage(file: File | undefined) {
    if (!file) return;
    const request = ++imageRequest.current;
    setImageUploading(true);
    setImageError("");
    try {
      const id = await savePageImage(file);
      const src = await validatePageImageAsset(id, readPageImage(id));
      if (request !== imageRequest.current) return;
      setImageError("");
      setImageSnapshot({ id, src });
      onSettings({ ...latestSettings.current, imageId: id });
    } catch (error) {
      if (request === imageRequest.current)
        setImageError(error instanceof Error ? error.message : "This image could not be added.");
    } finally {
      if (request === imageRequest.current) setImageUploading(false);
    }
  }
  const downloadPage = () => {
    if (imageLoading || missingImage || needsImageDescription) return;
    downloadBlob(new Blob([built.html], { type: "text/html" }), "index.html");
    toast.success("Working page downloaded");
  };
  const downloadZip = async () => {
    if (imageLoading || missingImage || needsImageDescription) return;
    setPacking(true);
    try {
      const zip = new JSZip();
      for (const [name, text] of Object.entries(built.files)) zip.file(name, text);
      zip.file(
        "focus-project.json",
        JSON.stringify(
          {
            kind: "focus-project-source",
            version: 1,
            studio: projectState,
            embeddedImage: image
              ? { id: settings.imageId, src: image, alt: settings.imageAlt }
              : null,
          },
          null,
          2,
        ),
      );
      downloadBlob(await zip.generateAsync({ type: "blob" }), "focus-working-page.zip");
      if (!missingImage) onExport();
      toast.success("Page source downloaded");
    } catch {
      toast.error("The page ZIP could not be prepared. Your design is still here.");
    } finally {
      setPacking(false);
    }
  };
  const missingImage = settings.imageId && !image;
  const needsImageDescription = !!image && !settings.imageAlt.trim();

  return (
    <section aria-labelledby="authored-page-title" className="authored-workspace">
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
          <Button
            onClick={downloadPage}
            disabled={imageLoading || !!missingImage || needsImageDescription}
          >
            <Download size={16} /> Download working HTML
          </Button>
          <Button
            variant="outline"
            onClick={() => void downloadZip()}
            disabled={packing || imageLoading || !!missingImage || needsImageDescription}
          >
            {packing ? "Preparing…" : "Download page ZIP"}
          </Button>
        </div>
      </div>
      <div className="authored-layout">
        <aside className="authored-controls">
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
          <div className="space-y-2">
            <Label htmlFor="page-action-url">Where should the main action lead?</Label>
            <Input
              id="page-action-url"
              value={settings.actionUrl}
              maxLength={2000}
              onChange={(e) => onSettings({ ...settings, actionUrl: e.target.value })}
              placeholder="https://… or mailto:hello@…"
              aria-describedby="page-action-help"
            />
            <p id="page-action-help" className="text-xs leading-relaxed text-muted-foreground">
              Use your actual booking page, contact address, or destination. Without one, the page
              links to its details.
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
                  void chooseImage(e.target.files?.[0]);
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    imageRequest.current++;
                    setImageUploading(false);
                    setImageSnapshot({ id: null, src: null });
                    onSettings({ ...settings, imageId: null });
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
                Saved in this browser and embedded in your download. Use an image you have
                permission to publish.
              </p>
            </div>
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
              <button type="button" aria-pressed={!phone} onClick={() => setPhone(false)}>
                <Monitor size={15} />
                Fit
              </button>
              <button type="button" aria-pressed={phone} onClick={() => setPhone(true)}>
                <Smartphone size={15} />
                320 px
              </button>
            </div>
          </div>
          <div className="authored-frame-stage">
            <iframe
              key={`${settings.imageId ?? "none"}:${image ? "loaded" : "empty"}`}
              title="Working page preview"
              srcDoc={built.html}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              className={phone ? "authored-frame is-phone" : "authored-frame"}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Section links work here. Test contact and booking destinations in the downloaded page.
            Fonts use local fallbacks; no font service or script is required.
          </p>
        </div>
      </div>
      {editor && (
        <div className="mt-6 border-t border-border pt-3">
          <ContentEditor content={content} onChange={onContent} defaultOpen autoFocus />
        </div>
      )}
    </section>
  );
}
