import { contextBridge, ipcRenderer } from 'electron';
import type { RecorderBridge, RecorderCommand } from '../shared/contracts';
const bridge: RecorderBridge = {
  command: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: RecorderCommand): void =>
      listener(command);
    ipcRenderer.on('recorder:command', handler);
    return () => ipcRenderer.removeListener('recorder:command', handler);
  },
  packet: (packet) => ipcRenderer.invoke('recorder:packet', packet),
  event: (event) => ipcRenderer.send('recorder:event', event),
};
contextBridge.exposeInMainWorld('recorder', Object.freeze(bridge));
