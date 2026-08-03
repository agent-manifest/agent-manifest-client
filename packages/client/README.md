# @agent-manifest/client

Reading client for [Agent Manifest](https://agent-manifest-spec.org) v1.0 declarations.

It answers three questions a reader actually has — *what does this document
say*, *has it changed*, and *is it shaped the way v1.0 says* — and refuses to
answer a fourth one it has no standing to answer: whether the agent behind it is
any good.

```bash
npm install @agent-manifest/client
```

Requires Node 22.12 or newer. The reading layer also runs unchanged in a
browser.

## Read a manifest

```js
import { parse, detectVersion, fingerprint } from '@agent-manifest/client';

const { document } = parse(await (await fetch(url)).text());

detectVersion(document);        // '1.0', or null if none was declared
await fingerprint(document);    // 'sha256:…' — same document, same string
```

## Check its structure

Structural validation lives behind its own entry point, so importing the reader
above does not load a JSON Schema validator.

```js
import { validate } from '@agent-manifest/client/validate';

const { schemaValid, errors } = validate(document);
// errors: [{ path: '/data_handling/retention', message: 'must match pattern …' }]
```

`validate()` takes the document. `parse()` returns `{ document, form }`, so the
two go together like this:

```js
const { document } = parse(readFileSync('manifest.json', 'utf8'));
const { schemaValid, errors } = validate(document);
```

Passing the whole `parse()` result instead is refused with a single error
carrying `source: 'usage'`, which is the only error that ever carries it —
errors about the document keep the `{ path, message }` shape above. The refusal
exists because the alternative was worse than useless: the wrapper has none of
the required fields, so a perfectly good manifest came back described as broken
in thirteen places, and the reader went looking for a defect that was in their
call all along. Nothing is unwrapped or repaired on your behalf.

The boolean is called `schemaValid` and not `valid`, and that is not fussiness.
`valid` gets read as *the agent is fine*. What the schema constrains is the
shape of a declaration; whether the declaration is true, complete, or worth
relying on is not something any validator can tell you.

## See what changed

```js
import { diff, canonicalize } from '@agent-manifest/client';

diff(lastWeek, today);
// [{ path: '/autonomy/level', change: 'replaced', before: 1, after: 2 }]
```

`diff` reports the change. It does not tell you the change was an improvement or
a regression — that reading belongs to you and depends on what you are using the
agent for.

`canonicalize` is [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS). It is
lossless: same document, one agreed way of writing it. Naming the scheme is what
makes a fingerprint computed here comparable to one computed by an
implementation in another language.

## Find one on the network

The access layer is a separate entry point, so a network request is visible in
an import line rather than buried in a call stack.

```js
import { discover, discoverRegistry, resolve } from '@agent-manifest/client/net';

// A host, at the location the specification prescribes. One request.
await discover('example.com');

// By agent_id, against a registry index you named. Two requests.
const { registryUrl, registryVersion } = await discoverRegistry('agent-manifest-spec.org');
const { resolutions, absence } = await resolve('the-diplomat', { registryUrl });
```

Each resolution says where it came from and what that is worth:

```js
{
  document,                     // exactly as served
  schemaValid, errors,
  source:  'https://…/the-diplomat.json',
  route:   'registry-index',    // how it was found
  binding: 'registry-indexed',  // what it is attached to
  retrievedAt,
  caveats                       // what you still cannot conclude
}
```

`binding` never takes the value `verified`, `trusted` or `authentic`. No such
state exists in this ecosystem, and offering the word would invite its use.

Three behaviours are deliberate and will not change:

**Resolving an id returns zero, one or several resolutions.** Nothing here
declares `agent_id` unique — no namespace, no issuing authority — so a function
that returned *the* entry would promise a uniqueness the data cannot support.

**No registry is chosen for you.** `resolve` by id needs a `registryUrl` you
named. Picking one on your behalf is picking whose word you take.

**Nothing is retried and nothing falls back.** A read that fails returns an
`absence` with a reason you can branch on — `no-document-at-well-known`,
`host-did-not-respond`, `not-in-registry-index`, `unknown-registry-version`,
`unparseable-json` and so on. With five manifests in the world, absence is the
common case, and a generic failure is what makes an integrator stop after ten
minutes.

That last reason is worth spelling out. The registry discovery document
declares its own `registry_version`, and its field names are stable only while
that number is unchanged. So a version this package does not know is treated as
a document it cannot parse — the fields are not read hopefully by name, because
the contract that gave those names meaning is exactly what changed.

## What you cannot conclude

```js
import { CAVEATS } from '@agent-manifest/client';
```

Five statements about the limits of anything read from a manifest — that it is
self-declared, that no behaviour was observed, that structure is not substance,
that identity is not bound, and that it is a point-in-time reading.

There is no option that switches them off. If you want to disregard them, do it
explicitly in your own code, in a line somebody can point at later.

## Write your policy in your own code

This package has no `allow()`, no `check()`, no `isCompliant()` and no
thresholds, and it is not going to grow them. The policy seat is yours, and it
is left empty on purpose — what counts as acceptable depends on what you are
about to do with the agent, which is knowledge this package does not have and
should not pretend to.

Here is the whole pattern. It is deliberately unglamorous:

```js
import { parse } from '@agent-manifest/client';
import { validate } from '@agent-manifest/client/validate';

/** Your rules. Yours to name, yours to change, yours to defend. */
function acceptableForBillingWorkflow(manifest) {
  const reasons = [];

  if (manifest.autonomy?.level > 1) {
    reasons.push('autonomy above 1 is more than this workflow delegates');
  }
  if (manifest.data_handling?.stores_personal_data &&
      manifest.data_handling.retention !== 'none') {
    reasons.push('personal data is retained beyond the session');
  }
  if (!manifest.stopping_authority?.stoppable_by?.includes('operator')) {
    reasons.push('our operators are not listed as able to stop it');
  }

  return { accepted: reasons.length === 0, reasons };
}

const { document } = parse(text);
const { schemaValid, errors } = validate(document);
if (!schemaValid) throw new Error(`not a well-formed v1.0 manifest: ${errors[0].message}`);

const decision = acceptableForBillingWorkflow(document);
```

Note what the last three lines are doing: your decision is yours, it is recorded
in your repository, and it is reviewable by your colleagues. That is a better
place for it than inside a dependency, whatever the dependency.

And note what the manifest is doing: it tells you what the operator declared
*before* you interact. It does not stop the agent, does not police it, and does
not promise that any of it is true.

## This is one implementation, not the definition

The definition of Agent Manifest lives in the
[specification](https://agent-manifest-spec.org/spec/v1.0/) and in the schema.
`@agent-manifest/schema` distributes that schema together with a conformance
corpus — manifests with the expected structural result for each — so that
anyone, in any language, can check that their reader agrees with this one
without asking permission and without telling anybody the outcome.

A second, independent implementation that passes the corpus is a good outcome
for the format. If one arrives and this package becomes unnecessary, that is the
best thing that could happen to it, not a loss.

## What it does not do

No scoring, ranking or grading. No trust, safety or compliance verdicts. No
policy evaluation. No behaviour verification. No certification or badges. No
signing or signature checking. No writing to any registry. No telemetry, not
even anonymous. No filling in defaults. No thresholds or recommended profiles.
No network access outside the access layer.

These are not aspirations. Every one of them is a test that fails the build,
including a CI check that rejects any exported identifier matching the
vocabulary above. See `test/doctrine.test.js` and `test/vocabulary.test.js`.

## Licence

Apache-2.0. The schema file distributed by `@agent-manifest/schema` is dedicated
to the public domain under CC0 1.0 so that it can be embedded without
attribution obligations; the prose specification remains CC BY 4.0.
