# Changelog

## 0.1.0 — development

Initial implementation of the Windows dictation utility: Google Live Transcribe Smart/Verbatim protocol adapter, dedicated PCM recorder, toggle shortcut, nonactivating bubble, target-aware Win32 insertion with clipboard preservation, recovery, DPAPI key storage, local dictionary and encrypted opt-in history.

Includes per-user NSIS packaging, automated checks and release documentation. This version is not yet declared production-ready. See `tests/manual-windows-qa.md` for observed validation and `docs/release-checklist.md` for remaining gates. Push-to-talk, ARM64, automatic updates, snippets and near-caret overlay placement are not shipped.

Live validation fixes include opaque API-key input, CommonJS WebSocket import compatibility, durable encrypted writes in redirected Windows profiles, explicit Google activity boundaries/generation-completion handling, and clipboard sequence/ownership checks after Windows publishes the clipboard. The packaged path passed real Google transcription and native insertion with a generated speech fixture; live human speech remains an acceptance item.
