/**
 * The things a reader cannot conclude from a manifest, stated in code.
 *
 * The specification already says that the content is self-declared and that
 * nobody checks it. A sentence in a document is read once; a field in a return
 * value is read every time. These are the same statement, placed where it
 * cannot be skipped.
 *
 * There is deliberately no option, flag or configuration that suppresses them.
 * A consumer who wants to disregard them is free to do so in their own code —
 * explicitly, in a line someone can point at later. What they cannot do is make
 * this package stop saying them.
 */

/**
 * @typedef {{code: string, statement: string}} Caveat
 */

/** @type {ReadonlyArray<Caveat>} */
export const CAVEATS = Object.freeze([
  Object.freeze({
    code: 'self-declared',
    statement:
      'Everything in a manifest is stated by whoever published it. Nobody checked whether any of it is true.',
  }),
  Object.freeze({
    code: 'behaviour-not-observed',
    statement:
      'A manifest describes intent and declared limits. It is not a record of what the agent did, and reading one tells you nothing about what it will do.',
  }),
  Object.freeze({
    code: 'structure-only',
    statement:
      'A structurally valid document is a well-formed declaration, not a good, correct or acceptable one. The schema constrains shape, never substance.',
  }),
  Object.freeze({
    code: 'identity-not-bound',
    statement:
      'agent_id has no namespace, no issuing authority and no guaranteed uniqueness, and manifests are not signed. Obtaining a manifest does not establish that it describes the party you are talking to.',
  }),
  Object.freeze({
    code: 'point-in-time',
    statement:
      'A manifest is what was published at the moment it was read. It may have changed since, and nothing here subscribes to changes.',
  }),
]);
