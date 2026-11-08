# Changelog

## 0.1.10 — validation

Keep the saved key combination as the default and add optional Right Ctrl activation. Hold for three seconds to start: either keep holding while speaking and release to finish, or release and speak, then tap/release again to finish. Ignore autorepeat and short accidental presses, disarm ordinary Ctrl combinations, and cancel pending setup when hold mode releases. Native listener failure disables single-key activation and restores the saved combination when available. Fn is shown as unavailable because it has no standard Windows virtual-key event; no firmware/driver workaround is bundled.

## 0.1.9 — validation

Keep idle WebSocket transport alive using control pings, with no audio or transcription input. Detect unanswered pings. Renew server-ended idle sessions and allow at most three delayed retries (30, 60 and 120 seconds) for temporary idle network failures. Quota, key, model and policy errors stop retries; active dictation failures never replay speech. All setup attempts still share the four-per-minute guard. This addresses the longer idle disconnect observed after the initial 0.1.8 acceptance.

## 0.1.8 — validation

Prepare a silent Google connection before the shortcut so dictation can open the microphone without waiting for network setup. Keep the sandboxed recorder page loaded, with microphone permission limited to explicit activation. Stop releases tracks; each dictation gets fresh transcript state. Idle socket renewal reserves the configured recording duration within Google's session limit.

Add Keep Google ready and an honest connection indicator. Share a four-connection-attempts-per-minute limit across background preparation, dictation and key tests. Do not send silence, perform extra cleanup-model calls, or automatically retry provider/quota errors. Pause, sleep, lock, key removal and quit close background connections. Google free-tier eligibility and paid-project charges remain controlled by Google.

## 0.1.7 — validation

Preserve supported screenshot images and Windows clipboard privacy flags during paste. Keep portable image data and the native bitmap in a bounded 64 MiB transaction; ignore only COM owner bookkeeping, and refuse unsupported content before mutation. Temporary transcripts request exclusion from Windows clipboard history and cloud sync. Existing target, modifier, one-shot insertion and concurrent-copy checks remain in force.

Make the entire floating-window canvas transparent in all themes. Hide completion after 1.5 seconds and error/recovery after eight seconds, retaining recoverable words in Home until the next explicit dictation, Dismiss or exit.

Read the sign-in preference using the same executable and arguments used to register it. Confirm changes in Settings. Prevent pending window requests from reopening windows during shutdown, and identify the failed initialization stage in startup dialogs without logging private errors.

Clarify free, open-source MIT use and welcome contributions with a project Code of Conduct.

## 0.1.6 — validation

Make repeated dictation work without dismissing the last result. After native input is sent, return to Ready; the next explicit dictation replaces the previous in-memory transcript and captures a fresh target. Failed or incomplete output remains available until that next activation, Copy, Dismiss or exit. No stale result is replayed, and history remains opt-in. “Text sent” describes the Windows input attempt, not independent confirmation that another app accepted it.

Confirm shortcut saves, show the active or paused binding, disable Save after success, and validate incomplete combinations before submission. Failed rebinds retain the previous shortcut and visibly explain the conflict. Keep error/recovery bubbles visible until handled; distinguish local microphone tests and no-speech results from successful input.

The interactive installer now selects Create a desktop shortcut and Run Seyvo by default. Both choices remain user-controlled; completing setup launches the app when Run is selected. Launch the installed executable directly so a missing or unresolved Start menu shortcut cannot prevent startup. Unattended installs honor the no-desktop-shortcut option.

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
