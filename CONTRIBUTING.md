# Contributing

1. Use Node.js 20 or newer and `npm ci`.
2. Add a failing test before production behavior changes.
3. Keep the installer dependency-free and fail closed on unsafe paths,
   ownership conflicts, malformed manifests, and active locks.
4. Keep the eight definitive agent templates exact; do not add a ninth managed
   role or change the Luna/Max pins without a versioned design decision.
5. Run `npm.cmd test`, `npm.cmd run validate:plugin`, `npm.cmd pack --dry-run`,
   `git diff --check`, and the temporary user/project lifecycle before a release.
6. Do not include credentials, local paths, caches, `node_modules`, or temporary
   fixtures in commits or release assets.

Release publication is restricted to the primary release manager after the
clean-room and runtime gates in [Release validation](docs/RELEASE_VALIDATION.md)
pass.
