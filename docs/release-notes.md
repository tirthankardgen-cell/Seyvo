Seyvo 0.1.3 — Windows x64 validation build.

Microphone selection now discovers real inputs through the authorized recorder. Device names refresh during an explicit local test or dictation; choose Windows default and run a local test after connecting a new microphone. The dashboard remains unable to capture audio. The local device list is bounded, held in memory and never sent to Google.

Permission denial and unavailable-input errors now appear on Settings and onboarding, and failed capture releases its hidden recorder window. Selecting Windows default recovers from a missing saved device. Failed key replacement preserves the previous encrypted key.

Source validation passed typecheck, lint, production build, 41 unit/integration tests and eight Electron scenarios. Coverage includes provider authentication/quota/service failures, setup timeout, disconnect during finalization, failed key replacement, real input selection, permission-denial cleanup and unavailable-device recovery. Existing scale/zoom, lifecycle, security and persistence checks remain covered. See the committed Windows QA record for version-specific installed and CI observations.

Final build `4a9d663bee58` passed Windows CI run 42311811558 and installed acceptance. The saved encrypted key tested successfully against Google; generated speech passed through the production worklet and real Google, and all 55 finalized characters matched the original native field. Physical microphone discovery/selection/open/stop, startup readback, upgrade, uninstall/reinstall, encrypted-profile retention, startup removal and clean process exit passed. Installed Notepad direct-input refusal left its field unchanged. Full dependency audit: zero vulnerabilities. Credential-pattern scans passed source, Git history and bundled application code; no key or transcript was included in result artifacts.

The app implements explicit shortcut → recorder/worklet → Google Live Transcribe → finalized native text insertion, with recovery when insertion cannot be verified. It includes Smart/Verbatim settings, dictionary, encrypted optional history, tray/startup controls, sound cues, coding vocabulary, three bubble sizes and manual release checking. It never submits a field.

This is an unsigned validation prerelease. Human-spoken English/Hindi/Hinglish, clean-machine installation and the wider physical Windows/target matrix remain acceptance gates. Generated speech through real Google and physical microphone open/stop are distinct tests. No stable commercial readiness is claimed. Do not disable Windows security controls to install it.

Known target limitation: direct Unicode input is refused for Notepad because it transformed the fixture in Windows acceptance. The refusal leaves the target unchanged and retains the complete transcript for recovery. Clipboard mode in Notepad is not yet accepted. Windows Forms and an isolated Edge textarea have separate successful native-input observations. Seyvo does not change keyboard layouts or silently switch insertion methods.

Requires Windows x64, microphone, internet and a user-owned Gemini key with access to the transcription model. Google pricing, quotas and data terms apply. MIT permits commercial reuse with notices; trademark clearance, signing and any paid support policy remain owner decisions. There is no Seyvo backend, telemetry, subscription, automatic updater or always-on recording. ARM64 and push-to-talk are not shipped.

Verify the attached SHA256SUMS.txt before distribution. The release includes the installer, runtime CycloneDX SBOM and complete lockfile license inventory. Uninstall preserves the encrypted user profile; follow PRIVACY.md for deliberate removal. Inspect the destination before retrying an uncertain insertion.
