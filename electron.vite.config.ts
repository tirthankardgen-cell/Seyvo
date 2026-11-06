import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function buildHash(): string {
  try {
    const hash = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
    return `${hash}${dirty ? '-modified' : ''}`;
  } catch {
    return 'unavailable';
  }
}
export default defineConfig({
  main: {
    define: { __SEYVO_BUILD__: JSON.stringify(buildHash()) },
    build: { externalizeDeps: true },
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/preload/index.ts'),
          recorder: resolve('src/preload/recorder.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [
      react(),
      {
        name: 'loopback-development-csp',
        apply: 'serve',
        transformIndexHtml: (html) =>
          html
            .replace("script-src 'self';", "script-src 'self' 'unsafe-inline';")
            .replace(
              "connect-src 'self';",
              "connect-src 'self' ws://localhost:* ws://127.0.0.1:*;",
            ),
      },
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          recorder: resolve('src/renderer/recorder.html'),
        },
      },
    },
  },
});
