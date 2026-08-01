/**
 * Read the declared specification version of a manifest document.
 *
 * It reads `manifest_version` and returns it. It does not infer a version from
 * the shape of the document and it does not guess: a document that declares
 * nothing gets `null`, because "no declared version" and "version 1.0" are
 * different facts and only one of them was stated by the author.
 *
 * The function is trivial today because exactly one version exists. That is the
 * point of having it: it is the single place that changes when a second one
 * does, instead of a `manifest_version` string spread across every caller.
 *
 * @param {unknown} document A parsed manifest document.
 * @returns {string|null} The declared version, or null.
 */
export function detectVersion(document) {
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    return null;
  }
  const declared = document.manifest_version;
  return typeof declared === 'string' ? declared : null;
}
