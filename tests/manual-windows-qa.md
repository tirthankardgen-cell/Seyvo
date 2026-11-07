# Windows acceptance record

Host: Windows 11 Home Single Language, x64, build 26300; 7 November 2026. Display scale observed: 150%. These are workstation observations, not certification of other PCs or applications.

| Check | Observed result |
| --- | --- |
| Typecheck / lint / production build | Passed the final implementation gate. |
| GitHub Windows CI | Release source `3b65c52eb47a` passed [run 42348439528](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42348439528), including clean dependencies, checks, 11 Electron scenarios, audit, secret scan and supply-chain reports. Earlier results remain below. |
| Development launch | The Vite loopback renderer and native helper loaded successfully with microphone off. |
| Core unit/integration tests | 51 passed in 0.1.6: PCM, validation, shortcuts, assembly, repeated dictation, provider boundaries/vocabulary/failures, cues, cancellation, geometry, storage and redirected-profile recovery. Network/native services are mocked at this tier. |
| Electron E2E | Passed. Real app UI, persistence, renderer isolation, malformed/unauthorized IPC, Windows encryption, compiled WebSocket/vault loopback test and physical microphone open/stop. Google is mocked only for the loopback test. |
| Live Google key/model access | Passed from the installed app, using a user-owned key kept in the encrypted Windows profile. Exact model: gemini-3.5-transcribe-live. |
| Packaged speech → Google → original field | Final 0.1.6 build passed two consecutive generated-speech sessions through the production recorder/worklet, real Google and native Win32 input. First 55, then 110 cumulative characters exactly matched finalized output. Real shortcut events, microphone stop and clean exit passed; no Dismiss between sessions. No provider mock or transcript artifact. |
| Physical microphone speech | Hardware opens/stops. The user subsequently reported successful human dictation through 0.1.5. This is a user report, not an independently compared speech fixture. Wider spoken-language acceptance remains open; do not describe file-backed capture as a physical-microphone speech pass. |
| Native direct Unicode | Passed in an owned Windows Forms field, including Hindi and emoji. |
| Native clipboard paste | Passed with synthetic clipboard data: multiline Hindi/emoji preserved and the previous synthetic clipboard restored. |
| Concurrent clipboard change | Passed: a synthetic copy during insertion was preserved, not overwritten by restoration. Busy clipboard recovery is also a valid safe result. |
| Duplicate / read-only / unsupported clipboard | One-shot token and read-only refusal passed. Unsupported existing formats were refused before mutation during earlier workstation runs. |
| Installed resources / fuses / IPC isolation | Passed: native helper loaded; renderer Node disabled; production fuses inspected; packaged app ignored an untrusted development-renderer environment override. |
| Installed startup | Enable/disable with OS readback passed. |
| Install / upgrade / uninstall / reinstall | Final 0.1.6 passed interactive reinstall: both desktop/Run options default checked, both opt-outs respected, correct desktop target and Finish launches directly with microphone off. Encrypted key/settings hashes unchanged. Prior versions passed uninstall/startup cleanup and retained-profile reinstall; final 0.1.6 uninstall was not repeated. |
| Dependency audit | Full npm audit: zero vulnerabilities. Runtime CycloneDX SBOM and complete lockfile license inventory generated. |
| Screenshots / performance | Real screenshots captured. One development measurement is published in docs/performance-sample.json; it is not a broad performance or memory guarantee. |
| Windows 10 / clean Windows 11 VM | Not performed. |
| Hindi / Hinglish cloud recognition | Not yet empirically accepted. Unicode insertion was tested separately. |
| Multi-monitor / negative origin / 100–200% physical scaling | Only the current 150% desktop was observed. Broader matrix remains untested. |
| Notepad / browser / VS Code / Word / chat / terminals | Installed 0.1.4 exact Unicode input passed in Edge textarea/contenteditable, an isolated Word RTF, isolated VS Code editor and logged-out ChatGPT composer. Classic PowerShell console capture was safely refused. See the [versioned target matrix](../docs/target-acceptance-0.1.4.md) for exact configurations and remaining limits. Notepad Unicode remains refused; third-party clipboard paths remain unaccepted. |
| Browser / foreground refusal | An initial attempt correctly refused input when another window retained focus. A later isolated Edge textarea received synthetic Hindi/emoji via native Unicode input; see the 0.1.2 record below. |
| Suspend/resume / unplug during dictation / screen reader | Handling is implemented; full physical acceptance remains unperformed. |
| Signature / trademark | Installer unsigned; no signing certificate or formal trademark clearance supplied. |

