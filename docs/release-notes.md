Seyvo development validation build.

Windows 11 x64 observations: 27 automated unit/integration tests and Electron E2E passed; the packaged application passed real Google transcription and original-field insertion with a generated speech WAV. Native Unicode/multiline clipboard preservation and concurrent clipboard-change checks passed. Install/upgrade/uninstall/reinstall, encrypted-key persistence, startup cleanup, production fuses and full dependency audit were verified.

Physical microphone access works, but speaker playback produced no recognized speech; a live human-spoken check and the wider target/OS matrix remain pending. This is an unsigned validation prerelease, not a stable commercial launch. See the QA record for exact evidence and limitations.

Implements the Windows voice dictation path with a user-owned Gemini key, a local microphone test, Smart/Verbatim settings, an actual waveform, target-aware insertion and recoverable transcripts. Includes dictionary, encrypted optional history, tray, startup controls and manual release checking.

This draft is not a production-readiness statement. Review the committed Windows QA matrix, signing status, real Google/account/speech acceptance and trademark review before publication. The installer may be unsigned if signing credentials were not configured. Do not disable Windows security controls to install it.

Requires Windows x64, microphone, internet and access to Gemini Live Transcribe. Google API pricing, quota and data terms apply. No auto-submit, no automatic updater, no always-on recording, no Seyvo backend. Push-to-talk and ARM64 are not included.

Uninstall preserves the encrypted user profile; follow PRIVACY.md for deliberate removal. Inspect the destination before retrying an uncertain paste. Verify the attached SHA256SUMS.txt against the actual installer before distribution.
