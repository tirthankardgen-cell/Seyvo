# Privacy and threat model

Assets: provider key, microphone speech, final/interim text, clipboard formats, original target identity, local preferences and optional history. Trust boundaries: sandboxed dashboard/overlay/recorder -> main IPC; main -> Windows helper pipes; main -> Google TLS; main -> user profile storage; clipboard -> third-party applications.

| Threat | Control | Residual risk / validation |
| --- | --- | --- |
| Renderer asks for secrets/OS commands | Narrow bridge, exact sender/main-frame URL checks, schemas, no secret getter | A compromised main process or same-user malware remains trusted by Windows. E2E checks renderer isolation. |
| Unsolicited recording | Explicit action, active-session permission gate, local-only mic test, stop/cancel/crash/lock cleanup | Hardware/browser bugs; verify physical indicator during QA. |
| Misrouted paste | Immutable token, HWND/PID/start time/control/caret checks immediately before SendInput | Focus race between verification and input; unsupported apps may not expose useful automation identity. No success claim. |
| Clipboard loss | Supported-format snapshot, total size bound, sequence-aware restore | Slow apps may consume after restore; another process may retain temporary text; helper crash during transaction may leave transcript. |
| Stale network result inserted | Session IDs, abort-before-cleanup, final-only assembly, one insertion phase | Provider offset semantics must be rechecked on SDK/API upgrade. |
| Memory/connection exhaustion | PCM packet bounds, four-packet IPC window, 64 KB upload buffer, maxPayload, handshake/final/session limits | Large but bounded transcript memory; no guaranteed JS secure erase. |
| Key/text leaks in logs | Fixed error mapping, no transport/audio/transcript logs, diagnostics allowlist | OS dumps and Google service retention are outside app control. |
| Malicious imported data | JSON schema/length/size limits, inert vocabulary strings, no code execution | Dictionary itself may be sensitive and is sent with transcription setup. |
| Tampered distribution | Lockfile, audit, ASAR integrity and Electron fuses, checksums, optional signing hooks | Unsigned builds lack verified publisher identity; signing certificate and release environment are owner-controlled. |

No account server, cloud history, telemetry backend, kernel driver or arbitrary keyboard listener is present. Run unit/integration/e2e tests and record real Windows acceptance before stable release. This document is an implementation threat review, not an independent third-party penetration-test certification.
