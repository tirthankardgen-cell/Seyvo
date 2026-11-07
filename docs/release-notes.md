Seyvo 0.1.7 — Windows x64 validation prerelease.

Fix clipboard paste by preserving supported screenshot images, native bitmap rendering, Chromium text/HTML source metadata and Windows clipboard privacy flags. Unsupported or unavailable data still causes safe refusal. Temporary paste text requests exclusion from Windows history/cloud sync; other clipboard readers may still observe it. Original-field checks, one-shot insertion, concurrent-copy protection and no auto-submit remain unchanged.

Remove the opaque rectangle around the microphone bubble in all themes. Completion hides after 1.5 seconds; errors/recovery hide after eight seconds while the words remain available in Home. Starting another dictation replaces the last in-memory result as previously requested.

Fix the Launch when I sign in switch's OS readback and add visible confirmation. Test both values across restart, quiet sign-in launch and second-instance handoff. Guard pending window requests during shutdown and identify startup failures by initialization stage without exposing raw errors.

Seyvo is open source under MIT. Anyone may download and use it, including commercially. Contributions are welcome under CONTRIBUTING.md and the new Code of Conduct. Internet and your own Gemini API key are required; Google charges, quotas and data terms apply.

Validation: 51 unit/integration tests and 11 Electron scenarios passed. Native multiline Hindi/emoji paste passed with an existing screenshot clipboard and exact image/flag restoration, including a second helper process. Windows Notepad paste passed with paragraph-preserving line-ending normalization. Packaged lifecycle checks passed. The repository QA record separates these observations, final installed/live results, synthetic tests and remaining physical acceptance.

Interactive setup keeps Create a desktop shortcut and Run Seyvo checked by default, with working opt-outs. Your encrypted key and preferences are retained on upgrade. The release includes an unsigned x64 installer, checksums, runtime SBOM and license inventory.

This remains an unsigned validation prerelease. Signing, fresh-machine and broader physical/language/accessibility acceptance, and owner-controlled brand/provider launch decisions remain stable-release gates. Another app's acceptance cannot universally be confirmed; inspect the destination before retrying. There is no Seyvo subscription, backend, telemetry or automatic updater.
