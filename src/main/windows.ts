import {
  app,
  BrowserWindow,
  screen,
  session,
  type IpcMainInvokeEvent,
  type IpcMainEvent,
} from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RecorderCommand, Settings, Status } from '../shared/contracts';
import type { Target } from './native';
import { AppError } from '../shared/errors';
import { overlayBounds } from '../shared/overlay';

export class Windows {
  dashboard?: BrowserWindow;
  overlay?: BrowserWindow;
  recorder?: BrowserWindow;
  quitting = false;
  recordingAllowed = false;
  private recordingId?: string;
  private recorderReady?: Promise<void>;
  private dashboardReady?: Promise<void>;
  private overlayReady?: Promise<void>;
  private overlayRequest = 0;
  private overlayTarget?: Target;
  private acknowledgments = new Map<
    string,
    { kind: string; resolve: () => void; reject: (error: Error) => void; timer: NodeJS.Timeout }
  >();
  constructor(
    private settings: () => Settings,
    private onCrash: () => void,
    private quit: () => void,
  ) {
    session.defaultSession.setPermissionRequestHandler(
      (contents, permission, callback, details) => {
        callback(
          contents === this.recorder?.webContents &&
            this.recordingAllowed &&
            permission === 'media' &&
            'mediaTypes' in details &&
            details.mediaTypes?.every((type) => type === 'audio') === true,
        );
      },
    );
    session.defaultSession.setPermissionCheckHandler(
      (contents, permission, _origin, details) =>
        contents === this.recorder?.webContents &&
        this.recordingAllowed &&
        permission === 'media' &&
        details.mediaType === 'audio',
    );
    const reposition = () => {
      if (this.overlay?.isVisible()) this.positionOverlay();
    };
    screen.on('display-metrics-changed', reposition);
    screen.on('display-removed', reposition);
  }
  private url(page: string): string {
    if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
      const development = new URL(process.env.ELECTRON_RENDERER_URL);
      if (
        development.protocol !== 'http:' ||
        !['localhost', '127.0.0.1'].includes(development.hostname)
      )
        throw new AppError('Development renderer must use the local loopback server.');
      return new URL(page, development.origin + '/').href;
    }
    return pathToFileURL(join(__dirname, '../renderer', page)).href;
  }
  private secure(window: BrowserWindow): void {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  }
  private webPreferences(recorder = false): Electron.WebPreferences {
    return {
      preload: join(__dirname, `../preload/${recorder ? 'recorder' : 'index'}.js`),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
      spellcheck: false,
    };
  }
  async showDashboard(): Promise<void> {
    if (!this.dashboard || this.dashboard.isDestroyed()) {
      const window = new BrowserWindow({
        width: 1020,
        height: 760,
        minWidth: 760,
        minHeight: 580,
        show: false,
        title: 'Seyvo',
        backgroundColor: '#101217',
        autoHideMenuBar: true,
        webPreferences: this.webPreferences(),
      });
      this.dashboard = window;
      this.secure(window);
      window.on('close', (event) => {
        if (!this.quitting && this.settings().closeToTray) {
          event.preventDefault();
          window.hide();
        } else if (!this.quitting) {
          event.preventDefault();
          this.quit();
        }
      });
      this.dashboardReady = window.loadURL(this.url('index.html'));
    }
    await this.dashboardReady;
    if (this.dashboard.isMinimized()) this.dashboard.restore();
    this.dashboard.show();
    this.dashboard.focus();
  }
  async showOverlay(target?: Target): Promise<void> {
    if (!this.settings().showOverlay) return;
    const request = ++this.overlayRequest;
    this.overlayTarget = target;
    if (!this.overlay || this.overlay.isDestroyed()) {
      const window = new BrowserWindow({
        width: 300,
        height: 90,
        show: false,
        frame: false,
        transparent: true,
        focusable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        hasShadow: false,
        webPreferences: this.webPreferences(),
      });
      this.overlay = window;
      this.secure(window);
      window.setIgnoreMouseEvents(true);
      this.overlayReady = window.loadURL(this.url('index.html') + '#overlay');
    }
    await this.overlayReady;
    if (request !== this.overlayRequest || this.quitting || !this.settings().showOverlay) return;
    this.positionOverlay();
    this.overlay.showInactive();
  }
  private positionOverlay(): void {
    if (!this.overlay || this.overlay.isDestroyed()) return;
    const target = this.overlayTarget;
    const point = target
      ? screen.screenToDipPoint({
          x: target.x + Math.max(0, target.width / 2),
          y: target.y + Math.max(0, target.height / 2),
        })
      : screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(point).workArea;
    this.overlay.setBounds(overlayBounds(area, this.settings()));
  }
  hideOverlay(): void {
    ++this.overlayRequest;
    this.overlay?.hide();
  }
  broadcast(status: Status): void {
    for (const window of [this.dashboard, this.overlay])
      if (window && !window.isDestroyed() && !window.webContents.isLoadingMainFrame())
        window.webContents.send(
          'app:state',
          window === this.overlay ? { ...status, recovery: '', microphones: [] } : status,
        );
  }
  authorize(
    event: IpcMainInvokeEvent | IpcMainEvent,
    role: 'dashboard' | 'read' | 'recorder',
  ): void {
    const candidates =
      role === 'read'
        ? [this.dashboard, this.overlay]
        : [role === 'recorder' ? this.recorder : this.dashboard];
    if (
      !candidates.some((window) => window?.webContents === event.sender) ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new AppError('This window is not allowed to perform that action.');
    const page = role === 'recorder' ? 'recorder.html' : 'index.html';
    if (event.senderFrame?.url.split('#')[0] !== this.url(page))
      throw new AppError('Untrusted application page.');
  }
  async record(id: string, deviceId: string): Promise<void> {
    this.recordingId = id;
    if (!this.recorder || this.recorder.isDestroyed()) {
      const window = new BrowserWindow({ show: false, webPreferences: this.webPreferences(true) });
      this.recorder = window;
      this.secure(window);
      window.webContents.on('render-process-gone', () => {
        if (this.recorder !== window) return;
        this.recordingAllowed = false;
        this.recorder = undefined;
        this.recorderReady = undefined;
        const id = this.recordingId;
        this.recordingId = undefined;
        if (id)
          this.recorderEvent({
            id,
            kind: 'error',
            error: 'The recorder stopped unexpectedly. Microphone is off.',
          });
        if (!window.isDestroyed()) window.destroy();
        this.onCrash();
      });
      this.recorderReady = window.loadURL(this.url('recorder.html'));
    }
    await this.recorderReady;
    if (this.recordingId !== id) throw new AppError('Microphone operation cancelled.');
    this.recordingAllowed = true;
    await this.command({ kind: 'start', id, deviceId }, 'started');
  }
  async stopRecord(id: string, cancel: boolean): Promise<void> {
    if (this.recordingId && this.recordingId !== id) return;
    if (cancel && this.recordingId === id) this.recordingId = undefined;
    if (!this.recorder || this.recorder.isDestroyed()) return;
    try {
      if (this.recordingAllowed)
        await this.command({ kind: cancel ? 'cancel' : 'stop', id }, 'stopped');
    } finally {
      this.recordingAllowed = false;
      if (this.recordingId === id) this.recordingId = undefined;
      const finished = this.recorder;
      this.recorder = undefined;
      this.recorderReady = undefined;
      if (finished && !finished.isDestroyed()) finished.destroy();
    }
  }
  private command(command: RecorderCommand, kind: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const previous = this.acknowledgments.get(command.id);
      if (previous) {
        clearTimeout(previous.timer);
        previous.reject(new AppError('Microphone operation cancelled.'));
      }
      const timer = setTimeout(
        () => {
          this.acknowledgments.delete(command.id);
          this.recordingAllowed = false;
          this.recorder?.destroy();
          this.recorder = undefined;
          reject(new AppError('Microphone did not respond. It has been closed; please retry.'));
        },
        kind === 'started' ? 15000 : 3000,
      );
      this.acknowledgments.set(command.id, { kind, resolve, reject, timer });
      this.recorder?.webContents.send('recorder:command', command);
    });
  }
  recorderEvent(event: { id: string; kind: string; error?: string }): void {
    const ack = this.acknowledgments.get(event.id);
    if (ack && (ack.kind === event.kind || event.kind === 'error')) {
      clearTimeout(ack.timer);
      this.acknowledgments.delete(event.id);
      if (event.kind === 'error')
        ack.reject(new AppError(event.error ?? 'Microphone unavailable.'));
      else ack.resolve();
    }
    if (event.kind === 'stopped' || event.kind === 'error') this.recordingAllowed = false;
  }
  isRecordingSession(id: string): boolean {
    return this.recordingAllowed && this.recordingId === id;
  }
  close(): void {
    this.quitting = true;
    this.recordingAllowed = false;
    for (const ack of this.acknowledgments.values()) {
      clearTimeout(ack.timer);
      ack.reject(new AppError('Seyvo is quitting.'));
    }
    this.acknowledgments.clear();
    for (const window of [this.dashboard, this.overlay, this.recorder])
      if (window && !window.isDestroyed()) window.destroy();
  }
}
