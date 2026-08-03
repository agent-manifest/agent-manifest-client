import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../src/index.js';
import { validate } from '../src/validate.js';

/**
 * Regression tests for one specific way of holding this API wrong.
 *
 * `parse()` returns `{ document, form }`. Passing that object to `validate()`
 * used to report every required field as missing — a valid manifest described
 * as broken in thirteen places, which sends the caller looking for a defect in
 * their document that is not there.
 *
 * The refusal has to stay narrow to be worth anything. These tests pin both
 * halves: that the contractual shape is refused, and that nothing wider is.
 */

const VALID = JSON.parse(
  readFileSync(new URL('../../../examples/1-ci-gate/manifest-a.json', import.meta.url), 'utf8'),
);

test('a valid manifest passed directly is schema-valid', () => {
  const result = validate(VALID);
  assert.equal(result.schemaValid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.schemaVersion, '1.0');
});

test('an invalid manifest passed directly reports schema errors', () => {
  const { autonomy, ...withoutAutonomy } = VALID;
  const result = validate(withoutAutonomy);
  assert.equal(result.schemaValid, false);
  assert.ok(result.errors.length > 0);
  assert.ok(result.errors.every((e) => e.source === undefined));
  assert.ok(result.errors.some((e) => e.path.includes('autonomy')));
});

test('the whole result of parse() is refused with one usage error', () => {
  const parsed = parse(JSON.stringify(VALID));
  const result = validate(parsed);

  assert.equal(result.schemaValid, false);
  assert.equal(result.errors.length, 1, 'one error, not thirteen');
  assert.equal(result.errors[0].source, 'usage');
  assert.match(result.errors[0].message, /\.document/);
  assert.equal(result.schemaVersion, null);

  // The refusal must not have unwrapped anything on the way past.
  assert.deepEqual(Object.keys(parsed), ['document', 'form']);
});

test('both forms parse() can return are refused the same way', () => {
  for (const input of [JSON.stringify(VALID), VALID]) {
    const result = validate(parse(input));
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].source, 'usage');
  }
});

test('parse(...).document is validated normally', () => {
  const { document } = parse(JSON.stringify(VALID));
  const result = validate(document);
  assert.equal(result.schemaValid, true);
  assert.deepEqual(result.errors, []);
});

test('an ordinary object that merely carries document or form is not refused', () => {
  const cases = [
    { document: {} },
    { form: 'text' },
    { document: {}, form: 'text', agent_id: 'x' },
    { document: {}, form: 'something-else' },
    { document: {}, format: 'text' },
    { ...VALID, document: 'a chapter of it' },
  ];

  for (const value of cases) {
    const result = validate(value);
    assert.ok(
      result.errors.every((e) => e.source === undefined),
      `${JSON.stringify(value).slice(0, 60)} was refused as API misuse; the check is too wide`,
    );
  }
});

test('a valid manifest that happens to carry a document property still validates', () => {
  // Nothing in the schema forbids it, so nothing here may.
  const result = validate({ ...VALID, document: 'a chapter of it' });
  assert.equal(result.schemaValid, true);
});

test('arrays and primitives are not mistaken for the wrapper', () => {
  for (const value of [['document', 'form'], 'document', 42, null, undefined]) {
    const result = validate(value);
    assert.ok(result.errors.every((e) => e.source === undefined));
  }
});
