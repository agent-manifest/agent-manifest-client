import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validate } from '../src/validate.js';
import { schemaV1_0, SOURCE, SCHEMA_VERSIONS, schemaFor } from '@agent-manifest/schema';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const readJson = async (relative) => JSON.parse(await readFile(here(relative), 'utf8'));

/**
 * Mechanism 7 — the package states its own non-goals, and declares itself.
 *
 * A project that asks others to publish a manifest and does not publish one for
 * the thing it ships is asking for a courtesy it will not extend.
 */

test('the package declares its own manifest and that manifest is structurally valid', async () => {
  const manifest = await readJson('../agent-manifest.json');
  const result = validate(manifest);
  assert.equal(result.schemaValid, true, JSON.stringify(result.errors, null, 2));
  assert.equal(manifest.agent_id, 'agent-manifest-client');
  assert.equal(manifest.autonomy.level, 0, 'a library takes no action of its own');
});

test('the declared agent_version tracks the package version', async () => {
  const manifest = await readJson('../agent-manifest.json');
  const pkg = await readJson('../package.json');
  assert.equal(manifest.agent_version, pkg.version, 'the manifest declares a version nobody shipped');
});

test('the manifest claims no authority over the specification', async () => {
  const text = await readFile(here('../agent-manifest.json'), 'utf8');
  // The core repository's own manifest once declared authority over the format
  // and called it "the Agent Manifest standard". Both readings contradict
  // GOVERNANCE.md, which says the project enforces no authority. This document
  // must not reintroduce either.
  assert.doesNotMatch(text, /"specification"\s*:/);
  assert.doesNotMatch(text, /\bthe Agent Manifest standard\b/i);
  assert.doesNotMatch(text, /\bthe standard\b/i);
  assert.doesNotMatch(text, /\bthe missing layer\b/i);
});

test('the package manifest lists its non-goals', async () => {
  const pkg = await readJson('../package.json');
  assert.ok(Array.isArray(pkg.not_goals) && pkg.not_goals.length >= 10);
  const joined = pkg.not_goals.join(' ').toLowerCase();
  for (const subject of ['score', 'policy', 'certif', 'telemetry', 'sign', 'default']) {
    assert.ok(joined.includes(subject), `non-goals do not mention ${subject}`);
  }
});

test('the shipped file list carries no test material and nothing internal', async () => {
  const pkg = await readJson('../package.json');
  assert.deepEqual(pkg.files.sort(), ['LICENSE', 'README.md', 'agent-manifest.json', 'src'].sort());
});

test('the schema package ships one copy of the schema, with its provenance', () => {
  assert.equal(SOURCE.sha256, 'c1e3caaf9543f2a5d610ccdfaf36329562fe03b6db00c4ea30b7ef0b7b8ef70a');
  assert.equal(SOURCE.canonical_path, 'spec/v1.0/schema.json');
  assert.equal(SOURCE.license.schema_file, 'CC0-1.0');
  assert.equal(SOURCE.license.prose_specification, 'CC BY 4.0');
  assert.deepEqual(SCHEMA_VERSIONS, ['1.0']);
  assert.equal(schemaFor('1.0'), schemaV1_0);
  assert.equal(schemaFor('2.0'), null, 'an unknown version must not fall back to a known schema');
  assert.equal(schemaFor('1.1'), null);
});

test('the vendored schema is byte-for-byte the canonical one', async () => {
  const url = import.meta.resolve('@agent-manifest/schema/v1.0/schema.json');
  const bytes = await readFile(fileURLToPath(url));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  assert.equal(hex, SOURCE.sha256, 'the vendored schema has drifted from its recorded checksum');
  assert.equal(bytes.byteLength, SOURCE.bytes);
});
