// Archetype 3 — MCP server. AN EXPLICIT DERIVATION of archetype 2.
//
// This is not an independent case and is not presented as one. The server does
// not use the manifest to learn WHO is calling — it cannot, and it does not try.
//
// The server starts from an independently established baseline tool set. The
// caller's forbidden_actions can only remove tools from that set. Omitting a
// prohibition can restore at most the server's baseline; it can never add a
// tool the server did not already authorize.
//
// A real MCP server would receive this document over whatever channel it already
// has. How it arrives, who issued it, and whether the claims are true are
// separate concerns and are not solved by this example.

import { readFileSync } from 'node:fs';
import { parse } from '@agent-manifest/client';

// --- independently established server baseline ---------------------------
const BASELINE_TOOLS = [
  { name: 'no-payment-execution', description: 'Issues a payment.' },
  { name: 'no-vendor-record-changes', description: 'Edits a vendor record.' },
  { name: 'read-invoices', description: 'Reads invoices.' },
];
// ------------------------------------------------------------------------

// tools/list — the baseline list is narrowed by what the caller forbade itself.
export function listTools(manifest) {
  const forbidden = new Set(manifest.forbidden_actions || []);
  return BASELINE_TOOLS.filter((t) => !forbidden.has(t.name));
}

// tools/call — baseline authorization is checked first, then the declaration
// may add a further refusal.
export function callTool(manifest, name) {
  const baselineTool = BASELINE_TOOLS.find((t) => t.name === name);
  if (!baselineTool) {
    return {
      isError: true,
      executed: false,
      content: [{ type: 'text', text: `'${name}' is not authorized by the server baseline.` }],
    };
  }

  const forbidden = new Set(manifest.forbidden_actions || []);
  if (forbidden.has(name)) {
    return {
      isError: true,
      executed: false,
      content: [{ type: 'text', text: `'${name}' is in the caller's own forbidden_actions.` }],
    };
  }

  return { isError: false, executed: true, content: [{ type: 'text', text: `'${name}' executed.` }] };
}

for (const file of ['./manifest-a.json', './manifest-b.json']) {
  const { document: manifest } = parse(readFileSync(new URL(file, import.meta.url), 'utf8'));
  const advertised = listTools(manifest).map((t) => t.name);
  const r = callTool(manifest, 'no-payment-execution');
  console.log(`${file}  ->  advertised=${advertised.length} [${advertised.join(', ')}]  executed=${r.executed}`);
}
