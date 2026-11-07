Seyvo 0.1.6 — Windows x64 validation prerelease.

Fix the repeat-dictation workflow. After Windows input is sent, Seyvo returns to Ready. Pressing the shortcut again starts a fresh dictation at the current field and caret, replacing the last in-memory transcript. A failed or incomplete result can still be copied or explicitly retried before starting again. Old text is never replayed automatically, and history stays off unless enabled by the user.

Shortcut saves now show confirmation, disable Save after success and display the active or paused binding. Invalid combinations receive guidance; a conflict keeps the previous working shortcut and explains the refusal. Microphone levels retain fractional RMS feedback. Error and recovery bubbles stay visible until handled, while local microphone tests and no-speech results have distinct labels.

Create a desktop shortcut and Run Seyvo are selected by default in interactive setup. Either option can be unchecked. The app opens when setup finishes with Run selected; the microphone stays off until explicit activation.

Source validation passed typecheck, lint, production build, 51 unit/integration tests and 11 Electron scenarios. The repeat-session regression uses the real coordinator and Windows input with synthetic capture/provider events. The release record separates these tests from installed live-Google and physical-microphone observations. No test records credentials, private transcripts or audio.

This is an unsigned prerelease, not a stable commercial launch. Wider English/Hindi/Hinglish, fresh-machine and physical Windows compatibility checks, signing and owner-controlled brand/provider launch decisions remain gates. “Text sent” describes the Windows input attempt; another application's acceptance is not universally observable. Check the destination before retrying. Seyvo never submits a field or silently switches insertion methods.

Requires Windows x64, a microphone, internet and a user-owned Gemini key with model access. Google quotas, charges and data terms apply. The app and source use MIT with third-party notices. No Seyvo backend, telemetry, subscription or automatic updater is shipped.

The published release includes the installer, SHA256SUMS.txt, runtime CycloneDX SBOM and full lockfile license inventory. Uninstall preserves the encrypted profile; PRIVACY.md describes deliberate removal. At the user's request, this release replaces the older downloads. Historical validation remains in the repository's evidence records and commit history.
