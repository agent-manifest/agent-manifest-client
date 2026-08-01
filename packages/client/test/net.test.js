import test from 'node:test';
import assert from 'node:assert/strict';

import { discover, discoverRegistry, resolve, Absence, ROUTES, BINDINGS } from '../src/net/index.js';

/**
 * Access-layer behaviour, driven by a recorded fetch so that every branch is
 * reachable — including the ones the real ecosystem cannot produce today, such
 * as an index that declares a version nobody has published yet.
 *
 * The live counterparts run in `live.test.js` against the real endpoints.
 */

const MANIFEST = {
  manifest_version: '1.0',
  agent_id: 'the-diplomat',
  agent_name: 'The Diplomat',
  agent_version: '1.0.0',
  owner: { type: 'organization', identifier: 'Agent Manifest Project' },
  purpose: { primary_code: 'registration', description: 'Registration bridge for the public dataset.' },
  forbidden_actions: ['no-autonomous-decision-making'],
  autonomy: { level: 1 },
  risk_profile: { level: 'low' },
  data_handling: { stores_personal_data: false },
  stopping_authority: { stoppable_by: ['operator'], mechanism: 'runtime disable via admin console' },
  audit_surface: { logging: 'none', reconstructability: 'none' },
  contact: { email: 'contact@agent-manifest-spec.org' },
};

