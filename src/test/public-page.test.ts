import { afterEach, describe, expect, it, vi } from "vitest";
import { grabPublicDocument, grabPublicPage } from "@/lib/public-page.server";

afterEach(() => vi.unstubAllGlobals());

// DNS-over-HTTPS lookups answer with `ip`; every other request goes to the page fetcher.
function stub(page: (url: string, init?: RequestInit) => unknown, ip = "93.184.216.34") {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) =>
      url.includes("dns-query")
        ? Promise.resolve(
            Response.json({
              Answer: url.endsWith("type=A") ? [{ type: 1, data: ip }] : [],
            }),
          )
        : (page(url, init) as Promise<Response>),
    ),
  );
}

describe("public page downloads", () => {
  it("retains the validated final URL and source completeness after a redirect", async () => {
    stub(
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/shop/" } }))
        .mockResolvedValueOnce(
          new Response('<a href="checkout">Pay</a>', { headers: { "content-type": "text/html" } }),
        ),
    );
    const document = await grabPublicDocument("https://example.com/old", 100);
    expect(document).toEqual({
      text: '<a href="checkout">Pay</a>',
      url: "https://example.com/shop/",
      complete: true,
    });
    expect(new URL("checkout", document!.url).pathname).toBe("/shop/checkout");
  });
  it.each([
    ["abcd", true],
    ["abcde", false],
  ])("reports whether a bounded source is complete: %s", async (body, complete) => {
    stub(
      vi.fn().mockResolvedValue(new Response(body, { headers: { "content-type": "text/html" } })),
    );
    expect(await grabPublicDocument("https://example.com", 4)).toEqual({
      text: "abcd",
      url: "https://example.com/",
      complete,
    });
  });
  it("never fetches a private redirect target", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );
    stub(fetcher);
    expect(await grabPublicPage("https://example.com", 100)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[1].redirect).toBe("manual");
  });
  it("follows a validated public relative redirect", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/home" } }))
      .mockResolvedValueOnce(
        new Response("<h1>Home</h1>", { headers: { "content-type": "text/html" } }),
      );
    stub(fetcher);
    expect(await grabPublicPage("https://example.com", 100)).toBe("<h1>Home</h1>");
    expect(fetcher.mock.calls[1]?.[0]).toBe("https://example.com/home");
  });
  it("bounds response bytes while streaming", async () => {
    stub(
      vi
        .fn()
        .mockResolvedValue(new Response("abcdefghij", { headers: { "content-type": "text/css" } })),
    );
    expect(await grabPublicPage("https://example.com", 4)).toBe("abcd");
  });
  it("stops redirect loops after five requests", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        () => new Response(null, { status: 302, headers: { location: "/loop" } }),
      );
    stub(fetcher);
    expect(await grabPublicPage("https://example.com", 100)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("rejects non-text downloads and handles network failures", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("binary", { headers: { "content-type": "image/png" } }))
      .mockRejectedValueOnce(new Error("offline"));
    stub(fetcher);
    expect(await grabPublicPage("https://example.com", 100)).toBeNull();
    expect(await grabPublicPage("https://example.com", 100)).toBeNull();
  });
  it("refuses a public-looking name that resolves to a private machine", async () => {
    const fetcher = vi.fn();
    stub(fetcher, "10.0.0.5");
    expect(await grabPublicPage("https://sneaky.example.com", 100)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
