# Security policy

## What these packages do and do not do

`@agent-manifest/schema` is data: a JSON Schema file and a corpus of test
manifests. It contains no code and no dependencies.

`@agent-manifest/client` reads Agent Manifest documents and checks their
structure against that schema. It does not authenticate, authorise, enforce,
certify or attest anything. A manifest that validates is a well-formed
declaration; it is not evidence that the declaring agent behaves as declared.

This matters more here than it does for a command-line tool. A library is a
**runtime dependency of somebody else's system**, and a value it returns may end
up in a decision path. That is why nothing it returns can be read as an
endorsement — a property enforced by tests, not by convention.

Operational properties, each covered by a regression test:

- Nothing is written anywhere. Input documents are never modified.
- The pure entry point (`@agent-manifest/client`) reaches no network, no
  filesystem, no clock and no runtime dependency. This is checked by following
  the import graph in CI, not asserted in prose.
- Importing the reading layer does not load a JSON Schema validator; Ajv sits
  behind the `/validate` subpath only.
- There is no telemetry, no analytics, no auto-update and no install-time script
  (`preinstall`, `install`, `postinstall`, `prepare`).
- Failures carry a machine-readable `reason` and a single-line message.

## Supply chain

Both packages are published from a tagged release with npm Trusted Publishing
and build provenance. Verify a published tarball with:

```bash
npm audit signatures
```

The schema file is a byte-for-byte copy of the canonical specification file,
with its SHA-256 recorded in `packages/schema/SOURCE.json` and re-checked
against the published canonical URL on every CI run.

## Reporting a vulnerability

Report privately through GitHub's Private Vulnerability Reporting for this
repository (Security → Advisories → Report a vulnerability). Do not open a
public issue for an exploitable finding.

Please include the package and version, the Node.js version, the input needed to
reproduce, and the observed and expected behaviour.

Reports are acknowledged as capacity allows; this is a small, single-maintainer
project and no response time is promised.

## In scope

- Reading a crafted manifest causes anything other than a returned value or a
  typed error — unbounded memory, a hang, a thrown stack trace, an exit.
- Any file write, process execution or network access from the reading layer.
- Any path by which a caller can make the caveats stop being emitted.
- Divergence between the vendored schema and the canonical specification.

## Out of scope

- The content or truthfulness of any manifest a third party publishes.
- The behaviour of agents that declare a manifest.
- Vulnerabilities in Node.js itself, or in a dependency, that are already
  publicly tracked upstream — report those upstream and, if these packages are
  affected, open an issue referencing the advisory.
