import { afterEach, describe, expect, it, vi } from "vitest";
import { grabSiteSources } from "@/lib/watchtower.server";

afterEach(() => vi.unstubAllGlobals());

describe("customer live-site review boundary", () => {
  it("resolves relative stylesheets from the validated final page URL after a redirect", async () => {
    const styles: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.startsWith("https://cloudflare-dns.com/dns-query?")) {
          return Response.json({
            Answer: url.endsWith("type=A") ? [{ type: 1, data: "93.184.216.34" }] : [],
          });
        }
        if (url === "https://customer.example/old") {
          return new Response(null, { status: 302, headers: { location: "/shop/" } });
        }
        if (url === "https://customer.example/shop/") {
          return new Response(
            '<link rel="stylesheet" href="styles/customer.css"><h1>Customer shop</h1>',
            { headers: { "content-type": "text/html" } },
          );
        }
        styles.push(url);
        return new Response(
          url === "https://customer.example/shop/styles/customer.css"
            ? ".customer { color: #123456; }"
            : ".wrong-page { color: #654321; }",
          { headers: { "content-type": "text/css" } },
        );
      }),
    );
    const sources = await grabSiteSources("https://customer.example/old");
    expect(styles).toEqual(["https://customer.example/shop/styles/customer.css"]);
    expect(sources.css).toContain("#123456");
    expect(sources.css).not.toContain("#654321");
  });

  it("only reads HTML and bounded stylesheets; never executes scripts, submits forms or sends customer credentials", async () => {
    const requests: { url: string; init: RequestInit | undefined }[] = [];
    const html = `<!doctype html><html><head>
      <link rel="stylesheet" href="/customer.css">
      <link rel="stylesheet" href="https://customer-cdn.example/theme.css">
      <script>fetch('/api/delete-account', { method: 'DELETE' })</script>
      <script src="/customer-script.js"></script>
      </head><body><form action="/api/book" method="POST"><input name="secret" value="customer-only"><button>Book</button></form>
      <a href="/dangerous-action">Original link</a><img src="/private-image.png"></body></html>`;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, init });
        if (url.startsWith("https://cloudflare-dns.com/dns-query?")) {
          return Response.json({
            Answer: url.endsWith("type=A") ? [{ type: 1, data: "93.184.216.34" }] : [],
          });
        }
        if (url === "https://customer.example/booking") {
          return new Response(html, { headers: { "content-type": "text/html" } });
        }
        if (
          [
            "https://customer.example/customer.css",
            "https://customer-cdn.example/theme.css",
          ].includes(url)
        ) {
          return new Response("body { color: #111111; background: #ffffff; }", {
            headers: { "content-type": "text/css" },
          });
        }
        throw new Error(`Unexpected customer request: ${url}`);
      }),
    );
    const sources = await grabSiteSources("https://customer.example/booking");
    expect(sources.html).toBe(html);
    expect(sources.css).toContain("color: #111111");
    const customerRequests = requests.filter(
      ({ url }) => !url.startsWith("https://cloudflare-dns.com/"),
    );
    expect(customerRequests.map(({ url }) => url).sort()).toEqual([
      "https://customer-cdn.example/theme.css",
      "https://customer.example/booking",
      "https://customer.example/customer.css",
    ]);
    for (const { init } of requests) {
      expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
      expect(init?.body).toBeUndefined();
      expect(init?.credentials).not.toBe("include");
      const headers = new Headers(init?.headers);
      expect(headers.has("Authorization")).toBe(false);
      expect(headers.has("Cookie")).toBe(false);
    }
    for (const { init } of customerRequests) expect(init?.redirect).toBe("manual");
  });

  it("limits a page's stylesheet fan-out to four external reads", async () => {
    const fetchedStyles: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = String(input);
        if (url.startsWith("https://cloudflare-dns.com/dns-query?")) {
          return Response.json({
            Answer: url.endsWith("type=A") ? [{ type: 1, data: "93.184.216.34" }] : [],
          });
        }
        if (url === "https://customer.example/") {
          return new Response(
            Array.from(
              { length: 40 },
              (_, index) => `<link rel="stylesheet" href="/style-${index}.css">`,
            ).join(""),
            { headers: { "content-type": "text/html" } },
          );
        }
        fetchedStyles.push(url);
        return new Response("body { color: #111111; }", {
          headers: { "content-type": "text/css" },
        });
      }),
    );
    await grabSiteSources("https://customer.example");
    expect(fetchedStyles).toEqual(
      Array.from({ length: 4 }, (_, index) => `https://customer.example/style-${index}.css`),
    );
  });
});
