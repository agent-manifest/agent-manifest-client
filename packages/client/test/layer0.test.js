import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parse,
  stripBom,
  detectVersion,
  canonicalize,
  fingerprint,
  diff,
  CAVEATS,
  ManifestParseError,
  CanonicalFormError,
} from '../src/index.js';

const MINIMAL = {
  manifest_version: '1.0',
  agent_id: 'example.minimal-agent',
  agent_name: 'Minimal Example Agent',
};

test('parse reads JSON text and reports the form it was given', () => {
  const result = parse(JSON.stringify(MINIMAL));
  assert.deepEqual(result.document, MINIMAL);
  assert.equal(result.form, 'text');
});

test('parse accepts an already-parsed value without copying or altering it', () => {
  const result = parse(MINIMAL);
  assert.equal(result.document, MINIMAL);
  assert.equal(result.form, 'value');
});

test('parse strips a byte order mark', () => {
  const result = parse(`﻿${JSON.stringify(MINIMAL)}`);
  assert.deepEqual(result.document, MINIMAL);
  assert.equal(stripBom('﻿x'), 'x');
  assert.equal(stripBom('x'), 'x');
});

test('parse keeps x- keys and the extensions container apart', () => {
  const source = {
    ...MINIMAL,
    'x-vendor': 'root-level convention',
    extensions: { 'vendor.example': 'container convention' },
  };
  const { document } = parse(JSON.stringify(source));
  assert.equal(document['x-vendor'], 'root-level convention');
  assert.deepEqual(document.extensions, { 'vendor.example': 'container convention' });
});

test('parse fails with a typed reason, never a bare Error', () => {
  const cases = [
    ['', 'empty-input'],
    ['   ', 'empty-input'],
    ['{oops', 'invalid-json'],
    [42, 'not-a-string-or-object'],
    [null, 'not-a-string-or-object'],
    [undefined, 'not-a-string-or-object'],
  ];
  for (const [input, reason] of cases) {
    assert.throws(
      () => parse(input),
      (err) => err instanceof ManifestParseError && err.reason === reason,
      `expected reason ${reason}`,
    );
  }
});

test('detectVersion returns what was declared and never guesses', () => {
  assert.equal(detectVersion({ manifest_version: '1.0' }), '1.0');
  assert.equal(detectVersion({ manifest_version: '2.0' }), '2.0');
  // A complete v1.0-shaped document with no declared version stays null:
  // inferring one from the shape would state something nobody wrote.
  assert.equal(detectVersion({ agent_id: 'x', agent_name: 'y', contact: { email: 'a@b.co' } }), null);
  assert.equal(detectVersion({ manifest_version: 1.0 }), null);
  assert.equal(detectVersion([]), null);
  assert.equal(detectVersion(null), null);
  assert.equal(detectVersion('1.0'), null);
});

