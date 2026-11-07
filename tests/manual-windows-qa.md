# Windows acceptance record

Host: Windows 11 Home Single Language, x64, build 26300; 7 November 2026. Display scale observed: 150%. These are workstation observations, not certification of other PCs or applications.

| Check | Observed result |
| --- | --- |
| Typecheck / lint / production build | Passed the final implementation gate. |
| GitHub Windows CI | Initial implementation passed [run 42299582189](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42299582189). The 0.1.1 cold-start patch passed [run 42301070076](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42301070076), including clean dependencies, runtime preparation, checks, E2E, audit and secret scan. |
| Development launch | The Vite loopback renderer and native helper loaded successfully with microphone off. |
| Core unit/integration tests | 41 passed in 0.1.3: PCM, validation, shortcuts, assembly, provider boundaries/vocabulary/failures, cues, cancellation, geometry, storage and redirected-profile recovery. Network/native services are mocked at this tier. |
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
| Browser / foreground refusal | An initial attempt correctly refused input when another window retained focus. A later isolated Edge textarea received synthetic Hindi/emoji via native Unicode input; see the 0.1.2 record below. |
| Suspend/resume / unplug during dictation / screen reader | Handling is implemented; full physical acceptance remains unperformed. |
| Signature / trademark | Installer unsigned; no signing certificate or formal trademark clearance supplied. |

Evidence files are generated locally under ignored artifacts/: native/results.txt, packaged/results.json, live/recorded-speech.json, live/microphone.json, screenshots, performance, SBOM and licenses. They contain coarse results, not credentials or private transcripts. Release checksums identify the final uploaded installer.

Current 0.1.3 installer SHA256: `ec235a8652540b7676851a3980c42af9c418497129f5152400cbe44ba79d0702`. File: `Seyvo-0.1.3-windows-x64-setup.exe`; build `4a9d663bee58`. Archived 0.1.2 hash: `c5a42c45f7d6dc8e7f82ac457e3c23e9685115bb57bbeb82fdfbb082c876384e`; archived 0.1.1 hash: `0824e2394499b6fc987b107316c181268937d59f350106d3e33863ab5e2179c0`; archived 0.1.0 hash: `3b67b030bcfbb81a6328dfdcf055354c6dd23d473ee2a52f0bbff48446a7611b`. Builds are unsigned.

## Reproduce

Run `npm run check`, `npm run test:e2e`, `npm run test:native`, `npm run dist:win` and `npm run test:packaged`. Desktop tests must run sequentially because they own foreground focus. Native clipboard fixtures run only if the clipboard is empty; otherwise those cases report SKIP. The test never clears or backs up arbitrary user clipboard data.

For opt-in live acceptance, install into .tools/installed, save a user-owned key through the app, disable history, and resolve any existing recovery. Run `powershell -NoProfile -File scripts/live-speech.ps1`, then `node scripts/test-live.mjs`. It uses the saved key without retrieving it into the test runner. `--hardware` plays the fixture through speakers; `--human` records a spoken sentence for 15 seconds. Google charges/quotas apply. Do not run tests while editing another app; only the labelled test field is a valid destination.

## Test-harness incident

An early extended clipboard fixture attempted to retain an OLE data object and could not restore it after replacing the clipboard. That fixture was removed. The current test uses only an empty clipboard, creates known synthetic content, and conditionally removes only its own content. The supplied screenshot was copied back to the workstation clipboard and verified at 1512 × 1071. This incident is not reported as successful clipboard preservation.

## 0.1.2 source validation

33 unit/integration tests passed, including opt-in vocabulary/provider limits, cue defaults/order, migration defaults and negative/tiny monitor geometry. Six Electron scenarios cover the original UI/security/physical-microphone test plus four emulated scale factors and crash/suspend/lock/close-to-tray/second-instance behavior. Settings survive complete process restarts; caption bounds and non-focusability are asserted. A recorder crash exposed a retained hidden window, which is now destroyed and covered by regression testing. A test-launcher error in the second-instance fixture was corrected to launch the actual Electron executable.

Native Unicode, one-shot refusal, read-only refusal and non-editable-button refusal passed with the tightened guard. Clipboard mutation fixtures reported SKIP because the current clipboard was occupied; it was preserved. An isolated Edge textarea received a synthetic Hindi/emoji Unicode string. A Notepad attempt was interrupted by a Windows security prompt and did not match the fixture; it is not an accepted target yet. No firewall permissions were changed.

100%, 125%, 150% and 200% scaling here are Chromium/Electron emulation on the current workstation, combined with 200% page zoom. Native surface screenshots were inspected. This does not certify physical monitor/DPI switching or screen-reader behavior. Sound preview reached the Windows playback API; physical audibility/mute acceptance remains distinct.

The specification-to-evidence mapping and remaining gaps are maintained in `docs/requirements-evidence.md`.

## 0.1.2 installed and CI acceptance

Build `a98442b9f1af` passed [GitHub Windows CI 42306352059](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42306352059), including all 33 unit/integration and six Electron tests, audit and secret scan. An initial CI failure identified a race between a synthetic caption fixture and real level broadcasts; the test now drains the recorder before checking static captions.

The installed 0.1.2 app successfully tested the saved encrypted key against Google and completed generated speech through the production worklet, live Google and original Windows Forms field. All 55 finalized characters matched; F8 start/stop used real Windows events and the microphone stopped. This remains file-backed capture, not human speech. No transcript or credential was saved to the result artifact.

