import assert from 'node:assert/strict';
import { terminateTestProcess } from './terminate-test-process.mjs';

export async function quitTestedApp(page, child, browser) {
  let timer;
  try {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      // Resolve CDP evaluation before quit destroys its renderer. Awaiting the
      // quit IPC response can deadlock the debug connection during shutdown.
      await page.evaluate(() => {
        setTimeout(() => void window.seyvo.action('quit'), 100);
      });
      const code = await Promise.race([
        exited,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('Tested app did not quit')), 10000);
        }),
      ]);
      assert.equal(code, 0, 'Tested app must exit cleanly.');
    } else assert.equal(child.exitCode, 0, 'Tested app exited unexpectedly.');
  } finally {
    clearTimeout(timer);
    try {
      terminateTestProcess(child);
    } finally {
      await browser?.close().catch(() => {});
    }
  }
}
