# 0.1.4 source review and remediation

Codex Security Standard scan `7a8f59ea-3096-43f3-8dc2-b5073bc356ad` completed against immutable source revision `7128c2cb20ceeb1467935fbf06864bb1752f3bc5`. It used an independent baseline auditor, independent architecture mapping, a focused Windows native investigation and parent validation. This is an AI-assisted static review, not a third-party penetration-test certification.

The review covered 88 first-party implementation, configuration, test and supporting documentation files. The two original design briefs and four static artwork files were classified separately. Dependency implementations, generated binaries, private profiles, credentials and Git history were outside this scan. Runtime tests and dependency/credential scans are separate release evidence.

One low-severity finding was confirmed: cancellation during asynchronous history persistence could still be followed by delivery of the finalized transcript to its original target or clipboard. It required a narrow cancellation interval, normally with history enabled, and did not allow choosing a new target or retrieving a key.

The fix retains a separate pending-delivery identity after microphone/provider cleanup. Cancellation and shutdown revoke it; the continuation checks it after cleanup and history persistence. Pending delivery remains busy, and a stale storage failure cannot change a newer session. Five regression cases first failed on the reviewed revision and then passed: paste/Unicode/copy cancellation, shutdown during persistence, and delayed failure after starting another recording. Existing session tests also passed.

The generated scan report remains an immutable record of the reviewed revision and its finding. This document records the subsequent remediation, not a claim that the original scan found no issues. The full application checks, installed validation and release commit are recorded in `../tests/manual-windows-qa.md`.

Architecture observations also clarified two privacy details: key testing sends language/vocabulary setup without audio, and expired encrypted history is pruned on later writes rather than by an exact-time purge timer. These are now explicit in `../PRIVACY.md`. The helper remains outside ASAR; signature and Windows account protections are separate release/OS controls. Physical compatibility and the final-focus/clipboard-crash limits remain in the security policy.

The scanner reported 6,564,132 total tokens across five threads, including 6,062,580 cached input tokens; this is the tool's attributed usage, not a new application benchmark. Its preflight was ready with the actual four-slot session capacity; the suggested six-slot capacity was unknown. Daybreak status was unknown and no programs were returned. Neither advisory was treated as evidence that a runtime security test passed.
