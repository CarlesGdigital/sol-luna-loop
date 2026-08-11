# Usage

The parent Sol/High session drives this sequence:

```text
PREFLIGHT → DISCOVERY → PLAN → IMPLEMENT → INTEGRATE → REVIEW → VERIFY
          ↘ REPLAN → FIX → SECURITY → DOCUMENT → FINAL_VERIFY
                                               ↘ VERIFIED_READY
```

Use the smallest suitable Luna agent for each bounded task. Implementers and
fixers may edit only the scoped workspace; reviewers, test engineers, security
auditors, and docs writers report evidence to the parent. The parent integrates
changes, decides whether a failure requires replan, and owns final acceptance.

Every loop result should retain the failure fingerprint, changed hypothesis,
tests run, review result, security result, and documentation result. Repeating a
fingerprint changes strategy instead of terminating early.
