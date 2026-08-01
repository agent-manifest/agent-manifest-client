import { discover, discoverRegistry, resolve } from '@agent-manifest/client/net';
import { CAVEATS } from '@agent-manifest/client';

/**
 * The reference consumer: a reachability report.
 *
 * Its scope was written down before the first line of code, because this is the
 * piece of the ecosystem that most easily degrades into a directory of good
 * agents — one reasonable request at a time. The scope, verbatim:
 *
 *   It produces a reachability report. It does not produce a directory, a
 *   ranking, a score or a compliance status.
 *
 *   For each origin in its declared universe it attempts to resolve a manifest
 *   and records four things: whether a document exists at the prescribed
 *   location, whether the host answered, whether the document validates
 *   structurally against the v1.0 schema, and why it failed when it failed,
 *   with a typed reason.
 *
 *   It does not grade, does not order by any metric, does not compare origins
 *   with one another, does not infer quality from structural validity, does not
 *   publish lists of who passed or failed, does not retry silently, and does not
 *   retain content beyond what it reports.
 *
 *   Output is ordered alphabetically or by order of discovery. Never by
 *   completeness, validity or any property of the manifest — ordering is
 *   scoring under another name.
 *
 *   It carries the same non-suppressible caveats as a Resolution: what is
 *   declared is self-declared, and nobody observed any behaviour. A reachability
 *   report is not a reliability report.
 *
 *   Its first audience is the ecosystem itself, not the public: it measures
 *   whether the infrastructure we defined is reachable, starting with ours.
 *
 * The universe is **declared origins only** — our own registry, plus whatever
 * the caller supplies. There is no open sweep of the web, and none is
 * implemented behind a flag: a project whose whole doctrine is "declare without
 * executing" crawling other people's hosts would be a poor first impression, and
 * that decision belongs in the open, not in an option.
 */

export const OWN_REGISTRY_HOST = 'https://agent-manifest-spec.org';

/**
 * Build the list of things to look at.
 *
 * @param {{registryHost?: string|null, origins?: string[], fetchImpl?: Function}} options
 * @returns {Promise<{targets: object[], registry: object|null, notes: string[]}>}
 */
export async function universe(options = {}) {
  const notes = [];
  const targets = [];

  for (const origin of options.origins ?? []) {
    targets.push({ kind: 'declared-origin', label: origin, origin });
  }

  const registryHost = options.registryHost === undefined ? OWN_REGISTRY_HOST : options.registryHost;
  let registry = null;

  if (registryHost) {
    targets.push({ kind: 'declared-origin', label: registryHost, origin: registryHost });

    const discovery = await discoverRegistry(registryHost, options);
    registry = {
      host: registryHost,
      source: discovery.source,
      registryVersion: discovery.registryVersion,
      registryUrl: discovery.registryUrl,
      absence: discovery.absence,
    };

    if (discovery.absence) {
      notes.push(`No registry index could be read from ${registryHost}: ${discovery.absence.reason}.`);
    } else {
      const index = await readIndex(discovery.registryUrl, options);
      if (index.absence) {
        notes.push(`The registry index at ${discovery.registryUrl} could not be read: ${index.absence.reason}.`);
      } else {
        for (const entry of index.entries) {
          targets.push({
            kind: 'registry-entry',
            label: entry.agent_id,
            agentId: entry.agent_id,
            url: entry.manifest_url,
            registryUrl: discovery.registryUrl,
          });
        }
      }
    }
  }

  // Alphabetical by label, then by kind — a stable order that owes nothing to
  // any property of the manifests themselves.
  targets.sort((a, b) => a.label.localeCompare(b.label) || a.kind.localeCompare(b.kind));
  return { targets, registry, notes };
}

async function readIndex(registryUrl, options) {
  const probe = await resolve(registryUrl, options);
  if (probe.absence) return { entries: [], absence: probe.absence };
  const document = probe.resolutions[0].document;
  return { entries: Array.isArray(document.index) ? document.index : [], absence: null };
}

