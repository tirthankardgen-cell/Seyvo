Seyvo 0.1.5 — Windows x64 validation candidate.

Fix hidden feedback when a shortcut is refused because a transcript is waiting or a key is missing. Open the dashboard, retain the original recovery reason and words, show recovery instructions on every tab, and correctly indicate recovery in the privacy-filtered bubble.

Display fractional RMS microphone levels on a logarithmic scale and keep the local test's measured peak after stopping. A faint signal no longer rounds to zero. Capture processing and Google finalization are unchanged. The reported provider timeout remains unresolved; this update does not claim to repair recognition or a hardware microphone fault.

Source validation passed typecheck, lint, production build, 50 unit/integration tests and ten Electron scenarios. The recovery regression uses the real main-process handler with synthetic audio/provider events and an owned native target. The QA record separates that coverage from real microphone amplitude measurements and the earlier 0.1.4 provider/target observations. The running 0.1.4 session was preserved at the user's request; an upgrade must not discard its unsaved recovery.

Seyvo implements explicit shortcut → recorder/worklet → direct Google Live Transcribe → finalized native text insertion, retaining recovery when insertion cannot be verified. It includes Smart/Verbatim settings, microphone discovery/selection, dictionary, encrypted optional history, tray/startup, sound cues, coding vocabulary and manual release checking. It never submits a field, logs private speech or publishes the user's key.

This is an unsigned validation prerelease. Human-spoken English/Hindi/Hinglish, clean-machine installation and the wider physical Windows/target matrix remain acceptance gates. Generated speech through real Google and physical microphone open/stop are distinct tests. No stable commercial readiness is claimed. Do not disable Windows security controls to install it.

Direct Unicode input remains refused for Notepad because that target transformed the fixture in Windows acceptance. The refusal leaves the field unchanged and retains the transcript. Notepad clipboard insertion remains unaccepted. Windows Forms and an isolated Edge textarea have separate successful native-input observations. Seyvo does not change keyboard layouts or silently switch insertion methods.

Requires Windows x64, microphone, internet and a user-owned Gemini key with access to the transcription model. Google pricing, quotas and data terms apply. MIT permits commercial reuse with notices; trademark clearance, signing and paid support policy remain owner decisions. No Seyvo backend, telemetry, subscription, automatic updater, ARM64 or push-to-talk is shipped.

Verify SHA256SUMS.txt before distribution. Publish installer, runtime CycloneDX SBOM and complete lockfile license inventory only after recording the matching package checks. Uninstall preserves the encrypted profile; PRIVACY.md explains deliberate deletion, history retention and key-test setup data. Inspect the destination before retrying uncertain insertion.