Upgrade, packaged resources, production fuses, development-URL rejection, startup roundtrip, physical microphone open/stop and uninstall/reinstall passed. Startup registration was removed on uninstall; encrypted key presence and settings survived reinstall. Full dependency audit: zero vulnerabilities. Source and bundled application scans found no credential patterns. The installer is unsigned.

## 0.1.3 source validation

Typecheck, lint, production build, 41 unit/integration tests and eight Electron scenarios passed. Added provider setup rejection (401/403/404/429/500/503), missing setup timeout and disconnect-during-finalization coverage with late-event suppression. A compiled loopback provider test verifies a rejected replacement leaves the encrypted key unchanged and the previous key can still be tested.

Physical microphone discovery produced usable device IDs; selecting one opened and stopped that input. The dashboard remains denied direct microphone access. Simulated permission denial shows an actionable error and destroys the hidden recorder; an unavailable synthetic device selection recovers by selecting Windows default. These simulations do not claim physical device unplug or human speech acceptance.

The user deferred the physical spoken test and requested continued automated testing. Human speech remains pending.

Build `a9280db39247` passed [Windows CI 42309748565](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42309748565). Installed microphone selection, production fuses, development-URL rejection, startup roundtrip and generated speech through live Google/native input passed. All 55 finalized characters matched the original Windows Forms field. Upgrade and uninstall/reinstall retained encrypted key presence/preferences and removed startup registration. The packaged test harness now lets its debug evaluation finish before quitting and requires a zero process exit within ten seconds; the earlier debug-connection shutdown hang is not counted as a clean-exit pass.

An additional test used the installed native helper against the uniquely identified `Seyvo-acceptance-synthetic.txt` Notepad tab. Direct Unicode input did not exactly append the known fixture (22 UTF-16 units received for a 32-unit fixture in the repeat). No other document or clipboard was used, and no Enter was sent. This is a failed compatibility observation, not a Notepad acceptance pass. Clipboard mode there remains untested.

The subsequent fix refuses direct Unicode for Notepad before sending keys. A real Windows test of the compiled helper confirmed the specific refusal and exact unchanged field contents. A broader IME check was investigated and rejected because Windows also reported stock keyboard layouts as IMEs on this host; no general IME rule or input-language change is shipped. Native Windows Forms Unicode/Hindi/emoji and existing safety tests still pass.

## 0.1.3 final installer acceptance

Final build `4a9d663bee58` passed [GitHub Windows CI 42311811558](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42311811558): checks, 41 unit/integration tests, eight Electron scenarios, dependency audit, secret scan and supply-chain reports. The installer is 124,706,087 bytes; its SHA256 is recorded above and Authenticode reports NotSigned.

The exact installed build passed microphone discovery and selecting/opening/stopping an actual input, startup readback, fuses, renderer isolation and development-URL rejection. The saved key tested successfully against real Google. Generated speech through the production worklet and provider inserted exactly 55 finalized characters into the original native field using physical F8 start/stop events. Microphone stop and clean process exit were verified. This remains generated file-backed speech, not live human speech.

Upgrade and uninstall/reinstall passed with settings and encrypted key presence retained, startup registration removed, native helper available and clean exit. The installed Notepad direct-input guard refused the request and left the owned test field exactly unchanged; no clipboard mutation or Enter event was used. Native clipboard fixtures were skipped because the desktop clipboard was occupied. Source, Git history and bundled application credential-pattern scans passed. Human/clean-machine/broader-target and commercial gates remain open.

The public [v0.1.3 release](https://github.com/tirthankardgen-cell/Seyvo/releases/tag/v0.1.3) was published as an unsigned prerelease with installer, checksums, SBOM and license inventory. Its tag resolves to `4a9d663bee589df0050aa1014387f776b2c44e04`. The complete hosted installer was downloaded again (124,706,087 bytes); SHA256 matched `ec235a8652540b7676851a3980c42af9c418497129f5152400cbe44ba79d0702`. Repository documentation links were checked; no missing local link target was found.

## Release gate

Source and an explicitly labelled unsigned validation prerelease may be shared. Do not promote a stable commercial release until live human speech, relevant target applications, clean-machine installation and the chosen support matrix are accepted, and the owner addresses signing and brand clearance.

## 0.1.4 source acceptance

Typecheck, lint, production build, 49 unit/integration tests and all nine Electron scenarios passed. Near-caret/custom placement, safe fallback/bounds, native caret geometry, custom coordinate persistence, no-microphone preview and preview/recording races are covered. The post-fix E2E run completed in 47.1 seconds.

The Codex Security Standard scan of revision `7128c2cb20ceeb1467935fbf06864bb1752f3bc5` completed with one low-severity cancellation race. Five regression cases reproduced it before remediation and passed afterward: cancelled paste, Unicode and copy during history persistence, shutdown during persistence, and a late failure after a new recording. A distinct delivery identity now survives capture cleanup and is revoked before pending output. See `docs/security-review-0.1.4.md`; the original scan is not described as a no-findings report.

Native clipboard mutation fixtures continue to require an empty clipboard; occupied user clipboard contents are preserved. The user's physical spoken acceptance remains deferred at their request.
