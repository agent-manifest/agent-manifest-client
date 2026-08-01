/**
 * @agent-manifest/client — the pure reading layer.
 *
 * Nothing in this entry point touches the network, the filesystem, the clock or
 * any runtime dependency. Importing it does not load a JSON Schema validator:
 * structural validation lives behind the `@agent-manifest/client/validate`
 * subpath, so a reader that only wants to read pays for nothing else.
 *
 * What is deliberately absent, and stays absent:
 *
 *   - no `normalize()` — filling in defaults would invent declarations the
 *     responsible party never made;
 *   - no `upgrade()` — one specification version exists, and a migration
 *     function for a version that does not exist would advertise breaking
 *     changes nobody has decided on;
 *   - no policy layer of any kind. That seat belongs to the consumer. The
 *     README shows how to write one in your own code, precisely so that nobody
 *     needs this package to grow one.
 *
 * The definition of Agent Manifest lives in the specification and the schema.
 * This is one implementation that reads them. A second, independent
 * implementation that agrees with the conformance corpus is a success for the
 * format, not competition.
 */

export { parse, stripBom } from './parse.js';
export { detectVersion } from './version.js';
export { canonicalize } from './canonicalize.js';
export { fingerprint } from './fingerprint.js';
export { diff } from './diff.js';
export { CAVEATS } from './caveats.js';
export { ManifestParseError, CanonicalFormError } from './errors.js';
