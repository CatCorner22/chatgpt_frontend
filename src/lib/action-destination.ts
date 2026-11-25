import { safeUrl } from "./critic";

/** Navigation only: never fetched, embedded, or interpreted as executable content. */
export function actionDestination(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (
    !raw ||
    [...raw].some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    ) ||
    /[<>"'`\\]/.test(raw) ||
    /%(?:0a|0d)/i.test(raw)
  )
    return null;
  if (/^mailto:/i.test(raw)) {
    return /^mailto:[a-z0-9.!#$%&*+/=?^_{}|~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
      raw,
    )
      ? raw
      : null;
  }
  if (/^tel:/i.test(raw)) return /^tel:\+?[0-9][0-9().-]{2,39}$/.test(raw) ? raw : null;
  try {
    const url = new URL(raw);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const SECRET_PARAMETERS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "api_key",
  "apikey",
  "token",
  "auth_token",
  "password",
  "passwd",
  "client_secret",
  "secret",
  "authorization",
]);
const SIGNED_LINK_PARAMETERS = new Set([
  ...SECRET_PARAMETERS,
  "code",
  "signature",
  "sig",
  "x-amz-signature",
  "x-goog-signature",
  "x-amz-credential",
  "x-amz-security-token",
]);

export function containsUrlCredentials(url: URL, secretParameters = SECRET_PARAMETERS): boolean {
  if (url.username || url.password) return true;
  const fragment = url.hash.slice(1);
  const parameters = [
    url.searchParams,
    new URLSearchParams(fragment),
    new URLSearchParams(fragment.split("?")[1] ?? ""),
  ];
  return parameters.some((params) =>
    [...params].some(([name, value]) => secretParameters.has(name.toLowerCase()) && value.trim()),
  );
}

/** A guide may circulate independently of the page. Only include a public web destination. */
export function websiteActionForHandoff(page: unknown): string | null {
  if (!page || typeof page !== "object" || !("actionUrl" in page)) return null;
  if (typeof page.actionUrl !== "string" || page.actionUrl.length > 2000) return null;
  const href = actionDestination(page.actionUrl);
  if (!href || !/^https?:\/\//.test(href)) return null;
  const url = new URL(href);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  url.hostname = host;
  if (
    !safeUrl(url.href) ||
    host.endsWith(".localhost") ||
    host === "home.arpa" ||
    host.endsWith(".home.arpa") ||
    containsUrlCredentials(url, SIGNED_LINK_PARAMETERS)
  )
    return null;
  return href;
}