test('canonicalize sorts object keys by UTF-16 code unit', () => {
  assert.equal(canonicalize({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalize({ 'ä': 1, 'a': 2, 'Z': 3 }), '{"Z":3,"a":2,"ä":1}');
  assert.equal(canonicalize({ a: 1, ab: 2, '': 3 }), '{"":3,"a":1,"ab":2}');
});

test('canonicalize orders and escapes as RFC 8785 prescribes', () => {
  // Keys chosen from the RFC's own example set: a control character, a digit,
  // a character above the ASCII range, and one outside the BMP. They sort by
  // UTF-16 code unit — not by locale, not by appearance.
  const input = {
    '\u20ac': 'Euro Sign',
    '\r': 'Carriage Return',
    '1': 'One',
    '\u0080': 'Control',
    '\u{1f602}': 'Emoji',
  };
  const expected =
    '{' +
    '"\\r":"Carriage Return",' + // U+000D  escaped: JSON escapes below U+0020
    '"1":"One",' + //                U+0031
    '"\u0080":"Control",' + //       U+0080  not escaped: JSON escaping is minimal
    '"\u20ac":"Euro Sign",' + //     U+20AC
    '"\u{1f602}":"Emoji"' + //       U+1F602, sorts last by its lead surrogate
    '}';
  assert.equal(canonicalize(input), expected);
  // The canonical form is still JSON and round-trips to the same value.
  assert.deepEqual(JSON.parse(canonicalize(input)), input);
});

test('canonicalize is order-independent and whitespace-independent', () => {
  const a = parse('{ "b": [1, 2], "a": { "d": 1, "c": 2 } }').document;
  const b = parse('{"a":{"c":2,"d":1},"b":[1,2]}').document;
  assert.equal(canonicalize(a), canonicalize(b));
});

test('canonicalize preserves array order, which is data, not presentation', () => {
  assert.notEqual(canonicalize([1, 2]), canonicalize([2, 1]));
});

test('canonicalize is lossless: it adds nothing and drops nothing', () => {
  const document = { manifest_version: '1.0', capabilities: [], nested: { empty: {} }, zero: 0, no: false };
  assert.deepEqual(JSON.parse(canonicalize(document)), document);
});

test('canonicalize normalises -0 and rejects what is not JSON', () => {
  assert.equal(canonicalize(-0), '0');
  assert.equal(canonicalize(1e30), '1e+30');
  for (const [value, reason] of [
    [Number.NaN, 'non-finite-number'],
    [Number.POSITIVE_INFINITY, 'non-finite-number'],
    [() => {}, 'unsupported-type'],
    [Symbol('x'), 'unsupported-type'],
    [10n, 'unsupported-type'],
  ]) {
    assert.throws(
      () => canonicalize(value),
      (err) => err instanceof CanonicalFormError && err.reason === reason,
    );
  }
  const circular = { a: 1 };
  circular.self = circular;
  assert.throws(
    () => canonicalize(circular),
    (err) => err instanceof CanonicalFormError && err.reason === 'circular-reference',
  );
});

test('fingerprint is stable, self-describing and independent of key order', async () => {
  const one = await fingerprint({ b: 1, a: 2 });
  const two = await fingerprint({ a: 2, b: 1 });
  assert.equal(one, two);
  assert.match(one, /^sha256:[0-9a-f]{64}$/);
  const empty = await fingerprint({});
  // SHA-256 of the two bytes "{}"
  assert.equal(empty, 'sha256:44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
});

test('fingerprint changes when the document changes', async () => {
  const before = await fingerprint({ ...MINIMAL, agent_version: '1.0.0' });
  const after = await fingerprint({ ...MINIMAL, agent_version: '1.0.1' });
  assert.notEqual(before, after);
});

test('diff reports additions, removals and replacements as JSON Pointers', () => {
  const before = { manifest_version: '1.0', autonomy: { level: 1 }, gone: true };
  const after = { manifest_version: '1.0', autonomy: { level: 2 }, added: 'yes' };
  assert.deepEqual(diff(before, after), [
    { path: '/added', change: 'added', after: 'yes' },
    { path: '/autonomy/level', change: 'replaced', before: 1, after: 2 },
    { path: '/gone', change: 'removed', before: true },
  ]);
});

test('diff of documents with the same canonical form is empty', () => {
  assert.deepEqual(diff({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
  assert.deepEqual(diff(MINIMAL, { ...MINIMAL }), []);
});

test('diff handles arrays position by position and escapes pointer segments', () => {
  assert.deepEqual(diff({ list: ['a'] }, { list: ['a', 'b'] }), [
    { path: '/list/1', change: 'added', after: 'b' },
  ]);
  assert.deepEqual(diff({ 'a/b': 1 }, { 'a/b': 2 }), [
    { path: '/a~1b', change: 'replaced', before: 1, after: 2 },
  ]);
  assert.deepEqual(diff({ 'a~b': 1 }, { 'a~b': 2 }), [
    { path: '/a~0b', change: 'replaced', before: 1, after: 2 },
  ]);
});

test('diff of two scalars reports the document root', () => {
  assert.deepEqual(diff(1, 2), [{ path: '/', change: 'replaced', before: 1, after: 2 }]);
});

test('CAVEATS is frozen and cannot be emptied by a caller', () => {
  assert.ok(Object.isFrozen(CAVEATS));
  assert.ok(CAVEATS.length >= 4);
  for (const caveat of CAVEATS) {
    assert.ok(Object.isFrozen(caveat));
    assert.equal(typeof caveat.code, 'string');
    assert.ok(caveat.statement.length > 20);
  }
  assert.throws(() => CAVEATS.push({ code: 'x', statement: 'y' }));
});
