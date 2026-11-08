# Frequently asked questions

## Is Seyvo free? Is it unlimited?

Seyvo is free to download and MIT-licensed, with no Seyvo subscription or paid feature tier. You supply your own Google Gemini API key. Google may charge for API usage and enforces quotas, model availability and account restrictions. A key alone does not guarantee free access. Dictation sessions have configurable duration limits (1, 3, 5 or 9 minutes). Do not treat Seyvo as an unlimited transcription service.

## Is this Wispr Flow or OpenAI Whisper?

No. Seyvo is an independently developed alternative to the shortcut-driven Windows dictation workflow. It uses Google Gemini for transcription, not OpenAI Whisper. It is not affiliated with Wispr Flow, Google or OpenAI.

## How do I start?

Download the Windows x64 installer from [GitHub Releases](https://github.com/tirthankardgen-cell/Seyvo/releases), install for your account, and open Seyvo. Enter your own Gemini key in the app and use Save & test. Test your microphone, choose a shortcut, focus a supported text field, and use the shortcut to start and stop dictation. Check inserted text before sending it. Seyvo never submits it automatically.

The current release is unsigned and intended for evaluation. See the release notes and checksums. Do not disable Windows security protections to install it.

## Where does my speech go?

During dictation, audio goes directly from the app to Google. Seyvo has no transcription proxy or telemetry backend and does not save audio files. The microphone requires explicit activation. Your key is encrypted locally; optional encrypted transcript history defaults off. Google handles transmitted data under its own terms. Read [PRIVACY.md](../PRIVACY.md) for details and clipboard limitations.

## Can I use it for work or sell a modified version?

Yes. MIT permits commercial use, modification and sale with the required copyright and license notice. Preserve applicable third-party notices too. Google terms remain separate. MIT does not grant rights to third-party trademarks, and a permissive license does not establish production readiness. Review [commercial readiness](commercial-readiness.md) before offering supported deployments.

## Which platforms work?

The initial target is Windows 11 x64. Windows 10 needs further runtime and installation validation; macOS, Linux and ARM64 application support are not shipped. Some portable development checks can run on Linux, but Windows native integration and packaging require Windows.

## Why might insertion fail?

Seyvo checks the original target and refuses unsafe or unsupported operations. Elevated apps, password fields, remote sessions and custom editors may not work. Unsupported clipboard formats or a changed target can prevent pasting. Check the destination before retrying, and use the app's copy/recovery flow when needed. See [support and limitations](support-and-limitations.md).

## Can anyone contribute?

Yes. Start with [CONTRIBUTING.md](../CONTRIBUTING.md) and the [Code of Conduct](../CODE_OF_CONDUCT.md). Useful contributions include reproducible bug reports, tests, documentation, accessibility improvements and Windows compatibility observations. Discuss substantial changes in an issue first. Do not include keys, real private speech or clipboard contents in reports.

## Is paid support available?

The repository currently offers community issue tracking with no response-time SLA or paid support contract. Report security issues using [SECURITY.md](../SECURITY.md). Signing, broader acceptance testing and formal name clearance remain launch requirements.

## Why is Google connected while the microphone is off?

Keep Google ready prepares a setup-only connection so the shortcut can start capture without the usual network handshake. No audio or silence is sent while idle. Google ended silent sessions after about 60 seconds on the tested account, so Seyvo renews them every 45 seconds by default (about 1.33 setups per minute). A nine-minute recording limit requires renewal every 30 seconds. The shortcut may still wait during startup, renewal or a network interruption; the connection indicator shows actual readiness. Pause, sleep, lock, key removal or quit closes standby. Turn this setting off to connect only when activating dictation.

Key tests, foreground setup and background renewal share a cap of four connection attempts per rolling minute. Temporary idle network failures get at most three delayed retries; quota, credential, model and policy errors stop automatic retries. Active speech is never retried. Use a Google project that is eligible for the free tier to avoid paid usage. This local guard cannot verify billing eligibility, enforce other apps' usage of the same project or guarantee zero charges on a paid project. Google's current account quotas and pricing remain authoritative.
