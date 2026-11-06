# SEYVO — Windows Voice Dictation App

> **Codex implementation specification / product requirements document**  
> Version: 1.0 (implementation brief)  
> Research reference date: 7 November 2026  
> Working brand: **Seyvo** — *Speak. Refine. Paste.*  
> License intent: open-source, free-to-download app, **bring your own Google Gemini API key** (BYOK).  
> Deployment target: Windows 11 and Windows 10 x64 where supported by the current Electron runtime; investigate Windows ARM64 separately.

## 0. Instructions to the coding agent — READ FIRST

Build a real, installable, production-quality Windows desktop application—not a web mockup, landing page, or single-process demo. Complete working code, build tooling, tests, installer, documentation, privacy controls, and reproducible GitHub Releases workflow are required. Follow `windows-desktop-product-engineering.md` as the reusable engineering quality standard.

**Execution rules**

1. Inspect the existing repository first. If empty, scaffold it from scratch. Record versions actually installed; use current stable compatible versions of Node.js, Electron, React, TypeScript, and the Google Gen AI JavaScript SDK at implementation time. Do not guess an API signature.
2. Read the official Google Gemini **Live transcription** documentation and SDK definitions before writing integration code. Target `gemini-3.5-transcribe-live`, not Gemini native conversational audio as the default dictation engine. Confirm that this model is available to the user's API key and geographic account before enabling it.
3. Build a vertical slice first: **shortcut → non-focus-stealing waveform → microphone → Gemini streaming → finalized Smart transcript → safe insertion into the previously focused app**. Then complete settings and polish.
4. Produce functioning code and tested behavior. Never mark a feature done if it only has a styled toggle, placeholder callback, mocked service in production, or hardcoded example transcript.
5. Unit/integration tests can mock Google and Windows APIs; document clearly which system-integration tests require a real Windows desktop session, actual microphone, live key, and foreground application.
6. Do not introduce a developer-owned Gemini key, telemetry backend, user accounts, hidden proxy, or mandatory subscription. Use the end user's key only; all provider requests originate from the installed app directly to Google.
7. Ask for input only when blocked by a noninferable legal/business secret such as a code-signing certificate or GitHub repository ownership. Implement the unsigned/local testable build first and document signing separately.
8. After each milestone, run type checks, lint, tests, and production build; fix failures before proceeding. Do not assert manual Windows validation unless it has actually been performed.
9. Capture architectural decisions, known limitations, and any deviation from this spec in the repository documentation.

---

## 1. Product summary

**Seyvo** is a small, elegant, system-wide voice-to-text utility for Windows. It lives in the system tray and lets users dictate into an existing text field in another program: browser-based AI agents, ChatGPT, Claude, Gemini, Cursor, VS Code, Notepad, email, messaging, forms, documents, and more.

The user clicks a text field, presses a user-configured hotkey, speaks naturally in their preferred language (including Hindi, English, and mixed Hinglish where supported), and presses the same hotkey again or releases it in push-to-talk mode. A small glassy microphone-waveform bubble appears without stealing focus. Google Gemini Live Transcribe streams audio and emits a Smart transcript. Seyvo places the finalized text at the **original caret position**; it **never automatically presses Enter or sends a prompt**.

### Product promise

- **Talk anywhere. Text appears where your cursor was.**
- **Smart cleanup by default:** filler word removal, punctuation, self-correction handling, sensible lists/formatting.
- **Your key, your control:** no Seyvo subscription or proprietary transcription server. Users are responsible for any Google API charges, quota, and relevant Google data terms.
- **Beautiful but quiet:** no full-screen application needed after onboarding; the mic bubble and tray icon communicate state.
- **Windows-native reliability:** hotkey conflict reporting, startup toggle, tray, foreground app preservation, honest insertion failure feedback.

### What this is NOT

- Not OpenAI Whisper model software, despite the similar-sounding name. The relevant workflow inspiration is **Wispr Flow** (`wisprflow.ai`).
- Not a browser extension or a chatbot; it writes text into whichever supported app already has an insertion point.
- Not an always-listening background recorder. The microphone opens **only** on explicit user activation.
- Not guaranteed to type into secure desktops, password fields, anti-cheat/protected applications, elevated administrator applications, remote desktop sessions, or every custom-rendered editor.
- Not guaranteed to be zero-cost: *the application* may be free, but Google API access depends on the user's account, tier, quotas, and pricing.

## 2. Competitive behavior research

Wispr Flow's published product behavior (verified against its help center/features pages in November 2026): position cursor in another application, hold/activate a keyboard shortcut, speak, then release/stop to insert cleaned text. Its cleanup includes filler words, spoken corrections, punctuation, list formatting, dictionary, and snippets; its Windows default shortcut was described as Ctrl + Win in its help center. Wispr Flow is a commercial independent product; **do not copy its name, brand assets, screenshots, proprietary UI, or copywriting**.

Build a distinct product: **visible BYOK transparency, privacy-first local settings, developer-friendly vocabulary, refined Win11-inspired interface, reliable fallback-to-copy, and no subscription to Seyvo**.

References:
- Wispr Flow overview: https://docs.wisprflow.ai/articles/2772472373-what-is-flow
- Wispr Flow features: https://wisprflow.ai/features
- Wispr Flow plans: https://wisprflow.ai/pricing

## 3. Critical Gemini architecture decision

**Use dedicated transcription over the Gemini Live API:**

