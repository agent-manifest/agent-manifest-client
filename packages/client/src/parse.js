import { ManifestParseError } from './errors.js';

/**
 * Remove a leading UTF-8 byte order mark.
 *
 * Editors on Windows routinely write one and `JSON.parse` rejects it, so a
 * well-formed manifest would otherwise fail as unreadable.
 */
export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Read a manifest document from text or from an already-parsed value.
 *
 * Reading is separate from validating on purpose. `parse` tells you what the
 * document is; it does not tell you whether it satisfies the schema, and it
 * changes nothing about it. `x-` prefixed root keys and the `extensions`
 * container are left exactly where the author put them and are never merged
 * into one view — which of the two conventions was used is information, and
 * flattening it would discard it.
 *
 * @param {string|object} input JSON text, or a value already parsed from JSON.
 * @returns {{document: unknown, form: 'text'|'value'}}
 *   `document` is the value read. `form` records how it was supplied.
 * @throws {ManifestParseError} With `reason` set to `empty-input`,
 *   `invalid-json` or `not-a-string-or-object`.
 */
export function parse(input) {
  if (typeof input === 'string') {
    const text = stripBom(input);
    if (text.trim() === '') {
      throw new ManifestParseError('empty-input', 'Input is empty.');
    }
    let document;
    try {
      document = JSON.parse(text);
    } catch (err) {
      throw new ManifestParseError('invalid-json', `Input is not valid JSON: ${err.message}`, {
        cause: err,
      });
    }
    return { document, form: 'text' };
  }

  if (input !== null && typeof input === 'object') {
    return { document: input, form: 'value' };
  }

  throw new ManifestParseError(
    'not-a-string-or-object',
    `Input must be JSON text or a value parsed from JSON, not ${input === null ? 'null' : typeof input}.`,
  );
}
