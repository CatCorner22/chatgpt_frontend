import { safeUrl } from "./critic";

/** Navigation only: never fetched, embedded, or interpreted as executable content. */
export function actionDestination(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (
    !raw ||
    [...raw].some(
      (character) => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    ) ||
    /[<>"`\\]/.test(raw) ||
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
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null;
    // Keep the owner's spelling in exported attributes. Legacy shorthand still
    // receives the absolute serialization used by earlier authored pages.
    return /^https?:\/\/[^/?#]/i.test(raw) ? raw : url.href;
  } catch {
    return null;
  }
}

/** Earlier pages normalized web addresses and rejected literal apostrophes. */
export function changesPreviousActionMarkup(value: unknown): boolean {
  const action = actionDestination(value);
  return (
    !!action &&
    (action.includes("'") || (/^https?:/i.test(action) && new URL(action).href !== action))
  );
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
  "signature",
  "sig",
  "client_assertion",
  "oauth_token",
  "jwt",
  "session_token",
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

function publicWebAction(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return null;
  const href = actionDestination(value);
  if (!href || !/^https?:\/\//i.test(href)) return null;
  const url = new URL(href);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  // This is navigation data. Only reuse the Critic's host check; its network
  // fetch port restrictions do not apply to a link a developer will render.
  if (
    !safeUrl(`https://${host}/`) ||
    host.endsWith(".localhost") ||
    host === "home.arpa" ||
    host.endsWith(".home.arpa") ||
    containsUrlCredentials(url, SIGNED_LINK_PARAMETERS)
  )
    return null;
  const params = [
    ...url.searchParams,
    ...new URLSearchParams(url.hash.slice(1)),
    ...new URLSearchParams(url.hash.slice(1).split("?")[1] ?? ""),
  ];
  const has = (key: string) =>
    params.some(([name, data]) => name.toLowerCase() === key && data.trim());
  const hasCode = has("code");
  if (
    hasCode &&
    (has("state") ||
      has("client_id") ||
      /(?:oauth|authorize|callback|signin|login)/i.test(url.pathname))
  )
    return null;
  return { href, hasCode };
}

export function needsPublicCodeConfirmation(value: unknown): boolean {
  return publicWebAction(value)?.hasCode === true;
}

/** Public promo codes and one-time login codes can use the same parameter name. */
export function websiteActionForHandoff(page: unknown): string | null {
  if (!page || typeof page !== "object" || !("actionUrl" in page)) return null;
  const action = publicWebAction(page.actionUrl);
  if (!action) return null;
  if (action.hasCode && !("publicCodeUrl" in page && page.publicCodeUrl === page.actionUrl))
    return null;
  return action.href;
}
