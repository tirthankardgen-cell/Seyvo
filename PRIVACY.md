# Seyvo privacy notice

Effective date: 7 November 2026. Applies to the source distribution and 0.1 development builds. Seyvo is an independent Windows application maintained by Tirthankar Dasgupta, with no Seyvo account, transcription server, analytics or crash-upload service.

## What goes where

| Data | Processing and retention |
| --- | --- |
| Microphone audio | Captured only after explicit activation. Local mic tests do not upload. Dictation audio streams directly to Google's Gemini API under your key. No audio files are written by Seyvo. Tracks and buffers are released on stop, cancellation, failure or exit. |
| Microphone devices | After explicit capture starts, the recorder discovers available input IDs/names for the device selector. The list stays in local process memory until exit and is not sent to Google, the overlay or diagnostics. Only the selected device ID is saved in preferences. |
| API key | Entered once in the settings window, cleared from the input when submitted, tested in main, encrypted using Electron's asynchronous Windows credential protection, and stored in `key.enc`. A saved key is never returned to the UI. |
| Transcript | Finalized segments are held in memory for insertion and recovery. Interim captions are hidden by default. Dismiss or quit clears in-memory recovery. JavaScript memory and OS swap cannot be guaranteed to be securely erased. |
| History | Off by default. When enabled, final text and timestamp are encrypted in `history.enc`; optional app executable names require a separate setting. Default retention is seven days and at most 100 entries. No recorded audio is saved. Disabling history deletes its file. |
| Preferences/dictionary | Local JSON in the Windows user profile. Dictionary entries and language hints are sent to Google in dictation setup. No cloud synchronization. |
| Target metadata | Window/process/focus/caret identity is captured to prevent misdirected insertion. Seyvo does not read the target field's text, window title, screenshots or unrelated keystrokes. |
| Clipboard | Clipboard paste temporarily writes finalized text and restores supported prior formats when the clipboard sequence is unchanged. Copy, paste test, history-copy and diagnostics-copy intentionally replace clipboard contents. Other applications, clipboard managers and Windows clipboard history may observe clipboard text. |

Expired history entries are hidden when history is read and removed from the encrypted file on the next history or settings write. There is no timer that erases ciphertext at the exact expiry time. Clear history or disable it to delete the current encrypted history file and recovery journal immediately.

## Google's processing

An internet connection and Google account/API key are required for dictation. Audio, vocabulary and authentication are transmitted to Google over TLS. Google controls its service logs, retention, model processing, account geography and free/paid tier data treatment. Review [Gemini terms](https://ai.google.dev/gemini-api/terms), [Google privacy](https://policies.google.com/privacy) and [pricing](https://ai.google.dev/gemini-api/docs/pricing) before use. Seyvo does not claim cloud transcription is offline, free of API charges or exclusively local.

The key/model test sends the current language hints and dictionary in Google setup, just as dictation setup does; it does not capture or send microphone audio.

## Control and deletion

Pause disables the shortcut and cancels recording. Excluded executable names prevent activation in listed applications. Settings can remove the saved key, disable/clear history and clear the dictionary. Recovery can be dismissed. JSON history export is **unencrypted** and requires a save dialog; you control its destination and deletion.

Default application data is `%APPDATA%\seyvo` (Electron may normalize the application folder's case). Uninstall preserves data for reinstall. Quit Seyvo, then remove that explicitly identified folder if you want to delete remaining preferences, encrypted files and Chromium cache. Corrupt settings are preserved locally as `settings-invalid-*.json`. Interrupted writes on redirected profiles can leave `.pending` recovery journals; key/history journals contain encrypted bytes and are removed by the corresponding key/history deletion controls. Deletion is not a forensic secure erase and does not remove backups, Windows clipboard history, exported files or Google's copies.

Windows protection separates user accounts; malicious software with access as the same signed-in user may still obtain credentials. Keys necessarily exist in trusted process memory during provider requests. Diagnostics are copied only on request and contain app/runtime versions and coarse flags, not keys, transcripts, raw errors, audio or clipboard content. Do not include private transcripts or keys in public support reports.

Privacy questions can be raised through the [repository](https://github.com/tirthankardgen-cell/Seyvo); use private security reporting for sensitive issues. There is no commercial support SLA or paid service operated by Seyvo in this release.
