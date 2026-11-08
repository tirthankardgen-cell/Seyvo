import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { quitApp } from './helpers';

test('new dictations replace old recovery and consecutive finalized sessions insert without opening the dashboard', async () => {
  test.setTimeout(90000);
  const profile = await mkdtemp(join(tmpdir(), 'seyvo-shortcut-feedback-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
    ),
  ) as Record<string, string>;
  const app = await electron.launch({
    args: [
      process.cwd(),
      `--user-data-dir=${profile}`,
      '--use-fake-device-for-media-stream',
      '--force-renderer-accessibility',
    ],
    env,
  });
  let target: ReturnType<typeof spawn> | undefined;
  try {
    const page = await app.firstWindow();
    await page.waitForFunction(() => Boolean(window.seyvo));
    // Capture the app's registered handler. This exercises main-process activation,
    // not physical Windows keyboard delivery; provider/audio are synthetic here.
    await app.evaluate(({ globalShortcut }) => {
      const register = globalShortcut.register.bind(globalShortcut);
      globalShortcut.register = (combo, callback) => {
        if (combo === 'F8')
          (globalThis as unknown as { activateFixture: () => void }).activateFixture = callback;
        return register(combo, callback);
      };
    });
    expect((await page.evaluate(() => window.seyvo.updateSettings({ shortcut: 'F8' }))).ok).toBe(
      true,
    );
    const hideAndActivate = () =>
      app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('index.html'))!
          .hide();
        (globalThis as unknown as { activateFixture: () => void }).activateFixture();
      });
    const dashboardVisible = () =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('index.html'))!
          .isVisible(),
      );
    await hideAndActivate();
    await expect.poll(dashboardVisible).toBe(true);
    await expect(page.getByRole('alert')).toContainText('Save and test your Gemini API key');
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
    await page.getByRole('button', { name: 'Dismiss error' }).click();
    // Real compiled WebSocket adapter and vault, loopback provider, no real key.
    await app.evaluate(async ({ app }) => {
      const requireApp = process
        .getBuiltinModule('module')
        .createRequire(app.getAppPath() + '/package.json');
      const ws = requireApp('ws');
      const server = new ws.WebSocketServer({ port: 0, host: '127.0.0.1' });
      await new Promise<void>((resolve) => server.on('listening', resolve));
      const stats = { connections: 0, activities: 0, audio: 0 };
      (globalThis as unknown as { standbyStats: typeof stats }).standbyStats = stats;
      server.on(
        'connection',
        (socket: {
          on: (event: string, callback: (data: Buffer) => void) => void;
          send: (data: string) => void;
        }) => {
          stats.connections++;
          let sent = false;
          socket.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.realtimeInput?.activityStart) stats.activities++;
            if (message.realtimeInput?.audio) stats.audio++;
            if (message.setup) socket.send(JSON.stringify({ setupComplete: {} }));
            const finalFixture = (globalThis as unknown as { finalFixture?: boolean }).finalFixture;
            if (message.realtimeInput?.activityEnd && finalFixture) {
              socket.send(
                JSON.stringify({
                  serverContent: {
                    inputTranscription: { text: 'Automatic native insertion fixture.' },
                    generationComplete: true,
                  },
                }),
              );
            }
            if (message.realtimeInput?.audio && !sent && !finalFixture) {
              sent = true;
              socket.send(
                JSON.stringify({
                  serverContent: { inputTranscription: { text: 'Synthetic recovery fixture.' } },
                }),
              );
              socket.send(JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE' } }));
            }
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
    expect(
      (await page.evaluate(() => window.seyvo.saveKey('synthetic-local-test-credential'))).ok,
    ).toBe(true);
    await expect
      .poll(async () => (await page.evaluate(() => window.seyvo.status())).connectionState)
      .toBe('ready');
    const idleStats = await app.evaluate(
      () =>
        (
          globalThis as unknown as {
            standbyStats: { connections: number; activities: number; audio: number };
          }
        ).standbyStats,
    );
    expect(idleStats).toEqual({ connections: 2, activities: 0, audio: 0 });
    expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
    const recorder = app.windows().find((candidate) => candidate.url().endsWith('recorder.html'))!;
    expect(
      await recorder.evaluate(async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          return false;
        } catch (error) {
          return error instanceof DOMException && error.name === 'NotAllowedError';
        }
      }),
    ).toBe(true);
    // Use the owned native text field: Chromium's UI Automation activation can
    // lag behind DOM focus, which is unrelated to this recovery regression.
    const targetExe = join(profile, 'TestHost.exe');
    const compiled = spawnSync(
      join(process.env.WINDIR!, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
      [
        '/nologo',
        '/target:exe',
        '/platform:x64',
        '/reference:System.Windows.Forms.dll',
        '/reference:System.Drawing.dll',
        `/out:${targetExe}`,
        join(process.cwd(), 'tests/native/TestHost.cs'),
      ],
      { encoding: 'utf8', windowsHide: true },
    );
    expect(compiled.status, compiled.stdout).toBe(0);
    target = spawn(targetExe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
    const lines = createInterface({ input: target.stdout! })[Symbol.asyncIterator]();
    expect((await lines.next()).value).toBe('ready');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('index.html'))!
        .hide(),
    );
    target.stdin!.write('focus\n');
    expect((await lines.next()).value).toBe('focused');
    await app.evaluate(() =>
      (globalThis as unknown as { activateFixture: () => void }).activateFixture(),
    );
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { phase, message } = await window.seyvo.status();
          return `${phase}: ${message}`;
        }),
      )
      .toMatch(/^recovery:/);
    const before = await page.evaluate(() => window.seyvo.status());
    expect(
      await app.evaluate(
        () =>
          (globalThis as unknown as { standbyStats: { connections: number } }).standbyStats
            .connections,
      ),
    ).toBe(idleStats.connections);
    expect(before.recovery).toBe('Synthetic recovery fixture.');
    const overlay = app.windows().find((p) => p.url().includes('#overlay'))!;
    await expect(overlay.getByText('Check your text', { exact: true })).toBeVisible();
    expect(await overlay.locator('body').innerText()).not.toContain(before.recovery);
    // Failures remain briefly visible, then hide without dropping recovery.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().includes('#overlay'))!
          .isVisible(),
      ),
    ).toBe(true);
    await expect
      .poll(
        () =>
          app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes('#overlay'))!
              .isVisible(),
          ),
        { timeout: 7000 },
      )
      .toBe(false);
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('index.html'))!
        .show(),
    );
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.getByRole('button', { name: 'View recovered text' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test microphone', exact: true })).toBeDisabled();
    const after = await page.evaluate(() => window.seyvo.status());
    expect(after.recovery).toBe(before.recovery);
    expect(after.message).toBe(before.message);
    expect(after.microphoneActive).toBe(false);
    await page.getByRole('button', { name: 'View recovered text' }).click();
    await expect(page.locator('.recovery pre')).toHaveText(before.recovery);
    // Prove automatic delivery without a Copy/Retry click. Direct Unicode keeps
    // the real user's occupied clipboard untouched; clipboard restoration has
    // its separate controlled native acceptance fixture.
    expect(
      (await page.evaluate(() => window.seyvo.updateSettings({ insertion: 'unicode' }))).ok,
    ).toBe(true);
    await app.evaluate(({ BrowserWindow }) => {
      (globalThis as unknown as { finalFixture: boolean }).finalFixture = true;
      BrowserWindow.getAllWindows()
        .find((w) => w.webContents.getURL().endsWith('index.html'))!
        .hide();
    });
    target.stdin!.write('clear\n');
    expect((await lines.next()).value).toBe('cleared');
    target.stdin!.write('focus\n');
    expect((await lines.next()).value).toBe('focused');
    for (let cycle = 1; cycle <= 2; cycle++) {
      target.stdin!.write('focus\n');
      expect((await lines.next()).value).toBe('focused');
      await app.evaluate(() =>
        (globalThis as unknown as { activateFixture: () => void }).activateFixture(),
      );
      await expect
        .poll(
          () =>
            page.evaluate(async () => {
              const { phase, message } = await window.seyvo.status();
              return `${phase}: ${message}`;
            }),
          { timeout: 20000 },
        )
        .toMatch(/^listening:/);
      expect((await page.evaluate(() => window.seyvo.status())).recovery).toBe('');
      expect(await dashboardVisible()).toBe(false);
      target.stdin!.write('focus\n');
      expect((await lines.next()).value).toBe('focused');
      await app.evaluate(() =>
        (globalThis as unknown as { activateFixture: () => void }).activateFixture(),
      );
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const { phase, message } = await window.seyvo.status();
            return `${phase}: ${message}`;
          }),
        )
        .toMatch(/^idle:/);
      target.stdin!.write('text\n');
      expect(Buffer.from((await lines.next()).value!, 'base64').toString()).toBe(
        'Automatic native insertion fixture.'.repeat(cycle),
      );
      expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
      expect(await dashboardVisible()).toBe(false);
    }
    await expect
      .poll(
        () =>
          app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().includes('#overlay'))!
              .isVisible(),
          ),
        { timeout: 4000 },
      )
      .toBe(false);
  } finally {
    if (target?.exitCode === null) {
      target.stdin?.write('quit\n');
      await expect
        .poll(() => target!.exitCode, { timeout: 5000 })
        .toBe(0)
        .catch(() => target!.kill());
    }
    await quitApp(app);
    await rm(profile, { recursive: true, force: true });
  }
});