- Live model ID: `gemini-3.5-transcribe-live`.
- Transport: Google Gen AI JS SDK (`@google/genai`) over the Live API / WebSocket, or an equivalent verified protocol adapter behind one interface.
- API-owned data: end user's AI Studio / Gemini API key.
- Transcription response modality: `TEXT`.
- Primary mode: `inputAudioTranscription: { mode: 'SMART', languageCodes: [] }` (SDK JavaScript casing; verify installed version).
- Alternative: `VERBATIM` for literal dictation.
- Automatic language detection by default; allow BCP-47 language hints.
- `customVocabulary` passed as supported, capped at documented limits; default maximum in UI should guide users toward the most useful ~100 entries (provider supports up to 1,000).
- Microphone payload: **mono, raw signed 16-bit little-endian PCM, 16 kHz**, streamed in about 100 ms chunks using MIME type `audio/pcm;rate=16000`.
- Observe session setup completion **before sending audio**.
- Handle `serverContent.interimInputTranscription` as **replaceable preview**, and `serverContent.inputTranscription` as **committed segments**. Do not paste speculative interim content.
- On stop, signal end-of-stream (or manual `activityEnd` when manual activity detection is configured); wait for finalized output or a bounded timeout. Commit collected final segments exactly once and in order.
- Document the provider's stated streaming session maximum (10 minutes as of research). For v1, limit a single dictation to a shorter configurable safe max (default 5 minutes), warn clearly, then finalize. Never silently lose speech due to session expiry.
- **Do not append the same segment twice** when multiple callbacks/turn events arrive. Maintain per-session sequence, deduplication, abort token, and state.
- Smart mode already performs cleanup; do **not** make an additional paid LLM call unless user explicitly opts into future advanced rewrite mode. Don't silently translate, summarize, censor, or invent details.
- Do not convert dictated Hindi/Hinglish to English automatically. Preserve speech language/script as recognized; a requested translation feature would be a distinct opt-in feature.

Google primary sources:
- Live transcription: https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
- Non-streaming audio transcription/fallback: https://ai.google.dev/gemini-api/docs/transcribe
- Gemini API pricing: https://ai.google.dev/gemini-api/docs/pricing
- Google's Gemini Live API developer skill/examples: https://github.com/google-gemini/gemini-skills/blob/main/skills/gemini-live-api-dev/SKILL.md

### Verified SDK integration shape (illustrative, NOT a complete or blindly copyable module)

```ts
import { GoogleGenAI, Modality } from '@google/genai';

// This code MUST run on the trusted Electron main/utility side, not an
// untrusted renderer. Obtain the decrypted, user-supplied key only as needed.
const ai = new GoogleGenAI({ apiKey: userApiKey });
const session = await ai.live.connect({
  model: 'gemini-3.5-transcribe-live',
  config: {
    responseModalities: [Modality.TEXT],
    inputAudioTranscription: {
      mode: 'SMART', // selectable: 'SMART' | 'VERBATIM'
      languageCodes: [],
      customVocabulary: [],
    },
  },
  callbacks: {
    onmessage(message) {
      // Also handle setup completion, close, turn completion and errors.
      const server = message.serverContent;
      if (server?.interimInputTranscription?.text) {
        showReplaceablePreview(server.interimInputTranscription.text);
      }
      if (server?.inputTranscription?.text) {
        commitUniqueFinalSegment(server.inputTranscription.text);
      }
    },
    onerror(error) { handleTranscriptionError(error); },
    onclose(event) { handleSessionClose(event); },
  },
});

// AFTER provider setup has completed, for each ~100ms base64 PCM chunk:
session.sendRealtimeInput({
  audio: { data: base64Pcm16Mono16k, mimeType: 'audio/pcm;rate=16000' },
});
// On stop (where using hybrid/end-of-stream flow):
session.sendRealtimeInput({ audioStreamEnd: true });
```

The helper functions in the snippet above are **not** implemented; Codex must write and test them. Check whether SDK callbacks, session readiness, and `close()` differ in the actual installed SDK. Do not treat `onopen` alone as proof that server setup is complete.

### Why not Gemini 3.8 Live by default?

Gemini native live audio models are primarily designed to hold speech-to-speech conversations and may expose text through output transcription rather than direct textual dictation. The dedicated `3.5 Transcribe Live` path supports final and interim **input** transcripts, Smart formatting, and transcription-specific controls. Keep `TranscriptionProvider` interface swappable if Google changes models, but do not unnecessarily build a spoken chatbot.

### Provider limitations & truthful economics

- Network access is required; v1 is **not offline**.
- API key can be invalid, disabled, out of quota, billing-restricted, geographically unavailable, or unsupported for the chosen model. Map these to actionable UI messages.
- Public API and SDK may change. Verify `gemini-3.5-transcribe-live` availability, mode and behavior, quotas, pricing, and commercial eligibility during implementation and before each release.
- Google listed an estimated **~$0.009 per audio minute** of paid-tier Live Transcribe usage at the research date, subject to token consumption and pricing changes; do **not** promise a fixed rate or unlimited free quota. Put a link to live pricing in Settings.
- Explain that provider free-tier versus paid-tier data handling/usage terms differ. Link Google's current terms and never claim that audio is processed exclusively locally.
- Capture no telemetry, transcripts, or recordings on Seyvo-owned infrastructure. Audio is necessarily transmitted to Google for cloud transcription.

---

## 4. Target customers and use cases

1. **AI power users:** dictate long, clean prompts into AI chatboxes or developer agents; cursor remains in the original text area.
2. **Developers:** voice-write issue descriptions, PR comments, code explanations, and tool prompts; technical terminology is recognized via dictionary.
3. **Students, creators, professionals:** dictate messages, documents, notes, and queries with punctuation and cleanup.
4. **Multilingual users:** natural Hindi/English code-switching, with auto language recognition as provider supports it.
5. **Accessibility-minded users:** fewer keystrokes, scalable settings UI, reduced-motion option, explicit status/controls.

## 5. UX: complete happy path

