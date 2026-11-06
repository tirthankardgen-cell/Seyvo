# Contributing

Use Windows 11 x64, Node 26.13.0 LTS (or a compatible newer 26.x patch), npm and the .NET Framework 4.x C# compiler included with Windows. The native helper uses Windows Forms and UI Automation assemblies shipped with the framework. No Rust toolchain or .NET SDK is needed. See `AGENTS.md` and the two source requirements documents.

```powershell
npm ci
npm run dev
npm run check
npm run test:e2e
npm run dist:win
```

The portable `.tools` directory used on the initial workstation is not committed or required. Use your installed compatible Node. `build:native` invokes a fixed checked-in PowerShell build script; application runtime never invokes PowerShell or generated commands.

Write focused tests for state transitions, cancellation, provider/OS boundaries, privacy and persistence. Production code must not load mocks. E2E tests launch actual Electron windows with a disposable profile and may request local microphone access; they make no Google requests. Live acceptance requires configuring your own key in the app and recording observations without saving private speech.

`npm run test:native` uses a labelled disposable Windows Forms field and refuses input if another application has focus. Clipboard fixtures require an empty clipboard and otherwise skip; they never back up arbitrary user clipboard objects. `node scripts/test-install.mjs` intentionally uninstalls/reinstalls only the `.tools/installed` validation installation. `scripts/live-speech.ps1` and `scripts/test-live.mjs` provide the opt-in real-Google acceptance described in the QA record; the key must already be saved in the app and is never a command-line argument.

Use strict TypeScript and `npm run format`. Public methods must have narrow schemas. Never return saved secrets through IPC. Keep provider details out of UI state, avoid target-field content reads, do not claim a SendInput return value proves a successful paste. New settings must change real behavior and persist. New dependencies require a compatible license, pinned lockfile and an audit.

File bug reports with version, Windows build, target executable, steps and coarse error message. Redact keys, transcript and clipboard content. Include tests and update user-facing docs for behavior changes. Maintainers publish releases only through the checked release process; ordinary contributions do not need signing credentials.
