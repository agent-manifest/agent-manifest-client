# @agent-manifest/reachability

The reference consumer. It reads manifests with `@agent-manifest/client` and
reports what it could reach.

**Not published.** It exists to answer one question the ecosystem could not
answer about itself: is the infrastructure we defined actually reachable,
starting with ours.

```bash
npm run report
```

```
agent-manifest-reachability [--origin <host>]... [--registry-host <host>|--no-registry] [--out <file>]
```

## What it does

For every origin in its declared universe it records four things, and only
those four:

1. whether a document exists where the convention says it should be;
2. whether the host answered at all;
3. whether the document is structurally valid against the v1.0 schema;
4. why it failed when it failed, with a reason you can branch on.

The report is written to a local file. Nothing is uploaded, nothing is
announced, and no result leaves the machine that produced it.

## What it is not

It is not a directory, a ranking, a score or a compliance status. It does not
grade, does not order by any metric, does not compare origins with one another,
does not infer quality from structural validity, does not publish lists of who
passed or failed, does not retry silently, and does not retain content beyond
what it reports.

Output is ordered alphabetically. Never by presence, validity or any property of
a manifest — ordering by those is scoring under another name, and the ordering
is asserted in a test for exactly that reason.

A structurally valid manifest is a well-formed declaration. It is not a good
one, and this tool has no way of telling you which agents are worth using. It
carries the same non-suppressible caveats as any resolution: what is declared is
self-declared, and nobody observed any behaviour. **A reachability report is not
a reliability report.**

## The universe is declared origins only

The project's own registry, plus whatever the caller supplies. There is no open
sweep of the web, and none is implemented behind a flag.

That is a decision, not an omission. An open sweep opens a set of questions this
ecosystem has never had to answer — crawl courtesy, `robots.txt`, frequency, the
consent of the host being crawled — and a project whose entire doctrine is
*declare without executing* crawling other people's hosts would be a poor first
impression. If it is ever done, it will be decided in the open rather than
enabled by an option.
