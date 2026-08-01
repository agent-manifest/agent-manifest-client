import { canonicalize } from './canonicalize.js';

/**
 * Structural difference between two manifest documents.
 *
 * It reports what changed and nothing else. There is no notion here of a change
 * being an improvement, a regression, a tightening or a relaxation: deciding
 * that a shorter `forbidden_actions` list is worse than a longer one is a
 * judgement about the agent, and judgements about agents are the consumer's to
 * make, not this package's to hand out pre-made.
 *
 * Arrays are compared position by position. No similarity heuristic is applied,
 * because a heuristic would silently decide that two differently-worded entries
 * "are the same one, edited" — an inference nobody declared.
 */

/** RFC 6901 JSON Pointer escaping, so a path can be handed to any pointer tool. */
function pointer(segments) {
  if (segments.length === 0) return '/';
  return segments.map((s) => `/${String(s).replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function walk(before, after, segments, out) {
  if (Array.isArray(before) && Array.isArray(after)) {
    const longest = Math.max(before.length, after.length);
    for (let i = 0; i < longest; i += 1) {
      const path = [...segments, i];
      if (i >= before.length) out.push({ path: pointer(path), change: 'added', after: after[i] });
      else if (i >= after.length) out.push({ path: pointer(path), change: 'removed', before: before[i] });
      else walk(before[i], after[i], path, out);
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) {
      const path = [...segments, key];
      const inBefore = Object.prototype.hasOwnProperty.call(before, key);
      const inAfter = Object.prototype.hasOwnProperty.call(after, key);
      if (!inBefore) out.push({ path: pointer(path), change: 'added', after: after[key] });
      else if (!inAfter) out.push({ path: pointer(path), change: 'removed', before: before[key] });
      else walk(before[key], after[key], path, out);
    }
    return;
  }

  if (canonicalize(before) !== canonicalize(after)) {
    out.push({ path: pointer(segments), change: 'replaced', before, after });
  }
}

/**
 * Compare two documents.
 *
 * @param {unknown} before
 * @param {unknown} after
 * @returns {Array<{path: string, change: 'added'|'removed'|'replaced', before?: unknown, after?: unknown}>}
 *   Entries in JSON Pointer order. An empty array means the two documents have
 *   the same canonical form.
 */
export function diff(before, after) {
  const out = [];
  walk(before, after, [], out);
  return out;
}
