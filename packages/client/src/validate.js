import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schemaV1_0, schemaFor } from '@agent-manifest/schema';
import { detectVersion } from './version.js';

/**
 * Structural validation against the published Agent Manifest schema.
 *
 * This module is a separate entry point so that the pure reading layer stays
 * free of a validator: importing `@agent-manifest/client` does not load Ajv.
 *
 * The single boolean this package produces is called `schemaValid`, never
 * `valid`. `valid` reads as "the agent is fine". `schemaValid` cannot be read
 * that way, and the distinction is the whole point: the schema constrains the
 * shape of a declaration and says nothing about the agent that published it.
 *
 * Ajv messages are passed through verbatim. They are not reworded, not ordered
 * by seriousness, and no fix is suggested — ranking errors would be a judgement
 * about which parts of a declaration matter more, which is not ours to make.
 */

const compiled = new WeakMap();

/** Turn one Ajv error into the public `{ path, message }` shape. */
function formatError(error) {
  let path = error.instancePath || '';
  if (error.keyword === 'required' && error.params && error.params.missingProperty) {
    path = `${path}/${error.params.missingProperty}`;
  }
  if (path === '') path = '/';
  return { path, message: error.message || 'validation error' };
}

/**
 * Compile a JSON Schema into a reusable validation function.
 *
 * Compiled functions are cached per schema object, so repeated calls with the
 * bundled schema compile once.
 *
 * @param {object} schema A JSON Schema 2020-12 document.
 * @returns {(data: unknown) => boolean} The Ajv validation function.
 */
export function compileSchema(schema) {
  const cached = compiled.get(schema);
  if (cached) return cached;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const fn = ajv.compile(schema);
  compiled.set(schema, fn);
  return fn;
}

/**
 * Validate a document structurally.
 *
 * With no options the bundled v1.0 schema is used. Passing
 * `{ matchDeclaredVersion: true }` instead selects the schema by the document's
 * own `manifest_version`, and reports `schemaValid: false` with an explicit
 * error when this package carries no schema for the version declared — rather
 * than reading an unknown version with a known schema, which would report
 * results the document never claimed to satisfy.
 *
 * @param {unknown} document A parsed manifest document.
 * @param {{schema?: object, matchDeclaredVersion?: boolean}} [options]
 * @returns {{schemaValid: boolean, errors: Array<{path: string, message: string}>, schemaVersion: string|null}}
 *   `schemaVersion` is the version of the schema the document was checked
 *   against, or null when a caller-supplied schema was used.
 */
export function validate(document, options = {}) {
  let schema = options.schema;
  let schemaVersion = null;

  if (!schema && options.matchDeclaredVersion) {
    const declared = detectVersion(document);
    schema = declared === null ? null : schemaFor(declared);
    if (!schema) {
      return {
        schemaValid: false,
        errors: [
          {
            path: '/manifest_version',
            message:
              declared === null
                ? 'no manifest_version declared, so no schema applies'
                : `no schema available for manifest_version ${JSON.stringify(declared)}`,
          },
        ],
        schemaVersion: null,
      };
    }
    schemaVersion = declared;
  } else if (!schema) {
    schema = schemaV1_0;
    schemaVersion = '1.0';
  }

  const validateFn = compileSchema(schema);
  const ok = validateFn(document);
  return {
    schemaValid: ok,
    errors: ok ? [] : (validateFn.errors || []).map(formatError),
    schemaVersion,
  };
}