1. User downloads signed installer from GitHub Releases or official site, installs, and launches Seyvo.
2. Onboarding explains mic/network/key usage, shows the Google AI Studio key creation link, and provides a masked input with **Save and Test**. Do not log or display a saved key.
3. Onboarding requests microphone permission using native Chromium/Electron permission flow and provides **Test Mic** with live local level meter (never upload during local test).
4. User chooses a keyboard shortcut. Default: **Ctrl + Shift + Space** (subject to conflict detection). The Settings page can record a new combo. Offer a safe **single-function-key** option such as F8 when not reserved; do not accept arbitrary lone letter keys that would interfere with normal typing without a strong warning/explicit consent.
5. User clicks into any supported text field (for example, ChatGPT prompt, Notepad, VS Code editor, browser textarea).
6. First shortcut press: capture **target foreground window and caret/focus context** and original app identity *before* showing the bubble. Open mic only upon user action. Small waveform bubble appears near bottom center of **the active monitor**, non-activating and always on top (with DPI-aware coordinates).
7. Bubble animates based on **actual microphone amplitude** (not fake sine waves). States are clearly labeled: Connecting, Listening, Finishing, Pasting, Done, or Error. Include one-click cancel/stop only if it does not break focus preservation; clicking bubble requires a deliberate supported focus-restore strategy.
8. User speaks. Interim transcription is optional in expanded bubble and **must not be inserted**. Show privacy-aware on/off recording indicator, elapsed time, subtle color change for server status.
9. Second shortcut press: stop capturing audio, end provider audio input, await finalized transcript. By default, perform Smart transcription, not a second rewrite request.
10. Seyvo attempts to insert text into the **original focused field**, preserving newlines and Unicode. It neither clears the field nor submits the message.
11. On success, collapse bubble quickly and show transient confirmation. On failure, preserve the transcript for **Copy**, **Retry inserting**, **Open history**, and **Dismiss**. Do not falsely say 'Pasted' if insertion cannot be confirmed.
12. App remains running in the tray. Closing Settings minimizes/hides to tray unless the user selects **Quit Seyvo**.

### Additional flows

- **Cancel:** press Escape during recording or use tray cancel; discards audio and current pending transcript for that session, with no paste or permanent recording.
- **Hands-free:** toggle shortcut starts/stops; default mode.
- **Push-to-talk:** optional mode presses-and-holds a user-selected combo or safely selected function key; release finalizes. `Electron.globalShortcut` is NOT sufficient for key-up events; use a narrowly scoped/native keyboard event module or a Windows helper for true hold semantics. If helper fails/unavailable, visibly disable hold mode and retain functional toggle mode. Never claim hold mode works until real Windows validation.
- **Empty input:** if no meaningful speech, stop quietly without pasting a blank string.
- **Interruption:** new session while finishing should be queued or refused with feedback, never overlap or overwrite text.
- **Target vanished:** if window lost/disappeared, retain final output in recovery drawer and offer copy; do not paste into an unrelated app.
- **Offline/network loss:** show actionable error. Never retry cloud charges repeatedly without visible limits; preserve recoverable finalized text locally/in RAM for that session.

---

## 6. Screen design and visual direction

### Brand identity

Working name **Seyvo** (pronounced SAY-voh); tagline **Speak. Refine. Paste.**. This name is *not* legally cleared. A preliminary web check surfaced an existing voice-message translation product called **Sayvo** (`sayvo.online`), which is phonetically similar; treat that as a real naming-collision warning and consider rebranding if formal counsel finds a risk. Before public branding, conduct comprehensive trademark screening (India Class 9 and 42 plus launch markets), GitHub org/repo, domains, package names, and similarity searches. Replace all working-name references via a single brand config if necessary.

Style: premium Windows 11 utility, not a SaaS dashboard. Refined typography (properly licensed Inter/Geist or native Segoe UI Variable), charcoal + cool gray neutrals, quiet glacier-blue/indigo accent, subtle gradients and restrained glow. Clean borders, 12–16px radii, breathable spacing, 150–220ms feedback motions, Win11-like shadow, reduced-motion support, and high-contrast alternatives.

### A. First-run onboarding (stepper)

- Welcome: tagline, short 3-step demo illustration, explain key/network.
- Connect Google Gemini: key field, visibility toggle, Save and Test, error details, provider pricing/terms links.
- Microphone: permission status, device selection, Test Microphone button and live meter.
- Shortcut: hold/toggle mode selector; record shortcut; conflict verification and preview.
- Final test: select a built-in text input, dictate, verify output, then **Start using Seyvo**. Startup-at-login is **opt-in**, clearly explained.

### B. Main app / dashboard

Compact 920 × 660-ish window with side navigation; responsive within sensible minimum size, Windows custom title bar that retains drag regions, accessible minimize/maximize/close controls, no click-target overlaps.

Navigation: **Home, Settings, Dictionary, History (opt-in), About**.

Home:
- Large main status: **Ready** / **Listening** / **Processing** / **Paused** / **Needs Setup** / **Error**.
- Concise primary action **Start Dictation** + shortcut pill, microphone chip, connection indicator.
- Last result preview **only if local history or temporary recovery is enabled**; no unnecessary voice-content exposure by default.
- Fast controls: Pause Seyvo, Change mic, Show shortcut, Test paste, Open settings.
- Help link for compatibility/security limitations.

### C. Floating bubble (signature interaction)

- Visually approximately 220–300 × 50–64 logical pixels; user can choose bottom center / near caret (experimental) / custom position.
- Frameless, transparent where supported, rounded with shadow; display-only while listening; does **not steal focus**. Show safely on active monitor; respect taskbar, high DPI, multiple displays, and fullscreen window constraints.
- Center: actual audio amplitude waveform (5–13 narrow bars or smooth segmented curve, 30–60fps target under load). Paused/static visual when reduced motion is enabled.
- Left: microphone/status glyph; right: stop/time/short state label. No walls of text or over-designed gradients.
- Colors by state: neutral ready, blue listening, amber working, red error, green/neutral success; state must also have a text/icon affordance for color-blind users.
- Expanded bubble may show interim caption. Defaults **off** for privacy; show only if selected.
- If primary monitor resolution is low, clamp bubble to visible work area.

### D. Settings page (everything actually wired)

**General**
- Launch Seyvo when I sign in to Windows (on/off; actual OS state read back).
- Start minimized to system tray (on/off).
- Keep running in system tray when closing Settings (on/off; with clear meaning).
- Pause dictation (toggle; persistent per user preference).
- Show welcome/onboarding again.
- Check for app updates (manual now; optional automatic check on/off).
- Auto-install updates **off** by default; release channel Stable / Beta only if channel infrastructure exists.

