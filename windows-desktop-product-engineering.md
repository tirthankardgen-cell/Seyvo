---
name: windows-desktop-product-engineering
description: >
  Design, implement, harden, test, package, and release polished production-grade
  Windows desktop applications. Framework-agnostic guidance for Electron/React,
  Tauri/Rust, WinUI/.NET, WPF, Qt, Flutter, and native Windows integrations.
---

# Windows Desktop Product Engineering

**Reusable engineering skill for Codex and other coding agents.** Not specific to any one product. Apply it to utilities, productivity apps, creative tools, dashboards, developer applications, system tray utilities, desktop AI clients, and commercial/open-source Windows software.

## When to use this skill

Invoke this skill whenever a task involves creating, modernizing, auditing, packaging, or distributing a Windows desktop application. Especially relevant when there are native OS features, background processes, installers, auto-start, secure credentials, global shortcuts, accessibility requirements, multiple windows, or long-running tasks.

This skill is a **quality and execution policy**, not a requirement to use Electron. Select the stack to fit the actual product, licensing, team expertise, and deployment constraints.

## Agent operating procedure

1. **Read the goal, then inspect the repo.** Identify current architecture, target OS builds, code quality, dependencies, tests, delivery format, legal constraints, and actual Windows integration needs.
2. **Produce a concise technical plan** in repository notes: data flow, security boundary, process lifetimes, UI states, tests, milestones and blockers. Prefer implementing a real user-facing vertical slice over producing extensive untested boilerplate.
3. **Verify changing third-party APIs** against their official current docs and installed type definitions. Avoid guessing package exports or shipping deprecated APIs.
4. **Develop iteratively:** scaffold → core integration → reliability → settings/state → visual polish → packaging → tests on a clean Windows machine.
5. **Treat user-facing toggles as contracts:** a toggle must affect behavior, persist appropriately, reflect OS state after restart, and have failure feedback. A beautifully styled inert setting is a bug.
6. **Run validation** after each milestone: format, lint, typecheck, automated tests, builds, packaging smoke test.
7. **Never fabricate test results.** Clearly separate mocked tests, runtime tests, native Windows manual validation, and release readiness.
8. **Document handoff:** exact scripts, architecture, security choices, installer output, supported systems, known limitations, and what remains untested.

## 1. Stack selection (decision matrix)

| Stack | Prefer when | Key risks / cautions |
|---|---|---|
| **Electron + React/TypeScript** | Rich modern Chromium UI, web-focused team, cross-platform path, complex UI | App size/memory, main/renderer security, IPC, native addon rebuilds, packaging and focus management |
| **Tauri + React/TypeScript + Rust** | Small binaries/resource footprint, web UI + strong native Rust backend | WebView2 availability/version, Rust/Windows bridge complexity, plugin/API compatibility |
| **WinUI 3 + .NET/C#** | Deep Windows 11 look/feel, Windows-only long-term product, native UI and accessibility | Windows App SDK and MSIX/deployment complexity, expertise and compatibility |
| **WPF + .NET** | Mature business apps, Windows-only, stable tooling/ecosystem | Modern appearance requires deliberate styling, old patterns/dispatcher misuse |
| **Qt (C++ or Python)** | Desktop-heavy controls, custom rendering, native/system integration | Commercial license obligations, binary/runtime deployment, C++/binding quality |
| **Flutter Desktop** | Custom-rendered consistent UI and broader platform ambition | Native Windows plugin maturity, integration complexity, platform conventions |

**Rule:** Don't select a framework simply because it sounds modern. For a UI-rich program with existing React expertise and moderate native integration, Electron is often appropriate. For a lightweight native-first tray utility, Tauri/WinUI may be better. Explain trade-offs and pick deliberately.

## 2. Product-design standard

