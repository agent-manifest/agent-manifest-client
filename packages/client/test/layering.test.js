import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Mechanism 1 — the dependency direction is structural, not editorial.
 *
 * The pure layer must not be able to reach the network, the filesystem or the
 * clock, and no layer may import a policy engine, because there is none to
 * import. Rather than asserting this in prose, the test reads the source and
 * follows the imports from each entry point.
 */

const SRC = new URL('../src/', import.meta.url);

async function sourceFiles() {
  const dir = fileURLToPath(SRC);
  return (await readdir(dir, { recursive: true })).filter((f) => f.endsWith('.js'));
}

async function read(file) {
  return readFile(new URL(file, SRC), 'utf8');
}

/** Static imports, re-exports and dynamic imports alike — a re-export is an edge. */
function importsOf(text) {
  return [
    ...[...text.matchAll(/^\s*import\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...text.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...text.matchAll(/^\s*export\s[\s\S]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]),
    ...[...text.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
  ];
}

/** Every local file reachable from an entry point, transitively. */
async function reachableFrom(entry) {
  const seen = new Set();
  const queue = [entry];
  const externals = new Set();
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of importsOf(await read(file))) {
      if (specifier.startsWith('.')) {
        queue.push(new URL(specifier, new URL(file, SRC)).pathname.split('/src/').pop());
      } else {
        externals.add(specifier);
      }
    }
  }
  return { files: seen, externals };
}

test('the pure entry point reaches no network, no filesystem, no clock and no dependency', async () => {
  const { files, externals } = await reachableFrom('index.js');
  assert.deepEqual([...externals], [], `the pure layer must have no runtime dependency, found: ${[...externals]}`);

  for (const file of files) {
    const text = await read(file);
    assert.doesNotMatch(text, /from\s+['"]node:/, `${file} imports a node: builtin`);
    assert.doesNotMatch(text, /\bfetch\s*\(/, `${file} calls fetch`);
    assert.doesNotMatch(text, /\bXMLHttpRequest\b|\bWebSocket\b/, `${file} opens a connection`);
    assert.doesNotMatch(text, /\bDate\.now\s*\(|new Date\s*\(/, `${file} reads the clock`);
    assert.doesNotMatch(text, /\bprocess\.(env|exit|stdout|stderr|stdin)\b/, `${file} touches the process`);
  }
});

test('the validator is the only place a runtime dependency appears', async () => {
  const { externals } = await reachableFrom('validate.js');
  assert.deepEqual(
    [...externals].sort(),
    ['@agent-manifest/schema', 'ajv-formats', 'ajv/dist/2020.js'],
    'the validation entry point carries exactly its declared dependencies',
  );
});

test('importing the pure layer does not load the validator', async () => {
  const { files } = await reachableFrom('index.js');
  assert.ok(!files.has('validate.js'), 'index.js must not reach validate.js');
});

test('no source file imports or defines a policy layer', async () => {
  for (const file of await sourceFiles()) {
    const text = await read(file);
    assert.doesNotMatch(
      text,
      /^export\s+(?:async\s+)?function\s+(check|evaluate|decide|gate|permit|authorize|authorise)\b/m,
      `${file} exports a policy entry point; that seat belongs to the consumer`,
    );
  }
});

test('every source file is reachable from a declared entry point', async () => {
  // An unreachable file is either dead code or a back door around the layering.
  const declared = ['index.js', 'validate.js'];
  const reachable = new Set();
  for (const entry of declared) {
    for (const file of (await reachableFrom(entry)).files) reachable.add(file);
  }
  const orphans = (await sourceFiles()).filter((f) => !reachable.has(f));
  assert.deepEqual(orphans, [], `unreachable source files: ${orphans.join(', ')}`);
});
