import type { ReactNode } from "react";
import { AppHeader } from "./AppHeader";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <><AppHeader /><main className="mx-auto max-w-3xl px-5 py-12 text-foreground">
    <h1 className="font-display text-4xl">{title}</h1>
    <p className="mt-3 text-sm text-muted-foreground">Last updated November 17, 2026</p>
    <article className="mt-8 space-y-7 leading-relaxed [&_h2]:mb-2 [&_h2]:font-display [&_h2]:text-2xl [&_p+p]:mt-3 [&_a]:underline">{children}</article>
  </main></>;
}