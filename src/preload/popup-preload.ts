import { contextBridge, ipcRenderer } from 'electron';

// Ver nota em main-preload.ts: canais copiados literalmente para evitar chunk
// compartilhado, incompatível com o carregador restrito do preload sandboxado.
const IPC = {
  popupListNames: 'popup:list-names',
  popupAutotype: 'popup:autotype',
  popupClose: 'popup:close',
} as const;

// Superfície deliberadamente mínima: o popup nunca recebe a senha em texto puro,
// só o resultado ok/erro do autopreenchimento (que acontece inteiramente no processo main).
const api = {
  listNames: () => ipcRenderer.invoke(IPC.popupListNames) as Promise<Array<{ id: string; name: string; username: string }>>,
  autotype: (id: string, pin: string) => ipcRenderer.invoke(IPC.popupAutotype, { id, pin }),
  close: () => ipcRenderer.invoke(IPC.popupClose),
};

contextBridge.exposeInMainWorld('popupApi', api);

export type PopupApi = typeof api;
