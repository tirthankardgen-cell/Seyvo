# ADR 001: stack and cautious input delivery

Status: accepted for implementation, 7 November 2026.

Electron/React follows the product brief and gives maintained media support, safeStorage and a testable renderer. A C#/.NET Framework sidecar avoids Electron native ABI rebuilds and additional runtime distribution on supported Windows systems. Its surface is deliberately smaller than a desktop automation library. .NET Framework is Windows-only; x64 is the sole target.

Node 26.13.0 LTS, Electron 45.2.3, React 19.3.1, Vite 8.3.6 and Google Gen AI 3.0.0 were verified against current releases. TypeScript 7.0.2 was current, but typescript-eslint 8.72.1 declares support only below 6.1; TypeScript 6.0.3 is the compatible selection. npm replaces suggested pnpm because it was installed and supports deterministic locking. Actual versions are pinned in package.json/lock.

CSS tokens and semantic native HTML controls replace suggested Tailwind/Radix; this avoids dependencies for controls already covered by native keyboard behavior. No external fonts or copied competitor assets.

Safe insertion takes priority over claiming universal compatibility. Changed targets are refused, clipboard formats outside the audited set cause refusal, and successful OS input still has an uncertainty message. The 0.1.10 validation prerelease enables optional Right Ctrl push-to-talk after native Win32 key-up and installed real-provider checks. Physical keyboard acceptance remains a stable-release gate; bare Fn is visibly unavailable. Update UI opens a fixed real GitHub Releases page rather than claiming a secure automatic updater exists.

The native helper and browser process must be installed without elevation. Do not bypass UIPI or demand admin rights to fix compatibility.