**Dictation**
- Activation mode: press-once-to-start/press-again-to-stop; push-to-talk if native helper supported.
- Editable shortcut + capture UI, validation, registration success, collision/error report, Reset default.
- Transcription mode: Smart (default) / Verbatim.
- Language: Auto (default), plus curated BCP-47 language hint options; explain automatic code-switching.
- Microphone dropdown with live permission/device health and Test mic.
- Maximum duration/timeouts + visible max cap; only within provider constraints.
- Format handling: preserve paragraphs/newlines (default), optional trim whitespace, no auto-submission.
- Auto-paste on success (on default) or copy-only mode (for restricted apps).
- Sound cues on start/stop/error (off by default or subtle; respect system volume).

**Personalization**
- Dictionary entries: words, acronyms, brand names; import/export local JSON; no silent cloud sync.
- Optional snippets/expansions, local only and explicitly enabled. Snippets must not execute code.
- Preferred coding vocabulary set (opt-in); no hidden app-context snooping.

**Privacy & Data**
- API key status: Configured / Missing / Failed; Replace, Test, Remove; saved secret is never returned to renderer.
- Clear all local history / recovery text / dictionary with explicit scope.
- Store transcript history locally: **off by default**. When enabled, encrypted-at-rest where feasible; bounded retention by count/days, manual deletion and export.
- Never retain recorded audio by default; no troubleshooting log may include recorded speech or key.
- No analytics/telemetry unless a future version obtains separate explicit opt-in.
- Link to Google terms/privacy, explain sending audio to Google, available account plans, and potential paid usage.

**Appearance**
- System/Light/Dark mode, reduced motion, overlay placement/size, waveform style (2 restrained variants), show overlay on/off (with tray signal even if hidden), app accent.

**Compatibility / Troubleshooting**
- Current shortcut registration result, foreground target diagnostics (application name only, never contents), mic and provider connection checks, paste test, local debug log with redaction, export diagnostics with explicit consent.
- Privacy-focused excluded applications list (user-configured executable names; no mic activation in these apps), easy pause switch.

**About**
- Version, build hash, maintainer, open-source license, contributors, acknowledgments, update status, independent-vendor disclaimer, privacy policy, API pricing/terms, GitHub links.

### E. Tray menu

Status label; **Start/Stop Dictation**, **Pause/Resume**, **Open Seyvo**, **Settings**, **Choose microphone** if stable, **Check for Updates**, **Quit Seyvo**. Context menu and left-click behavior predictable; balloon/notification only on actionable issues.

---

## 7. Desktop architecture (non-negotiable boundaries)

Preferred implementation:

| Layer | Choice | Responsibility |
|---|---|---|
| Desktop runtime | Electron + Node.js | Native windows, tray, lifecycle, autostart, system hotkeys, permissions, OS APIs |
| Renderer UI | React + TypeScript + Vite | Settings, onboarding, dashboard, overlay UI |
| Styling | Tailwind CSS + Radix primitives/shadcn-style accessible components | Premium, accessible interface; adapt to Electron |
| UI state | Zustand or reducer-based typed state | Small predictable cross-window UI state; main owns source-of-truth session state |
| Cross-process | `contextBridge` + validated IPC (`zod`) | Minimal typed methods and safe event subscriptions |
| Speech | `@google/genai` in trusted main/utility process | BYOK auth, Live sessions, transcript assembly, errors |
| Audio | Web Audio + `AudioWorklet` in dedicated trusted local recorder renderer or worker | Mic permission, 16kHz downsample, PCM16 stream, measured audio level |
| Windows integration | Rust + `napi-rs` Win32 module or a minimal audited native Windows sidecar | Foreground/focus capture, reliable Unicode input/paste, optional key-up detection |
| Local config | JSON-backed validated versioned settings | Non-secret preferences, schema migrations, corruption recovery |
| Secret storage | Electron `safeStorage` async APIs on Windows (DPAPI) or Windows Credential Manager | Encrypt key before saving; never write key to plain config/logs |
| Testing | Vitest + React Testing Library + Playwright Electron where supported + Windows manual QA | Core, renderer, mocked provider, installer, host app behavior |
| Packaging | electron-builder (NSIS) or electron-forge + Windows targets | Signed `.exe` installer, per-user install/uninstall, release artifacts |
| CI/release | GitHub Actions + versioned tags + signed/checksummed artifacts | Reproducible Windows build & tests |

### Process topology

```text
+---------------------------------------------+
| Target application (browser/IDE/Notepad)    |
| Original focused HWND + caret               |
+----------------------+----------------------+
                       ^  safe paste / Unicode insertion
                       |
+----------------------+----------------------+
| ELECTRON MAIN (privileged, local)           |
| Single instance / tray / startup / hotkeys  |
| State machine / Win32 target & paste bridge |
| Key storage / validated IPC / provider      |
+----------+--------------------+-------------+
           | typed IPC          | audio packets/transcripts
   +-------+--------+   +-------+--------------------+
   | React Renderer |   | Trusted Audio Recorder    |
   | Dashboard      |   | getUserMedia -> Worklet   |
   | Settings       |   | PCM16 16kHz, level meter  |
   +----------------+   +------------+--------------+
                                     |
                           backpressure / chunk IPC
                                     |
                          Gemini Live Transcribe
                          Google WebSocket (BYOK)
```

For audio capture, select the safest implementation that works reliably in production under current Electron media permissions. Never send API key to waveform/React UI or expose unrestricted Node APIs. Consider a dedicated utility process for provider connection to isolate failures if overhead is acceptable.

### Suggested directory layout

