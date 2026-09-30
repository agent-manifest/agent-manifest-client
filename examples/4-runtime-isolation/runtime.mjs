// Archetype 4 — runtime / orchestrator with an isolation boundary.
//
// The decision that already exists: which isolation a job is launched under.
// The runtime begins from an independently established baseline profile that
// must be acceptable on its own. A declaration may only add confinement to that
// baseline; it never removes baseline controls.
//
// Here a declared high risk level adds the Node permission boundary. A false
// low-risk declaration could evade only this manifest-derived extra confinement
// and fall back to the independent baseline. For that reason an unsigned
// manifest must not be the sole security boundary.
//
// Requirement: Node.js with the permission model. On Node 23 or later the flag
// is `--permission`; on Node 22 it is `--experimental-permission`.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from '@agent-manifest/client';

const TASK = new URL('./task.mjs', import.meta.url).pathname;

// --- independently established runtime baseline --------------------------
// This minimal demonstration has no additional Node flags in its baseline.
// A production baseline would normally contain the controls the operator
// requires regardless of what the manifest says.
const BASELINE_FLAGS = [];
// ------------------------------------------------------------------------

function isolationFor(manifest) {
  const flags = [...BASELINE_FLAGS];

  // --- manifest-derived restriction --------------------------------------
  if (manifest.risk_profile.level === 'high') {
    flags.push('--permission');
  }
  // ----------------------------------------------------------------------

  return flags;
}

for (const file of ['./manifest-a.json', './manifest-b.json']) {
  const { document: manifest } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const flags = isolationFor(manifest);
  console.log(`${file}  risk_profile.level=${manifest.risk_profile.level}  ->  node ${flags.join(' ') || '(baseline: no flags)'} task.mjs`);
  const r = spawnSync(process.execPath, [...flags, TASK], { encoding: 'utf8' });
  process.stdout.write(r.stdout || r.stderr.split('\n').slice(0, 1).join('\n') + '\n');
}
