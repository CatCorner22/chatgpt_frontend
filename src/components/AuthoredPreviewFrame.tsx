import { useMemo, type ComponentPropsWithoutRef } from "react";

type Props = Omit<
  ComponentPropsWithoutRef<"iframe">,
  "src" | "srcDoc" | "sandbox" | "referrerPolicy"
> & {
  html: string;
};

/** Only accepts script-free markup from the authored renderer, which escapes owner content.
 * srcdoc otherwise resolves "#section" against Focus. Outbound links keep their real href,
 * but request a new window, which this sandbox doesn't permit. Downloads use the original HTML.
 */
export function AuthoredPreviewFrame({ html, ...props }: Props) {
  const document = useMemo(
    () =>
      html
        .replace("<head>", '<head><base href="about:srcdoc">')
        .replace(/(<a\b[^<>]*? )href="(?!#)/g, '$1target="_blank" href="'),
    [html],
  );
  return (
    <iframe
      {...props}
      data-focus-authored-preview=""
      srcDoc={document}
      sandbox=""
      referrerPolicy="no-referrer"
    />
  );
}
