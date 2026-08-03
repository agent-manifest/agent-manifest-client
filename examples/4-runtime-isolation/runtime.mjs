// Archetype 4 — runtime / orchestrator with an isolation boundary.
//
// The decision that already exists: which isolation a job is launched under.
// Today it is made by the runtime's configuration — container or process,
// network or no network, permission profile — fixed per class of job.
//
// Here it is made by `risk_profile.level` in the agent's own manifest.
// Restrictive use: declaring `high` can only ADD confinement. Declaring `low`
// grants nothing the runtime would not already give by default, so lying opens
// no door.
//
// Requirement: Node.js with the permission model. On Node 23 or later the flag
// is `--permission`; on Node 22 it is `--experimental-permission`.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from '@agent-manifest/client';

const TASK = new URL('./task.mjs', import.meta.url).pathname;

function isolationFor(manifest) {
  // --- consumer policy, meant to be edited ---
  return manifest.risk_profile.level === 'high' ? ['--permission'] : [];
}

for (const file of ['./manifest-a.json', './manifest-b.json']) {
  const { document: manifest } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const flags = isolationFor(manifest);
  console.log(`${file}  risk_profile.level=${manifest.risk_profile.level}  ->  node ${flags.join(' ') || '(no flags)'} task.mjs`);
  const r = spawnSync(process.execPath, [...flags, TASK], { encoding: 'utf8' });
  process.stdout.write(r.stdout || r.stderr.split('\n').slice(0, 1).join('\n') + '\n');
}
