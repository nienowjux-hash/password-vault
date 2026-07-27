import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC } from '@shared/ipc-channels';
import * as vault from '../vault/vault-store';
import { WrongPinError, LockedOutError } from '../vault/vault-store';
import { autotypeIntoCapturedWindow } from '../native/autotype';
import { closePopupWindow } from '../windows/popup-window';

const pinSchema = z.string().min(4).max(128);
const newCredentialSchema = z.object({
  name: z.string().min(1).max(200),
  username: z.string().max(200),
  password: z.string().max(2000),
  notes: z.string().max(4000),
  category: z.string().max(100).default(''),
  twoStepLogin: z.boolean().default(false),
});
const updateCredentialSchema = newCredentialSchema.partial().extend({ id: z.string().uuid() });

function toErrorPayload(err: unknown): { message: string; code: string; retryAfterMs?: number } {
  if (err instanceof LockedOutError) return { message: err.message, code: 'LOCKED_OUT', retryAfterMs: err.retryAfterMs };
  if (err instanceof WrongPinError) return { message: err.message, code: 'WRONG_PIN' };
  return { message: err instanceof Error ? err.message : String(err), code: 'ERROR' };
}

export function registerVaultHandlers(): void {
  ipcMain.handle(IPC.vaultStatus, () => ({
    exists: vault.vaultExists(),
    unlocked: vault.isUnlocked(),
  }));

  ipcMain.handle(IPC.vaultCreate, async (_e, rawPin: unknown) => {
    const pin = pinSchema.parse(rawPin);
    await vault.createVault(pin);
    return { exists: true, unlocked: true };
  });

  ipcMain.handle(IPC.vaultUnlock, async (_e, rawPin: unknown) => {
    const pin = pinSchema.parse(rawPin);
    try {
      const credentials = await vault.unlock(pin);
      return { ok: true as const, credentials };
    } catch (err) {
      return { ok: false as const, error: toErrorPayload(err) };
    }
  });

  ipcMain.handle(IPC.vaultLock, () => {
    vault.lock();
    return { exists: vault.vaultExists(), unlocked: false };
  });

  ipcMain.handle(IPC.vaultChangePin, async (_e, raw: unknown) => {
    const { currentPin, newPin } = z.object({ currentPin: pinSchema, newPin: pinSchema }).parse(raw);
    try {
      await vault.changePin(currentPin, newPin);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: toErrorPayload(err) };
    }
  });

  ipcMain.handle(IPC.credentialList, () => vault.listCredentials());

  ipcMain.handle(IPC.credentialReveal, async (_e, raw: unknown) => {
    const { id, pin } = z.object({ id: z.string().uuid(), pin: pinSchema }).parse(raw);
    try {
      const password = await vault.verifyPinAndRevealPassword(pin, id);
      return { ok: true as const, password };
    } catch (err) {
      return { ok: false as const, error: toErrorPayload(err) };
    }
  });

  ipcMain.handle(IPC.credentialAdd, (_e, raw: unknown) => {
    const input = newCredentialSchema.parse(raw);
    return vault.addCredential(input);
  });

  ipcMain.handle(IPC.credentialUpdate, (_e, raw: unknown) => {
    const input = updateCredentialSchema.parse(raw);
    return vault.updateCredential(input);
  });

  ipcMain.handle(IPC.credentialDelete, (_e, rawId: unknown) => {
    const id = z.string().uuid().parse(rawId);
    vault.deleteCredential(id);
    return { ok: true };
  });

  // --- popup do atalho global ---

  ipcMain.handle(IPC.popupListNames, () => {
    if (!vault.isUnlocked()) return [];
    return vault.listCredentials().map((c) => ({ id: c.id, name: c.name, username: c.username, category: c.category }));
  });

  ipcMain.handle(IPC.popupAutotype, async (_e, raw: unknown) => {
    const { id, pin } = z.object({ id: z.string().uuid(), pin: pinSchema }).parse(raw);
    try {
      const password = await vault.verifyPinAndRevealPassword(pin, id);
      const credential = vault.listCredentials().find((c) => c.id === id);
      closePopupWindow();
      await autotypeIntoCapturedWindow({
        username: credential?.username ?? '',
        password,
        twoStepLogin: credential?.twoStepLogin ?? false,
      });
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: toErrorPayload(err) };
    }
  });

  ipcMain.handle(IPC.popupClose, () => {
    closePopupWindow();
  });
}
