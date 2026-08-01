import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';

import { report, render, universe } from '../src/report.js';

/**
 * The written scope of this consumer is the reason it exists in this shape.
 * Most of these tests assert that it does *not* do something, because the way a
 * reachability report becomes a directory of good agents is one reasonable
 * feature at a time.
 */

const FORBIDDEN = /trust|score|rank|grade|certif|approve|enforce|allow|deny|safe|compliant|verify/i;

const DISCOVERY = 'https://example.test/.well-known/agent-manifest-registry.json';
const INDEX = 'https://example.test/registry.json';

function manifest(id, overrides = {}) {
  return {
    manifest_version: '1.0',
    agent_id: id,
    agent_name: id,
    agent_version: '1.0.0',
    owner: { type: 'organization', identifier: 'Example' },
    purpose: { primary_code: 'support', description: 'Answer basic product questions.' },
    forbidden_actions: ['never delete user data'],
    autonomy: { level: 0 },
    risk_profile: { level: 'low' },
    data_handling: { stores_personal_data: false },
    stopping_authority: { stoppable_by: ['operator'], mechanism: 'runtime disable via console' },
    audit_surface: { logging: 'basic', reconstructability: 'partial' },
    contact: { email: 'ops@example.com' },
    ...overrides,
  };
}

function entry(id) {
  return {
    agent_id: id,
    manifest_path: `manifests/${id}.json`,
    manifest_url: `https://example.test/manifests/${id}.json`,
    registered_at: '2026-03-08T00:00:00Z',
    source: 'https://github.com/example',
  };
}

function fakeNetwork(overrides = {}) {
  const routes = {
    [DISCOVERY]: { registry_version: '1.0', registry_url: INDEX },
    [INDEX]: {
      registry_version: '1.1',
      base_url: 'https://example.test/',
      agents: [],
      index: [entry('zulu-agent'), entry('alpha-agent'), entry('mike-agent')],
    },
    'https://example.test/manifests/zulu-agent.json': manifest('zulu-agent'),
    'https://example.test/manifests/alpha-agent.json': manifest('alpha-agent'),
    // mike-agent is listed but its document is missing — the majority path.
    ...overrides,
  };
  return async (url) => {
    const answer = routes[url];
    if (answer === undefined) return new Response('missing', { status: 404 });
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
}

const OPTIONS = { registryHost: 'https://example.test', fetchImpl: fakeNetwork() };

test('the universe is declared origins only, and nothing is swept', async () => {
  const { targets } = await universe(OPTIONS);
  assert.ok(targets.every((t) => ['declared-origin', 'registry-entry'].includes(t.kind)));
  // Every target came either from the caller or from the registry the caller named.
  assert.equal(targets.filter((t) => t.kind === 'declared-origin').length, 1);
  assert.equal(targets.filter((t) => t.kind === 'registry-entry').length, 3);
});

test('records exactly the four things the written scope allows, and no fifth', async () => {
  const result = await report(OPTIONS);
  for (const observation of result.observations) {
    assert.deepEqual(Object.keys(observation).sort(), [
      'binding', 'documentPresent', 'failureDetail', 'failureReason', 'hostAnswered',
      'kind', 'label', 'location', 'retrievedAt', 'schemaValid', 'source',
    ]);
    // No aggregate, no derived judgement, no per-origin figure of any kind.
    assert.ok(!('score' in observation));
    assert.ok(!('completeness' in observation));
    assert.ok(!('quality' in observation));
  }
});

test('output is alphabetical, never ordered by any property of the manifest', async () => {
  const result = await report(OPTIONS);
  const labels = result.observations.map((o) => o.label);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b)));
  // Ordering by presence would put the found ones first. It does not.
  const present = result.observations.map((o) => o.documentPresent);
  assert.ok(present.includes(true) && present.includes(false), 'the fixture must exercise both');
  assert.notDeepEqual(present, [...present].sort((a, b) => Number(b) - Number(a)));
});

test('a missing document is reported with a typed reason, not as a failing agent', async () => {
  const result = await report(OPTIONS);
  const missing = result.observations.find((o) => o.label === 'mike-agent');
  assert.equal(missing.documentPresent, false);
  assert.equal(missing.schemaValid, null, 'no structural claim is made about a document nobody has');
  assert.equal(missing.failureReason, 'http-error');
  assert.ok(missing.failureDetail.length > 0);
  assert.doesNotMatch(JSON.stringify(missing), /untrusted|unsafe|bad|non-compliant|rejected/i);
});