Evidence files are generated locally under ignored artifacts/: native/results.txt, packaged/results.json, live/recorded-speech.json, live/microphone.json, screenshots, performance, SBOM and licenses. They contain coarse results, not credentials or private transcripts. Release checksums identify the final uploaded installer.

Archived 0.1.3 installer SHA256: `ec235a8652540b7676851a3980c42af9c418497129f5152400cbe44ba79d0702`. File: `Seyvo-0.1.3-windows-x64-setup.exe`; build `4a9d663bee58`. Archived 0.1.2 hash: `c5a42c45f7d6dc8e7f82ac457e3c23e9685115bb57bbeb82fdfbb082c876384e`; archived 0.1.1 hash: `0824e2394499b6fc987b107316c181268937d59f350106d3e33863ab5e2179c0`; archived 0.1.0 hash: `3b67b030bcfbb81a6328dfdcf055354c6dd23d473ee2a52f0bbff48446a7611b`. Builds are unsigned.

## Reproduce

Run `npm run check`, `npm run test:e2e`, `npm run test:native`, `npm run dist:win` and `npm run test:packaged`. Desktop tests must run sequentially because they own foreground focus. Native clipboard fixtures run only if the clipboard is empty; otherwise those cases report SKIP. The test never clears or backs up arbitrary user clipboard data.

For opt-in live acceptance, install the current build, save a user-owned key through the app, disable history, and resolve any existing recovery. Run `powershell -NoProfile -File scripts/live-speech.ps1`, then `node scripts/test-live.mjs --executable=D:\Seyvo\Seyvo.exe --repeat`, substituting the actual installation path. It uses the saved key without retrieving it into the test runner. `--hardware` plays the fixture through speakers; `--human` records a spoken sentence for 15 seconds. Google charges/quotas apply. Do not run tests while editing another app; only the labelled test field is a valid destination. Pass the same executable path to `node scripts/test-packaged.mjs` for the isolated packaging smoke test.

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

The historical v0.1.3 release was published as an unsigned prerelease with installer, checksums, SBOM and license inventory, from `4a9d663bee589df0050aa1014387f776b2c44e04`. Its release and tag were withdrawn during 0.1.6 cleanup. The complete hosted installer was downloaded again at the time (124,706,087 bytes); SHA256 matched `ec235a8652540b7676851a3980c42af9c418497129f5152400cbe44ba79d0702`. Repository documentation links were checked; no missing local link target was found.

## Release gate

Source and an explicitly labelled unsigned validation prerelease may be shared. Do not promote a stable commercial release until live human speech, relevant target applications, clean-machine installation and the chosen support matrix are accepted, and the owner addresses signing and brand clearance.

## 0.1.4 source acceptance

Typecheck, lint, production build, 49 unit/integration tests and all nine Electron scenarios passed. Near-caret/custom placement, safe fallback/bounds, native caret geometry, custom coordinate persistence, no-microphone preview and preview/recording races are covered. The post-fix E2E run completed in 47.1 seconds.

The Codex Security Standard scan of revision `7128c2cb20ceeb1467935fbf06864bb1752f3bc5` completed with one low-severity cancellation race. Five regression cases reproduced it before remediation and passed afterward: cancelled paste, Unicode and copy during history persistence, shutdown during persistence, and a late failure after a new recording. A distinct delivery identity now survives capture cleanup and is revoked before pending output. See `docs/security-review-0.1.4.md`; the original scan is not described as a no-findings report.

Native clipboard mutation fixtures continue to require an empty clipboard; occupied user clipboard contents are preserved. The user's physical spoken acceptance remains deferred at their request.

## 0.1.4 final installer acceptance

Build `9839000c6cfd` passed [GitHub Windows CI 42316720466](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42316720466), including clean dependencies, typecheck/lint/build, 49 unit/integration tests, nine Electron scenarios, dependency audit and source credential-pattern scan. The unsigned installer is `Seyvo-0.1.4-windows-x64-setup.exe`, 124,707,747 bytes, SHA256 `a762ef343dafbac103bbedf32ecbb6173d27de1825c4145014c52daff5744fcc`.

