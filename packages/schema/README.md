# @agent-manifest/schema

The [Agent Manifest](https://agent-manifest-spec.org) v1.0 JSON Schema and its
conformance corpus, distributed as data. No code, no runtime dependencies.

```bash
npm install @agent-manifest/schema
```

```js
import { schemaV1_0, SCHEMA_VERSIONS, schemaFor, SOURCE } from '@agent-manifest/schema';

schemaFor('1.0');    // the schema document
schemaFor('2.0');    // null — this package carries no schema for that version
```

The file is also reachable directly, for tooling in any language:

```js
import schema from '@agent-manifest/schema/v1.0/schema.json' with { type: 'json' };
```

`schemaFor` returns `null` for an unknown version rather than falling back to the
newest schema. Reading an unknown version with a known schema would report
results the document never claimed to satisfy.

## Provenance

`v1.0/schema.json` is a byte-for-byte copy of the canonical file at
[`agent-manifest/spec/v1.0/schema.json`](https://github.com/agent-manifest/agent-manifest/blob/main/spec/v1.0/schema.json),
SHA-256 `c1e3caaf9543f2a5d610ccdfaf36329562fe03b6db00c4ea30b7ef0b7b8ef70a`.
`SOURCE.json` records where it came from and the policy that governs it: this
package consumes the specification, it does not define it, and the file is never
edited here. Agent Manifest v1.0 is frozen, so a checksum that stops matching is
drift and is treated as an incident rather than re-vendored. A future
specification version arrives as an additional file under a new minor version of
this package, never by mutating this one.

## Conformance corpus

`corpus/index.json` lists manifests together with the structural result a
format-aware JSON Schema 2020-12 validator should produce for each. It covers
the required properties, every closed enum, the pattern constraints, the single
conditional in the schema (`stores_personal_data: true` requires `retention`),
and the retention cases that a hand-written re-implementation once got wrong.

```js
import index from '@agent-manifest/schema/corpus/index.json' with { type: 'json' };

for (const entry of index.cases) {
  // entry.file, entry.schema_valid, entry.note
}
```

**This is test material, not a conformance programme.** There is no seal, no
list of who passed, no register of results, and no way for the project to learn
how your implementation did — by design, and permanently. Whoever runs the
corpus knows their own result. That is the entire mechanism.

`schema_valid` means one thing: whether a validator reports the document as
structurally well-formed against v1.0. It says nothing about the agent the
document describes, and a structurally valid manifest is a well-formed
declaration rather than a good one.

## Licence

**CC0 1.0** — the schema file and corpus in this package are dedicated to the
public domain, so they can be embedded in software of any licence without
attribution obligations. Copying the file into your own project is a supported
use; depending on this package instead just means you do not have to notice when
it changes.

The prose specification is a separate work and remains under **CC BY 4.0**.
