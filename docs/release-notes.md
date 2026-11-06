Seyvo 0.1.2 — Windows x64 validation build. Adds sound cues with Windows playback and preview, an opt-in coding vocabulary preset, compact/standard/large bubbles, dictionary editing, and About build/maintainer/privacy/contributor information. Captions now stay inside the overlay and compact layouts support 200% zoom.

Fixes hidden recorder-window cleanup after a crash. Insertion targets must be editable text controls; buttons, password and read-only fields are refused. Temporary process identity handles are released. Display changes reposition the overlay within the work area.

Source validation includes 33 unit/integration tests and six Electron scenarios covering persistence, security, emulated 100/125/150/200% scale with 200% zoom, captions, native sound playback, recorder crash/suspend/lock and second-instance behavior. Native Unicode/Hindi/emoji and read-only/non-text/duplicate refusal passed. An isolated Edge textarea received a synthetic Unicode fixture. Latest clipboard mutation fixtures were skipped because the desktop clipboard was occupied; earlier controlled results remain in the QA record. No physical multi-monitor pass is implied by emulation.

The previous installed build passed generated speech through the real recorder, Google and native input. The 0.1.2 installer/live/CI results are recorded in tests/manual-windows-qa.md after validation. The full dependency audit reports zero vulnerabilities.

Physical microphone access works, but speaker playback produced no recognized speech; a live human-spoken check and the wider target/OS matrix remain pending. This is an unsigned validation prerelease, not a stable commercial launch. See the QA record for exact evidence and limitations.

Implements the Windows voice dictation path with a user-owned Gemini key, a local microphone test, Smart/Verbatim settings, an actual waveform, target-aware insertion and recoverable transcripts. Includes dictionary, encrypted optional history, tray, startup controls and manual release checking.

This prerelease is not a production-readiness statement. Review the committed Windows QA matrix, signing status, real Google/account/speech acceptance and trademark review. The installer is unsigned. Do not disable Windows security controls to install it. MIT permits commercial reuse with notices; it does not provide trademark clearance or a support SLA.

Requires Windows x64, microphone, internet and access to Gemini Live Transcribe. Google API pricing, quota and data terms apply. No auto-submit, no automatic updater, no always-on recording, no Seyvo backend. Push-to-talk and ARM64 are not included.

Uninstall preserves the encrypted user profile; follow PRIVACY.md for deliberate removal. Inspect the destination before retrying an uncertain paste. Verify the attached SHA256SUMS.txt against the actual installer before distribution.
