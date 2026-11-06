# Release procedure and gates

Development builds are distinct from production readiness. Do not publish a stable release until all required observations below are recorded. A source push is not a claim that live acceptance or signing passed.

1. Use a clean checkout of the intended commit. Install Node 26 LTS, run `npm ci`, `npm run check`, `npm run test:e2e`, `npm audit`, license inventory and `npm run dist:win`.
2. Inspect x64 package resources: main/preloads/renderers, native helper, original icon, license/privacy/notices, production fuses, no development key, source maps, private profile or transcript fixture.
3. Install NSIS as a normal user into a clean Windows environment. Confirm correct publisher/signature status, icon, Start menu shortcut, single instance, startup opt-in/readback, close-to-tray, quit, restart, upgrade and uninstall. Confirm startup entry is removed; document retained profile data.
4. **Required:** enter a user-owned key in the app, verify exact model availability, complete packaged start -> dictate -> insert -> close -> restart. Observe actual mic-off and socket teardown. Test English/Hindi/Hinglish without logging private speech. Verify failure recovery and target refusal. Update `tests/manual-windows-qa.md` with results and build hash.
5. Review security boundaries and dependency/license reports. Record untested compatibility matrix entries honestly; no mock-only production release.
6. Owner completes trademark review (see naming document), Google commercial terms review for launch markets, maintainer/support identity and release policy. MIT permits commercial reuse; it is not trademark clearance or Google service authorization.
7. Configure a trusted code-signing certificate through protected CI secrets `CSC_LINK` and `CSC_KEY_PASSWORD` (or supported external signing service). Sign helper and Electron/installer binaries, timestamp, then verify `Get-AuthenticodeSignature`. Never commit keys or upload them to untrusted PR jobs. Without credentials, produce an explicitly unsigned development installer. Do not instruct users to disable Windows security controls.
8. Generate SHA256 checksums, SBOM and version-specific notes. A GitHub release workflow creates a **draft prerelease** by default. Owner/maintainer reviews gates before making it public/stable. Use semantic tags matching package.json. Pin third-party actions to reviewed commit SHAs and keep `contents: write` confined to the release job.
9. Download the actual hosted installer, verify checksum/signature, install in a fresh profile/VM and check artifact links. Add the verified download URL to README only once it exists.

Current expected output: `dist/Seyvo-0.1.0-windows-x64-setup.exe`; existence and checksum must be verified after a successful packaging run. Manual updates open the fixed repository releases page; there is no background automatic installer. Reproducible means documented locked inputs and repeatable process, not an unproven bit-for-bit deterministic signed binary claim.

The initial [0.1.0 validation prerelease](https://github.com/tirthankardgen-cell/Seyvo/releases/tag/v0.1.0) contains the unsigned x64 installer, SHA256SUMS.txt, CycloneDX SBOM and license inventory. The QA record identifies passed gates and pending human/compatibility/commercial-launch decisions. Publication as a prerelease does not waive those stable-release gates.
