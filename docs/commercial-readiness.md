# Commercial use and launch decisions

The application and original artwork use MIT. Commercial use, modification and redistribution are permitted when the copyright and license notices are retained. Bundled third-party components have their own notices; use the release SBOM and license inventory. Windows system fonts are referenced rather than redistributed.

Seyvo is a BYOK desktop utility, not a reseller of Google API access. Each user supplies a Gemini key, pays any provider charges and accepts Google's current service/data terms. There is no Seyvo subscription, backend, telemetry service or account system. Do not advertise unlimited free transcription, offline processing or guaranteed language accuracy.

The current deliverable is an unsigned Windows x64 validation build. Its real provider, native insertion, encrypted storage, automated checks and installer are implemented; the QA record identifies what was actually accepted. Before selling supported deployments or calling a release production-ready:

1. Complete the live spoken and target-application acceptance matrix on clean supported Windows machines. Choose an explicit OS/architecture support policy.
2. Obtain and protect an appropriate Windows signing identity. The [code signing policy](code-signing.md) provides the free SignPath Foundation online application route and prepared project details. Approval is not guaranteed. Timestamp the application/helper/installer and verify signatures on downloaded artifacts. Signing keys belong in protected CI secrets or a signing service, never the repository.
3. Complete the documented trademark review. The working name has a known phonetic neighbour; MIT does not provide trademark rights.
4. Confirm Google terms for launch markets and provider account types. Maintain the pricing/terms links as APIs evolve.
5. Publish a maintainer/support contact, response expectations and refund terms if independently selling paid support or distribution. The repository currently offers community issue tracking and no SLA.
6. Attach exact checksums, license inventory, SBOM, release notes and tested compatibility information to each release. Manual updates open the fixed GitHub Releases page; no automatic updater is shipped.

The code does not require a paid license server or an artificial feature restriction for commercial reuse. A future business model is an owner decision and must not silently change BYOK privacy promises or introduce hidden services.

## Reuse and distribution checklist

- Keep the MIT copyright and permission notice with copies or substantial portions of Seyvo. MIT permits proprietary modifications and paid redistribution; it does not require publishing your modifications.
- Preserve applicable third-party notices and review the exact dependencies you distribute. The project license does not replace their licenses or Google's service terms.
- Identify your own distributor and support terms. Do not imply endorsement by the original maintainer or Google, or represent the working brand as a cleared trademark.
- Describe provider charges, direct audio transmission, supported Windows versions, signature status and known limitations accurately to customers.
- If you offer paid services, publish your actual prices, support scope, privacy practices and applicable purchase/refund terms before accepting payments. This repository does not currently offer a paid support contract.
