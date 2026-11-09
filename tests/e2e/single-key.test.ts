import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { quitApp } from './helpers';

for (const binding of ['right-control', 'fn'] as const)
  test(`native ${binding} short press, three-second hold, toggle, pause and listener loss`, async () => {
    test.setTimeout(90000);
    const profile = await mkdtemp(join(tmpdir(), 'seyvo-single-key-'));
    // Saved calibration fixture, not proof of physical Fn hardware support.
    if (binding === 'fn')
      await writeFile(
        join(profile, 'fn-key.json'),
        JSON.stringify({ vk: 0x7c, scan: 0x64, extended: false }),
      );
    const env = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined,
      ),
    ) as Record<string, string>;
    const app = await electron.launch({
      args: [process.cwd(), `--user-data-dir=${profile}`, '--use-fake-device-for-media-stream'],
      env,
    });
    let target: ReturnType<typeof spawn> | undefined;
    try {
      const page = await app.firstWindow();
      await page.waitForFunction(() => Boolean(window.seyvo));
      // Isolated provider budget: this fixture makes one key test and three
      // dictations. The production connection budget is never bypassed.
      expect(
        (
          await page.evaluate(
            (singleKey) =>
              window.seyvo.updateSettings({
                keepConnectionReady: false,
                shortcut: 'F8',
                insertion: 'unicode',
                activation: 'single-key',
                singleKey,
              }),
            binding,
          )
        ).ok,
      ).toBe(true);
      await app.evaluate(async ({ app }) => {
        const requireApp = process
          .getBuiltinModule('module')
          .createRequire(app.getAppPath() + '/package.json');
        const ws = requireApp('ws');
        const server = new ws.WebSocketServer({ port: 0, host: '127.0.0.1' });
        await new Promise<void>((resolve) => server.on('listening', resolve));
        server.on(
          'connection',
          (socket: {
            on: (event: string, cb: (data: Buffer) => void) => void;
            send: (data: string) => void;
          }) => {
            socket.on('message', (data) => {
              const message = JSON.parse(data.toString());
              if (message.setup) socket.send(JSON.stringify({ setupComplete: {} }));
              if (message.realtimeInput?.activityEnd)
                socket.send(
                  JSON.stringify({
                    serverContent: {
                      inputTranscription: { text: 'Single key fixture.' },
                      generationComplete: true,
                    },
                  }),
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
      expect(
        (await page.evaluate(() => window.seyvo.saveKey('synthetic-local-test-credential'))).ok,
      ).toBe(true);
      const exe = join(profile, 'TestHost.exe');
      const compiled = spawnSync(
        join(process.env.WINDIR!, 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),
        [
          '/nologo',
          '/target:exe',
          '/platform:x64',
          '/reference:System.Windows.Forms.dll',
          '/reference:System.Drawing.dll',
          `/out:${exe}`,
          join(process.cwd(), 'tests/native/TestHost.cs'),
        ],
        { encoding: 'utf8', windowsHide: true },
      );
      expect(compiled.status, compiled.stdout).toBe(0);
      target = spawn(exe, [], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = createInterface({ input: target.stdout! })[Symbol.asyncIterator]();
      expect((await lines.next()).value).toBe('ready');
      const command = async (value: string) => {
        target!.stdin!.write(value + '\n');
        return (await lines.next()).value;
      };
      const key = async (edge: 'down' | 'up') => {
        expect(await command('focus')).toBe('focused');
        expect(await command(`${binding === 'fn' ? 'fn-fixture' : 'right-control'}-${edge}`)).toBe(
          'key-sent',
        );
      };
      const waitPhase = (phase: string) =>
        expect
          .poll(
            async () => {
              const status = await page.evaluate(() => window.seyvo.status());
              return `${status.phase}: ${status.message}`;
            },
            { timeout: 10000 },
          )
          .toMatch(new RegExp(`^${phase}:`));
      const bubbleVisible = () =>
        app.evaluate(({ BrowserWindow }) => {
          const bubble = BrowserWindow.getAllWindows().find((w) =>
            w.webContents.getURL().includes('#overlay'),
          );
          return Boolean(
            bubble?.isVisible() &&
            !bubble.isMinimized() &&
            !bubble.isFocusable() &&
            bubble.isAlwaysOnTop(),
          );
        });
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((w) => w.webContents.getURL().endsWith('index.html'))!
          .hide(),
      );
      for (const [index, singleKeyMode] of (['hold', 'toggle'] as const).entries()) {
        expect(
          (
            await page.evaluate(
              (singleKeyMode) => window.seyvo.updateSettings({ singleKeyMode }),
              singleKeyMode,
            )
          ).ok,
        ).toBe(true);
        expect((await page.evaluate(() => window.seyvo.status())).singleKeyRegistered).toBe(true);
        expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('F8'))).toBe(
          false,
        );
        await key('down');
        await new Promise((resolve) => setTimeout(resolve, 200));
        await key('up');
        await new Promise((resolve) => setTimeout(resolve, 3100));
        expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
        await key('down');
        await expect.poll(bubbleVisible, { timeout: 2000 }).toBe(true);
        const bubble = app.windows().find((w) => w.url().includes('#overlay'))!;
        await expect(bubble.getByRole('status')).toContainText('Hold to start');
        expect((await page.evaluate(() => window.seyvo.status())).shortcutPending).toBe(true);
        expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
        expect(await command('focused-state')).toBe('field-focused');
        await waitPhase('listening');
        await expect(bubble.getByRole('status')).toContainText('Listening');
        // Reproduce a shell-hidden overlay while recording; status must restore it.
        await app.evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows()
            .find((w) => w.webContents.getURL().includes('#overlay'))!
            .hide(),
        );
        await expect.poll(bubbleVisible).toBe(true);
        expect(await command('focused-state')).toBe('field-focused');
        const released = Date.now();
        await key('up');
        if (singleKeyMode === 'hold') {
          await expect
            .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive, {
              timeout: 1000,
            })
            .toBe(false);
          expect(Date.now() - released).toBeLessThan(1000);
        }
        if (singleKeyMode === 'toggle') {
          await new Promise((resolve) => setTimeout(resolve, 300));
          expect((await page.evaluate(() => window.seyvo.status())).phase).toBe('listening');
          await key('down');
          await new Promise((resolve) => setTimeout(resolve, 100));
          await key('up');
        }
        await waitPhase('idle');
        expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
        expect(Buffer.from((await command('text'))!, 'base64').toString()).toBe(
          'Single key fixture.'.repeat(index + 1),
        );
        expect(
          await app.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()
              .find((w) => w.webContents.getURL().endsWith('index.html'))!
              .isVisible(),
          ),
        ).toBe(false);
      }
      // Pause during a partial hold; resuming with Ctrl already held cannot arm it.
      await key('down');
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect((await page.evaluate(() => window.seyvo.updateSettings({ paused: true }))).ok).toBe(
        true,
      );
      expect((await page.evaluate(() => window.seyvo.status())).singleKeyRegistered).toBe(false);
      expect((await page.evaluate(() => window.seyvo.updateSettings({ paused: false }))).ok).toBe(
        true,
      );
      await new Promise((resolve) => setTimeout(resolve, 3200));
      expect((await page.evaluate(() => window.seyvo.status())).microphoneActive).toBe(false);
      await key('up');
      await key('down');
      await waitPhase('listening');
      await key('up');
      // Only kill the helper owned by this isolated Electron test process.
      const mainPid = await app.evaluate(() => process.pid);
      const killed = spawnSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          `$helper = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = ${mainPid} AND Name = 'Seyvo.Native.exe'"); if ($helper.Count -ne 1) { exit 3 }; Stop-Process -Id $helper[0].ProcessId -Force`,
        ],
        { windowsHide: true, timeout: 10000 },
      ).status;
      expect(killed).toBe(0);
      await expect
        .poll(async () => (await page.evaluate(() => window.seyvo.status())).microphoneActive)
        .toBe(false);
      expect((await page.evaluate(() => window.seyvo.status())).singleKeyRegistered).toBe(false);
      expect(await app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('F8'))).toBe(
        true,
      );
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
