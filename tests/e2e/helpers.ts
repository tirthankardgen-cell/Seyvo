import { expect, type ElectronApplication } from '@playwright/test';

/** Exercise the app's own graceful quit before disposing Playwright's context. */
export async function quitApp(app: ElectronApplication): Promise<void> {
  const child = app.process();
  if (child.exitCode === null) {
    await app
      .evaluate(({ app }) => app.quit())
      .catch(() => {
        // Closing the process can close CDP before it replies to evaluate.
      });
    await expect.poll(() => child.exitCode, { timeout: 10000 }).toBe(0);
  }
}
