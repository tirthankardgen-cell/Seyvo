# Windows acceptance record

Host: Windows 11 Home Single Language, x64, build 26300; 7 November 2026. Display scale observed: 150%. These are workstation observations, not certification of other PCs or applications.

| Check | Observed result |
| --- | --- |
| Typecheck / lint / production build | Passed the final implementation gate. |
| GitHub Windows CI | Initial implementation passed [run 42299582189](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42299582189). The 0.1.1 cold-start patch passed [run 42301070076](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42301070076), including clean dependencies, runtime preparation, checks, E2E, audit and secret scan. |
| Development launch | The Vite loopback renderer and native helper loaded successfully with microphone off. |
| Core unit/integration tests | 27 passed: PCM, validation, shortcuts, assembly, provider boundaries, cancellation, storage and redirected-profile recovery. Network/native services are mocked at this tier. |
| Electron E2E | Passed. Real app UI, persistence, renderer isolation, malformed/unauthorized IPC, Windows encryption, compiled WebSocket/vault loopback test and physical microphone open/stop. Google is mocked only for the loopback test. |
| Live Google key/model access | Passed from the installed app, using a user-owned key kept in the encrypted Windows profile. Exact model: gemini-3.5-transcribe-live. |
| Packaged speech → Google → original field | Passed using a generated speech WAV through Chromium capture, the production recorder/worklet, real Google and real Win32 input. Both shortcut activations used Windows input events. Recognized and inserted text matched; microphone stopped. No provider mock or transcript artifact. |
| Physical microphone speech | Hardware opens/stops. A generated sentence played through the laptop speakers produced no recognized speech. A live human-spoken check remains pending; do not describe file-backed capture as a physical-microphone speech pass. |
| Native direct Unicode | Passed in an owned Windows Forms field, including Hindi and emoji. |
| Native clipboard paste | Passed with synthetic clipboard data: multiline Hindi/emoji preserved and the previous synthetic clipboard restored. |
| Concurrent clipboard change | Passed: a synthetic copy during insertion was preserved, not overwritten by restoration. Busy clipboard recovery is also a valid safe result. |
| Duplicate / read-only / unsupported clipboard | One-shot token and read-only refusal passed. Unsupported existing formats were refused before mutation during earlier workstation runs. |
| Installed resources / fuses / IPC isolation | Passed: native helper loaded; renderer Node disabled; production fuses inspected; packaged app ignored an untrusted development-renderer environment override. |
| Installed startup | Enable/disable with OS readback passed. |
| Install / upgrade / uninstall / reinstall | 0.1.0 passed install/uninstall/reinstall, including startup cleanup and retained encrypted key/preferences. Upgrade to 0.1.1 passed and its packaged smoke/live tests were rerun successfully. |
| Dependency audit | Full npm audit: zero vulnerabilities. Runtime CycloneDX SBOM and complete lockfile license inventory generated. |
| Screenshots / performance | Real screenshots captured. One development measurement is published in docs/performance-sample.json; it is not a broad performance or memory guarantee. |
| Windows 10 / clean Windows 11 VM | Not performed. |
| Hindi / Hinglish cloud recognition | Not yet empirically accepted. Unicode insertion was tested separately. |
| Multi-monitor / negative origin / 100–200% physical scaling | Only the current 150% desktop was observed. Broader matrix remains untested. |
| Notepad / browser / VS Code / Word / chat / terminals | The owned native text field is verified. Individual third-party targets remain acceptance work; custom, protected, remote and elevated targets can require Copy. |
| Browser attempt / foreground refusal | An isolated Edge textarea was opened, but another Windows window retained foreground focus. The test guard refused input. No browser insertion pass is claimed. |
| Suspend/resume / unplug during dictation / screen reader | Handling is implemented; full physical acceptance remains unperformed. |
| Signature / trademark | Installer unsigned; no signing certificate or formal trademark clearance supplied. |

Evidence files are generated locally under ignored artifacts/: native/results.txt, packaged/results.json, live/recorded-speech.json, live/microphone.json, screenshots, performance, SBOM and licenses. They contain coarse results, not credentials or private transcripts. Release checksums identify the final uploaded installer.

Current 0.1.1 installer SHA256: `0824e2394499b6fc987b107316c181268937d59f350106d3e33863ab5e2179c0`. File: `Seyvo-0.1.1-windows-x64-setup.exe`. The archived 0.1.0 installer hash is `3b67b030bcfbb81a6328dfdcf055354c6dd23d473ee2a52f0bbff48446a7611b`. Builds are unsigned.

## Reproduce

Run `npm run check`, `npm run test:e2e`, `npm run test:native`, `npm run dist:win` and `npm run test:packaged`. Desktop tests must run sequentially because they own foreground focus. Native clipboard fixtures run only if the clipboard is empty; otherwise those cases report SKIP. The test never clears or backs up arbitrary user clipboard data.

For opt-in live acceptance, install into .tools/installed, save a user-owned key through the app, disable history, and resolve any existing recovery. Run `powershell -NoProfile -File scripts/live-speech.ps1`, then `node scripts/test-live.mjs`. It uses the saved key without retrieving it into the test runner. `--hardware` plays the fixture through speakers; `--human` records a spoken sentence for 15 seconds. Google charges/quotas apply. Do not run tests while editing another app; only the labelled test field is a valid destination.

## Test-harness incident

An early extended clipboard fixture attempted to retain an OLE data object and could not restore it after replacing the clipboard. That fixture was removed. The current test uses only an empty clipboard, creates known synthetic content, and conditionally removes only its own content. The supplied screenshot was copied back to the workstation clipboard and verified at 1512 × 1071. This incident is not reported as successful clipboard preservation.

## Release gate

Source and an explicitly labelled unsigned validation prerelease may be shared. Do not promote a stable commercial release until live human speech, relevant target applications, clean-machine installation and the chosen support matrix are accepted, and the owner addresses signing and brand clearance.
