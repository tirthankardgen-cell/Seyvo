import {
  app,
  clipboard,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  powerMonitor,
  safeStorage,
  shell,
  Tray,
} from 'electron';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { brand } from '../shared/brand';
import {
  settingsPatchSchema,
  apiKeySchema,
  vocabularySchema,
  type ActionResult,
  type Status,
  type Microphone,
} from '../shared/contracts';
import { AppError, publicError } from '../shared/errors';
import { Storage } from './storage';
import { NativeBridge } from './native';
import { Shortcuts } from './shortcuts';
import { Windows } from './windows';
import { GeminiLive } from './transcription/gemini-live';
import { SessionCoordinator } from './session-coordinator';

declare const __SEYVO_BUILD__: string;

const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) app.setPath('userData', profile);
app.setAppUserModelId(brand.appId);
if (!app.requestSingleInstanceLock()) app.quit();
else
  void app
    .whenReady()
    .then(run)
    .catch(() => {
      dialog.showErrorBox(
        'Seyvo could not start',
        'Local application data or Windows services are unavailable. Restart Seyvo or consult the troubleshooting guide.',
      );
      app.quit();
    });

async function run(): Promise<void> {
  Menu.setApplicationMenu(null);
  const storage = new Storage(app.getPath('userData'), {
    encrypt: async (text) => {
      if (!(await safeStorage.isAsyncEncryptionAvailable()))
        throw new AppError('Windows encryption is unavailable. No key or history was saved.');
      return safeStorage.encryptStringAsync(text);
    },
    decrypt: async (data) => (await safeStorage.decryptStringAsync(data)).result,
  });
  await storage.initialize();
  let hasKey = await storage.hasKey();
  let providerVerified = false;
  let microphones: Microphone[] = [];
  let keyBusy = false;
  let settingsBusy = false;
  let shuttingDown = false;
  let practice = false;
  let delayedAbort: AbortController | undefined;
  const native = new NativeBridge(
    app.isPackaged
      ? join(process.resourcesPath, 'native', 'Seyvo.Native.exe')
      : join(app.getAppPath(), 'native-win/bin/Seyvo.Native.exe'),
  );
  await native.start().catch(() => {});
  const windows = new Windows(
    () => storage.settings,
    () => {
      void coordinator.fail(new AppError('The recorder stopped unexpectedly. Microphone is off.'));
    },
    () => {
      void quit();
    },
  );
  const coordinator = new SessionCoordinator({
    settings: () => storage.settings,
    key: () => storage.key(),
    provider: () => new GeminiLive(),
    capture: () => (native.available ? native.capture(practice) : Promise.resolve(undefined)),
    record: (id, deviceId) => windows.record(id, deviceId),
    stopRecord: (id, cancel) => windows.stopRecord(id, cancel),
    insert: (target, text, method) => native.insert(target, text, method),
    copy: (text) => clipboard.writeText(text),
    saveHistory: (text, target) =>
      storage.changeHistory((entries) => [
        {
          id: randomUUID(),
          text,
          timestamp: Date.now(),
          ...(storage.settings.historyAppNames ? { app: target } : {}),
        },
        ...entries,
      ]),
    changed: () => publish(),
    // Cue failures must not interrupt speech or input. Preview reports failures.
    cue: (kind) => {
      void native.cue(kind).catch(() => {});
    },
    overlay: (target) => {
      void windows.showOverlay(target).then(publish);
    },
  });
  const shortcuts = new Shortcuts(globalShortcut, () => {
    delayedAbort?.abort();
    void act(coordinator.phase === 'listening' ? 'stop' : 'start').catch(reportActivationError);
  });
  try {
    shortcuts.set(storage.settings.shortcut, storage.settings.paused);
  } catch (error) {
    coordinator.message = publicError(error);
  }
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'assets/icon.png')
    : join(app.getAppPath(), 'assets/icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon.resize({ width: 20, height: 20 }));
  tray.on('click', () => {
    void windows.showDashboard().then(publish);
  });
  let lastTrayState = '';
  let overlayTimer: NodeJS.Timeout | undefined;
  function status(): Status {
    return {
      phase: coordinator.phase,
      message: coordinator.message,
      hasKey,
      providerVerified,
      microphoneActive: coordinator.microphoneActive,
      microphones,
      level: coordinator.level,
      elapsed: coordinator.elapsed,
      interim: coordinator.interim,
      recovery: coordinator.recovery,
      targetApp: coordinator.targetApp,
      shortcutRegistered: Boolean(shortcuts.current),
      nativeAvailable: native.available,
      startup: app.getLoginItemSettings().openAtLogin,
      startupAvailable: app.isPackaged,
      version: app.getVersion(),
      buildHash: __SEYVO_BUILD__,
      settings: storage.settings,
    };
  }
  function publish(): void {
    const snapshot = status();
    windows.broadcast(snapshot);
    const trayState = `${snapshot.phase}|${snapshot.settings.paused}|${snapshot.microphoneActive}|${snapshot.hasKey}`;
    if (trayState !== lastTrayState) {
      lastTrayState = trayState;
      tray.setToolTip(
        `${brand.name} · ${snapshot.microphoneActive ? 'Microphone active' : snapshot.settings.paused ? 'Paused' : 'Microphone off'} · ${snapshot.phase}`,
      );
      tray.setContextMenu(
        Menu.buildFromTemplate([
          {
            label: snapshot.microphoneActive ? '● Microphone active' : 'Microphone off',
            enabled: false,
          },
          {
            label: snapshot.phase === 'listening' ? 'Stop dictation' : 'Start dictation',
            enabled: snapshot.phase === 'listening' || (!coordinator.busy && !snapshot.recovery),
            click: () => {
              void act(snapshot.phase === 'listening' ? 'stop' : 'start').catch(
                reportActivationError,
              );
            },
          },
          {
            label: 'Cancel recording',
            enabled: coordinator.busy,
            click: () => {
              void coordinator.cancel();
            },
          },
          {
            label: snapshot.settings.paused ? 'Resume Seyvo' : 'Pause Seyvo',
            click: () => {
              void updateSettings({ paused: !storage.settings.paused }).catch(report);
            },
          },
          { type: 'separator' },
          {
            label: snapshot.recovery ? 'Open recovery' : 'Open Seyvo / Settings',
            click: () => {
              void windows.showDashboard().then(publish);
            },
          },
          {
            label: 'Check releases',
            click: () => {
              void shell.openExternal(brand.links.releases);
            },
          },
          { type: 'separator' },
          {
            label: 'Quit Seyvo',
            click: () => {
              void quit();
            },
          },
        ]),
      );
      if (overlayTimer) clearTimeout(overlayTimer);
      if (!coordinator.busy && snapshot.phase !== 'inserting')
        overlayTimer = setTimeout(() => windows.hideOverlay(), 2500);
    }
    if (coordinator.busy && !globalShortcut.isRegistered('Escape'))
      globalShortcut.register('Escape', () => {
        void coordinator.cancel();
      });
    else if (!coordinator.busy && globalShortcut.isRegistered('Escape'))
      globalShortcut.unregister('Escape');
  }
  function report(error: unknown): void {
    coordinator.message = publicError(error);
    publish();
  }
  async function reportActivationError(error: unknown): Promise<void> {
    // Keep the original recovery reason (for example a provider timeout).
    // A rejected shortcut must remain visible even with the dashboard hidden.
    if (!coordinator.recovery) {
      if (!coordinator.busy && coordinator.phase !== 'inserting') coordinator.phase = 'error';
      report(error);
    }
    if (!coordinator.busy && coordinator.phase !== 'inserting') {
      await windows.showDashboard().then(publish).catch(report);
    }
  }
  async function updateSettings(input: unknown) {
    if (settingsBusy || keyBusy) throw new AppError('Another settings operation is in progress.');
    const patch = settingsPatchSchema.parse(input);
    if (coordinator.busy && !('paused' in patch))
      throw new AppError('Finish recording before changing settings.');
    settingsBusy = true;
    const previous = storage.settings;
    try {
      if (patch.paused) {
        delayedAbort?.abort();
        await coordinator.cancel();
      }
      const next = { ...previous, ...patch };
      const rebind = 'shortcut' in patch || 'paused' in patch;
      if (rebind) shortcuts.set(next.shortcut, next.paused);
      try {
        await storage.saveSettings(next);
      } catch (error) {
        if (rebind) shortcuts.set(previous.shortcut, previous.paused);
        throw error;
      }
      nativeTheme.themeSource = next.theme;
      if (storage.warning) coordinator.message = storage.warning;
      if (!next.showOverlay) windows.hideOverlay();
      else windows.refreshOverlay();
      publish();
      return next;
    } finally {
      settingsBusy = false;
    }
  }
  async function testKey(candidate?: string): Promise<void> {
    if (coordinator.busy || keyBusy)
      throw new AppError('Finish the current operation before testing a key.');
    keyBusy = true;
    const provider = new GeminiLive();
    const abort = new AbortController();
    try {
      const key = candidate ?? (await storage.key());
      await provider.connect(
        key,
        storage.settings,
        abort.signal,
        () => {},
        () => {},
      );
      if (candidate) {
        try {
          await storage.saveKey(candidate);
        } catch {
          throw new AppError(
            'Google accepted this key, but Windows could not save it securely. Restart Seyvo and check access to your local app data folder.',
          );
        }
      }
      hasKey = true;
      providerVerified = true;
      coordinator.message = 'Gemini Live Transcribe is available to your key.';
    } catch (error) {
      if (!candidate) providerVerified = false;
      throw error;
    } finally {
      provider.close();
      keyBusy = false;
      publish();
    }
  }
  async function act(action: string): Promise<void> {
    if (action === 'start') {
      if (keyBusy || settingsBusy) throw new AppError('Wait for settings to finish.');
      if (!hasKey) throw new AppError('Save and test your Gemini API key in Settings first.');
      await coordinator.start();
    } else if (action === 'stop' || action === 'micStop') await coordinator.stop();
    else if (action === 'practice') {
      if (!hasKey || keyBusy) throw new AppError('Save and test your key first.');
      practice = true;
      try {
        await coordinator.start();
      } finally {
        practice = false;
      }
    } else if (action === 'cancel') {
      delayedAbort?.abort();
      await coordinator.cancel();
    } else if (action === 'copy') coordinator.copy();
    else if (action === 'retry') await coordinator.retry();
    else if (action === 'dismiss') coordinator.dismiss();
    else if (action === 'micTest') await coordinator.start(true);
    else if (action === 'previewOverlay') {
      const available = () => !coordinator.busy && coordinator.phase !== 'inserting';
      if (!storage.settings.showOverlay || !available())
        throw new AppError('Enable the bubble and finish recording before previewing.');
      if (overlayTimer) clearTimeout(overlayTimer);
      await windows.showOverlay();
      publish();
      if (available()) overlayTimer = setTimeout(() => windows.hideOverlay(), 3000);
    } else if (action === 'testSound') {
      if (!storage.settings.soundCues || coordinator.busy)
        throw new AppError('Enable sound cues and finish recording before previewing.');
      await native.cue('start');
    } else if (action === 'quit') await quit();
    else if (action === 'diagnostics')
      clipboard.writeText(
        JSON.stringify(
          {
            app: brand.name,
            version: app.getVersion(),
            buildHash: __SEYVO_BUILD__,
            os: process.platform,
            architecture: process.arch,
            electron: process.versions.electron,
            nativeAvailable: native.available,
            phase: coordinator.phase,
            microphoneActive: coordinator.microphoneActive,
            shortcutRegistered: Boolean(shortcuts.current),
            hasKey,
            providerVerified,
          },
          null,
          2,
        ),
      );
    else if (action === 'pasteTest') {
      clipboard.writeText('Seyvo paste test — नमस्ते 🌍\nSecond line.');
      coordinator.message =
        'Test text copied. Paste it into a field to check Unicode and newlines.';
      publish();
    }
  }
  function handle<T>(channel: string, fn: (input: unknown) => Promise<T> | T): void {
    ipcMain.handle(channel, async (event, input): Promise<ActionResult<T>> => {
      try {
        windows.authorize(event, 'dashboard');
        return { ok: true, value: await fn(input) };
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof z.ZodError
              ? 'Invalid input. Check the value and try again.'
              : publicError(error),
        };
      }
    });
  }
  ipcMain.handle('app:status', (event) => {
    windows.authorize(event, 'read');
    const snapshot = status();
    return event.sender === windows.overlay?.webContents
      ? { ...snapshot, recovery: '', microphones: [] }
      : snapshot;
  });
  handle('app:settings', updateSettings);
  handle('app:key-save', async (input) => {
    const parsed = apiKeySchema.safeParse(input);
    if (!parsed.success)
      throw new AppError(
        'Paste one complete API key without internal spaces or line breaks (up to 512 characters).',
      );
    await testKey(parsed.data);
  });
  handle('app:key-test', () => testKey());
  handle('app:key-remove', async () => {
    if (keyBusy || coordinator.busy) throw new AppError('Finish the current operation first.');
    await storage.removeKey();
    hasKey = false;
    providerVerified = false;
    publish();
  });
  let delayedAction = false;
  handle('app:action', async (input) => {
    const action = z
      .enum([
        'start',
        'practice',
        'stop',
        'cancel',
        'copy',
        'retry',
        'dismiss',
        'quit',
        'micTest',
        'micStop',
        'testSound',
        'previewOverlay',
        'diagnostics',
        'pasteTest',
      ])
      .parse(input);
    if (action === 'start' || action === 'retry') {
      if (delayedAction || coordinator.busy || coordinator.phase === 'inserting')
        throw new AppError('An operation is already in progress.');
      if (action === 'start' && !hasKey)
        throw new AppError('Save and test your Gemini API key first.');
      delayedAction = true;
      const abort = new AbortController();
      delayedAbort = abort;
      globalShortcut.register('Escape', () => abort.abort());
      try {
        windows.dashboard?.hide();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (!shuttingDown && !abort.signal.aborted) await act(action);
      } finally {
        delayedAction = false;
        delayedAbort = undefined;
        if (!coordinator.busy) globalShortcut.unregister('Escape');
      }
    } else await act(action);
  });
  handle('app:startup', (input) => {
    const enabled = z.boolean().parse(input);
    if (!app.isPackaged)
      throw new AppError('Startup registration is available after installing Seyvo.');
    app.setLoginItemSettings({ openAtLogin: enabled, path: process.execPath, args: ['--startup'] });
    const actual = app.getLoginItemSettings({
      path: process.execPath,
      args: ['--startup'],
    }).openAtLogin;
    if (actual !== enabled)
      throw new AppError(
        'Windows did not accept the startup change. Check Startup Apps in Windows Settings.',
      );
    publish();
    return actual;
  });
  handle('app:link', async (input) => {
    const link = z
      .enum([
        'keys',
        'pricing',
        'terms',
        'privacy',
        'releases',
        'help',
        'source',
        'contributors',
        'appPrivacy',
      ])
      .parse(input);
    await shell.openExternal(brand.links[link]);
  });
  handle('app:history', async (input) => {
    const request = z
      .object({
        action: z.enum(['list', 'clear', 'delete', 'copy', 'export']),
        id: z.string().max(80).optional(),
      })
      .strict()
      .parse(input);
    if (request.action === 'clear') await storage.clearHistory();
    if (request.action === 'delete')
      await storage.changeHistory((entries) => entries.filter((e) => e.id !== request.id));
    const entries = await storage.history();
    if (request.action === 'copy') {
      const entry = entries.find((e) => e.id === request.id);
      if (entry) clipboard.writeText(entry.text);
    }
    if (request.action === 'export') {
      const result = await dialog.showSaveDialog({
        title: 'Export unencrypted transcript history',
        defaultPath: 'seyvo-history.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePath)
        await fs.writeFile(result.filePath, JSON.stringify(entries, null, 2));
    }
    return entries;
  });
  handle('app:dictionary', async (input) => {
    const action = z.enum(['import', 'export']).parse(input);
    if (action === 'import') {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePaths[0]) {
        if ((await fs.stat(result.filePaths[0])).size > 256000)
          throw new AppError('Dictionary file is too large. Maximum size is 256 KB.');
        const dictionary = vocabularySchema.parse(
          JSON.parse(await fs.readFile(result.filePaths[0], 'utf8')),
        );
        return updateSettings({ dictionary: [...new Set(dictionary)] });
      }
    } else {
      const result = await dialog.showSaveDialog({
        defaultPath: 'seyvo-dictionary.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!result.canceled && result.filePath)
        await fs.writeFile(result.filePath, JSON.stringify(storage.settings.dictionary, null, 2));
    }
    return storage.settings;
  });
  ipcMain.handle('recorder:packet', (event, input) => {
    try {
      windows.authorize(event, 'recorder');
      const packet = z
        .object({
          id: z.string().uuid(),
          sequence: z.number().int().nonnegative().max(10000),
          level: z.number().min(0).max(1),
          pcm: z
            .instanceof(ArrayBuffer)
            .refine(
              (buffer) =>
                buffer.byteLength > 0 && buffer.byteLength <= 3200 && buffer.byteLength % 2 === 0,
            ),
        })
        .strict()
        .parse(input);
      return coordinator.packet(packet);
    } catch {
      return false;
    }
  });
  ipcMain.on('recorder:event', (event, input) => {
    try {
      windows.authorize(event, 'recorder');
      const payload = z
        .union([
          z
            .object({
              id: z.string().uuid(),
              kind: z.enum(['started', 'stopped', 'error']),
              error: z.string().max(300).optional(),
            })
            .strict(),
          z
            .object({
              id: z.string().uuid(),
              kind: z.literal('devices'),
              devices: z
                .array(
                  z
                    .object({
                      deviceId: z.string().min(1).max(300),
                      label: z.string().max(200),
                    })
                    .strict(),
                )
                .max(32),
            })
            .strict(),
        ])
        .parse(input);
      if (payload.kind === 'devices') {
        if (windows.isRecordingSession(payload.id)) {
          microphones = payload.devices;
          publish();
        }
        return;
      }
      windows.recorderEvent(payload);
      if (payload.kind === 'error')
        void coordinator.fail(new AppError(payload.error ?? 'Microphone unavailable.'));
    } catch {
      /* Reject malformed recorder messages without exposing content. */
    }
  });
  async function quit(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    delayedAbort?.abort();
    await coordinator.shutdown().catch(() => {});
    windows.close();
    native.close();
    tray.destroy();
    globalShortcut.unregisterAll();
    app.exit();
  }
  app.on('second-instance', () => {
    void windows.showDashboard().then(publish);
  });
  app.on('before-quit', (event) => {
    if (!shuttingDown) {
      event.preventDefault();
      void quit();
    }
  });
  app.on('window-all-closed', () => {});
  powerMonitor.on('suspend', () => {
    delayedAbort?.abort();
    void coordinator.cancel().catch(report);
  });
  powerMonitor.on('lock-screen', () => {
    delayedAbort?.abort();
    void coordinator.cancel().catch(report);
  });
  nativeTheme.themeSource = storage.settings.theme;
  if (storage.warning) coordinator.message = storage.warning;
  publish();
  if (
    !storage.settings.onboardingComplete ||
    (!storage.settings.startMinimized && !process.argv.includes('--startup'))
  )
    await windows.showDashboard();
  publish();
}
