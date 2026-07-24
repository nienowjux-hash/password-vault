import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC } from '@shared/ipc-channels';
import { getSettings, updateSettings } from '../config';
import { reregisterHotkey } from '../hotkey';

const settingsPatchSchema = z.object({
  hotkey: z.string().min(1).optional(),
  autoLockMinutes: z.number().min(1).max(120).optional(),
  openAtLogin: z.boolean().optional(),
  clipboardFallback: z.boolean().optional(),
});

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.settingsGet, () => getSettings());

  ipcMain.handle(IPC.settingsUpdate, (_e, raw: unknown) => {
    const patch = settingsPatchSchema.parse(raw);
    const updated = updateSettings(patch);
    if (patch.hotkey) reregisterHotkey(updated.hotkey);
    return updated;
  });
}
