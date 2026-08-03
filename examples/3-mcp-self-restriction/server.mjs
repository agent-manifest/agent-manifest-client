// Archetype 3 — MCP server. AN EXPLICIT DERIVATION of archetype 2.
//
// This is not an independent case and is not presented as one. No native case
// was found for this archetype: the only one that landed here was authenticating
// the caller, and it fell because a manifest is not a credential.
//
// The derivation works by inverting who benefits from lying. The server does not
// use the manifest to learn WHO is calling — it cannot, and it does not try. It
// applies the restriction THE CALLER DECLARED ABOUT ITSELF. Falsifying that
// declaration gains nothing: it can only be used to remove your own tools, never
// to obtain them.
//
// A real MCP server would receive this document over whatever channel it already
// has. How it arrives is not part of the example, and the example does not solve it.

import { readFileSync } from 'node:fs';
import { parse } from '@agent-manifest/client';

const TOOLS = [
  { name: 'no-payment-execution', description: 'Issues a payment.' },
  { name: 'no-vendor-record-changes', description: 'Edits a vendor record.' },
  { name: 'read-invoices', description: 'Reads invoices.' },
];

// tools/list — the advertised list is narrowed by what the caller forbade itself.
export function listTools(manifest) {
  const forbidden = new Set(manifest.forbidden_actions || []);
  return TOOLS.filter((t) => !forbidden.has(t.name));
}

// tools/call — and if it is called anyway, it is refused without running.
export function callTool(manifest, name) {
  const forbidden = new Set(manifest.forbidden_actions || []);
  if (forbidden.has(name)) {
    return { isError: true, executed: false, content: [{ type: 'text', text: `'${name}' is in the caller's own forbidden_actions.` }] };
  }
  return { isError: false, executed: true, content: [{ type: 'text', text: `'${name}' executed.` }] };
}

for (const file of ['./manifest-a.json', './manifest-b.json']) {
  const { document: manifest } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const advertised = listTools(manifest).map((t) => t.name);
  const r = callTool(manifest, 'no-payment-execution');
  console.log(`${file}  ->  advertised=${advertised.length} [${advertised.join(', ')}]  executed=${r.executed}`);
}
