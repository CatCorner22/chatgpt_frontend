import type { Content, Tokens } from "./design";
import { families } from "./authored-families";
import { DEFAULT_PAGE_OPTIONS, renderAuthoredPage, type PageOptions } from "./render-authored-page";

export { DEFAULT_PAGE_OPTIONS, type PageOptions, type PageReadiness } from "./render-authored-page";

/** Synchronous entry for standalone generation. The Studio loads only its selected families. */
export function buildAuthoredPage(
  input: Tokens,
  content: Content,
  options: PageOptions = DEFAULT_PAGE_OPTIONS,
) {
  return renderAuthoredPage(input, content, options, families);
}