The exact installed build passed startup roundtrip, physical microphone discovery/selection/open/stop, production fuses, local-renderer enforcement despite a malicious development URL, and clean exit. The saved encrypted user key tested successfully against real Google. Generated speech traversed the installed recorder/worklet and provider; all 55 finalized characters matched the original Windows Forms field. F8 start/stop used real Windows events. Caret placement was enabled and its bubble screenshot was inspected. Capture stopped and the app exited cleanly; no key or transcript entered the result artifact.

Upgrade and uninstall/reinstall retained settings and encrypted-key presence, removed startup registration and relaunched the native helper successfully. The installed Notepad Unicode guard refused before input and left the owned synthetic field exactly unchanged. Native caret geometry, Unicode/Hindi/emoji and one-shot/read-only/non-text refusal passed. Clipboard restoration/race fixtures reported SKIP because the user's clipboard was occupied; it was not replaced.

The [packaged benchmark](../docs/packaged-performance-0.1.4.json) measured 832 ms readiness and 0.270% of one core over 11,569 ms idle on this workstation. Microphone remained off, both external TCP samples were zero, the dashboard was hidden to tray and exit was clean. This is a single fresh-profile packaged sample with CDP overhead and possible warm OS cache, not a battery/cold-boot/clean-machine guarantee.

Full dependency audit reported zero vulnerabilities. Source, 15 Git revisions and bundled own-code credential-pattern scans passed. That release included installer, checksums, runtime CycloneDX SBOM and the complete 520-package lockfile license inventory. The historical unsigned v0.1.4 prerelease was built from `9839000c6cfdb858c121f1de98af18bca277b50d`; its release and tag were withdrawn during 0.1.6 cleanup.

Human speech remains deferred at the user's request. Clean-machine, wider physical/target/accessibility acceptance, signing and brand/provider launch decisions remain open. No stable commercial completion is claimed.

The full public 0.1.4 installer was downloaded again: 124,707,747 bytes, SHA256 `a762ef343dafbac103bbedf32ecbb6173d27de1825c4145014c52daff5744fcc`, matching the tested local installer. Fresh-profile onboarding and the installed live caret bubble screenshots were inspected and updated in the documentation.

## 0.1.4 additional target acceptance

The unchanged installed native helper passed 13 additional real target checks: nine Edge insertion/refusal cases and Word, VS Code, logged-out ChatGPT and a classic PowerShell console. Positive cases exactly preserved single-line Hindi, Bengali and emoji. The console was refused before input; browser password/read-only/button, duplicate token, moved field and moved caret cases also refused as expected. No clipboard mutation or Enter was used and no chat message was submitted. Owned fixtures were closed. These are native-input observations, separate from cloud recognition and human microphone acceptance. Versions, setup, privacy boundaries and outstanding cases are recorded in [target acceptance](../docs/target-acceptance-0.1.4.md).

## 0.1.4 installed file-dialog and history acceptance

`npm run test:files` passed 11 checks against installed build `9839000c6cfd`, using real Windows Open/Save dialogs and a new paused profile with no API key. Dictionary export preserved Hindi/Bengali/emoji and a Unicode filename; import trimmed and deduplicated entries. Invalid structure, malformed JSON and a file above 256,000 bytes were rejected without changing the existing dictionary. Import/export cancellation preserved settings.

The test seeded known synthetic history with Electron's Windows encryption in that same isolated profile; it did not read or copy the user's history or key. The installed app loaded the encrypted entries, omitted an expired entry, searched Bengali text, exported exact multiline Unicode through the native Save dialog, deleted one selected entry and removed encrypted storage after confirmed Clear. This tests history management from an encrypted fixture, not live provider-to-history creation. The app exited cleanly, and neither microphone nor clipboard was used.

The maintained runner is `scripts/test-file-dialogs.mjs`, with narrowly scoped Windows dialog and encryption fixtures in `tests/native`. Native filename/action controls are checked against the owned process, dialog, control class and ID; output paths must stay in the new fixture directory. The first harness attempts stopped on common-dialog UI Automation differences, then passed after using verified native controls. Synthetic profiles/exports stay under ignored `.tools/seyvo-files-*`; coarse results go to `artifacts/file-dialogs/results.json`.

