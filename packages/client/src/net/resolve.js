import { readJson, Absence } from './http.js';
import { resolutionOf } from './resolution.js';
import { KNOWN_REGISTRY_INDEX_VERSIONS } from './discover.js';

/**
 * Resolve a manifest from a URL, or by `agent_id` against a registry index.
 *
 * There is no silent fallback between the two. If you ask for an id you must
 * say which registry index to ask, and a registry is never discovered on your
 * behalf: choosing a registry for somebody is choosing whose word they take.
 *
 * Resolving by id returns **zero, one or several** resolutions. Nothing in this
 * ecosystem declares `agent_id` unique — no namespace, no issuing authority —
 * so a lookup that returned "the" entry would be promising a uniqueness the
 * data cannot support. An id nobody registered returns an empty list and a
 * reason, not an error and not a judgement.
 */

/**
 * @param {string} ref An absolute http(s) URL, or an `agent_id`.
 * @param {{registryUrl?: string, timeoutMs?: number, fetchImpl?: Function}} [options]
 * @returns {Promise<{ref: string, route: string|null, resolutions: object[], absence: Absence|null, retrievedAt: string}>}
 */
export async function resolve(ref, options = {}) {
  if (/^https?:\/\//i.test(ref)) return resolveUrl(ref, options);
  if (!options.registryUrl) {
    return {
      ref,
      route: null,
      resolutions: [],
      absence: new Absence(
        'no-registry-declared',
        `"${ref}" is not a URL, so it can only be resolved against a registry index. Pass registryUrl, or read one with discoverRegistry().`,
      ),
      retrievedAt: new Date().toISOString(),
    };
  }
  return resolveAgentId(ref, options);
}

/** Read a manifest straight from a URL the caller supplied. One request. */
async function resolveUrl(url, options) {
  const result = await readJson(url, options);
  const retrievedAt = new Date().toISOString();
  if (result instanceof Absence) {
    return { ref: url, route: 'direct-url', resolutions: [], absence: result, retrievedAt };
  }
  return {
    ref: url,
    route: 'direct-url',
    resolutions: [
      resolutionOf({
        document: result.document,
        source: url,
        route: 'direct-url',
        binding: 'user-supplied',
        retrievedAt,
      }),
    ],
    absence: null,
    retrievedAt,
  };
}

/** Look an id up in a registry index. Two requests: the index, then the manifest. */
async function resolveAgentId(agentId, options) {
  const { registryUrl } = options;
  const indexResult = await readJson(registryUrl, options);
  const retrievedAt = () => new Date().toISOString();

  if (indexResult instanceof Absence) {
    return { ref: agentId, route: 'registry-index', resolutions: [], absence: indexResult, retrievedAt: retrievedAt() };
  }

  const registry = indexResult.document;
  const declared =
    registry && typeof registry === 'object' && typeof registry.registry_version === 'string'
      ? registry.registry_version
      : null;

  if (declared === null || !KNOWN_REGISTRY_INDEX_VERSIONS.includes(declared)) {
    return {
      ref: agentId,
      route: 'registry-index',
      resolutions: [],
      absence: new Absence(
        'unknown-registry-version',
        declared === null
          ? 'The registry index declares no registry_version, so its field names carry no contract.'
          : `The registry index declares registry_version ${JSON.stringify(declared)}, which this package does not know how to parse.`,
        { url: registryUrl },
      ),
      retrievedAt: retrievedAt(),
    };
  }

  if (!Array.isArray(registry.index)) {
    return {
      ref: agentId,
      route: 'registry-index',
      resolutions: [],
      absence: new Absence(
        'no-index-published',
        `The registry at ${registryUrl} declares registry_version ${declared} and publishes no index, so an agent_id cannot be resolved from it.`,
        { url: registryUrl },
      ),
      retrievedAt: retrievedAt(),
    };
  }

  const entries = registry.index.filter(
    (entry) => entry && typeof entry === 'object' && entry.agent_id === agentId,
  );

  if (entries.length === 0) {
    return {
      ref: agentId,
      route: 'registry-index',
      resolutions: [],
      absence: new Absence(
        'not-in-registry-index',
        `The registry at ${registryUrl} lists no entry with agent_id "${agentId}".`,
        { url: registryUrl },
      ),
      retrievedAt: retrievedAt(),
    };
  }

  const documents = await Promise.all(
    entries.map(async (entry) => {
      const url =
        typeof entry.manifest_url === 'string'
          ? entry.manifest_url
          : typeof registry.base_url === 'string' && typeof entry.manifest_path === 'string'
            ? registry.base_url + entry.manifest_path
            : null;
      if (url === null) {
        return new Absence(
          'no-registry-declared',
          `The index entry for "${agentId}" carries neither a manifest_url nor a base_url and manifest_path to build one from.`,
          { url: registryUrl },
        );
      }
      const result = await readJson(url, options);
      if (result instanceof Absence) return result;
      return resolutionOf({
        document: result.document,
        source: url,
        route: 'registry-index',
        binding: 'registry-indexed',
        retrievedAt: retrievedAt(),
      });
    }),
  );

  const resolutions = documents.filter((item) => !(item instanceof Absence));
  const failures = documents.filter((item) => item instanceof Absence);

  return {
    ref: agentId,
    route: 'registry-index',
    resolutions,
    absence: resolutions.length === 0 ? (failures[0] ?? null) : null,
    retrievedAt: retrievedAt(),
  };
}
