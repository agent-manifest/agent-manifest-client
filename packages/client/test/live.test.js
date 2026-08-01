import test from 'node:test';
import assert from 'node:assert/strict';

import { discover, discoverRegistry, resolve } from '../src/net/index.js';

/**
 * The access layer, exercised against what is actually served.
 *
 * These tests reach the public network on purpose. Everything else in this
 * suite runs against a recorded fetch, and a recorded fetch can only ever
 * confirm that the code agrees with the fixture somebody wrote. The point here
 * is different: the discovery document publishes a promise that its field names
 * are stable while `registry_version` is unchanged, and the only way to know
 * whether that promise can be kept by code is to write the code and point it at
 * the real document.
 *
 * Set AGENT_MANIFEST_SKIP_LIVE=1 to skip them offline.
 */

const skip = process.env.AGENT_MANIFEST_SKIP_LIVE === '1' ? 'AGENT_MANIFEST_SKIP_LIVE is set' : false;
const CANONICAL_HOST = 'https://agent-manifest-spec.org';

test('the canonical host publishes a registry discovery document this package can read', { skip }, async () => {
  const result = await discoverRegistry(CANONICAL_HOST);
  assert.equal(result.absence, null, JSON.stringify(result.absence));
  assert.equal(result.registryVersion, '1.0', 'the version the document declares today');
  assert.equal(result.source, `${CANONICAL_HOST}/.well-known/agent-manifest-registry.json`);
  assert.match(result.registryUrl, /^https:\/\//);
});

test('the registry index it points at is reachable and resolves an agent_id in two requests', { skip }, async () => {
  const discovery = await discoverRegistry(CANONICAL_HOST);
  assert.equal(discovery.absence, null);

  let requests = 0;
  const counting = (...args) => {
    requests += 1;
    return globalThis.fetch(...args);
  };

  const result = await resolve('the-diplomat', {
    registryUrl: discovery.registryUrl,
    fetchImpl: counting,
  });

  assert.equal(requests, 2, `resolving an id took ${requests} requests`);
  assert.equal(result.resolutions.length, 1);

  const [resolution] = result.resolutions;
  assert.equal(resolution.document.agent_id, 'the-diplomat');
  assert.equal(resolution.schemaValid, true, JSON.stringify(resolution.errors));
  assert.equal(resolution.route, 'registry-index');
  assert.equal(resolution.binding, 'registry-indexed');
  assert.match(resolution.source, /^https:\/\//);
  assert.ok(resolution.caveats.length >= 4);
});

test('an agent_id nobody registered comes back empty from the real registry', { skip }, async () => {
  const discovery = await discoverRegistry(CANONICAL_HOST);
  const result = await resolve('this-agent-does-not-exist-anywhere', {
    registryUrl: discovery.registryUrl,
  });
  assert.deepEqual(result.resolutions, []);
  assert.equal(result.absence.reason, 'not-in-registry-index');
});

test('every agent_id the real index lists resolves to a manifest that declares it', { skip }, async () => {
  const discovery = await discoverRegistry(CANONICAL_HOST);
  const response = await fetch(discovery.registryUrl);
  const registry = await response.json();

  assert.ok(Array.isArray(registry.index), 'the registry publishes an index');
  assert.ok(registry.index.length > 0);

  for (const entry of registry.index) {
    const result = await resolve(entry.agent_id, { registryUrl: discovery.registryUrl });
    assert.equal(result.resolutions.length, 1, `${entry.agent_id} resolved to ${result.resolutions.length}`);
    assert.equal(result.resolutions[0].document.agent_id, entry.agent_id);
    assert.equal(result.resolutions[0].schemaValid, true, `${entry.agent_id}: ${JSON.stringify(result.resolutions[0].errors)}`);
  }
});

test('the canonical host is asked for its own manifest, and the answer is recorded either way', { skip }, async () => {
  // Before G-D this endpoint returned 404 — the first thing a reader tries is
  // our own manifest, at the location we ourselves prescribed. The test asserts
  // that whichever answer comes back is reported honestly, and that a found
  // document is bound to the host and nothing more.
  const result = await discover(CANONICAL_HOST);

  if (result.resolutions.length === 0) {
    assert.equal(result.absence.reason, 'no-document-at-well-known');
    return;
  }

  const [resolution] = result.resolutions;
  assert.equal(resolution.binding, 'same-origin-well-known');
  assert.equal(resolution.source, `${CANONICAL_HOST}/.well-known/agent-manifest.json`);
  assert.equal(resolution.schemaValid, true, JSON.stringify(resolution.errors));
  assert.equal(resolution.document.agent_id, 'agent-manifest');
});