- Identify users and their primary task. Optimize the main action to be discoverable and low-friction.
- Define first-run onboarding, daily workflow, idle state, loading state, success, cancellation, recoverable error, fatal error, offline state, and uninstall path.
- Design a coherent component system: typography scale, spacing tokens, radii, elevation, borders, focus rings, colors, semantic statuses, motion, light/dark/high-contrast themes.
- Prefer a refined native Windows sensibility over a generic SaaS website pasted inside a window. Use consistent window chrome, draggable regions, system context menus and native affordances.
- Use motion to communicate transitions and activity, not to disguise latency. Honor Windows reduced-motion settings.
- Keep resource usage modest; tray/background apps should not boot large UI windows needlessly.
- Have responsive layouts with minimum supported window sizes and 100%–200%+ display scaling.
- Avoid deceptive UI: fake charts, mock content labeled live, fake microphone meters, false status badges, disabled-in-disguise controls, mocked data in production.
- Build accessible keyboard and screen-reader paths, names for icon buttons, predictable tab order, contrast and focus visibility.
- Require real screenshot or screen capture from actual built app for release visuals; never invent proof of completion.

## 3. Windows OS fundamentals

### Lifecycle and process model

- Single-instance management; foreground existing window on subsequent launches.
- Correct behavior for Close vs Minimize vs Quit; document tray persistence.
- Distinguish **launched at login** from **running as a Windows service**; do not silently install services or require admin rights.
- Startup-at-login opt-in, with actual OS state verification; test through install/update/uninstall.
- Support suspend/resume, lock/unlock, network changes, user logoff, app termination and clean cancellation of background tasks.
- Release resources deterministically: audio tracks, sockets, file locks, OS handles, native listeners, timers, notification subscriptions.
- Treat shutdown paths as part of core functionality, not afterthoughts.

### Windows shell integration

- Tray icon behavior, context menus, Taskbar / Jump Lists where relevant, file associations/protocol handlers only with explicit need.
- Global hotkeys may conflict with system/app shortcuts; validate registration and offer rebind.
- DPI-awareness across screens, multiple monitors with negative coordinates, taskbar/work-area placement, focus and z-order.
- File dialogs, clipboard, notifications, native menus and shell links must respect OS permissions and user choice.
- Avoid simulating user input unless it is essential to the product and explicitly initiated.
- Windows integrity boundaries matter: standard user apps cannot reliably interact with elevated apps, UAC secure desktops or protected controls. Don't demand administrator access as a blanket workaround.

### Native interoperability

- When possible use documented platform APIs rather than process injection, untrusted hacks, unsafe PowerShell, or undocumented registry changes.
- If JS/UI framework lacks necessary functionality, isolate a minimal native bridge (Rust with `napi-rs`, .NET sidecar/PInvoke, or C++/Win32 module). Surface a small typed API.
- Check x64 vs ARM64, ABI compatibility, native module prebuilds, Windows update behavior, and signing.
- Audit every native handle's lifetime; centralize ownership, handle errors, and return typed results rather than crashing.
- Never silently install kernel drivers, hook unrelated processes, or run background keyloggers.

## 4. Architecture boundaries and state ownership

- Define what runs in UI vs privileged main/native processes. The UI should not arbitrarily read files, execute shell commands, handle API secrets, or issue unrestricted OS operations.
- Write a clear trust-boundary data-flow diagram for any app with network, microphone, camera, clipboard, files, credentials, background listeners, or third-party integrations.
- One subsystem owns each piece of authoritative state. React/UI consumes typed snapshots and events; it must not become an independent duplicate of OS/service state.
- Use explicit state machines for sessions, recordings, uploads, installations, sync, transactions and tasks subject to cancellation/retries.
- Favor small interface-based services, dependency injection where useful, and focused test seams. Avoid both overabstracting trivial code and the one-file “God object”.
- Validate IPC payload schemas, length, types and sender; serialize errors safely.
- Ensure idempotency when callbacks repeat; guard stale async responses with session/request IDs and abort semantics.
- Provide sane fallback behavior when an OS API or optional native feature is unavailable.
- Design migrations for settings/storage before adding persistent state. Handle corruption gracefully.

### Electron-specific security baseline

If Electron is selected:

