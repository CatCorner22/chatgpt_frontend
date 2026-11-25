import { chromium, firefox } from "playwright-core";

export const browserName = process.env.FOCUS_BROWSER || "chromium";

export function launchChromium(executable) {
  return chromium.launch({
    executablePath: executable || process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: [
      "--no-sandbox",
      // Chromium bypasses proxies for loopback. Other hosts use an unresolvable
      // test proxy, including preconnects that bypass Playwright route handlers.
      ...(process.env.FOCUS_TEST_LOOPBACK_ONLY === "1"
        ? [
            "--proxy-server=http://focus-browser-test.invalid:80",
            "--host-resolver-rules=MAP focus-browser-test.invalid ~NOTFOUND",
          ]
        : []),
    ],
  });
}

export function launchTestBrowser() {
  if (browserName === "firefox") return firefox.launch({ headless: true });
  if (browserName !== "chromium") throw new Error("FOCUS_BROWSER must be chromium or firefox.");
  return launchChromium();
}
