Seyvo 0.1.4 — Windows x64 validation build.

Add experimental near-caret and custom percentage-based bubble placement. Near-caret uses activation-time geometry, prefers below/above the caret and falls back to the bottom of the monitor when geometry is unavailable. Custom positions remain inside the work area. The new preview does not open a microphone.

Fix a cancellation race found by the completed independent source review: cancelling or quitting while encrypted history is still being saved now revokes pending native/clipboard delivery. A late storage failure cannot change a newer session. Five regression cases reproduced the original issue and passed after the fix. The immutable scan found one low-severity issue; docs/security-review-0.1.4.md records its remediation and review limits.

Source validation passed typecheck, lint, production build, 49 unit/integration tests and nine Electron scenarios. Native caret capture, Unicode/Hindi/emoji and one-shot/read-only/non-text refusal are covered. The QA record identifies final installer, provider, lifecycle, benchmark, CI and download observations with their exact build identity.

Seyvo implements explicit shortcut → recorder/worklet → direct Google Live Transcribe → finalized native text insertion, retaining recovery when insertion cannot be verified. It includes Smart/Verbatim settings, microphone discovery/selection, dictionary, encrypted optional history, tray/startup, sound cues, coding vocabulary and manual release checking. It never submits a field, logs private speech or publishes the user's key.

This is an unsigned validation prerelease. Human-spoken English/Hindi/Hinglish, clean-machine installation and the wider physical Windows/target matrix remain acceptance gates. Generated speech through real Google and physical microphone open/stop are distinct tests. No stable commercial readiness is claimed. Do not disable Windows security controls to install it.

Direct Unicode input remains refused for Notepad because that target transformed the fixture in Windows acceptance. The refusal leaves the field unchanged and retains the transcript. Notepad clipboard insertion remains unaccepted. Windows Forms and an isolated Edge textarea have separate successful native-input observations. Seyvo does not change keyboard layouts or silently switch insertion methods.

Requires Windows x64, microphone, internet and a user-owned Gemini key with access to the transcription model. Google pricing, quotas and data terms apply. MIT permits commercial reuse with notices; trademark clearance, signing and paid support policy remain owner decisions. No Seyvo backend, telemetry, subscription, automatic updater, ARM64 or push-to-talk is shipped.

Verify SHA256SUMS.txt before distribution. Installer, runtime CycloneDX SBOM and complete lockfile license inventory are attached. Uninstall preserves the encrypted profile; PRIVACY.md explains deliberate deletion, history retention and key-test setup data. Inspect the destination before retrying uncertain insertion.