- `contextIsolation: true`, `nodeIntegration: false`, sandbox enabled where feasible, local bundled renderer assets, strict Content Security Policy.
- `contextBridge` exposes narrow typed app methods; never raw `ipcRenderer`, `require`, `fs`, generic shell execution, raw secrets, or unrestricted channels.
- Validate IPC sender/origin/window identity and input using a schema library such as Zod.
- Use safe navigation and `window.open` policies, restrict permissions to exactly what is needed.
- Keep remote webpages out of privileged BrowserWindows; do not turn off `webSecurity` to work around integration problems.
- Pin and audit dependencies, keep Electron patched, apply appropriate Electron Fuses for production as verified.
- Capture Chromium permissions thoughtfully; microphone, camera and clipboard access must be justified.
- Do not evaluate untrusted strings as code or expose native modules to untrusted scripts.

Reference: https://www.electronjs.org/docs/latest/tutorial/security

### Tauri-specific security baseline

- Scope Rust commands by feature; allowlist capabilities and filesystem/network access, avoid broad global permissions.
- Validate payloads and URLs, avoid arbitrary shell command execution, and audit plugins.
- Account for WebView2 runtime/Windows version behavior and signed native installer artifacts.

### .NET/WinUI/WPF-specific baseline

- Prefer maintained .NET LTS/runtime choices where appropriate; honor UI thread dispatcher and async cancellation.
- Use standard Windows credential storage/DPAPI for secrets and proper package manifests/permissions.
- Test packaged and unpackaged modes and all native dependencies.

## 5. Security, privacy, and supply chain

### Treat user data as sensitive by default

- Minimize collection, network traffic, background listening and persistent storage.
- Give clear disclosure when content leaves the device, including the actual provider and purpose.
- Never label a cloud-powered feature “offline,” “fully local,” or “unlimited free.”
- Default to local-only configuration. Make analytics, uploads, crash reporting and history optional with informed consent.
- Make sensitive-content capture visible and cancellable.
- No credentials, tokens, customer text, audio, clipboard material or full request payloads in logs, traces, error screenshots, crash dumps or telemetry.
- Allow users to delete local data and remove stored credentials. Document residual OS/third-party retention where relevant.

### Credential management

- Never commit secrets or embed developer-owned API keys into binaries.
- Store secrets with Windows Credential Manager, DPAPI, or securely configured platform store. In Electron, prefer current `safeStorage` async API and keep key out of renderer state after save.
- Treat secrets as available to the user's security context; understand limits against malware running as same account.
- Design key rotation, remove, validation failure and invalid credential recovery. Redact transport/log output.
- BYOK means cost/terms remain with user's provider account; it does **not** waive the developer's app-security obligations.

### Distribution and dependencies

- Verify commercial license compatibility of dependencies, UI icons, fonts, images, sound effects, libraries, models and native modules; include attribution and notices.
- Produce SBOM where feasible, scan dependencies, remove dev keys/sample secrets and unneeded binaries from releases.
- Use stable dependencies and lockfiles. Avoid downloading executable code from arbitrary endpoints at runtime.
- Sign Windows binaries/installer where possible, protect CI signing secrets, verify release integrity and update source.
- Publish `SECURITY.md` with vulnerability-reporting process and supported versions.
- Avoid deceptive competitor branding or implied affiliation; independently clear trademarks before public launch.

## 6. Reliability engineering & background work

- Timeouts for initialization/network/shutdown; retry only where operations are safe and idempotent; exponential backoff with jitter and bounds.
- Distinguish authentication errors, permission errors, rate limits, quota exhaustion, unsupported OS, offline, service unavailability and target-app incompatibility.
- Never silently drop user input after failure. Provide retry/copy/export/recovery as appropriate.
- Do not allow overlapping jobs to corrupt state. Use cancel tokens, per-operation IDs and maximum queue sizes.
- Avoid UI-thread blocking operations; offload CPU-intensive encoding, parsing and I/O.
- Design observability without violating privacy: coarse status, timings, error codes, redacted diagnostic export.
- Make startup and upgrade deterministic; work without elevated privileges where possible.
- Test app crash, manual force-close, network reconnect, monitor docking, device removal and Windows sleep/resume.
- Build actual behavior for all controls; remove nonworking options from releases.

## 7. Testing discipline

### Automated tiers

