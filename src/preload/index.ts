import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Status } from '../shared/contracts';
const bridge: Bridge = {
  status: () => ipcRenderer.invoke('app:status'),
  subscribe: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, status: Status): void => listener(status);
    ipcRenderer.on('app:state', handler);
    return () => ipcRenderer.removeListener('app:state', handler);
  },
  updateSettings: (patch) => ipcRenderer.invoke('app:settings', patch),
  saveKey: (key) => ipcRenderer.invoke('app:key-save', key),
  testKey: () => ipcRenderer.invoke('app:key-test'),
  removeKey: () => ipcRenderer.invoke('app:key-remove'),
  action: (action) => ipcRenderer.invoke('app:action', action),
  startup: (enabled) => ipcRenderer.invoke('app:startup', enabled),
  history: (action, id) => ipcRenderer.invoke('app:history', { action, id }),
  dictionary: (action) => ipcRenderer.invoke('app:dictionary', action),
  openLink: (link) => ipcRenderer.invoke('app:link', link),
};
contextBridge.exposeInMainWorld('seyvo', Object.freeze(bridge));
