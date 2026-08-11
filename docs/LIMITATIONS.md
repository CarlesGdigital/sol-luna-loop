# Limitations

- A fresh Codex session is required after plugin or custom-agent changes.
- TOML hashes and installer diagnostics do not prove runtime model routing.
- A parent turn's live sandbox/approval override is reapplied to children and
  can supersede the role's TOML default; mixed sandbox groups require separate
  verification turns.
- Hooks require explicit user trust and are guardrails, not OS isolation or a
  replacement for runtime acceptance. Specialized spawn paths may bypass
  `PreToolUse`; the `SubagentStart` quarantine starts after child creation and
  therefore cannot prove that no prohibited child was instantiated. It can
  validate the reported model, but the event does not expose reasoning effort;
  effort remains a parent/runtime-telemetry acceptance check.
- The `SubagentStart` matcher is global while the plugin is enabled. Unrelated
  built-in or third-party child roles receive quarantine context, so workflows
  that require them must disable this plugin or its hooks first.
- Equal-permission hostile filesystem races between validation and mutation are
  outside the installer’s cooperative threat model.
- The plugin does not submit itself to the universal public OpenAI plugin
  directory; this release uses a public Git-backed marketplace.
- GitHub Actions validates deterministic code only. Model/API runtime tests
  require a local Codex session and are not run with secrets in CI.
