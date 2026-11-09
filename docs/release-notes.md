Seyvo 0.1.11 fixes single-key dictation feedback and release handling.

- The bubble appears during the three-second hold with Microphone off, then shows Listening. A hidden active bubble is restored without taking focus; a crashed bubble stops recording.
- A Windows held-key check recovers missed release events so hold-to-talk ends when the key is released.
- Fn remains selectable. Its 12-second hardware check requires two physical hold/release pairs before enabling a supported Fn mapping. Firmware-only Fn and unsupported vendor events cannot be detected; physical Fn compatibility has not been validated on a supported keyboard.

Verified: 79 core tests and 14 Electron scenarios, successful Windows CI, installed upgrade with unchanged encrypted key/preferences, physical microphone open/select/stop, production fuses, and two installed real-Google/generated-speech sessions with visible bubbles, exact paste, ended tracks and clean exit. Scripted Windows key events and seeded Fn mappings are distinct from physical-key acceptance.

Unsigned Windows x64 validation prerelease. Signing, clean-machine and broader physical acceptance gates remain open. No automatic updater is included.

Installer SHA256: 8b762776afd639ce02c8b094419f98f19d4cd9ec2909eb347336becb2413adaf
Installer size: 124749383 bytes
Built application source: 6bb9f44c6c382a72fea0410254237946e317371a
CI: https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42691770191
Validation: https://github.com/tirthankardgen-cell/Seyvo/blob/main/docs/shortcut-validation-0.1.11.md
