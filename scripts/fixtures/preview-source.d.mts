export function exportSourceFromPreview(html: string): string;
export function readPreviewDocument(frame: {
  getAttribute(name: string): Promise<string | null>;
}): Promise<string>;
