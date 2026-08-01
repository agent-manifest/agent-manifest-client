/**
 * @agent-manifest/schema — the Agent Manifest v1.0 schema, distributed as data.
 *
 * This package contains no logic. It exists so that every consumer — the CLI,
 * the Diplomat, the Ambassador, this repository's own client, and any third
 * party — reads the same versioned artefact instead of maintaining a copy.
 *
 * The definition of Agent Manifest lives in the specification and in this
 * schema. A library that reads manifests is an implementation of them, never
 * the definition of them.
 */

import schemaV1_0 from './v1.0/schema.json' with { type: 'json' };
import source from './SOURCE.json' with { type: 'json' };

/**
 * The Agent Manifest v1.0 JSON Schema, byte-for-byte from the frozen
 * specification. Frozen upstream: this object is not edited here, ever.
 */
export { schemaV1_0 };

/**
 * Schema versions carried by this package, newest last.
 *
 * A future specification version is added as an additional entry under a new
 * minor version of this package — never by mutating an existing one.
 */
export const SCHEMA_VERSIONS = Object.freeze(['1.0']);

/**
 * Schemas by the `manifest_version` value they apply to.
 */
export const SCHEMAS = Object.freeze({ '1.0': schemaV1_0 });

/**
 * Return the schema for a `manifest_version` value, or null when this package
 * carries no schema for it.
 *
 * Returning null rather than falling back to the newest schema is deliberate:
 * reading an unknown version with a known schema would report structural
 * results the document never claimed to satisfy.
 *
 * @param {string} manifestVersion e.g. "1.0"
 * @returns {object|null}
 */
export function schemaFor(manifestVersion) {
  return Object.prototype.hasOwnProperty.call(SCHEMAS, manifestVersion)
    ? SCHEMAS[manifestVersion]
    : null;
}

/**
 * Provenance of the vendored schema file: where it came from, its checksum,
 * and the policy that governs re-vendoring.
 */
export { source as SOURCE };
