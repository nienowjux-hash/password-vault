export const IPC = {
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
  popupListNames: 'popup:list-names',
  popupAutotype: 'popup:autotype',
  popupClose: 'popup:close',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
