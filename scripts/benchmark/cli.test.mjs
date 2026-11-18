import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const exec = promisify(execFile);
const cli = fileURLToPath(new URL('../north-star-benchmark.mjs', import.meta.url));
const run = (...args) => exec(process.execPath, [cli, ...args]);
const save = (path, data) => writeFile(path, JSON.stringify(data));
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'benchmark-cli-test-'));
  const organizer = join(dir, 'organizer.json');
  await run('init', organizer);
  const manifest = JSON.parse(await readFile(organizer, 'utf8'));
  manifest.tasks = manifest.tasks.slice(0, 1);
  manifest.criteria.minimumHumanCreators = 1;
  manifest.criteria.targetReviewers = 2;
  // Synthetic test metadata; this is not submitted human work or study evidence.
  manifest.samples = [
    { id: 'opaque-a', taskId: manifest.tasks[0].id, assetRef: 'http://127.0.0.1:4173/sample-a.html', kind: 'interactive', group: 'spec', creatorCode: 'test-a', provenance: 'Synthetic CLI test artifact' },
    { id: 'opaque-b', taskId: manifest.tasks[0].id, assetRef: 'http://127.0.0.1:4173/sample-b.html', kind: 'interactive', group: 'human', creatorCode: 'test-b', provenance: 'Synthetic CLI test artifact' },
  ];
  await save(organizer, manifest);
  return { dir, organizer, manifest };
}

test('init writes an empty draft and refuses to overwrite it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'benchmark-cli-init-'));
  try {
    const output = join(dir, 'plan.json');
    await run('init', output);
    const plan = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(plan.status, 'draft');
    assert.equal(plan.tasks.length, 6);
    assert.deepEqual(plan.samples, []);
    await assert.rejects(run('init', output), /already exists/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('packet preserves requested order and excludes organizer-only fields', async () => {
  const { dir, organizer } = await setup();
  try {
    const order = join(dir, 'order.json');
    await save(order, ['opaque-b', 'opaque-a']);
    const output = join(dir, 'reviewer.json');
    await run('packet', organizer, output, '--order', order);
    const packet = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(packet.samples.map(sample => sample.id), ['opaque-b', 'opaque-a']);
    for (const sample of packet.samples) {
      assert.equal('group' in sample, false);
      assert.equal('provenance' in sample, false);
      assert.equal('creatorCode' in sample, false);
    }
    assert.equal('criteria' in packet, false);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('score merges genuine-format bundles without inventing completion or deduplicating votes', async () => {
  const { dir, organizer, manifest } = await setup();
  try {
    const bundle = { version: 1, benchmarkId: manifest.id, evaluations: manifest.samples.map(sample => ({
      benchmarkId: manifest.id, reviewerCode: 'synthetic-reviewer', sampleId: sample.id, taskOutcome: 'completed', judgedOrigin: 'unsure', note: 'Synthetic test answer',
      quality: { hierarchy: 5, typography: 5, composition: 5, distinctiveness: 5, interaction: 5, content: 5 },
    })) };
    const answers = join(dir, 'answers.json');
    await save(answers, bundle);
    const report = join(dir, 'report.json');
    await run('score', organizer, report, answers);
    const result = JSON.parse(await readFile(report, 'utf8'));
    assert.equal(result.state, 'not-ready');
    assert.equal(result.counts.evaluations, 2);
    assert.equal(result.counts.completeReviewers, 1);
    await assert.rejects(run('score', organizer, join(dir, 'duplicate-report.json'), answers, answers), /only once/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('packet refuses unsupported asset schemes before creating a review file', async () => {
  const { dir, organizer, manifest } = await setup();
  try {
    manifest.samples[0].assetRef = 'javascript:alert(1)';
    await save(organizer, manifest);
    await assert.rejects(run('packet', organizer, join(dir, 'reviewer.json')), /HTTP or HTTPS/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
