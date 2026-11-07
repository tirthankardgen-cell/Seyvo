# Changelog

## 0.1.5 — validation

Bring Seyvo into view when a shortcut cannot start because a transcript is waiting or a key is missing. Preserve the original recovery reason and words. Show recovery instructions on every dashboard tab, disable the unavailable local test while recovery is pending, and make the privacy-filtered bubble indicate that text needs attention.

Show measured microphone amplitude on a logarithmic display scale, with fractional RMS percentages instead of rounding quiet input to zero. Keep the local test's measured peak after stopping and give conditional guidance for very quiet input. This changes feedback only; it does not amplify audio or change Google finalization behavior.

## 0.1.4 — validation

Add experimental near-caret and custom percentage-based bubble placement, with work-area bounds, above-caret placement near the bottom edge and a bottom fallback when caret geometry is unavailable. Native capture obtains only caret rectangles; it never reads field text. Add a microphone-free bubble preview that cannot hide a newer recording.

Persist custom coordinates with bounded validation and migration defaults. Extend geometry, native caret, settings/restart and preview lifecycle coverage. Make Electron test shutdown release its pending debugger request before quitting. Add a packaged Windows startup/idle benchmark with explicit measurement limits.

Fix a cancellation race found during the independent source review: cancelling or quitting while history is being saved now revokes pending clipboard/native delivery. A delayed storage failure cannot overwrite a newer session. Regression tests reproduced the issue before the fix in all three insertion modes.

## 0.1.3 — validation

Discover microphones through the authorized recorder so Settings can offer real input devices without granting the dashboard microphone permission. Keep device discovery local and bounded, preserve a saved selection before discovery, and refresh available inputs during capture.

Show microphone failures on Settings and onboarding, release the hidden recorder after permission denial, and recover from an unavailable saved input by selecting Windows default. Add provider authentication/quota/service/timeout/finalization failure coverage and verify failed key replacement retains the previous encrypted key. Validation now includes 41 unit/integration tests and eight Electron scenarios.

Exclude Electron Vite's generated config loader from Git status so a clean build reports its commit without an incorrect modified suffix.

Refuse direct Unicode input into Notepad before sending keys: the Windows 11 acceptance fixture was transformed there. Preserve the complete transcript and explain clipboard/copy recovery. Do not change the user's input language. Other targets retain the existing field/caret and duplicate-input checks.

## 0.1.2 — validation

Complete sound cues with Windows playback and preview, an opt-in coding vocabulary preset, three bubble sizes, dictionary editing, and About build/maintainer/privacy/contributor details. Fix clipped captions and add compact layouts for 200% zoom. Reposition the overlay on display changes and invalidate delayed shows after hiding.

Destroy the hidden recorder window and settle pending operations after a renderer crash. Require editable native text controls before capturing an insertion target and dispose process identity handles. Add provider vocabulary limits, cue ordering/defaults, scale/zoom, settings restart, crash/suspend/lock and second-instance tests. The requirement evidence ledger records remaining physical and commercial acceptance gates.

## 0.1.1 — validation

Allow up to 15 seconds for the first native-helper handshake on cold Windows installations; capture and insertion remain bounded at five seconds. CI installs Electron before measuring application startup. This follows an intermittent native-helper availability failure on a hosted runner; it does not relax the native availability assertion.

## 0.1.0 — development

Initial implementation of the Windows dictation utility: Google Live Transcribe Smart/Verbatim protocol adapter, dedicated PCM recorder, toggle shortcut, nonactivating bubble, target-aware Win32 insertion with clipboard preservation, recovery, DPAPI key storage, local dictionary and encrypted opt-in history.

Includes per-user NSIS packaging, automated checks and release documentation. This version is not yet declared production-ready. See `tests/manual-windows-qa.md` for observed validation and `docs/release-checklist.md` for remaining gates. Push-to-talk, ARM64, automatic updates, snippets and near-caret overlay placement are not shipped.

Live validation fixes include opaque API-key input, CommonJS WebSocket import compatibility, durable encrypted writes in redirected Windows profiles, explicit Google activity boundaries/generation-completion handling, and clipboard sequence/ownership checks after Windows publishes the clipboard. The packaged path passed real Google transcription and native insertion with a generated speech fixture; live human speech remains an acceptance item.
