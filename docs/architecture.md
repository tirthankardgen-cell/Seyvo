# Architecture

Seyvo is a Windows x64 Electron application with React views and a narrowly scoped .NET Framework native helper. `src/shared/brand.ts` centralizes user-facing identity/links; installer appId and metadata are explicit in `electron-builder.yml`.

```mermaid
flowchart LR
  U[Explicit shortcut or action] --> M[Electron main: single session owner]
  M --> N[C# helper: target metadata and SendInput]
  M --> R[Sandboxed recorder]
  R --> W[AudioWorklet: FIR / PCM16 / RMS]
  W -->|bounded packets| M
  M -->|TLS audio, user key, vocabulary| G[Google Live Transcribe]
  G -->|interim / final events| M
  M -->|final text only| N
  N -->|verified target / clipboard transaction| T[Original application]
  M -->|typed public snapshots| V[Dashboard / nonactivating overlay]
  M --> S[Validated preferences / encrypted vault and history]
```

## Ownership and trust

`SessionCoordinator` owns one immutable session ID, cancellation token, captured target, settings snapshot, provider and timer. Renderer components consume snapshots and issue typed actions; they never own recording state. Settings changes are serialized and blocked during capture. The recorder's bridge contains only audio packet/event methods. Main validates window, main frame, exact URL, schema and bounds on every IPC call. The overlay can read state but cannot perform dashboard mutations. Saved keys and native handles never cross the UI bridge.

`Windows` restricts permission to audio in the recorder during an authorized capture. No remote page is loaded into an app window. Browser opens use named fixed links. The hidden recorder loads only when needed. Its AudioWorklet low-pass filters, downmixes and converts input to 16 kHz PCM16; max four IPC packets await acknowledgement. Provider upload stops if socket buffering exceeds 64 KB. No audio is persisted.

Microphone discovery happens in the authorized recorder after it obtains a stream. It reports at most 32 bounded input descriptors through validated, session-scoped IPC. Main keeps the list in memory for the dashboard; the overlay receives no device descriptors. Only the chosen device ID is persisted as a preference. The dashboard cannot capture audio, even after a recorder has received permission. Device-change listeners exist only during capture. Permission denial and unavailable-device errors destroy the recorder window, leave the microphone off and show a dismissible error on every dashboard page.

## Provider contract

`GeminiLive` implements the official WebSocket setup/realtimeInput protocol, using installed `@google/genai` types for transcription messages/configuration. The SDK 3.0.0 `Session.conn` exposes only connect/send/close, and pending `live.connect()` does not expose a cancellation handle. The verified protocol adapter was selected for deterministic terminate, handshake timeout, max message payload and bufferedAmount checks. It uses only Google's fixed endpoint and the user's key; no proxy.

Audio begins after `setupComplete`. Interim text replaces preview, never enters insertion. Final segments deduplicate by provider offsets when present; without offsets, matching text at the same audio-sequence position is a duplicate. Identical speech at different positions is retained. There is no guaranteed globally unique provider segment identifier; tests and release review must monitor protocol changes.

Each explicit dictation uses Google's documented manual activity boundaries: automatic VAD is disabled, setup completion is followed by activityStart, and stop drains recorder packets before activityEnd. This avoids depending on a silence boundary that might occur before the user stops. The adapter handles generationComplete (observed in the live transcription service), turnComplete and optional transcription.finished, followed by a quiet drain interval. A ten-second timeout retains only committed segments and never auto-inserts partial output. A five-minute default session cap remains below Google's documented ten-minute ceiling (configuration capped at nine minutes). Errors are reduced to fixed messages, not logged raw. No automatic paid retry or second rewrite call.

## Native integration and insertion

The helper runs as the same user, communicates through inherited pipes, and supports ping/capture/insert/clear plus three named sound cues. It retains a single opaque target token. Capture uses foreground HWND/PID/thread/process start time, focused child, UI Automation runtime identity, optional selection endpoints and caret geometry. Only editable Edit/Document controls with writable ValuePattern or TextPattern properties qualify. It does not retrieve field text. Every insertion verifies the original foreground field and position. It does not force-focus unrelated windows. Temporary process handles are disposed after identity checks.

Opt-in start/stop/error cues are original synthesized PCM tones. Cached SoundPlayer instances use asynchronous Windows mixer playback; the app does not alter system volume or mute. Cue failure does not interrupt dictation. The explicit preview action reports playback errors. The coding preset is merged with user vocabulary only when enabled, deduplicated and capped at 1,000 entries with user terms first.

Clipboard insertion snapshots only supported HGLOBAL formats (text/Unicode/locale/DIB/DIBV5/HTML/RTF/PNG) within 16 MB. Unsupported formats cause refusal before mutation. It samples the sequence after CloseClipboard publishes the new data, then checks clipboard owner, sequence, modifiers and target before Ctrl+V. Restoration after 800 ms requires both owner and sequence still to match; a concurrent copy is preserved. Direct Unicode input is limited to single-line text up to 5,000 UTF-16 code units and never synthesizes Enter. A native request has a five-second timeout; the helper is terminated on hangs, invalidating target tokens.

The first helper handshake has a 15-second allowance for cold .NET/Windows initialization; capture and insertion keep the five-second operation timeout. No universal acknowledgment exists for third-party paste. The application always retains recovery and reports uncertainty after attempted input. The user dismisses, copies or explicitly retries after checking for duplicate insertion.

## Lifecycle and storage

Single-instance lock, tray persistence, opt-in installed startup, pause/unregister, close-to-tray preference, explicit quit and suspend/lock cancellation. Cancellation invalidates session before awaited cleanup. Recorder permission and tracks close; sockets terminate. Disk writes flush a same-directory temporary file and rename it. Redirected profiles that return EXDEV use a checksummed, flushed `.pending` journal before copying the destination. Readers prefer a complete journal; interrupted journals cannot replace the last durable value. The next write finishes recovery before replacing a committed journal. Key/history bytes are encrypted before either path, and removal deletes both destination and journal. Settings schema version 1 restores defaults with a backup for corruption. Async Windows encryption protects key/history; files are not portable across Windows accounts. History is bounded by age/count and disabled by default.
