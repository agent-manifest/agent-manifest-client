/**
 * @agent-manifest/client/net — the access layer.
 *
 * This is the only part of the package that makes a network request, and it is
 * a separate entry point so that fact is visible in an import line rather than
 * buried in a call stack.
 *
 * Three properties hold throughout:
 *
 *   - **Nothing is retried and nothing falls back.** A request that fails
 *     returns a reason. Retrying quietly turns one honest failure into an
 *     unexplained delay; falling back to a location nobody published invents a
 *     convention.
 *   - **No registry is chosen for you.** Resolving an `agent_id` needs a
 *     registry index you named. Picking one on a caller's behalf is picking
 *     whose word they take.
 *   - **Failure is a first-class result.** With five manifests in the world,
 *     absence is the majority path, and a typed reason is the difference
 *     between an integrator continuing and an integrator giving up.
 */

export { discover, discoverRegistry, MANIFEST_PATH, REGISTRY_DISCOVERY_PATH } from './discover.js';
export { KNOWN_REGISTRY_DOCUMENT_VERSIONS, KNOWN_REGISTRY_INDEX_VERSIONS } from './discover.js';
export { resolve } from './resolve.js';
export { Absence, TIMEOUT_MS, MAX_BYTES } from './http.js';
export { ROUTES, BINDINGS } from './resolution.js';
