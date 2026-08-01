import { CAVEATS } from '../caveats.js';
import { validate } from '../validate.js';

/**
 * The object every successful read produces.
 *
 * It is deliberately not a manifest. Handing back a bare document would leave
 * the reader to decide, silently and in their own head, how much it is worth —
 * and there is no honest way for them to know unless we say where it came from
 * and what it is attached to.
 *
 * Two rules hold permanently:
 *
 *   - `binding` never takes the value `verified`, `trusted` or `authentic`. No
 *     such state exists in this ecosystem, and offering the word invites its
 *     use.
 *   - `caveats` is not optional and not configurable. There is no option that
 *     removes it.
 */

/** How the document was located. */
export const ROUTES = Object.freeze(['well-known', 'registry-index', 'direct-url']);

/**
 * What the document is attached to.
 *
 * `same-origin-well-known` — served by the host it describes, at the prescribed
 * location. That is a statement about the host, not about the agent.
 * `registry-indexed` — a registry lists it under this agent_id. That is a
 * statement about the registry.
 * `user-supplied` — the caller gave the URL. That is a statement about nobody.
 * `unbound` — none of the above.
 */
export const BINDINGS = Object.freeze([
  'same-origin-well-known',
  'registry-indexed',
  'user-supplied',
  'unbound',
]);

/**
 * Build a Resolution from a document that was actually obtained.
 *
 * @param {{document: unknown, source: string, route: string, binding: string, retrievedAt: string}} parts
 * @returns {object} Resolution
 */
export function resolutionOf({ document, source, route, binding, retrievedAt }) {
  const { schemaValid, errors } = validate(document);
  return Object.freeze({
    document,
    schemaValid,
    errors,
    source,
    route,
    binding,
    retrievedAt,
    caveats: CAVEATS,
  });
}
