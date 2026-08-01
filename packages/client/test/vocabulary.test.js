import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { sep } from 'node:path';

/**
 * Mechanism 2 — vocabulary blocking, checked by CI.
 *
 * A section of a document promising "we will not do X" is worth nothing: in two
 * years somebody else writes the next section. This test is the version of that
 * promise that fails a build.
 *
 * It inspects every identifier this package exports — function names, exported
 * constants, the keys of every object those constants contain, and the
 * properties of every returned object — and fails if any of them matches the
 * forbidden vocabulary. Adding `isTrustworthy`, `riskScore`, `allow`, `deny`,
 * `certify` or `verify` to the public surface breaks the build, whoever adds it
 * and whatever their reason.
 */
const FORBIDDEN = /trust|score|rank|grade|certif|approve|enforce|allow|deny|safe|compliant|verify/i;

const ENTRY_POINTS = ['../src/index.js', '../src/validate.js', '../src/net/index.js'];

/** Collect identifiers from an exported value, to a bounded depth. */
function collect(value, into, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return;
  if (typeof value === 'function') {
    if (value.name) into.add(value.name);
    // Class methods are public surface too.
    if (value.prototype) {
      for (const key of Object.getOwnPropertyNames(value.prototype)) {
        if (key !== 'constructor') into.add(key);
      }
    }
    return;
  }
  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      into.add(key);
      collect(value[key], into, depth + 1);
    }
  }
}

test('no exported identifier uses forbidden vocabulary', async () => {
  const identifiers = new Set();
  for (const entry of ENTRY_POINTS) {
    const module = await import(entry);
    for (const [name, value] of Object.entries(module)) {
      identifiers.add(name);
      collect(value, identifiers);
    }
  }

  assert.ok(identifiers.size > 10, 'the scan found suspiciously little surface to check');

  const offending = [...identifiers].filter((name) => FORBIDDEN.test(name));
  assert.deepEqual(
    offending,
    [],
    `forbidden vocabulary on the public surface: ${offending.join(', ')}`,
  );
});

test('the shape returned by validate carries no forbidden property', async () => {
  const { validate } = await import('../src/validate.js');
  const identifiers = new Set();
  collect(validate({ manifest_version: 'not-1.0' }), identifiers);
  collect(validate({ manifest_version: '1.0' }), identifiers);
  const offending = [...identifiers].filter((name) => FORBIDDEN.test(name));
  assert.deepEqual(offending, []);
});

test('the single boolean is named schemaValid, never valid', async () => {
  const { validate } = await import('../src/validate.js');
  const result = validate({});
  assert.ok('schemaValid' in result, 'schemaValid must exist');
  assert.ok(!('valid' in result), '`valid` reads as "the agent is fine" and must not exist');
  assert.equal(typeof result.schemaValid, 'boolean');
  const booleans = Object.entries(result).filter(([, v]) => typeof v === 'boolean');
  assert.equal(booleans.length, 1, 'exactly one boolean, so there is nowhere to put a verdict');
});

test('source files export nothing whose name matches the forbidden vocabulary', async () => {
  // Belt and braces: the dynamic scan above cannot see an export that is added
  // to a module the entry points do not re-export. This one reads the text.
  const srcDir = fileURLToPath(new URL('../src/', import.meta.url));
  const files = (await readdir(srcDir, { recursive: true }))
    .map((entry) => entry.split(sep).join('/'))
    .filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 7, 'expected the source tree to be found');

  const offending = [];
  for (const file of files) {
    const text = await readFile(new URL(file, new URL('../src/', import.meta.url)), 'utf8');
    for (const match of text.matchAll(
      /^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/gm,
    )) {
      if (FORBIDDEN.test(match[1])) offending.push(`${file}:${match[1]}`);
    }
    for (const match of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
      for (const name of match[1].split(',')) {
        const exported = name.split(/\s+as\s+/).pop().trim();
        if (exported && FORBIDDEN.test(exported)) offending.push(`${file}:${exported}`);
      }
    }
  }
  assert.deepEqual(offending, [], `forbidden vocabulary in exports: ${offending.join(', ')}`);
});
