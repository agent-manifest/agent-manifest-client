import { ManifestParseError } from '../errors.js';

/**
 * The only place in this package that touches the network.
 *
 * Everything here is browser-safe: `fetch`, `AbortSignal.timeout` and a stream
 * reader, and no `node:` import. The limits mirror the ones the command-line
 * validator already applies, so a document that is readable by one is readable
 * by the other.
 */

export const TIMEOUT_MS = 30_000;
export const MAX_BYTES = 8 * 1024 * 1024;

/** A read that did not produce a document, with the reason it did not. */
export class Absence {
  /**
   * @param {'host-did-not-respond'|'timed-out'|'http-error'|'too-large'|'unparseable-json'
   *         |'no-document-at-well-known'|'unknown-registry-version'|'no-index-published'
   *         |'not-in-registry-index'|'no-registry-declared'} reason
   * @param {string} detail Single-line, human-readable.
   * @param {{url?: string, status?: number}} [context]
   */
  constructor(reason, detail, context = {}) {
    this.reason = reason;
    this.detail = detail;
    if (context.url !== undefined) this.url = context.url;
    if (context.status !== undefined) this.status = context.status;
  }
}

/** Read a response body as text, refusing to buffer more than MAX_BYTES. */
async function readBounded(response, url) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    return new Absence('too-large', `Declared length exceeds ${MAX_BYTES} bytes.`, { url });
  }

  const reader = response.body?.getReader();
  if (!reader) return { text: await response.text() };

  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return new Absence('too-large', `Body exceeds ${MAX_BYTES} bytes.`, { url });
    }
    chunks.push(value);
  }

  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder('utf-8').decode(joined) };
}

/**
 * Fetch one URL and parse it as JSON.
 *
 * It never retries and never falls back to another URL. A read that does not
 * produce a document returns an {@link Absence} saying which of the ways to
 * fail it was — a silent or generic failure is what makes an integrator give up
 * in the first ten minutes, and in an ecosystem this size failure is the
 * majority path.
 *
 * @param {string} url
 * @param {{timeoutMs?: number, fetchImpl?: Function}} [options]
 * @returns {Promise<{document: unknown, url: string}|Absence>}
 */
export async function readJson(url, options = {}) {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  let response;
  try {
    response = await doFetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
      headers: { accept: 'application/json, text/plain;q=0.9, */*;q=0.8' },
    });
  } catch (error) {
    if (error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return new Absence('timed-out', `No response within ${timeoutMs} ms.`, { url });
    }
    return new Absence('host-did-not-respond', `The host could not be reached: ${error?.message ?? error}`, { url });
  }

  if (!response.ok) {
    return new Absence('http-error', `The host answered HTTP ${response.status}.`, {
      url,
      status: response.status,
    });
  }

  const body = await readBounded(response, url);
  if (body instanceof Absence) return body;

  try {
    return { document: JSON.parse(body.text.charCodeAt(0) === 0xfeff ? body.text.slice(1) : body.text), url };
  } catch (error) {
    const parseError = new ManifestParseError('invalid-json', error.message, { cause: error });
    return new Absence('unparseable-json', `The response is not valid JSON: ${parseError.message}`, { url });
  }
}
