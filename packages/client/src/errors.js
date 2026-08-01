/**
 * Typed failures.
 *
 * Every failure in this package carries a machine-readable `reason`. Failure is
 * the majority path in an ecosystem this size, so a generic error is not an
 * acceptable outcome: a reader has to be able to branch on why something did
 * not work without matching on message text.
 */

/** A value could not be read as an Agent Manifest document. */
export class ManifestParseError extends Error {
  /**
   * @param {'not-a-string-or-object'|'empty-input'|'invalid-json'} reason
   * @param {string} message Single-line, human-readable.
   * @param {{cause?: unknown}} [options]
   */
  constructor(reason, message, options = {}) {
    super(message, options);
    this.name = 'ManifestParseError';
    this.reason = reason;
  }
}

/** A value could not be put into canonical form. */
export class CanonicalFormError extends Error {
  /**
   * @param {'non-finite-number'|'unsupported-type'|'circular-reference'} reason
   * @param {string} message Single-line, human-readable.
   */
  constructor(reason, message) {
    super(message);
    this.name = 'CanonicalFormError';
    this.reason = reason;
  }
}
