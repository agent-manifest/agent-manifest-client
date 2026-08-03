// Archetype 1 — CI gate.
//
// The decision that already exists: a CI run passes or fails on declared
// metadata. Today that decision is made by a workflow step calling `exit 1`,
// governed by a policy written by hand in the pipeline itself.
//
// The only thing that changes here is WHERE the value feeding that policy comes
// from. The policy stays with the consumer: this file ships no recommended
// threshold, and the one below is an example meant to be edited.
//
// Restrictive use: what is declared can only REJECT the declarer's own run. It
// grants nothing, authenticates no one, and treats no manifest as a credential.

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

// --- consumer policy, meant to be edited --------------------------------
const MAX_AUTONOMY = 2;
// ------------------------------------------------------------------------

const { schemaValid, errors } = validate(manifest);
if (!schemaValid) {
  for (const e of errors) console.error(`${e.path} ${e.message}`);
  process.exit(1);
}

const level = manifest.autonomy.level;
if (level > MAX_AUTONOMY) {
  console.error(`REJECTED: declared autonomy.level ${level}, the maximum accepted here is ${MAX_AUTONOMY}.`);
  process.exit(1);
}

console.log(`ACCEPTED: declared autonomy.level ${level} (maximum ${MAX_AUTONOMY}).`);
process.exit(0);
