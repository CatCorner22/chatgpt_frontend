/**
 * This workbench checks markup, never a live page. Remove executable/raw styling
 * content and neutralize resource-bearing attributes before creating the inert
 * document. Attribute names are not character-reference decoded by HTML parsers.
 * The changes are deliberately limited to evidence our static checks do not use.
 */
export function inertMarkup(source: string): string {
  return source
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, "")
    .replace(
      /\b(src|srcset|srcdoc|href|poster|data|background|ping|action|formaction|style|codebase|archive|classid|manifest|profile|lowsrc|dynsrc)\s*=/gi,
      (_match, attribute: string) => `data-north-star-inert-${attribute.toLowerCase()}=`,
    );
}
