# Support and compatibility

Requirements: Windows x64 supported by the packaged Electron runtime, microphone and internet, a Gemini API key with access to `gemini-3.5-transcribe-live`, sufficient quota/billing and supported account geography. Initial development host is Windows 11 build 26300. Windows 10, clean-machine coverage, scaling and application compatibility are tracked separately in `tests/manual-windows-qa.md`; do not assume an untested platform passed.

The installed 0.1.4 helper exactly preserved multilingual single-line Unicode in Edge textarea/contenteditable, an isolated Word RTF, an isolated VS Code editor with accessibility enabled and the logged-out ChatGPT web composer. The classic PowerShell console refused capture before input. These are narrowly scoped observations; consult the [target matrix](target-acceptance-0.1.4.md) for versions, settings and untested variants. They do not certify clipboard paste or full speech recognition in every target.

| Symptom | Next step |
| --- | --- |
| Key test rejected | Review key restrictions, model/region access and account billing in Google AI Studio. Failed replacement does not overwrite the previous encrypted key. |
| Quota/billing error | Check Google's limits/pricing; no automatic retries are made. |
| Mic permission denied | Enable microphone access for desktop apps in Windows Privacy settings, then test locally. |
| Wrong/disconnected mic | Select Windows default in Settings, run Test microphone, then stop and select a discovered input. Device names refresh only during an explicit local test or dictation. A saved input may be listed as unverified until that discovery runs. |
| Speaking but little microphone movement | Run the local test while speaking toward the selected input. Version 0.1.5 shows fractional RMS percentages and keeps the measured peak after stopping; earlier versions rounded faint input to zero. Check Windows input volume, mute and enhancements if the spoken test remains quiet. The meter measures amplitude, not intelligibility or recognition accuracy. |
| Shortcut seems to do nothing | Check Pause and the active-shortcut label. Version 0.1.6 starts a fresh dictation even when the last transcript remains available; earlier versions required Dismiss. Starting again replaces the previous in-memory result, so copy it first if needed. |
| Unsure whether a shortcut saved | Version 0.1.6 shows “Shortcut saved,” disables Save after success and displays the active or paused binding. A conflict keeps the previous binding and explains the refusal. |
| Shortcut unavailable | Record another Ctrl+Shift/Alt combination or F6–F12. The previous working registration is retained. |
| Cannot insert | Check original window/field/caret stayed selected. Protected, elevated, password, read-only, terminal, custom or remote editors may reject input. Copy is the fallback. Do not routinely run Seyvo as administrator. |
| Direct Unicode unavailable in Notepad | Seyvo refuses this path before sending keys because the tested Windows 11 Notepad transformed the fixture. Recover the complete text from Seyvo. Clipboard mode passed the 0.1.7 owned-document Hindi/emoji/multiline test. Inspect your result before retrying. |
| Clipboard cannot be preserved | Version 0.1.7 supports ordinary screenshot images and Windows clipboard privacy flags. Unsupported or unavailable formats and snapshots over 64 MiB still cause refusal. Copy deliberately replaces the clipboard; direct Unicode mode supports short single-line text in compatible controls. |
| Sign-in switch appears unchanged | Version 0.1.7 reads the same executable and arguments used by Windows registration and confirms each change. If Windows rejects it, check Startup Apps in Windows Settings. |
| Box around the bubble or bubble remains after finishing | Version 0.1.7 makes the whole window canvas transparent. Completion hides after 1.5 seconds; error/recovery hides after eight seconds. Open Seyvo from the tray to recover text before starting a new dictation. |
| Seyvo could not start | The current dialog identifies the initialization stage without exposing private errors. Quit and reopen Seyvo; report that stage, version and Windows build. Do not delete the profile or remove your key as a routine fix. |
| Text duplicated after retry | SendInput cannot prove whether the app accepted paste. Always inspect the destination before retrying. |
| Finalization timeout | Recovery contains committed segments; final words may be missing. Copy them if needed before starting the next dictation or dismissing. The next dictation never replays incomplete output. |
| Native helper unavailable | Restart Seyvo, verify packaged resources/antivirus quarantine with the publisher, and consult release checks. |
| Setup cannot find Seyvo.lnk | Install the current 0.1.7 build. Its Finish action launches the installed executable directly. Desktop shortcut and Run Seyvo are checked by default and can be unchecked. |
| Closing keeps process alive | Default close-to-tray behavior. Use Quit Seyvo to release all resources and exit. |
| History disappeared | It defaults off and is deleted when disabled; configured age/count retention also applies. It is encrypted for the current Windows account. |

Smart mode uses Google's native cleanup only; no second paid rewrite call. No automatic translation, summarization or chat response. Installed 0.1.7 passed the specified human English, Hindi and Hinglish recognition/paste checks. Quality still depends on Google and your audio; those accepted samples are not a universal accuracy guarantee. No offline transcription. No fixed API price or unlimited free usage promise.

Sound cues are off by default. Enable them and use Preview sound cue to check the Windows output device/mixer. Coding vocabulary is opt-in in Dictionary; the complete term list is visible, user terms take priority and the combined provider vocabulary stays within 1,000 entries. Bubble size is compact, standard or large. Captions remain off by default.

Version 0.1.4 adds near-caret/custom bubble placement. Near-caret is experimental: it uses the insertion point captured at activation, positions above it if needed and falls back to the bottom when geometry is missing. Custom percentages are relative to the active monitor's available work area. Preview uses the monitor under the pointer and does not open the microphone. Version 0.1.3 offers top/bottom placement only.

Not shipped: push-to-talk, ARM64, automatic updates, snippets, automatic update channels or remote synchronization. Direct Unicode rejects newlines to avoid submission. The product remains a validation build until the release matrix passes. See `requirements-evidence.md` for the full specification audit and explicit deviations.

Data: `%APPDATA%\seyvo`; uninstall preserves it. Follow `PRIVACY.md` for deliberate removal. Report only app version, Windows build, target executable and coarse diagnostics; never submit private keys or speech.
