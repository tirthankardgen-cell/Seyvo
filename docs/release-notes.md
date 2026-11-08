Seyvo 0.1.10 — optional one-key dictation.

Your existing key combination stays selected by default. In Settings, choose **Activation method → Single key → Right Ctrl**, then choose:

- **Hold to talk:** hold Right Ctrl for three seconds, speak while holding, and release to finish.
- **Hold to start:** hold for three seconds, release and speak, then tap/release Right Ctrl again to finish.

Wait for Listening before speaking. Short presses do not open the microphone, normal Ctrl combinations keep working, and Pause disables the listener. Switching back restores your saved combination. Bare Fn has no standard Windows key event and is shown as unavailable; it is not advertised as working.

Verified on installed build `64ba3b8651e3`: both gestures through actual Windows input events, real Google transcription of generated speech, exact native insertion, microphone teardown, upgrade with unchanged encrypted key/preferences, and packaged smoke checks. These are automated Windows key events, not physical keyboard presses or a new human-speech accuracy claim. The source passed 73 core tests and all 12 Electron scenarios in Windows CI. See [the validation record](https://github.com/tirthankardgen-cell/Seyvo/blob/main/docs/shortcut-validation-0.1.10.md).

This is an **unsigned Windows x64 validation prerelease**, not a stable release. Signing, clean-machine and remaining physical acceptance gates remain open. No automatic updater is included.

Installer SHA256: `f734d86958470696de817a4ef8e92a44b2620f39946aa604393c9af32e5f0dac`.
