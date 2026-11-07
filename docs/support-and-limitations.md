# Support and compatibility

Requirements: Windows x64 supported by the packaged Electron runtime, microphone and internet, a Gemini API key with access to `gemini-3.5-transcribe-live`, sufficient quota/billing and supported account geography. Initial development host is Windows 11 build 26300. Windows 10, clean-machine coverage, scaling and application compatibility are tracked separately in `tests/manual-windows-qa.md`; do not assume an untested platform passed.

| Symptom | Next step |
| --- | --- |
| Key test rejected | Review key restrictions, model/region access and account billing in Google AI Studio. Failed replacement does not overwrite the previous encrypted key. |
| Quota/billing error | Check Google's limits/pricing; no automatic retries are made. |
| Mic permission denied | Enable microphone access for desktop apps in Windows Privacy settings, then test locally. |
| Wrong/disconnected mic | Select Windows default in Settings, run Test microphone, then stop and select a discovered input. Device names refresh only during an explicit local test or dictation. A saved input may be listed as unverified until that discovery runs. |
| Shortcut unavailable | Record another Ctrl+Shift/Alt combination or F6–F12. The previous working registration is retained. |
| Cannot insert | Check original window/field/caret stayed selected. Protected, elevated, password, read-only, terminal, custom or remote editors may reject input. Copy is the fallback. Do not routinely run Seyvo as administrator. |
| Direct Unicode unavailable in Notepad | Seyvo refuses this path before sending keys because the tested Windows 11 Notepad transformed the fixture. Recover the complete text from Seyvo. Clipboard mode there remains unaccepted; inspect the result if you choose paste or Copy. |
| Clipboard cannot be preserved | Current formats may be outside the safe set or larger than 16 MB. Copy deliberately replaces it; direct Unicode mode supports short single-line text. |
| Text duplicated after retry | SendInput cannot prove whether the app accepted paste. Always inspect the destination before retrying. |
| Finalization timeout | Recovery contains committed segments; final words may be missing. Copy them before dismissing. |
| Native helper unavailable | Restart Seyvo, verify packaged resources/antivirus quarantine with the publisher, and consult release checks. |
| Closing keeps process alive | Default close-to-tray behavior. Use Quit Seyvo to release all resources and exit. |
| History disappeared | It defaults off and is deleted when disabled; configured age/count retention also applies. It is encrypted for the current Windows account. |

Smart mode uses Google's native cleanup only; no second paid rewrite call. No automatic translation, summarization or chat response. Multilingual quality depends on Google and your audio; Hindi/Hinglish recognition needs empirical acceptance testing. No offline transcription. No fixed API price or unlimited free usage promise.

Sound cues are off by default. Enable them and use Preview sound cue to check the Windows output device/mixer. Coding vocabulary is opt-in in Dictionary; the complete term list is visible, user terms take priority and the combined provider vocabulary stays within 1,000 entries. Bubble size is compact, standard or large. Captions remain off by default.

Version 0.1.4 adds near-caret/custom bubble placement. Near-caret is experimental: it uses the insertion point captured at activation, positions above it if needed and falls back to the bottom when geometry is missing. Custom percentages are relative to the active monitor's available work area. Preview uses the monitor under the pointer and does not open the microphone. Version 0.1.3 offers top/bottom placement only.

Not shipped: push-to-talk, ARM64, automatic updates, snippets, automatic update channels or remote synchronization. Direct Unicode rejects newlines to avoid submission. The product remains a validation build until the release matrix passes. See `requirements-evidence.md` for the full specification audit and explicit deviations.

Data: `%APPDATA%\seyvo`; uninstall preserves it. Follow `PRIVACY.md` for deliberate removal. Report only app version, Windows build, target executable and coarse diagnostics; never submit private keys or speech.
