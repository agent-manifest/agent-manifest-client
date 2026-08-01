import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import * as pure from '../src/index.js';
import * as validation from '../src/validate.js';
import * as access from '../src/net/index.js';
import { validate } from '../src/validate.js';

/**
 * Mechanism 5 — the negative assertion suite.
 *
 * Every test here asserts that something does **not** exist or does **not**
 * happen. They are written this way on purpose: the failure mode this package
 * has to survive is not a bug, it is a reasonable-sounding feature request
 * granted one at a time until the library decides things it has no standing to
 * decide. A test that fails when the absence ends is the only durable form of
 * "we do not do that".
 */

const surface = { ...pure, ...validation, ...access };
const names = Object.keys(surface);

test('N-1 · nothing scores, grades, ranks or orders', () => {
  for (const forbidden of ['score', 'grade', 'rank', 'sort', 'order', 'compare', 'best', 'worst']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
  // Validation errors come back in the validator's own order and are never
  // re-ordered by seriousness: deciding which part of a declaration matters
  // more is a judgement about the agent.
  const result = validate({ manifest_version: '9.9' });
  assert.ok(result.errors.length > 1);
});

test('N-2 · no verdict of trust, safety or risk is produced', () => {
  const result = validate({ manifest_version: '1.0' });
  for (const key of Object.keys(result)) {
    assert.doesNotMatch(key, /trust|safe|risk|confidence|verdict/i);
  }
  assert.equal(Object.keys(result).filter((k) => typeof result[k] === 'boolean').length, 1);
});

test('N-3 · there is no policy layer, not even an example one', () => {
  for (const forbidden of ['allow', 'deny', 'check', 'enforce', 'policy', 'rule', 'permit']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
});

test('N-4 · the word verify is never used for a structural result', () => {
  assert.ok(!names.some((n) => /verif/i.test(n)));
  const result = validate({});
  assert.ok(!Object.keys(result).some((k) => /verif/i.test(k)));
});

test('N-5 · nothing certifies, accredits or issues a badge', () => {
  for (const forbidden of ['certif', 'accredit', 'badge', 'seal', 'attest', 'endorse']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
});

test('N-6 · nothing signs anything or inspects a signature', async () => {
  for (const forbidden of ['sign', 'signature', 'jws', 'jwt', 'pubkey', 'publickey']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
  // fingerprint() is the only hash in the package and its documentation says,
  // in as many words, that it is not a seal.
  const text = await readFingerprintSource();
  assert.match(text, /not a seal, not a signature/);
});

async function readFingerprintSource() {
  return readFile(fileURLToPath(new URL('../src/fingerprint.js', import.meta.url)), 'utf8');
}

test('N-7 · nothing writes anywhere', () => {
  for (const forbidden of ['write', 'publish', 'submit', 'register', 'upload', 'post']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
});

test('N-8 · there is no telemetry, anonymous or otherwise', async () => {
  const text = await readFile(fileURLToPath(new URL('../src/', import.meta.url)) + 'index.js', 'utf8');
  assert.doesNotMatch(text, /telemetry|analytics|beacon|sendBeacon/i);
  for (const forbidden of ['telemetry', 'analytics', 'report', 'track', 'usage']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
});

test('N-9 · nothing fills in a default or repairs a document', () => {
  for (const forbidden of ['normalize', 'normalise', 'fix', 'repair', 'complete', 'default', 'coerce', 'upgrade', 'migrate']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
  // Reading a document must leave it exactly as it was found.
  const original = { manifest_version: '1.0', data_handling: { stores_personal_data: true } };
  const snapshot = JSON.stringify(original);
  const { document } = pure.parse(original);
  validate(document);
  pure.canonicalize(document);
  pure.diff(document, document);
  assert.equal(JSON.stringify(original), snapshot, 'the input document was mutated');
  assert.ok(!('retention' in original.data_handling), 'a missing property was invented');
});

test('N-10 · no threshold, profile or recommended list ships with the package', () => {
  for (const forbidden of ['threshold', 'profile', 'preset', 'recommend', 'baseline', 'minimum']) {
    assert.ok(!names.some((n) => n.toLowerCase().includes(forbidden)), `found ${forbidden}`);
  }
});

test('N-11 · the pure layer performs no network access', () => {
  // Enforced structurally in layering.test.js. Asserted here too, because this
  // is the file someone reads when they want to know what is forbidden.
  assert.ok(!Object.keys(pure).some((n) => /fetch|http|request|download/i.test(n)));
  assert.ok(!Object.keys(validation).some((n) => /fetch|http|request|download/i.test(n)));
});

test('caveats cannot be switched off through any option', () => {
  const before = JSON.stringify(pure.CAVEATS);
  for (const options of [
    { caveats: false },
    { suppressCaveats: true },
    { quiet: true },
    { strict: false },
  ]) {
    validate({ manifest_version: '1.0' }, options);
  }
  assert.equal(JSON.stringify(pure.CAVEATS), before, 'caveats changed in response to an option');
  assert.throws(() => {
    pure.CAVEATS.length = 0;
  });
});

test('a structurally valid document is described as valid structure and nothing more', async () => {
  const readme = await readFile(fileURLToPath(new URL('../README.md', import.meta.url)), 'utf8');
  // The README has to carry the policy recipe, so that nobody has to force the
  // door by asking for policy features inside the package.
  assert.match(readme, /## Write your policy in your own code/);
  // And it has to say, in the reader's language, that this is one
  // implementation rather than the definition.
  assert.match(readme, /one implementation/i);
});
