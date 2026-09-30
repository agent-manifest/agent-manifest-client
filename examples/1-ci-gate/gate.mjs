// Archetype 1 — CI gate.
//
// The decision that already exists: a CI run passes or fails. The consumer must
// first establish an acceptable baseline independently of the manifest — for
// example through repository policy, authenticated identity, provenance, or
// another admission control.
//
// The manifest may only narrow that baseline. A declaration can make this run
// fail; it can never turn a baseline denial into an approval. If the declaration
// is false or incomplete, it may evade only the extra restriction derived from
// the declaration, so the baseline must be safe on its own.
//
// This example does not authenticate the agent or treat the manifest as a
// credential.

import { readFileSync } from 'node:fs';
import { parse } from '@agent-manifest/client';
import { validate } from '@agent-manifest/client/validate';

const path = process.argv[2];
if (!path) {
  console.error('usage: node gate.mjs <manifest.json>');
  process.exit(2);
}

// parse() returns { document, form }, not the document itself.
const { document: manifest } = parse(readFileSync(path, 'utf8'));

// --- independently established consumer baseline -------------------------
// Stand-in for a decision made without trusting this manifest.
const BASELINE_RUN_ALLOWED = true;
// ------------------------------------------------------------------------

// --- manifest-derived restriction, meant to be edited --------------------
const MAX_DECLARED_AUTONOMY = 2;
// ------------------------------------------------------------------------

const { schemaValid, errors } = validate(manifest);
if (!schemaValid) {
  for (const e of errors) console.error(`${e.path} ${e.message}`);
  process.exit(1);
}

if (!BASELINE_RUN_ALLOWED) {
  console.error('REJECTED: independent consumer policy denies this run.');
  process.exit(1);
}

const level = manifest.autonomy.level;
if (level > MAX_DECLARED_AUTONOMY) {
  console.error(
    `REJECTED: declared autonomy.level ${level} adds a restriction above the accepted declaration threshold ${MAX_DECLARED_AUTONOMY}.`
  );
  process.exit(1);
}

console.log(
  `ACCEPTED: independent baseline allows the run and the declaration adds no further rejection (autonomy.level=${level}).`
);
process.exit(0);
