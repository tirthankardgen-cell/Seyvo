# Specification coverage and remaining acceptance

This ledger maps the supplied specification to implementation and evidence. The original specification is retained unchanged. A working implementation, a mocked test, a workstation observation and commercial release approval are different kinds of evidence.

| Requirement | Implementation and evidence | Remaining acceptance |
| --- | --- | --- |
| FR-01: installation/lifecycle | NSIS per-user package, single-instance lock, close-to-tray, quit, installed startup and retained encrypted profile. Install/upgrade/uninstall/reinstall observations in the QA record. Automated recorder-crash, suspend/lock event and close-to-tray tests. | Clean Windows VM, actual suspend/resume and logoff. |
| FR-02: shortcuts | Validated capture UI, Ctrl+Shift+Space default, F6–F12, conflict preservation, pause/unregister. Unit tests and physical Windows F8 events in live acceptance. | Broader physical keyboard/conflict matrix. Hold mode is explicitly optional and unavailable. |
| FR-03: capture/provider | Real AudioWorklet PCM16 mono 16 kHz, bounded packets, provider setup and final drain, manual activity boundaries, cancellation and recovery. Live Google model/key test and generated speech through installed recorder and native input. Automated provider authentication/quota/service/timeout/finalization failures; microphone denial cleanup and missing-device recovery. | Human speech, Hindi/Hinglish recognition, physical unplug/network transitions. Generated speech is not a human-microphone pass. |
| FR-04: targeting/input | Original window/process/control/caret identity, editable non-password field checks, one-shot tokens, Unicode and clipboard paths, sequence/owner restoration, recovery. Native Windows Forms and Edge textarea input observed. Notepad direct Unicode is refused before input after it failed acceptance; the refusal leaves the field unchanged. | Clipboard mode in Notepad, Word, VS Code, chat, terminals and protected/elevated targets remain acceptance work. |
| FR-05: keys/privacy | Async Windows encryption, encrypted recovery journal, opaque bounded key input, failed replacement preservation, no stored-key getter or transport logs. Windows vault and compiled provider tests. | Continued release artifact scans and security review on each revision. |
| FR-06: working settings | Main-owned validated settings, additive defaults, actual startup readback, mic/mode/language/duration/insertion/theme/accent/preferences. Sound cues, coding preset and overlay sizes added in 0.1.2; persistence across process restart tested. 0.1.3 discovers real inputs through recorder-only permission and tests selecting/opening a discovered input. | Physical audio output audibility/mute and Windows startup-disabled policy. |
| FR-07: overlay/tray | Nonactivating, click-through, skip-taskbar overlay, monitor work-area clamping and display-change repositioning. Real level meter, captions default off with reserved visible space, size/position/waveform, high contrast/reduced motion CSS. | Automated 100/125/150/200% scale and 200% zoom; negative geometry unit tests. Physical multi-monitor/docking and screen reader acceptance remain open. |
| FR-08: dictionary/history | Dictionary add/edit/remove/clear/import/export, opt-in coding terms, encrypted count/age bounded history with search/copy/delete/export. Provider vocabulary cap and opt-in tests. | Broader user acceptance of multilingual vocabulary. |
| FR-09: updates/diagnostics | Fixed GitHub Releases link, manual downloads, coarse explicit diagnostic copy, build hash, source/contributors/privacy/terms links, actionable recovery. | Signed automatic updater is explicitly optional and not shipped. |

## Section 6 settings audit

General, Dictation, Personalization, Privacy, Appearance, Troubleshooting and About are implemented. Sound cues are original synthesized 150 ms tones played through the Windows mixer, off by default. Preview reports playback failures; an automatic cue failure does not abort a dictation. Coding vocabulary is opt-in, lists every term, merges behind the user's dictionary and never inspects app contents. Bubble size offers compact/standard/large; placement remains top/bottom of the target monitor. The build identifier is compiled from Git and marks modified checkouts.

Explicit deviations: near-caret/custom overlay positioning is deferred; placement is limited to top/bottom with work-area bounds. Native Windows title controls are used instead of custom titlebar buttons. Plain CSS and React state replace optional styling/state libraries. A minimal C# sidecar replaces the suggested Rust module. npm with a committed lockfile replaces pnpm. Hold-to-talk, snippets, ARM64 and automatic update channels are optional features not shipped. These deviations are visible in support documentation rather than exposed as inert controls.

## Milestone and delivery gates

- M0: foundation/build/IPC/security scaffolding implemented and checked.
- M1: real provider/recorder/native vertical slice implemented and observed using generated speech. Human microphone and remaining target acceptance remain open.
- M2: native safety, recovery, lifecycle, tray/startup and monitor logic implemented; remaining physical Windows cases are recorded above.
- M3: required settings gaps found in the audit are implemented, with lifecycle/layout/persistence regressions covered. Physical accessibility acceptance remains open.
- M4: source, installer, licensing/privacy/security/architecture/support documentation, supply-chain reports, checksums and GitHub prereleases delivered. Stable commercial release still requires the acceptance gates and owner-controlled signing/brand/provider decisions in `commercial-readiness.md`.

The required packaged voice-to-field test cannot be represented as a live human-speech pass until someone speaks into the physical microphone. No stable commercial completion is claimed while these gates remain open.