```text
seyvo/
  README.md
  LICENSE
  PRIVACY.md
  CONTRIBUTING.md
  SECURITY.md
  CHANGELOG.md
  AGENTS.md
  package.json
  pnpm-lock.yaml
  electron-builder.yml
  .github/
    workflows/ci.yml
    workflows/release.yml
    ISSUE_TEMPLATE/
  assets/
    icon.ico
    icon.png
    tray-light.png
    tray-dark.png
  src/
    main/
      index.ts
      windows.ts
      tray.ts
      shortcuts.ts
      lifecycle.ts
      session-coordinator.ts
      startup.ts
      settings-service.ts
      key-vault.ts
      ipc-handlers.ts
      updates.ts
      audio/transcode.ts
      transcription/provider.ts
      transcription/gemini-live.ts
      transcription/transcript-assembler.ts
      insertion/target-tracker.ts
      insertion/insertion-service.ts
      privacy.ts
    preload/
      index.ts
      types.ts
    renderer/
      index.html
      src/
        app.tsx
        components/
        features/onboarding/
        features/home/
        features/settings/
        features/dictionary/
        features/history/
        features/overlay/
        audio/audio-worklet-processor.ts
        styles/
    shared/
      contracts.ts
      schemas.ts
      errors.ts
      types.ts
    native-win/
      README.md
      src/
  tests/
    unit/
    integration/
    e2e/
    manual-windows-qa.md
  docs/
    architecture.md
    privacy-threat-model.md
    support-and-limitations.md
    release-checklist.md
    naming-and-trademark-clearance.md
```

This structure is a guide, not a command to create empty directories/modules; each committed file must serve a purpose. `AGENTS.md` should tell Codex to read this specification plus the reusable Windows skill.

---

## 8. Functionality requirements & precise acceptance criteria

### FR-01 — Installation and app lifecycle

- [ ] Starts as one installed Windows app with correct icon, executable name, AppUserModelID, and installer metadata.
- [ ] Single-instance lock; second launch opens existing Settings/Home window instead of launching a second microphone/listener.
- [ ] Closes to tray (based on setting), supports explicit Quit, and gracefully cancels and closes active streams on shutdown.
- [ ] Supports clean uninstall; user data removal prompt or documented residual data removal; no orphaned startup entries.
- [ ] App remains usable with main window closed; tray and global shortcut keep working.

### FR-02 — Global shortcut behavior

- [ ] Default `Ctrl+Shift+Space`; runtime registration checked and errors shown (Electron `globalShortcut` can fail on conflicts).
- [ ] User can record and save new valid shortcuts; unsafe/reserved combos rejected or strongly warned about.
- [ ] Conflicts do not silently disable dictation; keep previous working shortcut until new one successfully registers.
- [ ] Shortcuts disabled while Seyvo is Paused; re-enabled on resume.
- [ ] Optional hold-to-talk requires genuine global key-up delivery by native helper. Test physical keyboard handling and focus preservation. Function-key single-press support should not hijack ordinary input without consent.

### FR-03 — Recorder / network / streaming

- [ ] Select correct input device; support microphone disconnect/reconnect and Windows permission revocation.
- [ ] Raw PCM16 16kHz mono generated with tested amplitude/rate conversions; no WAV header in raw chunk stream.
- [ ] Await provider setup complete; stream bounded ~100 ms chunks; suppress unbounded audio queues via backpressure policy.
- [ ] No session begins without key, mic permission, and a valid local active app state.
- [ ] Stop/Cancel/Timeout/Crash always release microphone hardware tracks and close network streams.
- [ ] Provider adapter and assembler handle interim versus final events, duplicates, late packets, empty segments, and 10-minute vendor maximum.
- [ ] English, Hindi, mixed-language test phrases produce usable transcripts under a live key; log empirical results, never claim 100% accuracy.

### FR-04 — Safe targeting and insertion

**Hardest part of the app. Treat this as a first-class subsystem, not `clipboard.writeText` followed by a timer.**

- [ ] At activation, capture foreground top-level HWND, focused child control if available (via Win32/UI Automation where appropriate), process ID/name, active monitor, and a weak target identity; do not read text content.
- [ ] Show overlay with `showInactive()`/non-focusable semantics or tested native equivalent so the target input remains focused whenever possible.
- [ ] At paste time verify that the **original window/target is still appropriate**; never paste into Settings, the bubble, a different chat, or an unrelated app due to focus change. Prefer reactivating the original target **only when safe and explicit**; if uncertain, show Copy/Retry.
- [ ] Primary insertion: Unicode-safe clipboard paste with `Ctrl+V` via trusted Win32 `SendInput` and carefully snapshot/restore clipboard *formats actually supported*. Minimize clipboard lifetime. **Do not overwrite a clipboard changed by the user in the meantime**: use Windows clipboard sequence/version checks and safe restore conditions.
- [ ] Include optional direct Unicode injection (Win32 `SendInput` `KEYEVENTF_UNICODE`) for suitable controls to avoid clipboard mutation; compare compatibility, speed, newline behavior. Never assume it supports all rich editors.
- [ ] Clear limitation: Windows User Interface Privilege Isolation can block sending input from non-elevated Seyvo to elevated apps, secure/UAC desktop and some protected targets. Do not demand admin privilege as a routine workaround.
- [ ] On inability to verify paste success, say **“Insertion may have failed”** and offer manual Copy rather than claiming verified success. Clipboard-only mode is always available.
- [ ] Keep Unicode (including Bengali/Hindi scripts, emoji, symbols) and multiline text intact. No auto-Enter/submit.
- [ ] Test Notepad, browser textarea, ChatGPT prompt, VS Code, Word, Teams/Slack if available, terminals, and inaccessible/read-only fields. Record known limitations.

### FR-05 — Secure key management

- [ ] Obtain API key in onboarding/settings; maintain key in privileged memory only as required for requests.
- [ ] Prefer current **async** Electron `safeStorage` backed by Windows DPAPI; use encrypted binary on disk or Windows Credential Manager. Do not rely on obsolete synchronous API, plain localStorage, `.env` shipped in app, or obfuscation.
- [ ] Electron renderer only receives `hasKey: boolean` + masked tail *if user consented*; no `getApiKey()` bridge and no secret in React state after save.
- [ ] When saving/test fails, explain correct next step and retain previously working key unless user explicitly replaces/removes it.
- [ ] Error and network logs redact query strings, keys, transcripts, audio, cookies, and PII. No secrets in CLI flags, exception traces, crash reports, release bundles, or CI logs.
- [ ] Clearly disclose DPAPI same-user-context limitation: malware running as the same Windows user may still access accessible secrets; no software can fully protect them against a compromised account.

