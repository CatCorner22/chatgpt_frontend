const VALUE_FLAGS = new Map([
  ['--url', 'url'],
  ['--file', 'file'],
  ['--out', 'out'],
  ['--settle-ms', 'settleMs'],
  ['--timeout-ms', 'timeoutMs'],
  ['--actions', 'actions'],
  ['--executable', 'executable'],
]);
const BOOLEAN_FLAGS = new Map([
  ['--allow-remote', 'allowRemote'],
  ['--help', 'help'],
]);

/** Host-only decision; no DNS lookup and no claim about a hostname's resolution. */
export function isLocalHostname(hostname) {
  if (typeof hostname !== 'string') return false;
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname.toLowerCase());
}

/** A URL permission check shared by argument validation and request routing. */
export function urlAllowed(value, allowRemote = false) {
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    return allowRemote === true || isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function boundedInteger(value, name, minimum, maximum) {
  if (!/^\d+$/.test(value)) throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${name} must be a whole number from ${minimum} to ${maximum}.`);
  }
  return number;
}

/** Pure parsing: the runner owns paths, file reads, browsers, and timestamps. */
export function parseArgs(argv) {
  if (!Array.isArray(argv) || argv.some(value => typeof value !== 'string')) throw new Error('Arguments must be an array of strings.');
  const options = {
    url: null,
    file: null,
    out: 'artifacts/north-star-audit',
    allowRemote: false,
    settleMs: 1500,
    timeoutMs: 15000,
    actions: null,
    executable: null,
    help: false,
  };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const equals = argument.indexOf('=');
    const flag = equals < 0 ? argument : argument.slice(0, equals);
    if (!VALUE_FLAGS.has(flag) && !BOOLEAN_FLAGS.has(flag)) throw new Error(`Unknown argument: ${flag}`);
    if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    seen.add(flag);
    if (BOOLEAN_FLAGS.has(flag)) {
      if (equals >= 0) throw new Error(`${flag} does not take a value.`);
      options[BOOLEAN_FLAGS.get(flag)] = true;
      continue;
    }
    const value = equals >= 0 ? argument.slice(equals + 1) : argv[++index];
    if (value === undefined || !value.trim() || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
    if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${flag} cannot contain control characters.`);
    const key = VALUE_FLAGS.get(flag);
    if (key === 'settleMs') options.settleMs = boundedInteger(value, flag, 0, 10000);
    else if (key === 'timeoutMs') options.timeoutMs = boundedInteger(value, flag, 1000, 60000);
    else options[key] = value;
  }
  if (options.url && options.file) throw new Error('Choose exactly one target: --url or --file.');
  if (!options.help && !options.url && !options.file) throw new Error('Supply a target with --url or --file.');
  if (options.url) {
    let url;
    try {
      url = new URL(options.url);
    } catch {
      throw new Error('--url must be an absolute HTTP or HTTPS URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('--url must use HTTP or HTTPS. Use --file for a local HTML file.');
    if (url.username || url.password) throw new Error('--url cannot contain embedded credentials.');
    if (!urlAllowed(options.url, options.allowRemote)) throw new Error('Remote URLs require --allow-remote. Without it, use localhost, 127.0.0.1, or [::1].');
    options.url = url.href;
  }
  return options;
}

export const usage = `Usage:
  node scripts/north-star-audit.mjs --url http://localhost:3000 [options]
  node scripts/north-star-audit.mjs --file path/to/page.html [options]

Options:
  --out DIRECTORY       Report directory (default: artifacts/north-star-audit)
  --settle-ms INTEGER   Observation delay after load, 0–10000 (default: 1500)
  --timeout-ms INTEGER  Navigation/action timeout, 1000–60000 (default: 15000)
  --actions FILE        Optional JSON browser walk
  --executable FILE    Chromium executable path
  --allow-remote       Explicitly permit HTTP(S) requests to remote hosts
  --help               Show this help

File existence and supported browser-walk actions are validated by the runner.
Without --allow-remote, the runner blocks remote HTTP(S) resources and redirects.
`;
