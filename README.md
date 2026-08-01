# agent-manifest-client

Two packages for reading [Agent Manifest](https://agent-manifest-spec.org)
declarations.

| Package | What it is | Licence |
|---|---|---|
| [`@agent-manifest/schema`](packages/schema) | The v1.0 JSON Schema and a conformance corpus, distributed as data. No code, no dependencies | CC0 1.0 |
| [`@agent-manifest/client`](packages/client) | A reading client: parse, canonicalise, fingerprint, compare, and structurally validate | Apache-2.0 |

## Why this exists

Reading a manifest was never the hard part — it is JSON, and `JSON.parse` is
free. The cost is elsewhere: finding the document, knowing what it is attached
to, and knowing what you are entitled to conclude from it. This repository
exists to take that cost close to zero for somebody who has never met us.

It also settles something internal. The same validation logic had been written
three times across this project's own tools, the same schema file kept in four
places, and one hand-written re-implementation had already accepted a retention
value the schema forbids. Three independent copies of the same logic is the
classic sign that a library was owed.

## What it will not become

The reading side of a declarative format is the piece most likely to drift into
judging the things it reads — one reasonable request at a time, each one hard to
refuse on its own. So the limits are mechanical rather than promised:

- a CI check rejects any exported identifier matching
  `trust|score|rank|grade|certif|approve|enforce|allow|deny|safe|compliant|verify`;
- a suite of negative assertions covers all eleven prohibitions, and fails when
  an absence ends;
- the pure entry point is checked to reach no network, no filesystem, no clock
  and no runtime dependency;
- the caveats a reader must not ignore are values in the return, with no option
  that switches them off;
- the policy recipe is published in the README, **outside** the library, so that
  nobody has to force the door by asking for policy features inside it.

The definition of Agent Manifest lives in the specification and the schema.
These packages are one implementation of them. An independent implementation
that agrees with the conformance corpus is a good outcome for the format — and
if one arrives and makes this redundant, that is the best thing that could
happen to it.

## Development

```bash
npm ci
npm test
```

Node 22.12 or newer. The reading layer also runs unchanged in a browser.

## Licence

Code is Apache-2.0. The schema file and conformance corpus are dedicated to the
public domain under CC0 1.0 so they can be embedded without attribution
obligations. The prose specification is a separate work and remains CC BY 4.0.
