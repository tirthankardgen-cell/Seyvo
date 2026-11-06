# Working on Seyvo

Read `seyvo-windows-app-spec.md` and `windows-desktop-product-engineering.md` completely before changing the product. Follow `docs/implementation-plan.md` and preserve main-process authority, narrow validated IPC, explicit microphone activation, and safe target refusal. No production mocks, stored plaintext keys, transcript logging, auto-submit, or hidden cloud services.

Use Node 26 LTS and npm with the committed lockfile. Run `npm run check` at each milestone and `npm run test:e2e` plus packaging checks before release. Distinguish real Windows/provider observations from mocked tests. Never publish a stable release before the recorded acceptance gates pass.
