import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parse } from '../src/index.js';
import { validate } from '../src/validate.js';

const corpusIndexUrl = import.meta.resolve('@agent-manifest/schema/corpus/index.json');
const index = JSON.parse(await readFile(fileURLToPath(corpusIndexUrl), 'utf8'));

async function readCase(entry) {
  const url = new URL(entry.file, corpusIndexUrl);
  return parse(await readFile(fileURLToPath(url), 'utf8')).document;
}

test('the corpus is non-trivial and exercises both outcomes', () => {
  const valid = index.cases.filter((c) => c.schema_valid).length;
  const invalid = index.cases.length - valid;
  assert.ok(valid >= 10, `expected at least 10 structurally valid cases, got ${valid}`);
  assert.ok(invalid >= 10, `expected at least 10 structurally invalid cases, got ${invalid}`);
  assert.equal(new Set(index.cases.map((c) => c.id)).size, index.cases.length, 'case ids are unique');
});

test('every case has a note saying what it is for', () => {
  for (const entry of index.cases) {
    assert.ok(entry.note && entry.note.length > 20, `case ${entry.id} has no usable note`);
  }
});

for (const entry of index.cases) {
  test(`corpus: ${entry.id} — schemaValid is ${entry.schema_valid}`, async () => {
    const document = await readCase(entry);
    const result = validate(document);
    assert.equal(
      result.schemaValid,
      entry.schema_valid,
      `${entry.id}: ${entry.note}\n${JSON.stringify(result.errors, null, 2)}`,
    );
    if (!entry.schema_valid) {
      assert.ok(result.errors.length > 0, 'an invalid document must say what is wrong with it');
      for (const error of result.errors) {
        assert.match(error.path, /^\//, 'every error carries a JSON Pointer');
        assert.equal(typeof error.message, 'string');
      }
    } else {
      assert.deepEqual(result.errors, []);
    }
  });
}

test('the documented retention divergence cannot recur: a freeform label is rejected', async () => {
  // This is the case that a hand-written re-implementation got wrong. It is in
  // the corpus so that any implementation, in any language, can check the same
  // thing without asking anyone.
  const entry = index.cases.find((c) => c.id === 'retention-freeform-label');
  assert.ok(entry, 'the corpus must carry the divergence case');
  const document = await readCase(entry);
  assert.equal(document.data_handling.retention, '30d');
  assert.equal(validate(document).schemaValid, false);
});

test('the corpus states that it is not a conformance programme', () => {
  assert.match(index.what_this_is_not, /no seal/i);
  assert.match(index.what_this_is_not, /no list of who passed/i);
});
