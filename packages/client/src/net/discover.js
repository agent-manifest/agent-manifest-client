import { readJson, Absence } from './http.js';
import { resolutionOf } from './resolution.js';

/**
 * The two well-known locations this ecosystem defines.
 *
 * They are constants rather than parameters because guessing a location, or
 * accepting an alternative one "just in case", would put a convention into code
 * that nobody published.
 */
export const MANIFEST_PATH = '/.well-known/agent-manifest.json';
export const REGISTRY_DISCOVERY_PATH = '/.well-known/agent-manifest-registry.json';

/** Discovery-document versions whose field names this package knows. */
export const KNOWN_REGISTRY_DOCUMENT_VERSIONS = Object.freeze(['1.0']);

/** Registry-index contract versions this package knows. */
export const KNOWN_REGISTRY_INDEX_VERSIONS = Object.freeze(['1.0', '1.1']);

function originOf(input) {
  const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : `https://${input}`);
  return url.origin;
}

/**
 * Look for a manifest at the location the specification prescribes for a host.
 *
 * One request. It does not try anything else if that request fails: falling
 * back to a location nobody agreed on would manufacture a convention.
 *
 * Finding a document here means the host serves it. It does not mean the host
 * is the agent, that the agent exists, or that anything in the document is
 * true — which is what `binding` and `caveats` are for.
 *
 * @param {string} origin A host or an absolute URL; only its origin is used.
 * @param {{timeoutMs?: number, fetchImpl?: Function}} [options]
 * @returns {Promise<{origin: string, resolutions: object[], absence: Absence|null, retrievedAt: string}>}
 */
export async function discover(origin, options = {}) {
  const base = originOf(origin);
  const url = `${base}${MANIFEST_PATH}`;
  const result = await readJson(url, options);
  const retrievedAt = new Date().toISOString();

  if (result instanceof Absence) {
    const absence =
      result.reason === 'http-error' && result.status === 404
        ? new Absence('no-document-at-well-known', `No manifest is served at ${url}.`, {
            url,
            status: 404,
          })
        : result;
    return { origin: base, resolutions: [], absence, retrievedAt };
  }

  return {
    origin: base,
    resolutions: [
      resolutionOf({
        document: result.document,
        source: url,
        route: 'well-known',
        binding: 'same-origin-well-known',
        retrievedAt,
      }),
    ],
    absence: null,
    retrievedAt,
  };
}

/**
 * Read a registry's discovery document and report what it points at.
 *
 * The document declares its own `registry_version`, and its field names are
 * stable only while that number is unchanged. So an unrecognised value is
 * treated as a document this package does not know how to parse — it is not
 * read optimistically by field name, because the contract that made those names
 * meaningful is the one that just changed.
 *
 * @param {string} origin
 * @param {{timeoutMs?: number, fetchImpl?: Function}} [options]
 * @returns {Promise<{origin: string, registryUrl: string|null, registryVersion: string|null,
 *   source: string, absence: Absence|null, retrievedAt: string}>}
 */
export async function discoverRegistry(origin, options = {}) {
  const base = originOf(origin);
  const url = `${base}${REGISTRY_DISCOVERY_PATH}`;
  const result = await readJson(url, options);
  const retrievedAt = new Date().toISOString();

  const empty = { origin: base, registryUrl: null, registryVersion: null, source: url, retrievedAt };

  if (result instanceof Absence) return { ...empty, absence: result };

  const document = result.document;
  const declared =
    document && typeof document === 'object' && typeof document.registry_version === 'string'
      ? document.registry_version
      : null;

  if (declared === null || !KNOWN_REGISTRY_DOCUMENT_VERSIONS.includes(declared)) {
    return {
      ...empty,
      registryVersion: declared,
      absence: new Absence(
        'unknown-registry-version',
        declared === null
          ? 'The discovery document declares no registry_version, so its field names carry no contract.'
          : `The discovery document declares registry_version ${JSON.stringify(declared)}, which this package does not know how to parse.`,
        { url },
      ),
    };
  }

  const registryUrl = typeof document.registry_url === 'string' ? document.registry_url : null;
  if (registryUrl === null) {
    return {
      ...empty,
      registryVersion: declared,
      absence: new Absence(
        'no-registry-declared',
        'The discovery document declares no registry_url.',
        { url },
      ),
    };
  }

  return { ...empty, registryUrl, registryVersion: declared, absence: null };
}
