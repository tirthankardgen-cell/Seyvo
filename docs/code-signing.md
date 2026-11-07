# Code signing policy

Seyvo 0.1.7 is currently **unsigned**. No certificate, signing-service approval or verified publisher identity is configured. MIT allows commercial use; it does not make an unsigned binary a signed release. We do not instruct users to disable Windows security controls.

## Free online option for the owner

[SignPath Foundation](https://signpath.org/) offers free signing for eligible open-source projects. Start at its [online application](https://signpath.org/apply) and read the [current conditions](https://signpath.org/terms). These pages were checked on 7 November 2026. Approval is discretionary, and executable projects need verifiable reputation; a new project is not guaranteed acceptance or immediate service.

The certificate is issued to **SignPath Foundation**, which appears as publisher. It does not establish a certificate in the maintainer's personal or company name. The private key stays in the service's hardware security module. Do not buy or create a self-signed certificate expecting equivalent public Windows trust.

1. Sign in as the repository owner and enable multi-factor authentication for GitHub and the signing account. The current automation credential has push access, not repository administration.
2. Apply with the public repository, existing Windows release, MIT license, project description and the privacy links below. Declare that dictation sends audio directly to Google under the user's own key; do not describe it as offline.
3. Identify the actual authors, reviewers and release approvers. The current maintainer is [tirthankardgen-cell](https://github.com/tirthankardgen-cell); additional roles and MFA status need owner confirmation. External contributions must receive review. Each production signing request needs a trusted human approver.
4. If approved, configure their repository/build-origin integration and exact artifact rules. Restrict product names/versions and sign Seyvo's own app, native helper and installer. Do not re-sign unrelated upstream binaries under the project's certificate.
5. Put service tokens in the protected GitHub `release` environment, scoped only to signing. Require reviewed `main`/version-tag source and release approval. Never put tokens or certificate passwords in issues, logs, commits or this document.
6. Validate the integration on a new prerelease. Download the resulting artifact, check its timestamp, publisher and trust, and repeat the installed acceptance checks before considering a stable release.

After approval and successful signing, add the attribution required by their terms: “Free code signing provided by SignPath.io, certificate by SignPath Foundation.” **This is a future requirement, not a claim of current sponsorship or signing.** Acceptance of their terms and submission of the application are owner actions.

## Application details

- Project: Seyvo, a Windows voice dictation utility.
- Repository: https://github.com/tirthankardgen-cell/Seyvo
- Existing distribution: https://github.com/tirthankardgen-cell/Seyvo/releases/tag/v0.1.7
- License: [MIT](../LICENSE); no commercial dual-license or proprietary app backend.
- Function: explicitly activated microphone capture, direct Gemini transcription, guarded insertion into the user's original text field; no automatic submission.
- Privacy: [PRIVACY.md](../PRIVACY.md), [Google Gemini terms](https://ai.google.dev/gemini-api/terms) and [Google privacy policy](https://policies.google.com/privacy).
- Build: Windows x64, Node 26.13.0, npm lockfile, Electron and a small C# helper; checked-in build and draft-release workflows.
- Distribution evidence: versioned installer, SHA256 checksums, dependency SBOM/license inventory, security review and real Windows acceptance records.

The maintainer must supply contact details and attest to project ownership, roles and account security. No application has been submitted by the coding agent.

## Verification and other signing providers

Inspect the current unsigned output:

```powershell
npm run verify:signatures -- -AllowUnsigned
```

For a signed build, run without that switch and provide the **exact subject of the approved certificate**, obtained from the signing provider:

```powershell
npm run verify:signatures -- -ExpectedSubject '<approved certificate subject>'
```

The strict check fails unless the installer, Seyvo executable and native helper all have `Valid` Authenticode signatures, timestamps and the expected publisher. A signature is evidence of publisher/integrity, not proof of bug-free software or guaranteed SmartScreen reputation. Third-party library signatures are separate from first-party signing.

The draft-release workflow's `require_signatures` input enables this strict gate using the protected release environment variable `SEYVO_SIGNER_SUBJECT`. Its default remains an explicitly unsigned validation build. Enabling the check does not provision a certificate or create a signing-service account.

The existing builder also accepts owner-provided `CSC_LINK` and `CSC_KEY_PASSWORD` for a compatible trusted certificate. Paid commercial certificates/services are alternatives if the foundation declines the project or a company-name certificate is required; no purchase is necessary to apply for the free program. Signing integration must be tested with the actual approved service before declaring it operational.
