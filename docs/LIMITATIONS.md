# Limitations

- A fresh Codex session is required after plugin or custom-agent changes.
- TOML hashes and installer diagnostics do not prove runtime model routing.
- Hooks require explicit user trust and are guardrails, not OS isolation or a
  replacement for runtime acceptance.
- Equal-permission hostile filesystem races between validation and mutation are
  outside the installer’s cooperative threat model.
- The plugin does not submit itself to the universal public OpenAI plugin
  directory; this release uses a public Git-backed marketplace.
- GitHub Actions validates deterministic code only. Model/API runtime tests
  require a local Codex session and are not run with secrets in CI.
