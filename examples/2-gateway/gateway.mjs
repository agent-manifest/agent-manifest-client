// Archetype 2 — gateway / restrictive execution branch.
//
// The decision that already exists: a gateway forwards or refuses a tool call.
// Today that decision comes from an allow/deny list written in the gateway's own
// configuration.
//
// Here the list comes from `forbidden_actions` in the manifest of the agent
// making the call. Restrictive use: what is declared can only TAKE permissions
// away. An agent that lies by declaring fewer prohibitions gains nothing against
// the operator's own policy, which still exists and is still the one in charge.
// This does not authenticate the agent or treat the manifest as a credential.

import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { parse } from '@agent-manifest/client';

const upstreamHits = [];

function forbids(manifest, action) {
  return (manifest.forbidden_actions || []).includes(action);
}

export function startGateway(manifest) {
  return createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const { action } = JSON.parse(body || '{}');

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