### FR-06 — Settings persist and reflect truth

- [ ] Startup checkbox calls `app.setLoginItemSettings` for packaged Windows app, followed by `app.getLoginItemSettings` to verify actual OS state. Handle Windows startup-disabled state. Test on installed build, not only dev mode.
- [ ] Save microphone choice, appearance, shortcut, smart/verbatim, autocopy/autopaste, diagnostics/privacy and local history preferences.
- [ ] Validate and version settings schema; migrate safely with backup/reset on corrupted config.
- [ ] Mic privacy status truthfully displays “Not recording” / “Microphone active”; do not conflate “Gemini connected” with “microphone recording”.
- [ ] Display network provider state and quota error separately from hotkey/OS state.

### FR-07 — Tray, overlays and multiple monitors

- [ ] Tray status and context menu update correctly, including disabled items during finishing.
- [ ] Bubble appears on monitor hosting target, respects Windows scaling 100/125/150/200%, multiple monitors with negative origins, snapped windows, taskbar/work area.
- [ ] No focus stealing, no lost caret, no overlay visible after unexpected crash/session reset.
- [ ] Alt+Tab should not expose a ghost bubble as a normal app; it should not capture keystrokes accidentally.
- [ ] Theme high contrast and reduced motion respected.

### FR-08 — Optional history and dictionary

- [ ] History disabled by default; when enabled, never saves audio, only final text + local timestamp and optional destination app name (opt-in).
- [ ] Search, copy, delete one, clear all, retention policy; encrypt sensitive local transcript store or explicitly avoid durable storage until security is implemented.
- [ ] Dictionary CRUD and import/export; use vocabulary with Gemini Live config. Safe input length and rate limits.
- [ ] History/Dictionaries do not require a backend, login, analytics, or sync.

### FR-09 — Update & diagnostics

- [ ] Signed app updater design with signed release metadata, checksum/integrity, clear release notes, opt-in automated download/install. If true safe auto-update is not complete for v1, use **Check releases** opening verified GitHub URL and document that auto-update is not shipped; do not include fake toggles.
- [ ] “Copy diagnostic info” redacts keys, audio, transcripts, clipboard contents, and other apps' texts.
- [ ] UI errors have recovery; no mysterious blank screen after permission denial or socket closure.

---

## 9. Session state machine

Implement an explicit single owner in Electron main:

```text
DISABLED / NEEDS_SETUP
         |
         v
       IDLE  <---------------------------------------------+
         | valid user activation                           |
         v                                                 |
     CONNECTING --> ERROR ----recover / dismiss------------+
         | setup complete                                  |
         v                                                 |
      LISTENING --cancel--> CANCELLED ----------------------+
         | stop / time limit                               |
         v                                                 |
      FINALIZING --timeout/network error--> RECOVERABLE_ERROR
         | final text ready                                 |
         v                                                 |
       INSERTING --fail/uncertain--> RECOVERY_UI -----------+
         | success                                        |
         v                                                |
        DONE ----------------------------------------------+
```

Rules: one session ID, one foreground target, one timer budget, one final-buffer assembler, one insertion transaction. State transitions are validated. A stale callback with an old session ID is ignored. Pause/quit cancels active sessions safely. Recovery UI keeps the transcript locally until a user action or clear timeout; never silently drop the only copy after a failed paste.

## 10. IPC and data contracts

Types/validation must be shared and typed. Minimal renderer bridge concept:

```ts
interface SeyvoBridge {
  app: {
    getStatus(): Promise<AppStatus>;
    showDashboard(): Promise<void>;
    quit(): Promise<void>;
  };
  dictation: {
    start(): Promise<ActionResult>;
    stop(): Promise<ActionResult>;
    cancel(): Promise<ActionResult>;
    retryInsert(): Promise<ActionResult>;
    copyRecoveryText(): Promise<ActionResult>;
  };
  settings: {
    get(): Promise<PublicSettings>; // Never returns API key.
    update(patch: SettingsPatch): Promise<PublicSettings>;
    setApiKey(key: string): Promise<ActionResult>;
    testApiKey(): Promise<ActionResult>;
    removeApiKey(): Promise<ActionResult>;
  };
  devices: { listMicrophones(): Promise<MicDescriptor[]> };
  events: {
    subscribe(listener: (event: AppEvent) => void): () => void;
  };
}
```

Avoid exposing `ipcRenderer`, filesystem, shell, arbitrary URL opener, or arbitrary IPC channel invocation to the renderer. Each handler validates input size/type, permitted origins, state, and the sending window. Do not expose internal handles or raw secret from any method. Audio packets use a dedicated IPC path with strict bounds rather than a general-purpose bridge.

## 11. Native Windows bridge specification

If Electron APIs alone cannot reliably deliver hold-key-up or injection and focus behavior, implement narrowly scoped, auditable Windows helper using Rust + `napi-rs`/Win32 bindings (or equivalent carefully selected maintained library).

Native public API should contain only:

- `getForegroundTarget() -> { hwnd, pid, threadId, windowTitle?: sanitized, appName?, monitorId }`
- `isWindowValid(hwnd, pid)`, `canAttemptInsert(target)`
- `insertUnicodeText(target, text) -> Result`
- `pasteViaClipboard(target, text) -> Result`
- `registerHoldShortcut(combo)` / `unregisterHoldShortcut()` with **key-down/up only for assigned shortcut**, no arbitrary event harvesting or keyboard logging.

Restrict input events to the user's chosen shortcut; no hidden always-on global keylogger. Audit the Rust/Node boundary, Windows version differences, 64-bit support, native module rebuilds and prebuilt signed binaries. Provide a pure Electron **toggle-mode** fallback even if helper compilation fails on developer machines. Do not insert into elevated UI if Windows blocks it. Keep native code simple and well-tested.