This is an interactive Windows workstation test, separate from the nine Electron CI scenarios. No runtime code or published 0.1.4 installer was changed. Clipboard tests remain deferred because the desktop clipboard is occupied. No code-signing certificate/configuration or local Sandbox/Hyper-V/VirtualBox/VMware CLI was available during this check. Human speech remains deferred at the user's request; remaining release gates are unchanged.

## 0.1.4 dashboard release visual

The README now includes the requested real dashboard alongside onboarding and overlay captures. `docs/assets/dashboard.png` was captured from the installed 0.1.4 Home window at the workstation's physical 150% scale, with microphone off, history off and no transcript or credential visible. The normal Start using Seyvo action completed the setup UI after the already-recorded key, microphone-open, shortcut and generated-speech checks. This changes onboarding visibility only; human-spoken acceptance remains deferred. The complete client-area image was inspected before publication; it is not a mockup or a claim of a new speech test.

## 2026-11-07 — reported quiet input and hidden recovery

The user confirmed speaking into the built-in laptop microphone during a local production-recorder test. Windows selected the Intel Smart Sound microphone array, unmuted, at 100% input volume, with both microphone consent settings allowed. The isolated installed recorder received 255 level samples; its maximum observed RMS was 0.4715%, with no capture error and verified microphone stop/clean exit. The previous integer percentage display rounded this to zero. This was an amplitude check, not a speech-recognition pass.

A separate local Electron comparison started through an explicit Start button measured the same default device for 12 seconds with normal processing and 12 seconds with processing disabled. Maximum RMS was 1.6145% with processing (sample peak 6.8725%) and 0.4071% without it (sample peak 1.4214%). Neither track was muted and both closed. These are different capture intervals, not an identical-input laboratory comparison. They establish audio input, but not intelligible speech or hardware health under every condition. No audio file, Google request, key access or clipboard operation was used.

The original installed session had completed segments waiting after a Google finalization timeout. UI Automation then observed the refusal message after shortcut activation; new dictation was blocked by the existing recovery. The user requested keeping those words. They were not read into test output, copied, saved or dismissed, and the original app was not restarted. The timeout's provider cause remains unresolved; the feedback changes do not claim to fix it.

The 0.1.5 source gate passed typecheck, lint, build, all 50 unit/integration tests and all 10 Electron scenarios. The new regression invokes the actual registered main-process shortcut callback, uses an owned Windows Forms field, synthetic capture and a loopback provider to create recovery, and verifies that a blocked activation reopens the dashboard, preserves both text and failure reason, leaves the microphone off, and shows an actionable recovery banner. The bubble reports recovery without receiving its text. This is separate from physical keyboard delivery and real Google acceptance. The fixture initially depended on Chromium focus/accessibility timing; replacing that target with the existing owned native fixture resolved that test setup failure without weakening production target checks.

Candidate source `a6a0b18ef4af` produced `dist/Seyvo-0.1.5-windows-x64-setup.exe`, SHA256 `93e68bfc87de22e4ab193f49185216ccdb72a3210275f95d96736bfe03eafbb6`. The matching unpacked production binary passed the isolated packaged smoke test: native helper, physical microphone discovery/selection/open/stop, startup readback/cleanup, renderer isolation, production fuses, ignored development-URL override and clean exit. The bundle and source credential-pattern scans passed; the full dependency audit found zero vulnerabilities and the 520-package inventory/SBOM were regenerated. No 0.1.5 install/upgrade or live Google test was performed over the user's running recovery session. The candidate is unsigned and is not a stable-release acceptance claim.

## 2026-11-07 — 0.1.6 repeated dictation and shortcut feedback

The user subsequently ran 0.1.5 from `D:\Seyvo` and reported dictating their feedback through it successfully. This is a user-reported human speech observation, not an independently compared transcript. They clarified that saving a shortcut lacked feedback and that completed insertion left a result which blocked the next activation. They explicitly requested replacing the previous in-memory result on a new dictation. This supersedes the earlier request to preserve that result indefinitely.

The 0.1.6 source passed typecheck, lint, build, 51 unit/integration tests and all 11 Electron scenarios. The Windows regression retains a provider-failure result, starts again without Dismiss, and inserts two consecutive finalized results into the same owned native field without opening the dashboard. Audio/provider events are synthetic in this test; actual Windows Unicode input is used and the user's clipboard is untouched. A separate UI regression saves Ctrl+Alt+Space while paused, verifies the file and confirmation/disabled button, activates F6, refuses a conflicting F12 without losing F6, then verifies F6 after restart. F12 may be reserved by Windows, so the fixture treats that as an existing conflict.

