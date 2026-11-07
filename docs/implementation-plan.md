# Implementation and evidence ledger

Both supplied documents were read completely on 7 November 2026. Initial repository: two briefs, commit `0e1dd78`, existing origin `tirthankardgen-cell/Seyvo`. Host: Windows 11 x64 build 26300. Initial tools: Node 20.16.0, npm 10.9.1, no .NET SDK; .NET Framework compiler is present.

## Plan and boundaries

1. Foundation: Electron 45.2.3, React 19.3.1, TypeScript 6.0.3, Vite 8.3.6, Google Gen AI 3.0.0; verify installed definitions. TypeScript 6 is the compatible version for the pinned ESLint tooling. Use Node 26.13.0 LTS portable (official SHA256 verified). npm is chosen because it is available and provides a deterministic package-lock.
2. Vertical slice: authoritative main session coordinator; dedicated sandboxed audio renderer; AudioWorklet PCM16 conversion; setup-gated Gemini Live connection; finalized text; narrowly scoped C# Win32 helper via stdin/stdout. No shell commands generated from user data.
3. Windows reliability: capture HWND/PID/focus/caret identity before overlay; refuse changed/unsafe targets; version-checked clipboard restoration; recovery; shortcut conflict preservation; lifecycle cleanup.
4. Product: durable validated preferences, DPAPI async vault, dictionary, encrypted opt-in history, onboarding, actual local mic test, accessible themes, diagnostics, manual release link.
5. Distribution: NSIS per-user x64 package, install/launch/uninstall tests, real screenshots, license inventory/SBOM, security review, GitHub workflows and source push.

Data flow: explicit shortcut -> native metadata capture -> nonactivating overlay -> Google setup -> mic worklet -> bounded IPC -> Gemini -> committed final segments -> native target verification -> clipboard transaction -> recovery when uncertain. UI never receives stored secrets or HWNDs. Audio and transcript logs are prohibited. History defaults off. No auto-submit.

## Acceptance and release gates

Each milestone runs typecheck, lint, tests and production build. Tests cover cancellation, stale events, PCM bytes, setup/finalization, target refusal, clipboard races, settings/vault and IPC. Real Windows tests and provider tests are recorded separately. Live microphone/account acceptance needs a user-configured key; the app must test the exact model before enabling dictation. No production release until a packaged start/dictate/insert/close/restart test and security review pass. Signing and trademark clearance remain owner-controlled release prerequisites.

## Official API verification

Fetched `https://ai.google.dev/gemini-api/docs/live-api/live-transcribe` and Google's `gemini-live-api-dev/SKILL.md`: model, Smart/Verbatim, replaceable interim vs final, audioStreamEnd, 100 ms PCM16 mono 16 kHz, 10 minute session maximum, vocabulary 1,000 maximum (~100 recommended). Five-minute default locally. Fetched Electron safe-storage documentation: synchronous methods deprecated for removal in Electron 46; use isAsyncEncryptionAvailable/encryptStringAsync/decryptStringAsync. Never treat socket open as setup readiness.

## Milestone results

| Milestone | Implementation and observed evidence |
| --- | --- |
| 0: Foundation | Complete. Locked dependencies, strict TypeScript, lint/build/tests, isolated renderer/preloads, typed IPC, CI and original assets. |
| 1: Real vertical slice | Implemented and tested against live Google in the installed app. Windows F8 events started/stopped the real recorder worklet, a generated PCM speech fixture reached Google, and its finalized text was inserted into the original native test field. This test used a file-backed capture device; the separate physical-microphone test opened hardware but speaker playback produced no recognized speech. Live human-speech acceptance remains open. |
| 2: Windows reliability | Implemented target/caret validation, one-shot insertion tokens, Unicode input, clipboard transactions, tray, pause, startup readback, cancellation, bounded audio, crash/timeout recovery. Native Unicode/Hindi/emoji, read-only refusal, duplicate refusal and a real multiline paste were observed. See the QA matrix for clipboard cases and remaining targets. |
| 3: Product finish | Onboarding including a practice field, settings persistence, local mic test, dictionary import/export, encrypted opt-in history, themes, reduced motion, diagnostics, real screenshots and documentation implemented. |
| 4: Distribution | NSIS x64 installer built and upgraded in place. Packaged native resources, production fuses, local-renderer enforcement, startup roundtrip and microphone open/stop passed. Full dependency audit: zero vulnerabilities. Signing credentials, formal naming clearance and the broader acceptance matrix remain external launch gates. |

Latest development core gate: 49 automated tests, lint, typecheck and production build passed; all nine Electron E2E scenarios passed. Tests mock Google/native ports only at the unit/integration tier. The opt-in live test has no Google mock and does not persist speech or credentials in artifacts.

The 0.1.2 fidelity audit completed sound cues, coding vocabulary, overlay sizes, dictionary editing and About build metadata. It also fixed caption clipping and hidden recorder cleanup, tightened editable-target checks, and added scale/zoom, persistence, crash/suspend/lock and second-instance coverage. The complete mapping and remaining gates are in `requirements-evidence.md`.

The 0.1.4 audit closes the near-caret/custom placement gap. It adds native caret geometry, logical-pixel conversion, bounded percentage placement and a microphone-free preview, with geometry/native/restart/race coverage. Physical multi-monitor and accessibility acceptance remain distinct from these automated observations.

Live testing exposed and fixed three integration issues: CommonJS WebSocket import interop; EXDEV during same-directory AppData renames (now a flushed, checksummed recovery journal); and the transcription service's generationComplete signal without optional finished/turnComplete fields. Explicit activityStart/activityEnd boundaries follow Google's current manual-VAD protocol. A subsequent real clipboard test identified sequence publication after CloseClipboard; the helper now samples afterward and also checks ownership.

No stable-release or complete compatibility claim follows from these results. Use `tests/manual-windows-qa.md` and `docs/release-checklist.md` as the release record.

## Microphone and shortcut follow-up

The user's installed 0.1.4 session entered recovery after a provider finalization timeout. Subsequent shortcut activation was received but refused, with its message hidden in the closed dashboard. Preserve that in-memory result as requested. Fix blocked-activation visibility, recovery guidance and the redacted bubble's state indication. Make low microphone amplitudes visible without altering audio; retain local-test peak feedback. Verify with a main-process shortcut/loopback-provider Electron regression, the core gate, full E2E and an isolated packaged smoke test before offering the new installer. Keep real microphone observations separate from synthetic-provider coverage and leave provider completion/human recognition unclaimed.

Source verification: 50 unit/integration tests, typecheck, lint/build and all 10 Electron scenarios passed. The original process and recovery are retained; installing over that running session awaits the user's deliberate handling of its words.

The separate 0.1.5 installer was built from `a6a0b18ef4af`. Its unpacked production app passed the isolated packaged smoke test, including microphone selection/open/stop, startup readback/cleanup, isolation/fuses and clean exit. Source/bundle secret scans, dependency audit and regenerated supply-chain artifacts passed. Do not treat this as an installed upgrade or a resolved Google timeout.