## 12. Privacy / security / legal baseline

- Never activate microphone without direct user intent; persistent tray/mic indicator during recording; no invisible recording.
- Send recorded audio **only to Google's Gemini API** under end user's key, not to Seyvo's website or analytics.
- No microphone data retained at rest; immediately release tracks/buffers on finish/cancel; scrub sensitive buffers when practical.
- No system-wide keystroke collection, clipboard scraping, active-window text reading, or screenshot capture.
- Document that other applications can observe inserted text and clipboard paste may transiently place transcript on clipboard. Explain this honestly; minimize risk.
- Electron security: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where supported, strict CSP, local bundled UI, constrained permission handlers, validated IPC sender, restricted window navigation, current dependency versions.
- Google API commercial use is subject to Google's current terms; review regional policies, free-tier data treatment and acceptable-use terms. The fact that user supplies their own key does not eliminate application developer compliance obligations.
- Publish `PRIVACY.md`, `SECURITY.md` and responsible disclosure instructions.
- No competitor logo/trademark in product logo/installer; compatibility description can say “an independent, open-source alternative to Wispr Flow” with explicit non-affiliation. Avoid misleading “Wispr Flow free”, “unlimited free”, “fully offline”, “100% private” or “works in literally every app”.
- Bundled fonts, icons, dependencies, native addons and sample assets must allow commercial distribution; include notices.
- Choose repo license **MIT** for permissive open source, unless owner elects another compatible license. Keep necessary notices.

## 13. Performance and accessibility objectives

Targets to optimize and measure (not promises without measured benchmarks):

- Cold launch to tray: as fast as practical; avoid loading Settings window if startup-minimized.
- Hotkey to visible bubble: target ≤150 ms on reference PC.
- Hotkey to actual mic level feedback: target ≤300 ms once permission granted.
- Low idle CPU use (target <1% on reference test machine) and no idle microphone capture/network connection.
- Clear no-speech behavior; streaming resilient on unstable Wi-Fi and mobile hotspot.
- Good screen-reader semantics for dashboard and Settings, native keyboard navigation, focus rings, 200% zoom support, WCAG-minded contrast and reduced motion.
- Avoid massive JS render loops from audio stream; level meter updates throttled to animation needs.
- Add benchmark scripts and measure real resource usage before publishing performance claims.

## 14. Test plan

### Automated tests

- State-machine transition tests, stale callback suppression, duplicate final segment handling, abort/timeout, no-empty-paste.
- Audio processing: 48k→16k resampling against known PCM fixture; signed 16-bit endianness, mono, no headers, correct chunk ordering, backpressure.
- Provider adapter: mocked setupComplete, interim replaced not committed, final appended once, remote close, invalid key, 429 quota, 500, network drop.
- Clipboard restore logic: originally empty, text/HTML/images supported, concurrent clipboard changes, injection failure, slow app activation, Unicode, multiline.
- Key vault roundtrip with controlled test credential; security tests to ensure key is never sent via app state/logs.
- Settings migrations, hotkey conflict handling and unchanged previous shortcut on failure.
- React UI tests for onboarding, mic denial, disabled states, accessible labels, safe default history.
- Application packaging smoke tests; check installer asset architecture, tray/icon resources, valid LICENSE/PRIVACY.

### Manual Windows matrix (write results in `tests/manual-windows-qa.md`)

| Scenario | Test expectations |
|---|---|
| Windows 11 x64 100%, 150%, 200% scaling | Bubble in work area, usable UI |
| Windows 10 x64 with supported runtime | Launch/install; hotkey; mic; paste |
| Laptop + external monitor (including negative coordinates) | Bubble on target screen, no caret theft |
| Notepad, browser textareas, ChatGPT, VS Code, Word | Inserts correctly and preserves newlines |
| Elevated/secure/read-only app | Safe, truthful failure + Copy fallback |
| Windows microphone denied; USB mic unplugged midstream | No crash; status and recovery |
| Unplugged network / expired key / quota exceeded | Actionable error and bounded behavior |
| First run / upgrade / uninstall / startup toggle | No ghost entries or double launch |
| Hindi, English, Hinglish; technical acronyms | Accuracy recorded, output language respected |
| Hold vs toggle hotkey, conflicts, custom function key | Correct key-up and state behavior |
| Crash during recording, Windows sleep/resume | Mic released; no stuck listening session |
| Clipboard contents changed during insertion | Avoid clobber; honest recovery |
| Accessibility, screen reader, keyboard-only | All settings reachable |

**Release blocker:** no production release until at least one real packaged Windows installation passes a full start→dictate→insert→close→restart test and security review. Automated mocks alone are not sufficient.

## 15. Delivery milestones (do not stop at UI)

### Milestone 0 — Repo & security scaffold

Working build, Electron main/preload/renderer, app icon, single-instance, style system, safe IPC, lint/typecheck/test scripts, CI baseline, docs. No key in renderer or source.

### Milestone 1 — Real dictation vertical slice (highest priority)

Settings key save/test, mic permission, audio worklet + PCM16 resampling, real Gemini streaming, Smart final text, toggle global hotkey, waveform bubble, capture original target, insert to Notepad and browser. Test with real key and recording; no mocks in packaged runtime.

### Milestone 2 — Production-grade Windows integration

Target tracking, robust clipboard restore/injection, fallback Copy, errors, recovery, multi-monitor/DPI, tray/startup, pause, close-to-tray, hold mode/native helper if actually reliable.

### Milestone 3 — Product finish

All Settings persist and work; onboarding polish, dictionary, history opt-in, accessibility, theming, reduced motion, diagnostics/privacy docs, update checking.

### Milestone 4 — Commercial/open-source release readiness

Installer/uninstaller, code signing hook, clean machine testing, security review, dependency/SBOM checks, LICENSE, README, CONTRIBUTING, versioning, GitHub Releases, checksums, update strategy, documented limitations.