test('a retrieved document reports what it is attached to, and never more', async () => {
  const result = await report(OPTIONS);
  const found = result.observations.find((o) => o.label === 'alpha-agent');
  assert.equal(found.documentPresent, true);
  assert.equal(found.schemaValid, true);
  assert.equal(found.binding, 'registry-indexed', 'a URL taken from an index is registry-indexed');
  assert.doesNotMatch(found.binding, /verified|trusted|authentic/);
});

test('a structurally invalid document is recorded as such, and is not called a bad agent', async () => {
  const options = {
    registryHost: 'https://example.test',
    fetchImpl: fakeNetwork({
      'https://example.test/manifests/mike-agent.json': { manifest_version: '1.0', agent_id: 'mike-agent' },
    }),
  };
  const result = await report(options);
  const invalid = result.observations.find((o) => o.label === 'mike-agent');
  assert.equal(invalid.documentPresent, true, 'a document that was retrieved was retrieved');
  assert.equal(invalid.schemaValid, false);
  assert.equal(invalid.failureReason, null, 'invalid structure is not a retrieval failure');
});

test('the counts are counts, and carry no derived figure', async () => {
  const result = await report(OPTIONS);
  assert.deepEqual(Object.keys(result.counts).sort(), [
    'document_absent', 'document_present', 'looked_at', 'structurally_valid',
  ]);
  assert.equal(result.counts.looked_at, result.counts.document_present + result.counts.document_absent);
  // No percentage, no rate, no index number. A proportion invites a target.
  assert.ok(Object.values(result.counts).every((v) => Number.isInteger(v)));
});

test('the report carries the same non-suppressible caveats as a resolution', async () => {
  const result = await report(OPTIONS);
  assert.ok(result.caveats.length >= 4);
  assert.match(result.what_this_is, /not a directory, a ranking, a score or a compliance status/);
  const rendered = render(result);
  assert.match(rendered, /What this does not tell you/);
  for (const caveat of result.caveats) assert.ok(rendered.includes(caveat.statement));
});

test('an unreachable registry produces a note, not an invented universe', async () => {
  const result = await report({
    registryHost: 'https://example.test',
    fetchImpl: async () => new Response('gone', { status: 404 }),
  });
  assert.ok(result.notes.length > 0);
  assert.match(result.notes[0], /No registry index could be read/);
  assert.equal(result.observations.filter((o) => o.kind === 'registry-entry').length, 0);
});

test('no identifier in this package uses forbidden vocabulary', async () => {
  const module = await import('../src/report.js');
  const names = new Set(Object.keys(module));
  const result = await report(OPTIONS);
  for (const key of Object.keys(result)) names.add(key);
  for (const key of Object.keys(result.counts)) names.add(key);
  for (const key of Object.keys(result.observations[0])) names.add(key);
  const offending = [...names].filter((name) => FORBIDDEN.test(name));
  assert.deepEqual(offending, [], `forbidden vocabulary: ${offending.join(', ')}`);
});

test('no open sweep is implemented, not even behind a flag', async () => {
  const dir = fileURLToPath(new URL('../', import.meta.url));
  const files = (await readdir(dir, { recursive: true }))
    .map((entry) => entry.split(sep).join('/'))
    .filter((f) => f.endsWith('.js') && !f.startsWith('test/') && !f.includes('node_modules'));
  assert.ok(files.length >= 2);

  for (const file of files) {
    const text = await readFile(new URL(file, new URL('../', import.meta.url)), 'utf8');
    // Declarations, not prose: the files say in as many words that no sweep
    // exists, so a plain word search would flag the very sentence that says so.
    assert.doesNotMatch(
      text,
      /\b(function|const|let|class)\s+\w*(crawl|sweep|spider|scan|enumerate)\w*/i,
      `${file} declares a sweep`,
    );
    assert.doesNotMatch(text, /['"`][^'"`]*robots\.txt/i, `${file} reaches for robots.txt`);
  }

  // And the flag does not exist either, which is the point.
  const cli = await readFile(new URL('../bin/reachability.js', import.meta.url), 'utf8');
  assert.doesNotMatch(cli, /--all\b|--sweep\b|--crawl\b|--open\b/);
  assert.match(cli, /There is no flag for an open sweep/);
});

test('nothing is sent anywhere: the report is written locally and that is all', async () => {
  const cli = await readFile(new URL('../bin/reachability.js', import.meta.url), 'utf8');
  assert.doesNotMatch(cli, /\bfetch\s*\(|POST|PUT|telemetry|analytics|beacon/i);
  const source = await readFile(new URL('../src/report.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|telemetry|analytics|beacon/i);
});
