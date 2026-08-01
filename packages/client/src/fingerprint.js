import { canonicalize } from './canonicalize.js';

/**
 * A fingerprint answers exactly one question: **has this document changed since
 * the last time I looked at it?**
 *
 * It is not a seal, not a signature, not a proof of origin and not evidence
 * that anyone attested to anything. Two parties computing it over the same
 * bytes get the same string; that is the whole of its meaning. Nothing in this
 * ecosystem signs manifests, so a fingerprint that matches tells you the text
 * is unchanged and tells you nothing whatsoever about who wrote it or whether
 * what it says is true.
 *
 * It is asynchronous because it uses the Web Crypto API, which is available
 * unchanged in Node and in browsers. That keeps this module free of runtime
 * dependencies and free of any `node:` import.
 */

const HEX = Array.from({ length: 256 }, (_, byte) => byte.toString(16).padStart(2, '0'));

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) out += HEX[bytes[i]];
  return out;
}

/**
 * SHA-256 over the RFC 8785 canonical form of a value.
 *
 * @param {unknown} value Any value that could be written as JSON.
 * @returns {Promise<string>} `sha256:` followed by 64 lowercase hex digits.
 *   The prefix is part of the value so that a stored fingerprint stays
 *   self-describing if the algorithm ever changes.
 */
export async function fingerprint(value) {
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${toHex(digest)}`;
}
