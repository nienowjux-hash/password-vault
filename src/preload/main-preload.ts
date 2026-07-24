import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, NewCredentialInput, UpdateCredentialInput } from '@shared/types';

// Canais IPC copiados literalmente (não importados de @shared/ipc-channels): com
// sandbox:true o preload roda num carregador restrito que não resolve requires de
// chunks compartilhados extraídos pelo bundler entre os dois scripts de preload.
// Ver src/shared/ipc-channels.ts para a lista canônica usada por main/renderer.
const IPC = {
  vaultStatus: 'vault:status',
  vaultCreate: 'vault:create',
  vaultUnlock: 'vault:unlock',
  vaultLock: 'vault:lock',
  vaultChangePin: 'vault:change-pin',
  credentialList: 'credential:list',
  credentialReveal: 'credential:reveal',
  credentialAdd: 'credential:add',
  credentialUpdate: 'credential:update',
  credentialDelete: 'credential:delete',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
} as const;

const api = {
  vaultStatus: () => ipcRenderer.invoke(IPC.vaultStatus),
  vaultCreate: (pin: string) => ipcRenderer.invoke(IPC.vaultCreate, pin),
  vaultUnlock: (pin: string) => ipcRenderer.invoke(IPC.vaultUnlock, pin),
  vaultLock: () => ipcRenderer.invoke(IPC.vaultLock),
  vaultChangePin: (currentPin: string, newPin: string) =>
    ipcRenderer.invoke(IPC.vaultChangePin, { currentPin, newPin }),

  credentialList: () => ipcRenderer.invoke(IPC.credentialList),
  credentialReveal: (id: string, pin: string) => ipcRenderer.invoke(IPC.credentialReveal, { id, pin }),
  credentialAdd: (input: NewCredentialInput) => ipcRenderer.invoke(IPC.credentialAdd, input),
  credentialUpdate: (input: UpdateCredentialInput) => ipcRenderer.invoke(IPC.credentialUpdate, input),
  credentialDelete: (id: string) => ipcRenderer.invoke(IPC.credentialDelete, id),

  settingsGet: () => ipcRenderer.invoke(IPC.settingsGet),
  settingsUpdate: (patch: Partial<AppSettings>) => ipcRenderer.invoke(IPC.settingsUpdate, patch),

  onAutoLocked: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('vault:auto-locked', listener);
    return () => ipcRenderer.removeListener('vault:auto-locked', listener);
  },
};

contextBridge.exposeInMainWorld('api', api);

export type MainApi = typeof api;
