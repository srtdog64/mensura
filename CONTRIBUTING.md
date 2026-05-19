# Contributing

Mensura is a small math and geometry kernel. Contributions should preserve the
library's core constraints:

- no hidden global mutable scratch state in hot paths
- no renderer, scene graph, ECS, UI, or asset ownership
- explicit `Result` failure surfaces at trust boundaries
- documented numeric policy for thresholds, layout, and coordinate behavior
- benchmark evidence for hot-path changes

## DCO Is Required

Every contribution commit must include a DCO sign-off trailer:

```txt
Signed-off-by: Full Name <email@example.com>
```

The normal workflow is:

```sh
git commit -s
```

Pull requests with unsigned commits should not be merged. Maintainers should
ask contributors to amend or rebase their commits instead of adding a sign-off
on someone else's behalf.

See [DCO.md](DCO.md) for the policy and fix-up commands.

## Before Opening A Pull Request

Run the release gate:

```sh
npm run check:release
```

Run the DCO check against the commits you plan to submit:

```sh
npm run dco:check -- --range origin/master..HEAD
```

If `origin/master` is not the right base branch, replace the range with the
actual upstream range for the pull request.

## Performance Changes

For `core`, `batch`, `unsafe`, `gpu`, `query`, `collision`, or `accel` changes
that affect hot paths, include benchmark output or explain why the path is not
performance-sensitive.

Use:

```sh
npm run benchmark:check
```

Do not refactor hot loops for style alone. Keep object APIs inspectable, keep
`Into` APIs allocation-free, and keep `unsafe` APIs explicit.

## API Changes

Public API changes should update the relevant docs:

- [README.md](README.md)
- [docs/api-guide.md](docs/api-guide.md)
- [docs/api-stability.md](docs/api-stability.md)
- [docs/TODO.md](docs/TODO.md)

Experimental layers may change, but stable layers should avoid breaking changes
inside the `0.1.x` surface unless the release notes explicitly call it out.