/** A fetch that answers from a map of URL to payload, and records every call. */
function recordedFetch(routes) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    const answer = routes[url];
    if (answer === undefined) {
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }
    if (typeof answer === 'number') {
      return new Response('', { status: answer });
    }
    return new Response(JSON.stringify(answer), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

const REGISTRY_URL = 'https://example.test/registry.json';

function indexWith(entries, extra = {}) {
  return {
    registry_version: '1.1',
    generated_at: '2026-08-01T00:00:00Z',
    base_url: 'https://example.test/',
    agents: entries.map((e) => e.manifest_path),
    index: entries,
    ...extra,
  };
}

const DIPLOMAT_ENTRY = {
  agent_id: 'the-diplomat',
  manifest_path: 'manifests/2026/03/the-diplomat.json',
  manifest_url: 'https://example.test/manifests/2026/03/the-diplomat.json',
  registered_at: '2026-03-08T07:13:51-03:00',
  source: 'https://github.com/agent-manifest/agent-manifest-dataset',
};

test('resolving an agent_id costs exactly two network requests', async () => {
  const { impl, calls } = recordedFetch({
    [REGISTRY_URL]: indexWith([DIPLOMAT_ENTRY]),
    [DIPLOMAT_ENTRY.manifest_url]: MANIFEST,
  });

  const result = await resolve('the-diplomat', { registryUrl: REGISTRY_URL, fetchImpl: impl });

  assert.equal(calls.length, 2, `expected two requests, made ${calls.length}: ${calls.join(', ')}`);
  assert.deepEqual(calls, [REGISTRY_URL, DIPLOMAT_ENTRY.manifest_url]);
  assert.equal(result.resolutions.length, 1);
  assert.equal(result.resolutions[0].document.agent_id, 'the-diplomat');
  assert.equal(result.resolutions[0].schemaValid, true);
  assert.equal(result.resolutions[0].route, 'registry-index');
  assert.equal(result.resolutions[0].binding, 'registry-indexed');
  assert.equal(result.absence, null);
});

test('every resolution carries provenance and non-suppressible caveats', async () => {
  const { impl } = recordedFetch({
    [REGISTRY_URL]: indexWith([DIPLOMAT_ENTRY]),
    [DIPLOMAT_ENTRY.manifest_url]: MANIFEST,
  });
  const [resolution] = (await resolve('the-diplomat', { registryUrl: REGISTRY_URL, fetchImpl: impl })).resolutions;

  assert.deepEqual(Object.keys(resolution).sort(), [
    'binding', 'caveats', 'document', 'errors', 'retrievedAt', 'route', 'schemaValid', 'source',
  ]);
  assert.ok(ROUTES.includes(resolution.route));
  assert.ok(BINDINGS.includes(resolution.binding));
  assert.ok(resolution.caveats.length >= 4);
  assert.ok(Object.isFrozen(resolution), 'a resolution must not be editable in place');
  assert.match(resolution.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('binding never takes a word that implies anybody checked anything', () => {
  for (const binding of BINDINGS) {
    assert.doesNotMatch(binding, /verified|trusted|authentic|approved|certified/);
  }
});

test('an agent_id nobody registered returns empty, not an error and not a judgement', async () => {
  const { impl, calls } = recordedFetch({ [REGISTRY_URL]: indexWith([DIPLOMAT_ENTRY]) });

  const result = await resolve('nobody-registered-this', { registryUrl: REGISTRY_URL, fetchImpl: impl });

  assert.deepEqual(result.resolutions, [], 'an absent agent produces no resolutions');
  assert.ok(result.absence instanceof Absence);
  assert.equal(result.absence.reason, 'not-in-registry-index');
  assert.equal(calls.length, 1, 'no manifest request is made for an id that is not indexed');
  // The absence states a fact about the index. It carries no verdict about the
  // agent, which the registry has never heard of.
  assert.ok(!('schemaValid' in result.absence));
  assert.doesNotMatch(JSON.stringify(result.absence), /invalid|bad|untrusted|unsafe|failed agent/i);
});

test('an agent_id listed more than once returns every entry, and chooses none', async () => {
  const second = { ...DIPLOMAT_ENTRY, manifest_path: 'manifests/2026/04/the-diplomat.json',
    manifest_url: 'https://example.test/manifests/2026/04/the-diplomat.json' };
  const { impl } = recordedFetch({
    [REGISTRY_URL]: indexWith([DIPLOMAT_ENTRY, second]),
    [DIPLOMAT_ENTRY.manifest_url]: MANIFEST,
    [second.manifest_url]: { ...MANIFEST, agent_version: '2.0.0' },
  });

  const result = await resolve('the-diplomat', { registryUrl: REGISTRY_URL, fetchImpl: impl });

  assert.equal(result.resolutions.length, 2, 'multiplicity is reported, not resolved away');
  assert.deepEqual(
    result.resolutions.map((r) => r.document.agent_version).sort(),
    ['1.0.0', '2.0.0'],
  );
});

test('an index version this package does not know is treated as unparseable', async () => {
  const { impl, calls } = recordedFetch({
    [REGISTRY_URL]: indexWith([DIPLOMAT_ENTRY], { registry_version: '9.9' }),
    [DIPLOMAT_ENTRY.manifest_url]: MANIFEST,
  });

  const result = await resolve('the-diplomat', { registryUrl: REGISTRY_URL, fetchImpl: impl });

  assert.deepEqual(result.resolutions, []);
  assert.equal(result.absence.reason, 'unknown-registry-version');
  assert.match(result.absence.detail, /"9\.9"/);
  assert.equal(calls.length, 1, 'the fields are not read optimistically once the contract is unknown');
});

test('a 1.0 index still parses, and says plainly that it has no index to search', async () => {
  const { impl } = recordedFetch({
    [REGISTRY_URL]: { registry_version: '1.0', generated_at: '2026-06-26T13:26:53Z', agents: ['a.json'] },
  });

  const result = await resolve('the-diplomat', { registryUrl: REGISTRY_URL, fetchImpl: impl });

  assert.deepEqual(result.resolutions, []);
  assert.equal(result.absence.reason, 'no-index-published');
  assert.match(result.absence.detail, /1\.0/);
});

test('an agent_id is never resolved against a registry the caller did not name', async () => {
  const { impl, calls } = recordedFetch({});
  const result = await resolve('the-diplomat', { fetchImpl: impl });
  assert.deepEqual(result.resolutions, []);
  assert.equal(result.absence.reason, 'no-registry-declared');
  assert.equal(calls.length, 0, 'no registry is discovered on the caller behalf');
});

test('a direct URL is user-supplied and is never dressed up as anything stronger', async () => {
  const url = 'https://example.test/somebody/manifest.json';
  const { impl, calls } = recordedFetch({ [url]: MANIFEST });
  const result = await resolve(url, { fetchImpl: impl });
  assert.equal(calls.length, 1);
  assert.equal(result.resolutions[0].route, 'direct-url');
  assert.equal(result.resolutions[0].binding, 'user-supplied');
  assert.equal(result.resolutions[0].source, url);
});

test('discover finds a manifest at the prescribed location and binds it to the host only', async () => {
  const url = 'https://example.test/.well-known/agent-manifest.json';
  const { impl, calls } = recordedFetch({ [url]: MANIFEST });
  const result = await discover('example.test', { fetchImpl: impl });
  assert.deepEqual(calls, [url], 'one request, and no second guess at another location');
  assert.equal(result.resolutions[0].binding, 'same-origin-well-known');
  assert.equal(result.origin, 'https://example.test');
});

test('a host that serves nothing there says so, and nothing else is attempted', async () => {
  const { impl, calls } = recordedFetch({});
  const result = await discover('https://example.test/some/page', { fetchImpl: impl });
  assert.deepEqual(result.resolutions, []);
  assert.equal(result.absence.reason, 'no-document-at-well-known');
  assert.equal(result.absence.status, 404);
  assert.equal(calls.length, 1, 'no fallback location is tried');
});

test('discoverRegistry reports which registry_version it read from', async () => {
  const url = 'https://example.test/.well-known/agent-manifest-registry.json';
  const { impl } = recordedFetch({
    [url]: { registry_version: '1.0', registry_url: REGISTRY_URL, registry_type: 'agent-manifest-public-registry' },
  });
  const result = await discoverRegistry('example.test', { fetchImpl: impl });
  assert.equal(result.registryVersion, '1.0');
  assert.equal(result.registryUrl, REGISTRY_URL);
  assert.equal(result.source, url);
  assert.equal(result.absence, null);
});

test('a discovery document with an unknown version is not read by field name', async () => {
  const url = 'https://example.test/.well-known/agent-manifest-registry.json';
  const { impl } = recordedFetch({
    [url]: { registry_version: '4.0', registry_url: 'https://example.test/somewhere-else.json' },
  });
  const result = await discoverRegistry('example.test', { fetchImpl: impl });
  assert.equal(result.registryVersion, '4.0', 'the version read is still reported');
  assert.equal(result.registryUrl, null, 'but no field is trusted once the contract is unknown');
  assert.equal(result.absence.reason, 'unknown-registry-version');
});

test('an unreachable host and a malformed body are different, named failures', async () => {
  const failing = async () => {
    throw new TypeError('fetch failed');
  };
  const unreachable = await resolve('https://nowhere.test/m.json', { fetchImpl: failing });
  assert.equal(unreachable.absence.reason, 'host-did-not-respond');

  const malformed = async () =>
    new Response('{not json', { status: 200, headers: { 'content-type': 'application/json' } });
  const broken = await resolve('https://example.test/m.json', { fetchImpl: malformed });
  assert.equal(broken.absence.reason, 'unparseable-json');
});

test('a structurally invalid manifest still resolves, and says so without judging it', async () => {
  const url = 'https://example.test/m.json';
  const { impl } = recordedFetch({ [url]: { manifest_version: '1.0', agent_id: 'x' } });
  const result = await resolve(url, { fetchImpl: impl });
  assert.equal(result.resolutions.length, 1, 'a document that was found was found');
  assert.equal(result.resolutions[0].schemaValid, false);
  assert.ok(result.resolutions[0].errors.length > 0);
  assert.deepEqual(result.resolutions[0].document, { manifest_version: '1.0', agent_id: 'x' });
});
