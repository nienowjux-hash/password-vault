export interface CredentialMeta {
  id: string;
  name: string;
  username: string;
  notes: string;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface Credential extends CredentialMeta {
  password: string;
}

export type NewCredentialInput = Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateCredentialInput = Partial<NewCredentialInput> & { id: string };

export interface VaultStatus {
  exists: boolean;
  unlocked: boolean;
}

export interface LockoutInfo {
  locked: boolean;
  retryAfterMs: number;
  failedAttempts: number;
}

export interface AppSettings {
  hotkey: string;
  autoLockMinutes: number;
  openAtLogin: boolean;
  clipboardFallback: boolean;
}
