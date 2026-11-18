import { chromium, firefox } from "playwright-core";

export const browserName = process.env.FOCUS_BROWSER || "chromium";

export function launchTestBrowser() {
  if (browserName === "firefox") return firefox.launch({ headless: true });
  if (browserName !== "chromium") throw new Error("FOCUS_BROWSER must be chromium or firefox.");
  return chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
}
