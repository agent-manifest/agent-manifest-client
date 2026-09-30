# Four decisions, four minimal examples

Each folder shows **one decision a piece of software is already making today**,
and what happens when the value feeding that decision comes from an Agent
Manifest instead of coming from wherever it came from before.

These are not products. Each one is a single file, two manifests and two runs.
The only thing to look at is that **the same instruction produces two different
behaviours**, and that the manifest is what produced the difference.

```
npm install @agent-manifest/client
```

| Folder | Decision | Field | A | B |
|---|---|---|---|---|
| `1-ci-gate/` | A CI run passes or fails | `autonomy.level` | `exit 0` | `exit 1` |
| `2-gateway/` | A call is forwarded or refused | `forbidden_actions` | `403`, upstream never touched | `200`, upstream reached |
| `3-mcp-self-restriction/` | Which tools are advertised and which run | `forbidden_actions` | 1 advertised, call refused | 2 advertised, call runs |
| `4-runtime-isolation/` | Which isolation the job is launched under | `risk_profile.level` | disk read allowed | `ERR_ACCESS_DENIED` |

```sh
node 1-ci-gate/gate.mjs 1-ci-gate/manifest-a.json ; echo $?   # 0
node 1-ci-gate/gate.mjs 1-ci-gate/manifest-b.json ; echo $?   # 1
node 2-gateway/gateway.mjs
node 3-mcp-self-restriction/server.mjs
node 4-runtime-isolation/runtime.mjs
```

## The policy does not ship with the package

In all four cases the threshold is written in the example and marked to be
edited. `@agent-manifest/client` ships no thresholds, no profiles and no
recommended lists: it reads the declaration and holds no opinion. **The policy
belongs to the consumer**, and that is not a gap to be filled in later.

## What is declared can only narrow an independent baseline

All four examples start from a consumer baseline established without trusting
the manifest. The declaration is then allowed only to **take away** from that
baseline: refuse a run, block a call, narrow a tool list, or add confinement.

Conceptually:

```text
effective authority = independently established authority ∩ manifest-derived restrictions
```

That intersection is a model, not Agent Manifest syntax. Its purpose here is to
make the direction explicit: nothing in a manifest can add a privilege, identify
a caller, or relax a control the consumer already requires.

A false or incomplete declaration can still evade a restriction that exists
*only because the consumer chose to derive it from the declaration*. It then
falls back to the independently established baseline. That is why the baseline
must be safe on its own and why an unsigned manifest must not be the sole
security boundary.

None of these examples authenticates an agent, treats a manifest as a
credential, proves that a declaration is true, applies official enforcement, or
issues badges, seals or certifications of any kind.

## Requirements

Node.js 22.12 or later for the client. Example 4 additionally uses the Node
permission model: `--permission` on Node 23 or later, `--experimental-permission`
on Node 22.

## Third example: a derivation, and it says so

`3-mcp-self-restriction/` is not an independent case. It is archetype 2 read in
the self-restriction direction, and the file says so at the top. The case that
would have been native to an MCP server — using a manifest to tell who is
calling — is exactly the one a manifest cannot support.