/** Look at one target and record the four things, and only those four. */
async function look(target, options) {
  // A registry entry is resolved by its agent_id against the index, not by
  // fetching the URL directly. Both retrieve the same bytes, but only the first
  // reports honestly what the document is attached to: it was listed in a
  // registry under that id, which is a statement about the registry. Calling it
  // user-supplied because we happened to hold the URL would understate where it
  // actually came from.
  const result =
    target.kind === 'registry-entry'
      ? await resolve(target.agentId, { ...options, registryUrl: target.registryUrl })
      : await discover(target.origin, options);

  const found = result.resolutions[0] ?? null;

  return {
    label: target.label,
    kind: target.kind,
    location: target.url ?? `${target.origin}/.well-known/agent-manifest.json`,

    // 1 — is there a document where the convention says it should be
    documentPresent: found !== null,
    // 2 — did the host answer at all
    hostAnswered: found !== null || !['host-did-not-respond', 'timed-out'].includes(result.absence?.reason),
    // 3 — is it shaped the way v1.0 says. Nothing more is claimed by this field.
    schemaValid: found ? found.schemaValid : null,
    // 4 — and when it did not work, why, with a reason you can branch on
    failureReason: found ? null : (result.absence?.reason ?? 'unknown'),
    failureDetail: found ? null : (result.absence?.detail ?? null),

    source: found ? found.source : null,
    binding: found ? found.binding : null,
    retrievedAt: result.retrievedAt,
  };
}

/**
 * Run the report over the declared universe.
 *
 * @param {{registryHost?: string|null, origins?: string[], fetchImpl?: Function}} [options]
 * @returns {Promise<object>} The report. It is a local artefact; nothing is sent anywhere.
 */
export async function report(options = {}) {
  const { targets, registry, notes } = await universe(options);
  const observations = [];
  for (const target of targets) {
    observations.push(await look(target, options));
  }

  const reachable = observations.filter((o) => o.documentPresent).length;

  return {
    what_this_is:
      'A reachability report over a declared set of origins. It records whether a manifest could be retrieved and whether it is structurally valid. It is not a directory, a ranking, a score or a compliance status, and it says nothing about the behaviour of any agent.',
    universe: 'declared origins only — the project registry and whatever the caller supplied. No open sweep of the web was performed, and none is implemented.',
    generated_at: new Date().toISOString(),
    registry,
    notes,
    counts: {
      looked_at: observations.length,
      document_present: reachable,
      document_absent: observations.length - reachable,
      structurally_valid: observations.filter((o) => o.schemaValid === true).length,
    },
    observations,
    caveats: CAVEATS,
  };
}

/** Render the report as text, in the same order, with no summary judgement. */
export function render(result) {
  const lines = [];
  lines.push('Agent Manifest — reachability report');
  lines.push(`Generated ${result.generated_at}`);
  lines.push('');
  lines.push(`Universe: ${result.universe}`);
  if (result.registry?.registryUrl) {
    lines.push(`Registry index: ${result.registry.registryUrl}`);
    lines.push(
      `  read from ${result.registry.source}, which declares registry_version ${result.registry.registryVersion}`,
    );
  }
  lines.push('');
  for (const note of result.notes) lines.push(`Note: ${note}`);
  if (result.notes.length) lines.push('');

  for (const o of result.observations) {
    const outcome = o.documentPresent
      ? `document retrieved · structurally ${o.schemaValid ? 'valid' : 'invalid'} · binding ${o.binding}`
      : `no document · ${o.failureReason}`;
    lines.push(`${o.label}`);
    lines.push(`  ${o.location}`);
    lines.push(`  ${outcome}`);
  }

  lines.push('');
  lines.push(
    `Looked at ${result.counts.looked_at}; a document was retrieved for ${result.counts.document_present} and not for ${result.counts.document_absent}.`,
  );
  lines.push('');
  lines.push('What this does not tell you:');
  for (const caveat of result.caveats) lines.push(`  - ${caveat.statement}`);
  return lines.join('\n');
}
