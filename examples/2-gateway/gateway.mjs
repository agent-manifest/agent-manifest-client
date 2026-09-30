// Archetype 2 — gateway / restrictive execution branch.
//
// The decision that already exists: a gateway forwards or refuses a tool call.
// The gateway has an independently established baseline allow-list. The
// manifest is applied only after that baseline and can remove permissions from
// it; it cannot add an action the baseline did not already allow.
//
// A false or incomplete forbidden_actions list can therefore evade only a
// manifest-derived self-restriction. It cannot exceed the gateway's own
// baseline. This example does not authenticate the agent or treat the manifest
// as a credential.

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { parse } from '@agent-manifest/client';

const upstreamHits = [];

// --- independently established consumer baseline -------------------------
const BASELINE_ALLOWED_ACTIONS = new Set([
  'no-payment-execution',
  'read-invoices',
]);
// ------------------------------------------------------------------------

function forbids(manifest, action) {
  return (manifest.forbidden_actions || []).includes(action);
}

export function startGateway(manifest) {
  return createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { action } = JSON.parse(body || '{}');

      if (!BASELINE_ALLOWED_ACTIONS.has(action)) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ blocked: action, by: 'consumer_policy' }));
        return;
      }

      if (forbids(manifest, action)) {
        res.writeHead(403, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ blocked: action, by: 'forbidden_actions' }));
        return; // the upstream is never touched
      }

      upstreamHits.push(action);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ forwarded: action }));
    });
  });
}

async function demo(file) {
  const { document: manifest } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const server = startGateway(manifest);
  await new Promise((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/act`;

  const before = upstreamHits.length;
  const res = await fetch(url, { method: 'POST', body: JSON.stringify({ action: 'no-payment-execution' }) });
  const after = upstreamHits.length;

  console.log(`${file}  ->  HTTP ${res.status}  ${JSON.stringify(await res.json())}  upstream_reached=${after > before}`);
  server.close();
}

await demo('./manifest-a.json');
await demo('./manifest-b.json');
