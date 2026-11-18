import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalHostname, parseArgs, urlAllowed } from './options.mjs';

test('parses a local URL with deterministic defaults', () => {
  assert.deepEqual(parseArgs(['--url', 'http://localhost:3000']), {
    url: 'http://localhost:3000/', file: null, out: 'artifacts/north-star-audit', allowRemote: false,
    settleMs: 1500, timeoutMs: 15000, actions: null, executable: null, help: false,
  });
});

test('preserves file paths and accepts both value forms without file-system reads', () => {
  const result = parseArgs(['--file', './fixtures/real page.html', '--out=./reports/run 1', '--actions', './walk.json', '--executable=/usr/bin/chromium', '--settle-ms=0', '--timeout-ms', '60000']);
  assert.equal(result.file, './fixtures/real page.html');
  assert.equal(result.out, './reports/run 1');
  assert.equal(result.actions, './walk.json');
  assert.equal(result.executable, '/usr/bin/chromium');
  assert.equal(result.settleMs, 0);
  assert.equal(result.timeoutMs, 60000);
});

test('requires exactly one target except standalone help', () => {
  assert.throws(() => parseArgs([]), /Supply a target/);
  assert.throws(() => parseArgs(['--url', 'http://localhost', '--file', 'a.html']), /exactly one/);
  assert.equal(parseArgs(['--help']).help, true);
});

test('refuses unknown, repeated, empty, or malformed flags', () => {
  const base = ['--file', 'a.html'];
  for (const args of [['--unknown'], ['--out'], ['--out='], ['--out', '--help'], ['--out=a', '--out=b'], ['--allow-remote=true'], ['--allow-remote', '--allow-remote'], ['extra.html']]) {
    assert.throws(() => parseArgs([...base, ...args]));
  }
  assert.throws(() => parseArgs(['--file', 'a\n.html']), /control characters/);
  assert.throws(() => parseArgs([true]), /array of strings/);
});

test('enforces bounded whole-number timing values', () => {
  const base = ['--file', 'a.html'];
  for (const value of ['-1', '10001', '1.5', '1e3', 'NaN', 'Infinity']) assert.throws(() => parseArgs([...base, '--settle-ms', value]), /whole number/);
  for (const value of ['0', '999', '60001', '1000.1']) assert.throws(() => parseArgs([...base, '--timeout-ms', value]), /whole number/);
  assert.equal(parseArgs([...base, '--settle-ms=10000', '--timeout-ms=1000']).timeoutMs, 1000);
});

test('allows only exact loopback hostnames by default', () => {
  for (const hostname of ['localhost', 'LOCALHOST', '127.0.0.1', '::1', '[::1]']) assert.equal(isLocalHostname(hostname), true);
  for (const hostname of ['localhost.example.com', 'example.localhost', '127.0.0.2', '0.0.0.0', '', null, 'localhost:3000']) assert.equal(isLocalHostname(hostname), false);
  for (const url of ['http://localhost:3000/a#tab', 'https://127.0.0.1/', 'http://[::1]:8080/']) assert.equal(urlAllowed(url), true);
  for (const url of ['https://example.com', 'https://localhost.example.com', 'http://192.168.1.1']) assert.equal(urlAllowed(url), false);
});

test('remote access must be explicit and is independent of flag order', () => {
  assert.throws(() => parseArgs(['--url', 'https://example.com/path']), /--allow-remote/);
  assert.equal(parseArgs(['--url', 'https://example.com/path#part', '--allow-remote']).url, 'https://example.com/path#part');
  assert.equal(parseArgs(['--allow-remote', '--url=https://example.com']).allowRemote, true);
  assert.equal(urlAllowed('https://example.com', true), true);
  assert.equal(urlAllowed('https://example.com', 'true'), false);
});

test('never allows credentials, non-HTTP protocols, malformed URLs, or controls', () => {
  for (const url of ['file:///tmp/a.html', 'data:text/html,a', 'javascript:alert(1)', 'ftp://localhost/a', 'ws://localhost', 'http://name:secret@localhost/', 'https://name@example.com/', 'not a URL', 'http://local\nhost/']) {
    assert.equal(urlAllowed(url, true), false, url);
    assert.throws(() => parseArgs(['--allow-remote', '--url', url]), undefined, url);
  }
});
