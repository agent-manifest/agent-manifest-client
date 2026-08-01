#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { report, render, OWN_REGISTRY_HOST } from '../src/report.js';

/**
 * Run the reachability report and write it next to wherever it was invoked.
 *
 * The report is a local artefact. Nothing is uploaded, nothing is announced and
 * no result leaves the machine that produced it.
 *
 *   agent-manifest-reachability [--origin <host>]... [--registry-host <host>|--no-registry] [--out <file>]
 *
 * There is no flag for an open sweep of the web. That is not an omission and it
 * is not hidden behind an option: the universe is declared origins only.
 */

const args = process.argv.slice(2);
const origins = [];
let registryHost = OWN_REGISTRY_HOST;
let out = 'reachability-report.json';

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--origin') origins.push(args[++i]);
  else if (arg === '--registry-host') registryHost = args[++i];
  else if (arg === '--no-registry') registryHost = null;
  else if (arg === '--out') out = args[++i];
  else if (arg === '--help' || arg === '-h') {
    process.stdout.write(
      'agent-manifest-reachability [--origin <host>]... [--registry-host <host>|--no-registry] [--out <file>]\n',
    );
    process.exit(0);
  } else {
    process.stderr.write(`Unknown argument: ${arg}\n`);
    process.exit(2);
  }
}

const result = await report({ registryHost, origins });
await writeFile(out, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
process.stdout.write(`${render(result)}\n\nWritten to ${out}\n`);
