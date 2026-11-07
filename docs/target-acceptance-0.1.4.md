# Installed target acceptance: 0.1.4

Observed on 7 November 2026, Windows 11 Home Single Language x64 build 26300 at 150% display scale. Every native request below used the installed `Seyvo.Native.exe` from release build `9839000c6cfd`. Its SHA256 is `d05ceb5daa0b2ffe26506a1b8b3ab8928dac60c013e0a72329167b127c8dc307`, identical to the packaged helper. No runtime code changed for these tests.

These tests exercise real target capture, Win32 input and refusal. They do not repeat the separate generated-speech → live Google → Windows Forms end-to-end test, and they do not establish human speech recognition in these applications.

## Observations

| Target and configuration | Result |
| --- | --- |
| Microsoft Edge 157.0.4341.42, isolated profile, owned loopback HTML textarea | Exact single-line Unicode fixture, including Hindi, Bengali and emoji. |
| Same Edge profile, owned contenteditable rich-text field | Exact same Unicode fixture. |
| Edge textarea and rich-text field, reuse of each consumed target token | Both refused with `input-already-attempted`. |
| Edge password, read-only textarea and button | Capture refused with `unsafe-field`, `read-only-field` and `choose-text-field`, respectively. The password remained empty and the read-only content remained unchanged. |
| Edge, focus moved to another field after capture | Refused with `field-changed`; the other field remained empty. |
| Edge, caret moved within the original field after capture | Refused with `caret-changed`; original text remained unchanged. |
| Microsoft Word 16.0.20527.20150, new isolated instance, disposable RTF in Compatibility Mode, add-ins disabled with `/a` | Exact 28-UTF-16-unit multilingual suffix appended to the owned document. Document closed through Word's UI and discarded without saving. Other formats, add-ins and protected documents remain untested. |
| Visual Studio Code 1.141.0, new user-data/extensions directories, extensions disabled, accessibility support on, disposable text file | Exact 28-UTF-16-unit multilingual suffix appended. Test instance closed; the source fixture was not saved. Default accessibility detection, extensions, integrated terminals and remote workspaces remain separate cases. |
| ChatGPT logged-out web composer, isolated Edge profile, `chatgpt.com` | Exact multilingual fixture in the visible textarea. Zero conversation messages; no message submitted. Logged-in, alternate composer and desktop-app variants remain untested. |
| Windows PowerShell 5.1, classic console host, disposable `Read-Host` prompt that never evaluates its input | Capture refused with `unsafe-field`. No input sent. This is a safe-refusal observation, not terminal dictation support. |

This adds 13 checks: nine browser insertion/refusal cases plus Word, VS Code, ChatGPT and console capture. All expected exact-text or refusal outcomes passed. Browser and ChatGPT screenshots were inspected locally.

## Method and privacy

Only uniquely identified, owned test windows received input. The harness verified foreground process/window identity before calling the installed helper; the helper independently verified its captured token. An initial Windows foreground-grant failure stopped the browser harness before insertion. Attaching the harness input thread to both the foreground and target threads resolved that setup issue without changing the app.

Browser automation used Playwright CLI with named isolated sessions and fresh accessibility snapshots. The local fixture was served only on loopback and contained no external resources. Word used `/x /a /q`; VS Code used an isolated profile with telemetry and updates off, extensions disabled, auto-save off and accessibility support on. Only the synthetic document/editor contents were read for exact comparison. The terminal fixture used `Read-Host`, not a command prompt capable of evaluating the inserted text.

No clipboard mutation, Enter event, user speech, API credential access or message submission occurred. Owned browser sessions, the fixture server, Word, VS Code and the terminal fixture were closed. Private profiles, raw screenshots and workstation-specific harness files remain ignored and are not release assets.

## Repeating the checks

1. Install the release identified above and verify its checksum. Use the helper from that installation, not an unrelated local build.
2. Create disposable documents and an isolated browser/editor profile. Make textarea, contenteditable, password, read-only and button fields in an owned local HTML fixture.
3. Focus and identify the exact test window. Send the native `capture` request, then `insert` with its opaque token, known single-line Unicode text and method `unicode`. Compare only the owned field's contents. Never send Enter.
4. For refusal cases, repeat capture then change the field/caret or reuse an already-consumed token. Verify refusal and unchanged destination contents. Do not weaken the guards to force compatibility.
5. Close only the owned fixtures and record application versions, method, exact-match/refusal result and remaining limits. Clipboard tests require the separate empty-clipboard fixture in `npm run test:native`.

## Still open

Notepad's installed direct-Unicode refusal was verified separately; its clipboard path remains unaccepted. Teams is installed, but no disposable authenticated message composer was available in this run; no Teams account or conversation was opened. Slack was not found at the usual per-user installation path. Clipboard paste in these third-party targets, elevated/protected apps, Windows Terminal and remote editors remain untested.

The [full QA record](../tests/manual-windows-qa.md) retains human English/Hindi/Hinglish speech, clean supported-machine installation, physical multi-monitor/device/suspend and screen-reader acceptance as open gates. Signing, naming and provider/support launch decisions remain in [commercial readiness](commercial-readiness.md). These results do not promote the unsigned prerelease to a stable commercial release.
