# Implementation and evidence ledger

## 0.1.8 — ready connection with bounded API usage

Requested on 8 November 2026: connect to Google before the shortcut, keep the microphone off, and minimize API cost. This explicitly supersedes the original brief's no-idle-network target, but not explicit microphone activation. Both supplied engineering documents were read completely for this change.

Main owns one setup-only standby socket. The shortcut captures and validates the original target, takes the ready connection, sends activityStart, then opens the microphone. Every dictation still owns a fresh assembler and closes its socket on completion/cancellation. Main prepares the next socket without audio, silence, transcription activity, or a second rewrite call. A loaded sandboxed recorder page stays permission-denied until explicit activation; real tracks and AudioContexts are released on stop. Failed recorders are destroyed.

Idle sessions renew with enough time remaining for the configured maximum recording plus 30 seconds of setup/finalization margin inside Google's ten-minute limit. Default five-minute dictation permits 4.5 minutes of standby per connection; nine-minute dictation requires earlier renewal. Key tests, foreground connections and background renewal share a four-attempts-per-rolling-minute guard. Provider/network/quota errors stop automatic reconnect until explicit retry or a relevant setting/lifecycle change. Pause, lock, sleep, key removal and quit close standby. Settings show live connection state and a persistent Keep Google ready switch (default on for this requested behavior).

Google's official Live Transcribe and pricing pages were checked on 8 November 2026, alongside installed SDK definitions: manual activityStart/activityEnd, ten-minute streaming sessions, free-tier input/output listed as free and paid-tier blended estimate about USD 0.009/audio minute. Project-wide active quotas vary and are shown in AI Studio. Local limits cannot guarantee free-tier eligibility, account-wide TPM/RPM, billing status or zero charges on a paid project. No billing change, model fallback or chargeable idle audio is introduced.

Validation milestones: core checks and provider/standby failure tests; Electron loopback-provider tests with denied idle microphone access and connection reuse; isolated real-Google generated-speech repeats and measured shortcut latency; production packaging, installed lifecycle, checksum and hosted-download verification. Record observations in Windows QA. Remain an unsigned validation prerelease while existing stable-release gates are open.

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
| 1: Real vertical slice | Implemented and tested against live Google in the installed app, including consecutive finalized insertions without Dismiss. Windows F8 events started/stopped the actual worklet, generated speech reached Google and exactly matched the native test field. Installed 0.1.7 subsequently passed the required human English/Hindi/Hinglish prompt and target comparisons. The spoken-language gate is complete. |
| 2: Windows reliability | Implemented target/caret validation, one-shot insertion tokens, Unicode input, clipboard transactions, tray, pause, startup readback, cancellation, bounded audio, crash/timeout recovery. Native Unicode/Hindi/emoji, read-only refusal, duplicate refusal and a real multiline paste were observed. See the QA matrix for clipboard cases and remaining targets. |
| 3: Product finish | Onboarding including a practice field, settings persistence, local mic test, dictionary import/export, encrypted opt-in history, themes, reduced motion, diagnostics, real screenshots and documentation implemented. |
| 4: Distribution | NSIS x64 installer built and upgraded in place. Packaged native resources, production fuses, local-renderer enforcement, startup roundtrip and microphone open/stop passed. Full dependency audit: zero vulnerabilities. Signing credentials, formal naming clearance and the broader acceptance matrix remain external launch gates. |

Latest development core gate: 55 automated tests, lint, typecheck and production build passed. The 11 Electron scenarios and follow-up shutdown observations are recorded in QA. Unit/integration tests mock Google/native ports except the explicitly identified real Windows process-cleanup regression, and selected Electron tests use synthetic capture and a loopback provider. The opt-in live test has no Google mock and does not persist speech or credentials in artifacts.

The 0.1.2 fidelity audit completed sound cues, coding vocabulary, overlay sizes, dictionary editing and About build metadata. It also fixed caption clipping and hidden recorder cleanup, tightened editable-target checks, and added scale/zoom, persistence, crash/suspend/lock and second-instance coverage. The complete mapping and remaining gates are in `requirements-evidence.md`.

The 0.1.4 audit closes the near-caret/custom placement gap. It adds native caret geometry, logical-pixel conversion, bounded percentage placement and a microphone-free preview, with geometry/native/restart/race coverage. Physical multi-monitor and accessibility acceptance remain distinct from these automated observations.

Live testing exposed and fixed three integration issues: CommonJS WebSocket import interop; EXDEV during same-directory AppData renames (now a flushed, checksummed recovery journal); and the transcription service's generationComplete signal without optional finished/turnComplete fields. Explicit activityStart/activityEnd boundaries follow Google's current manual-VAD protocol. A subsequent real clipboard test identified sequence publication after CloseClipboard; the helper now samples afterward and also checks ownership.