1. **Unit tests:** state transitions, transformation algorithms, validation, migrations, error mapping, service behavior, format conversions.
2. **Integration tests:** mocked network/native services plus real IPC boundaries and state coordination; confirm secrets do not leak across boundaries.
3. **UI/e2e tests:** onboarding, settings, shortcuts, focus, disabled/error states, accessibility, window navigation; use Electron Playwright or framework equivalent.
4. **Packaging tests:** launch packaged binaries in clean environment, install/uninstall, resources, startup, file paths, antivirus/SmartScreen expectations.
5. **Security tests:** permission denial, malicious/unexpected IPC, oversized input, untrusted URL handling, clipboard/data leakage, corrupt config.

### Manual Windows acceptance

- Test Windows 11; Windows 10 only when officially supported by runtime and target requirements.
- x64, optional ARM64 if targeted; common 100%, 125%, 150%, and 200% scale factors.
- Multi-monitor, negative origin, laptop sleep/resume, mic/camera or devices unplugged mid-operation.
- Protected and elevated applications; standard user account; restricted enterprise user profiles.
- User data in Unicode scripts, emoji, RTL text if relevant, multiline copy/paste, high contrast, keyboard-only, screen reader.
- Startup toggle persists across restart; installer cleansly uninstall and upgrades; no duplicate background process.
- On a non-Windows development host, explicitly list unperformed Windows tests as blocked; don't say they passed.

**Quality gate:** no release solely on the basis of a successful build or green mocked tests. At least one real packaged Windows end-to-end test is mandatory.

## 8. Performance and UX quality

- Set measurable budgets for cold launch, memory, idle CPU, network usage, background battery impact, input response and UI frames.
- Defer loading heavyweight UI screens/modules until needed. Virtualize large data lists and throttle visualizations tied to streaming data.
- Avoid hidden perpetual camera/microphone/network activity in tray utilities.
- Use appropriate worker/utility thread for signal processing or high-frequency data.
- Profile both debug and packaged releases; avoid inventing “lightweight” claims without measurements.
- Design low-connectivity handling and useful user feedback.

## 9. Build, installer, versioning and release

- Create a well-defined build command, deterministic dependency graph, pinned lockfile, and CI validation.
- Set product name, `appId`, version, publisher, icons, architecture, OS minimum and installer type intentionally.
- For consumer `.exe`, prefer a tested NSIS installer; evaluate MSIX if Microsoft Store/enterprise distribution actually needs it.
- Prefer per-user installation unless system-wide install is justified. Do not request elevation for a simple utility.
- Verify shortcut/start-menu entries, background registration, file locations, credential handling, update and uninstall behavior.
- Handle code signing correctly. An unsigned build may trigger Windows SmartScreen; do not advise disabling security controls or treat unsigned warnings as harmless.
- Enable updates only when there is a secure real implementation, a trusted source, integrity validation and a rollback/recovery strategy. Else ship a truthful manual update checker.
- Protect release workflows with least-privilege CI tokens, reviews and secret scopes.
- Attach checksums, release notes, supported platforms, known issues and upgrade guidance.
- Use semantic versions, changelog, basic support matrix and reproducible release checklist.

## 10. Professional repo documentation

Deliver as relevant:

- `README.md`: why, what, screenshots (real), features, install, setup, usage, costs, privacy, limitations, development, license.
- `AGENTS.md`: agent conventions and links to implementation brief/skill.
- `docs/architecture.md`: components, trust boundaries, data flow, lifecycle.
- `docs/decisions/`: key architectural decisions and trade-offs.
- `PRIVACY.md`: data collected, processed, transmitted, retained, deleted, third parties.
- `SECURITY.md`: security model, vulnerability disclosure, supported versions.
- `CONTRIBUTING.md`: local development, tests, coding standards, release rules.
- `CHANGELOG.md`: notable changes by semantic version.
- `docs/release-checklist.md`: sign, validate, install/uninstall and publish procedure.
- `tests/manual-windows-qa.md`: genuine observations and untested cases.

Do not create empty ceremony files just to look complete; fill them with actionable project-specific content.

## 11. Standard implementation workflow for a new project

