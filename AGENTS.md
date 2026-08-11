# Contribution and agent policy

The primary session owns architecture, integration, release decisions, and
final acceptance. Productive delegated work uses only the eight custom
`sll_luna_*` profiles in `agent-templates/`, pinned to `gpt-5.6-luna` and
`model_reasoning_effort = "max"`.

Do not substitute Terra, a Sol child, `worker`, `default`, built-in `explorer`,
old Sol Advisor profiles, or silent fallbacks. Do not ask a child agent to push,
merge, create a release, or deploy. Review all delegated output independently.

Run `npm.cmd test`, `git diff --check`, plugin validation, and installer
`check`/`doctor` before making release claims. Preserve existing history and
never use `git reset --hard` or `git clean -fd` to clear a worktree.