No stable-release or complete compatibility claim follows from these results. Use `tests/manual-windows-qa.md` and `docs/release-checklist.md` as the release record.

## Microphone and shortcut follow-up

The user's installed 0.1.4 session entered recovery after a provider finalization timeout. Subsequent shortcut activation was received but refused, with its message hidden in the closed dashboard. Preserve that in-memory result as requested. Fix blocked-activation visibility, recovery guidance and the redacted bubble's state indication. Make low microphone amplitudes visible without altering audio; retain local-test peak feedback. Verify with a main-process shortcut/loopback-provider Electron regression, the core gate, full E2E and an isolated packaged smoke test before offering the new installer. Keep real microphone observations separate from synthetic-provider coverage and leave provider completion/human recognition unclaimed.

Source verification: 50 unit/integration tests, typecheck, lint/build and all 10 Electron scenarios passed. The original process and recovery are retained; installing over that running session awaits the user's deliberate handling of its words.

The separate 0.1.5 installer was built from `a6a0b18ef4af`. Its unpacked production app passed the isolated packaged smoke test, including microphone selection/open/stop, startup readback/cleanup, isolation/fuses and clean exit. Source/bundle secret scans, dependency audit and regenerated supply-chain artifacts passed. Do not treat this as an installed upgrade or a resolved Google timeout.

## 0.1.6 workflow correction and release cleanup

The user reported dictating their feedback successfully through the installed app, then identified the actual repeat-session issue: all native input attempts remained in blocking recovery. They explicitly requested replacing the old result when starting a new dictation. Return to Ready after input is sent; retain the last transcript only until the next activation, with visible retention guidance. Preserve active-operation refusal, fresh target capture, final-only delivery and opt-in history. Add shortcut-save confirmation, dirty-state validation and the active binding. Verify consecutive native insertions, saved shortcut persistence/conflicts and real provider repeats in the installed release before replacing old downloads. Remove obsolete installers/application copies and GitHub releases while retaining source history, credentials and preferences.

The user also requested checked-by-default desktop-shortcut and post-install launch choices. Add the desktop option to assisted setup, retain the standard checked Run choice, and verify both the actual installer controls and the resulting shortcut/application launch. Unchecking an option must affect the result.

Final 0.1.6 build `3b65c52eb47a` passed both interactive installer configurations, preserved encrypted profile files, and launched directly from Finish with microphone off. Direct executable launch fixes the observed missing Start menu shortcut error. Packaged smoke and two consecutive generated-speech/live-Google insertions passed. The shortcut was restored to Ctrl+Alt+Space and its registration and disabled Save state verified. Windows CI passed for this source. See the QA and release records for exact artifact hash, publication and cleanup.

## 0.1.7 clipboard, overlay and startup correction

User screenshots establish successful recognition followed by clipboard-preservation refusal. A read-only format inventory found screenshot PNG/DIB/bitmap payloads, Windows history/cloud flags and OLE bookkeeping. Support concrete screenshot formats without copying process-bound OLE handles or discarding unsupported user data; verify exact image restoration and multiline native paste. Retain target checks, bounds, conditional restoration and no automatic insertion-method fallback. The bubble's body is transparent but its HTML root is opaque; make the entire overlay canvas transparent before rendering, and time-limit terminal bubbles without losing recovery. Fix startup status using the same path/arguments as startup registration, and test actual UI state across restart. Verify native paste in supported real text controls, packaged/live repeats, installer and security checks before a new prerelease. Update README with open-source use/contribution guidance and a linked Code of Conduct, then replace older downloads as already requested.

The final 0.1.7 installed release passed real Google automatic paste twice with exact original clipboard restoration. Native screenshot and Chromium text/HTML cases passed separately, along with Notepad multilingual multiline paste. Core tests and Windows CI passed; final packaged startup and installer defaults/opt-outs passed. README, contribution guidance and Code of Conduct are complete. The repository now uses main only; obsolete binary releases/installers are retired after verifying the replacement download. Stable/commercial launch gates remain as recorded in the release checklist.

The final 44-file diff security review is complete. The required human English/Hindi/Hinglish samples and installed Edge/Word/VS Code paste checks are recorded in QA, including failed attempts and corrected harness assumptions. Diagnostic-privacy and process-cleanup regressions bring the source gate to 55 tests. Strict publisher/timestamp verification is prepared. The owner submitted the SignPath Foundation application and shared its receipt; review, approval and signing setup are pending. Clean-machine and physical acceptance remain separate gates. No new application binary is required for these tooling/documentation changes.
