import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { quitApp } from './helpers';
test('real Electron onboarding, persistence, security boundary and local microphone flow', async () => {
  const launchedAt = Date.now();
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-e2e-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const app = await electron.launch({ args: [process.cwd(), `--user-data-dir=${profile}`], env });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('heading', { name: 'A little setup. A lot less typing.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).require),
    ).toBe('undefined');
    expect(await page.evaluate(() => 'getApiKey' in window.seyvo)).toBe(false);
    const invalid = await page.evaluate(() => window.seyvo.updateSettings({ shortcut: 'A' }));
    expect(invalid.ok).toBe(false);
    const initial = await page.evaluate(() => window.seyvo.status());
    expect(initial.settings.historyEnabled).toBe(false);
    expect(initial.microphoneActive).toBe(false);
    expect(initial.nativeAvailable).toBe(true);
    // Keep this credential-replacement scenario independent of background setup.
    await page.evaluate(() => window.seyvo.updateSettings({ keepConnectionReady: false }));
    const readyMilliseconds = Date.now() - launchedAt;
    const protectedRoundtrip = await app.evaluate(async ({ safeStorage }) => {
      const plain = 'Seyvo non-secret vault test';
      const encrypted = await safeStorage.encryptStringAsync(plain);
      const decrypted = await safeStorage.decryptStringAsync(encrypted);
      return decrypted.result === plain && !encrypted.includes(Buffer.from(plain));
    });
    expect(protectedRoundtrip).toBe(true);
    // Redirect only this isolated test process's real ws transport to loopback.
    // This exercises the compiled CommonJS import, setup handshake and vault,
    // without making any Google request or using a real credential.
    await app.evaluate(async ({ app }) => {
      const requireApp = process
        .getBuiltinModule('module')
        .createRequire(app.getAppPath() + '/package.json');
      const ws = requireApp('ws');
      const server = new ws.WebSocketServer({ port: 0, host: '127.0.0.1' });
      await new Promise<void>((resolve) => server.on('listening', resolve));
      let connections = 0;
      server.on(
        'connection',
        (socket: {
          on: (event: string, callback: (data: Buffer) => void) => void;
          send: (data: string) => void;
        }) => {
          const reject = ++connections === 2;
          socket.on('message', (data) => {
            if (JSON.parse(data.toString()).setup)
              socket.send(
                JSON.stringify(
                  reject
                    ? { error: { code: 403, status: 'PERMISSION_DENIED' } }
                    : { setupComplete: {} },
                ),
              );
          });
        },
      );
      const Original = ws.WebSocket;
      ws.WebSocket = class extends Original {
        constructor(_url: string, options: object) {
          super(`ws://127.0.0.1:${server.address().port}`, options);
        }
      };
    });
    const keySaved = await page.evaluate(() => window.seyvo.saveKey('AQ.example.test-token'));
    expect(keySaved.ok).toBe(true);
    expect((await page.evaluate(() => window.seyvo.status())).providerVerified).toBe(true);
    const savedFingerprint = () =>
      app.evaluate(async ({ app }) => {
        const bytes = await process
          .getBuiltinModule('fs')
          .promises.readFile(
            process.getBuiltinModule('path').join(app.getPath('userData'), 'key.enc'),
          );
        return process.getBuiltinModule('crypto').createHash('sha256').update(bytes).digest('hex');
      });
    const beforeReplacement = await savedFingerprint();
    const rejectedReplacement = await page.evaluate(() =>
      window.seyvo.saveKey('synthetic-rejected-replacement'),
    );
    expect(rejectedReplacement.ok).toBe(false);
    expect(await savedFingerprint()).toBe(beforeReplacement);
    expect((await page.evaluate(() => window.seyvo.status())).hasKey).toBe(true);
    expect((await page.evaluate(() => window.seyvo.testKey())).ok).toBe(true);
    expect((await page.evaluate(() => window.seyvo.removeKey())).ok).toBe(true);
    await page.getByRole('button', { name: 'Dictionary', exact: true }).click();
    await page.getByLabel('Add a word or phrase').fill('Seyvo-नमस्ते');
    await page.getByRole('button', { name: 'Add word', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Remove Seyvo-नमस्ते', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Preferences.', exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/screenshots/settings.png', fullPage: true });
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    await page.getByRole('button', { name: 'Home', exact: true }).click();
    await page.screenshot({ path: 'artifacts/screenshots/onboarding.png', fullPage: true });
    // Real getUserMedia: either hardware levels arrive, or a truthful permission/device error.
    await page.getByRole('button', { name: '2 Microphone', exact: true }).click();
    await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).phase, {
        timeout: 20000,
      })
      .toMatch(/listening|error/);
    const mic = await page.evaluate(() => window.seyvo.status());
    console.log(
      `Windows local mic observation: phase=${mic.phase}, active=${mic.microphoneActive}, message=${mic.message}`,
    );
    if (mic.microphoneActive) {
      await expect
        .poll(() =>
          page
            .locator('select[aria-label="Microphone"] option')
            .evaluateAll(
              (options) =>
                options.filter(
                  (option) =>
                    (option as HTMLOptionElement).value &&
                    (option as HTMLOptionElement).value !== 'default',
                ).length,
            ),
        )
        .toBeGreaterThan(0);
      const overlay = app.windows().find((candidate) => candidate.url().includes('#overlay'));
      if (overlay) {
        const rejected = await overlay.evaluate(() =>
          window.seyvo.updateSettings({ historyEnabled: true }),
        );
        expect(rejected.ok).toBe(false);
        await overlay.screenshot({ path: 'artifacts/screenshots/overlay.png' });
      }
      await page.getByRole('button', { name: 'Stop microphone', exact: true }).click();
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(false);
      const dashboardDenied = await page.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          return false;
        } catch (error) {
          return error instanceof DOMException && error.name === 'NotAllowedError';
        }
      });
      expect(dashboardDenied).toBe(true);
      const device = await page
        .locator('select[aria-label="Microphone"] option')
        .evaluateAll((options) =>
          options
            .map((option) => (option as HTMLOptionElement).value)
            .find((value) => value && value !== 'default'),
        );
      expect(device).toBeTruthy();
      await page.getByLabel('Microphone', { exact: true }).selectOption(device!);
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).settings.deviceId)
        .toBe(device);
      await page.getByRole('button', { name: 'Test microphone', exact: true }).click();
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(true);
      await page.getByRole('button', { name: 'Stop microphone', exact: true }).click();
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(false);
    }
    await page.reload();
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).settings.dictionary)
      .toContain('Seyvo-नमस्ते');
    await app.evaluate(({ app }) => app.getAppMetrics());
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const metrics = await app.evaluate(({ app }) =>
      app.getAppMetrics().map((metric) => ({
        type: metric.type,
        cpu: metric.cpu.percentCPUUsage,
        memoryKiB: metric.memory.workingSetSize,
      })),
    );
    await mkdir('artifacts/performance', { recursive: true });
    await writeFile(
      'artifacts/performance/desktop.json',
      JSON.stringify(
        {
          readyMilliseconds,
          devicePixelRatio: await page.evaluate(() => window.devicePixelRatio),
          metrics,
          note: 'Single development Electron run after local microphone use; not a general performance claim.',
        },
        null,
        2,
      ),
    );
  } finally {
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
