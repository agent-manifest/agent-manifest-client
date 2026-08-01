import { CanonicalFormError } from './errors.js';

/**
 * JSON canonicalisation, RFC 8785 (JCS).
 *
 * This is the one place where two honest implementations in different languages
 * would otherwise disagree — key order, number formatting and string escaping
 * are all under-determined by JSON itself. Naming the scheme rather than
 * inventing one is what makes a fingerprint produced here comparable to a
 * fingerprint produced elsewhere.
 *
 * What it does NOT do: it does not reorder anything semantically, does not
 * rewrite values, does not drop or add properties, and does not fill in
 * defaults. Canonical form is the same document written one agreed way. It is
 * lossless by construction — that is why `normalize()` does not exist here.
 */

/** Compare two strings by UTF-16 code unit, as RFC 8785 §3.2.3 requires. */
function compareCodeUnits(a, b) {
  const shorter = Math.min(a.length, b.length);
  for (let i = 0; i < shorter; i += 1) {
    const diff = a.charCodeAt(i) - b.charCodeAt(i);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
}

function write(value, seen) {
  if (value === null) return 'null';

  const type = typeof value;

  if (type === 'boolean') return value ? 'true' : 'false';

  if (type === 'number') {
    if (!Number.isFinite(value)) {
      throw new CanonicalFormError(
        'non-finite-number',
        'A canonical form cannot contain NaN or Infinity: they are not JSON numbers.',
      );
    }
    // JSON.stringify emits ECMAScript Number::toString output, which is what
    // RFC 8785 §3.2.2.3 prescribes, and normalises -0 to 0.
    return JSON.stringify(value);
  }

  if (type === 'string') {
    // JSON.stringify has produced well-formed, minimally escaped JSON strings
    // since ES2019, which is the escaping RFC 8785 §3.2.2.2 requires.
    return JSON.stringify(value);
  }

  if (type === 'object') {
    if (seen.has(value)) {
      throw new CanonicalFormError(
        'circular-reference',
        'A canonical form cannot be produced for a value that refers to itself.',
      );
    }
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        const items = value.map((item) => write(item === undefined ? null : item, seen));
        return `[${items.join(',')}]`;
      }
      const keys = Object.keys(value)
        .filter((key) => value[key] !== undefined)
        .sort(compareCodeUnits);
      const members = keys.map((key) => `${JSON.stringify(key)}:${write(value[key], seen)}`);
      return `{${members.join(',')}}`;
    } finally {
      seen.delete(value);
    }
  }

  throw new CanonicalFormError(
    'unsupported-type',
    `A canonical form cannot be produced for a value of type ${type}.`,
  );
}

/**
 * Produce the RFC 8785 canonical serialisation of a JSON value.
 *
 * @param {unknown} value Any value that came from, or could be written as, JSON.
 * @returns {string} Canonical JSON text, with no insignificant whitespace.
 * @throws {CanonicalFormError} With `reason` set to `non-finite-number`,
 *   `unsupported-type` or `circular-reference`.
 */
export function canonicalize(value) {
  return write(value, new Set());
}
