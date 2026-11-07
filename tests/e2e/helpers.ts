import { expect, type ElectronApplication } from '@playwright/test';
import { terminateTestProcess } from '../../scripts/terminate-test-process.mjs';

/** Exercise the app's own graceful quit before disposing Playwright's context. */
export async function quitApp(app: ElectronApplication): Promise<void> {
  const child = app.process();
  if (child.exitCode === null) {
    try {
      await app.evaluate(({ app }) => {
        // Release the pending debugger request before its context is destroyed.
        setTimeout(() => app.quit(), 100);
      });
      await expect.poll(() => child.exitCode, { timeout: 10000 }).toBe(0);
    } finally {
      // A failed exit assertion must not strand this owned test process.
      terminateTestProcess(child);
    }
  } else expect(child.exitCode, 'The tested app must not exit with an error.').toBe(0);
}
