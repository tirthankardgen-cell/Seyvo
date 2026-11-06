# Third-party notices

Seyvo source is MIT licensed. Bundled packages retain their own licenses. The release inventory/SBOM is generated from the locked dependency tree; review it with each update.

Direct runtime components: React / React DOM (MIT), Zod (MIT), ws (MIT), Google Gen AI SDK types/dependency (Apache-2.0). Electron is MIT licensed and includes Chromium, Node.js and associated notices in its distribution. Windows/.NET Framework/UI Automation are platform components, not copied into Seyvo. No paid fonts, competitor graphics or externally sourced sound assets are bundled. Seyvo icon artwork is original project artwork covered by the repository license.

Electron packaging preserves `LICENSE.electron.txt` and `LICENSES.chromium.html` alongside the executable. Dependency package license files remain within the application archive. See generated `artifacts/sbom.cdx.json` and `artifacts/licenses.json` for the concrete release inventory; those artifacts are attached by release tooling after generation.
