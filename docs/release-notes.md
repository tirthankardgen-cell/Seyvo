Seyvo 0.1.7 — Windows x64 validation prerelease.

Fix clipboard paste by preserving supported screenshot images, native bitmap rendering, Chromium text/HTML source metadata and Windows clipboard privacy flags. Unsupported or unavailable data still causes safe refusal. Temporary paste text requests exclusion from Windows history/cloud sync; other clipboard readers may still observe it. Original-field checks, one-shot insertion, concurrent-copy protection and no auto-submit remain unchanged.

Remove the opaque rectangle around the microphone bubble in all themes. Completion hides after 1.5 seconds; errors/recovery hide after eight seconds while the words remain available in Home. Starting another dictation replaces the last in-memory result as previously requested.

Fix the Launch when I sign in switch's OS readback and add visible confirmation. Test both values across restart, quiet sign-in launch and second-instance handoff. Guard pending window requests during shutdown and identify startup failures by initialization stage without exposing raw errors.

Seyvo is open source under MIT. Anyone may download and use it, including commercially. Contributions are welcome under CONTRIBUTING.md and the new Code of Conduct. Internet and your own Gemini API key are required; Google charges, quotas and data terms apply.

Validation: 51 unit/integration tests and 11 Electron scenarios passed. Native multiline Hindi/emoji paste passed with an existing screenshot clipboard and exact image/flag restoration, including a second helper process. Windows Notepad paste passed with paragraph-preserving line-ending normalization. Packaged lifecycle checks passed. The repository QA record separates these observations, final installed/live results, synthetic tests and remaining physical acceptance.

Interactive setup keeps Create a desktop shortcut and Run Seyvo checked by default, with working opt-outs. Your encrypted key and preferences are retained on upgrade. The release includes an unsigned x64 installer, checksums, runtime SBOM and license inventory.

This remains an unsigned validation prerelease. Signing, fresh-machine and physical/accessibility acceptance, and owner-controlled brand/provider launch decisions remain stable-release gates. The required English, Hindi and Hinglish checks passed. Another app's acceptance cannot universally be confirmed; inspect the destination before retrying. There is no Seyvo subscription, backend, telemetry or automatic updater.

Final installed source `468d3f3c0e3f` passed two real Google/generated-speech cycles using automatic clipboard paste: 55 characters each, with exact cumulative target text and exact preservation of the original text/HTML clipboard and Chromium metadata. Physical microphone discovery/open/stop, startup persistence/quiet launch, second-instance behavior, production fuses and clean exit also passed. Windows CI: https://github.com/tirthankardgen-cell/Seyvo/actions/runs/42356338693.

Installer SHA256: `26f70a358763c0782d14ed5d356a28b0d9e9dec2469693262f219c0577473389` (124,740,888 bytes). The signature status is NotSigned.

Post-release acceptance: short human English, Hindi and Hinglish samples matched their prompts and pasted exactly with clipboard restoration and microphone stop. Edge plain/rich fields, Word and VS Code received multilingual multiline paste; unsafe/changed/duplicate browser targets refused input. The 44-file security diff review found no new reportable vulnerability. A test-only diagnostic privacy fix and signing-verification tooling are on main; the installed binary is unchanged. The QA record retains initial timing/prompt and one shutdown-test failure separately from the successful observations.

Code signing policy: https://github.com/tirthankardgen-cell/Seyvo/blob/main/docs/code-signing.md. The owner submitted the free SignPath Foundation application and shared its receipt email on 7 November 2026. Review, approval and signing setup are pending; the installer remains an unsigned prerelease. Clean-machine/physical/accessibility and owner launch gates remain open.

Known validation issue: an intermittent shutdown-test timeout appeared after successful repeated-dictation assertions in follow-up Windows CI. Two local diagnostic repeats exited cleanly, but the cause is unresolved. This remains a stability gate; see the QA record for failed and successful attempts.