> Prioritize a reliable voice→text→paste loop over features such as snippets, expanded captions, integrations, or fancy animation. If a feature is not working, say so in the release notes instead of pretending it exists.

## 16. GitHub deliverables

Produce a genuinely helpful README with badge icons where appropriate, concise screenshot/GIF captured from **actual running software**, privacy caveats and transparent BYOK wording. Include:

1. App name/logo/tagline and honest intro.
2. Screenshot of real dashboard plus real overlay (never fake screenshot).
3. **Download Windows installer** from a real GitHub Releases link, never an invented URL.
4. What it does: shortcut, Smart dictation, app-wide insertion, Unicode/multilingual, local settings and dictionary, tray and autostart.
5. What it costs: **Seyvo $0 subscription / Google Gemini API usage according to user account and Google's terms**. Link provider pricing.
6. Setup: Google AI Studio API key, Save and Test, mic access, shortcut, start dictating.
7. Supported Windows versions, known target-app limitations, internet requirement, microphone requirement.
8. Comparison: “Independent open-source alternative to Wispr Flow for Windows” with **not affiliated** disclosure; no copy/paste of competitor graphics.
9. Privacy/security: provider receives audio, key encrypted locally, no default history, paste uses system clipboard (if enabled), opt-in diagnostics only.
10. Build from source, requirements, scripts, local mock testing, release docs, license and contributions.
11. Usage problems: can't paste into admin app, hotkey occupied, permission denied, 429/quota exhausted, microphone disconnected.
12. Commercial license and third-party attribution.

### Suggested truthful README opening

```md
# Seyvo
**Speak. Refine. Paste.**

A free-to-download, open-source voice dictation app for Windows. Press your
shortcut, speak naturally, and insert clean text into the app you're already
using—powered by Gemini Live Transcribe with **your own Google API key**.

- No Seyvo subscription or account required.
- Real-time waveform, Smart or Verbatim transcription, and one-shortcut insertion.
- A system tray utility designed for Windows.

> Requires an internet connection and a Google Gemini API key. Google quotas,
> billing and data-use terms apply. Seyvo is independent and is not affiliated
> with Wispr Flow or Google.
```

### GitHub Release checklist

- Generate NSIS per-user installer, optional portable ZIP if supported; verify uninstall and updates.
- Sign binaries/installer if a signing certificate is available; if unsigned, transparently explain Windows SmartScreen prompts, not how to bypass protection.
- Build x64 first; ARM64 only with validated native addons.
- Attach checksum file and release notes, verify downloaded artifact in clean VM.
- GitHub Actions with least-privilege tokens, pinned actions, protected release environment and secret handling.
- Vulnerability scan, dependency-license review, SBOM, no secrets in packaged asar or source maps.
- Crash/error reports disabled by default; only opt-in, redacted diagnostic export.
- Tag semantic version e.g. `v1.0.0`; don't claim release exists before publishing it.

## 17. Acceptance tests / definition of done

**Functional launch gate:**

```text
Given Seyvo is installed and the user has entered a working Gemini API key,
And a regular Windows application text field contains the caret,
When the user presses the configured shortcut,
Then a non-focus-stealing bubble shows actual microphone levels and mic state,
And the app streams user speech to Gemini Live Transcribe,
And the user presses the shortcut again,
Then the FINALIZED Smart transcript is inserted at the original caret,
And no Enter/submit occurs,
And the microphone and WebSocket close,
And the existing unrelated clipboard state is preserved as safely as possible.
```

**Failure launch gate:**

```text
Given insertion into the previous target is blocked or cannot be verified,
When dictation finishes,
Then Seyvo preserves the finished text for recovery,
And shows Copy / Retry insertion / Dismiss,
And NEVER inserts into an unrelated focused app,
And NEVER reports verified success without evidence.
```

**Privacy launch gate:**

```text
With Seyvo idle, the mic is off and no audio is transmitted.
With settings UI open, no component can retrieve a stored plain-text API key.
No key/audio/clipboard contents are included in logs or telemetry.
History is disabled unless user opted in.
```

Complete checkboxes only after verified implementation and tests. Provide final handoff: supported features, commands, `.exe` output location, actual test results, remaining limitations, and signing/release status.

---

## 18. Developer scripts and build requirements

Use `pnpm` (or another lockfile-backed JS package manager with justification), with consistent scripts:

```json
{
  "scripts": {
    "dev": "<run Electron + Vite dev>",
    "typecheck": "<TypeScript checks for main/preload/renderer>",
    "lint": "<ESLint>",
    "test": "<Vitest>",
    "test:e2e": "<Electron e2e>",
    "build": "<compile + package app files>",
    "dist:win": "<produce Windows installer>",
    "check": "<lint + typecheck + test + build>"
  }
}
```

Replace ALL placeholders with actual working commands before declaring the milestone complete. Maintain `pnpm-lock.yaml`; include `.gitignore`, `.editorconfig`, formatter config, architecture decision records and helpful error boundaries. Never bundle sample real API keys.

## 19. Source and version maintenance

This document reflects public docs visible on **7 Nov 2026**. At implementation/release time, verify:

- Google streaming model identifier, region availability, JavaScript SDK Live API examples, audio format, readiness events, stream limits, free/paid data terms and current pricing.
- Electron `globalShortcut` and `app.setLoginItemSettings` Windows semantics.
- Electron `safeStorage` **async** methods and DPAPI properties in current runtime.
- Electron Security checklist, code-signing/installer requirements, Microsoft supported Windows versions, dependency licenses.

Official references:
- https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
- https://ai.google.dev/gemini-api/docs/pricing
- https://www.electronjs.org/docs/latest/api/global-shortcut
- https://www.electronjs.org/docs/latest/api/app
- https://www.electronjs.org/docs/latest/api/safe-storage
- https://www.electronjs.org/docs/latest/tutorial/security
- https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput

**Final guiding principle: a tiny, dependable Windows utility users trust—not merely a beautiful React screen.**