The old 0.1.0–0.1.4 local installers/blockmaps/download-check copies and unused `.tools/installed` 0.1.4 runtime were removed after resolved-path and process checks. Fifteen installer-related files plus the runtime accounted for 1,660,696,178 bytes. The live `D:\Seyvo` 0.1.5 copy, credentials and preferences were retained. Stale Start menu/uninstall references were repaired to that live installation before its upgrade.

## 0.1.6 final installer and live acceptance

Release source `3b65c52eb47ab7ff5a3635b4f9eb4a2ec2e5a703` passed the core gate (51 unit/integration tests, typecheck, lint and build), 11 local Electron scenarios and [Windows CI 42348439528](https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42348439528). The initial shortcut-save CI test raced persistence; it now waits for the saved confirmation and binding before resuming. The corrected final run passed. The final installer is 124,739,830 bytes, SHA256 `8f7c70a5389888ca5b36e0fb6cef697299b0f67c68b7fe19640ed9861e252bbd`, with Authenticode NotSigned.

The new NSIS options page initially failed compilation because its functions expanded before MUI definitions; expansion now occurs at the custom-page hook. A real setup launch then exposed a shell-link lookup error. Finish now launches the installed executable directly as the current user. Tests drove only owned installer controls by their verified native handles; asynchronous button notifications avoid blocking on NSIS modal pages. Windows exposed several controls as UI Automation panes, so control type alone was insufficient for this test harness.

Two complete interactive reinstalls of the final artifact passed. Create a desktop shortcut and Run Seyvo were checked by default in both. With both unchecked, no desktop link was created and the app remained closed. With both checked, `D:\Desktop\Seyvo.lnk` targeted `D:\Seyvo\Seyvo.exe`, Finish opened the app, and its visible UI reported Microphone off. Setup exited with code zero. Encrypted key and preferences matched their pre-install hashes in both cases. Coarse local evidence: `artifacts/installer-optout.json` and `artifacts/installer-defaults.json`. This is an upgrade on the current workstation, not a clean-machine acceptance pass. Silent setup does not promise automatic launch.

The exact installed build `3b65c52eb47a` passed native resources, production fuses, renderer isolation, development-URL rejection, startup roundtrip, actual microphone discovery/selection/open/stop and clean exit. The real Google repeat runner then inserted 55 finalized characters in session one and 55 more in session two, with exact 110-character cumulative agreement in the same owned Windows Forms field. Both sessions returned to idle; microphone stop and clean app exit passed. No Copy or Dismiss was required between them. The capture source was generated speech through Chromium and the real worklet, and the insertion method was Unicode, leaving the user's clipboard untouched.

An earlier repeat on build `a42868978054` safely refused a changed/unavailable target; that run is not counted as a pass. The final repeat kept the owned target focused and passed without weakening target checks. Human speech success remains the separate user report described above, with broader language/physical acceptance still open.

After verification, Ctrl+Alt+Space was configured and its registered state/disabled Save button verified. The installed Home screenshot `docs/assets/dashboard-0.1.6.png` was inspected: microphone off, history off, no recovery text or credential visible. The normal app was reopened without debugging flags. Source and bundled-code credential-pattern scans passed; the full audit found zero vulnerabilities and the 520-package license inventory/runtime SBOM were regenerated. Signing, fresh-machine, broader accessibility/physical/target acceptance and owner-controlled launch decisions remain open.

The [public 0.1.6 prerelease](https://github.com/tirthankardgen-cell/Seyvo/releases/tag/v0.1.6) was published with installer, checksums, SBOM and license inventory. Its complete public download returned 124,739,830 bytes and matched SHA256 `8f7c70a5389888ca5b36e0fb6cef697299b0f67c68b7fe19640ed9861e252bbd`. The cached installer also matched. Published v0.1.0–v0.1.4 releases, their 20 assets and version tags were then deleted; GitHub readback showed only v0.1.6. No 0.1.5 release had been published. The remaining local 0.1.5 installer/blockmap were removed; local installer directories and the current installed application now contain only version 0.1.6. Source history, preferences and encrypted credentials were retained. The release tag preserves the exact packaging source; subsequent documentation records the completed publication checks.