### Phase A — Scope

- Record Windows versions, target platforms/architectures, distribution model, internet/offline requirements, data sensitivity, user journey and essential native OS integrations.
- Select stack and libraries; verify licensing, current support, deployment prerequisites and native build costs.
- Produce feature priorities: P0 core job, P1 reliability/settings, P2 niceties. Define measurable acceptance criteria.

### Phase B — Foundation

- Scaffold source and proper build; configure formatting, linting, TypeScript strict mode or language equivalent, CI, dependency locking and changelog.
- Establish main/UI/native boundaries and typed contracts; default secure permissions.
- Create design tokens, app shell, settings persistence and error boundary.

### Phase C — Real vertical slice

- Implement an actual end-to-end user story using the real provider/native OS integration; use mocks only in tests.
- Test and capture real results on Windows; add graceful failure and meaningful loading/error states.

### Phase D — Hardening

- State machine, cancellation, duplicate guards, rate and size limits, crash recovery, sensitive-data handling, migrations, unsupported configurations and native edge cases.
- Privacy threat model, dependency security and license audit.

### Phase E — Polish

- Consistent spacing/typography, responsive states, keyboard access, DPI and monitors, reduced motion, tray taskbar/window behaviors, product copy and onboarding.
- Measure start and idle performance. Eliminate visual and functional placeholders.

### Phase F — Distribution

- Production package and fresh-machine install; sign if possible, document unsigned limitations if not.
- Test upgrades, uninstall, startup, config persistence and network/credential problems.
- Publish source/release with meaningful README, license, privacy policy and known issues; confirm actual artifact links exist.

## 12. Review checklist (must pass before announcing completion)

### Product
- [ ] Core promise demonstrably works with real desktop UI/OS integration.
- [ ] Onboarding is complete; the user can recover from common setup errors.
- [ ] Every Settings toggle changes actual behavior and persists or truthfully reports unsupported state.
- [ ] Loading, offline, permission denied, error, cancel, done and quit states are implemented.
- [ ] UI is premium, consistent, accessible, responsive and DPI-aware.

### Engineering
- [ ] No unchecked IPC, overly broad native commands, hardcoded credentials, hidden telemetry, or unwanted remote code.
- [ ] Async race conditions, cleanup, duplicate actions, cancellation and failures tested.
- [ ] Working automated checks and lockfile; dependencies audited.
- [ ] Packaged Windows build tested; installer/uninstaller functioning; native add-ons included.
- [ ] Code signature and update mechanism status truthfully documented.

### Communication
- [ ] Real screenshots; no fabricated downloads, benchmarks, prices, privacy guarantees or integration claims.
- [ ] README contains accurate installation, use, limits, cost and troubleshooting.
- [ ] License, privacy, security and third-party attributions match actual code and service providers.
- [ ] Remaining manual tests, limitations and external prerequisites explicitly disclosed.

## 13. Definition of done / final agent response

At handoff, state concisely:

1. The **functional end-to-end path** that is implemented.
2. The commands that **actually work** for development, checks, packaging and release.
3. Paths to built installers/releases **verified to exist**.
4. Automated test results, real manual Windows test results, and cases not tested.
5. Features deferred, integration boundaries, key security decisions, and known platform limitations.
6. Any external step the human owner must do (code signing, creating a GitHub repository/release, checking trademarks, accepting provider terms, purchasing a domain).

**Never equate polished appearance with production readiness. Production readiness means reliability, security, installability, maintainability, documentation, and verified behavior.**

---

### Note for Codex skill discovery

This file is intentionally named `windows-desktop-product-engineering.md` as requested. A Markdown file with this name can always be used as a **reference standard** by explicitly telling Codex to read it, or by linking to it from `AGENTS.md`. For **automatic** skill discovery, current Codex documentation requires the canonical path `.agents/skills/windows-desktop-product-engineering/SKILL.md` (or the user-level counterpart). Therefore, this custom-named file **is not automatically discovered** as a skill: explicitly ask Codex to read it, link it from `AGENTS.md`, or copy the content into the canonical `SKILL.md` path after download. We kept the filename requested by the project owner.
