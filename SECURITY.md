# Security policy

Seyvo 0.1.x is in development. Stable production support begins only after the release acceptance gates in `docs/release-checklist.md` are met. Maintain the latest patched release; older binaries are not promised backports.

Report vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/tirthankardgen-cell/Seyvo/security/advisories/new) when enabled. If unavailable, open an issue requesting a private contact **without exploit details or sensitive data**. Do not publish keys, real transcripts, clipboard contents or private audio. Acknowledgement and remediation are best effort; no response-time SLA is offered.

## Security properties

- Sandboxed renderers with context isolation, no Node integration, local assets, CSP, navigation denial and allowlisted external links.
- Main owns state and secrets. IPC checks window identity, main frame, exact URL, schemas and size bounds. Recorder has a separate bridge; overlay has read-only authorization.
- Async Windows credential encryption; no plaintext key in preferences, command arguments, logs or bundles. No telemetry or audio persistence.
- Direct TLS WebSocket to Google's fixed host. Upload buffer, message size, connection duration and finalize waits are bounded. No background retries or downloads of executable code.
- Private native stdin/stdout protocol; no arbitrary shell commands, process injection, keyboard hooks, or generic clipboard read API. Input is explicitly activated and targeted. No Enter submission.
- Original foreground process/control/caret checks before input. Unsupported clipboard formats are refused. Clipboard restoration is conditional on sequence number.
- Production Electron fuses disable RunAsNode, NODE_OPTIONS and Node CLI inspection, require ASAR, and enable archive integrity validation. Per-user non-elevated installation.

## Limitations and review scope

OS input delivery does not prove a target accepted the text. The UI retains recovery and labels insertion uncertainty. Windows focus may change in the small interval between the final check and SendInput; no desktop automation can make an arbitrary third-party UI transaction atomic. Protected, elevated, secure or remote desktops are unsupported. Clipboard managers may retain temporary data. Same-user malware, compromised Google accounts and OS-level compromise are outside the app's protection boundary.

Review authentication, IPC authorization, cancellation/late callbacks, microphone lifetime, target verification, clipboard restoration, storage and release integrity. See `docs/privacy-threat-model.md` and recorded QA. Dependency audits must pass before shipping; CI must not execute untrusted PR code with release credentials. Signing is configured only with owner-controlled credentials, never a committed certificate.
