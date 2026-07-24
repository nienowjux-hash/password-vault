import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import type { AppSettings } from '@shared/types';

const DEFAULTS: AppSettings = {
  hotkey: 'Control+Alt+L',
  autoLockMinutes: 5,
  openAtLogin: false,
  clipboardFallback: false,
};

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function getSettings(): AppSettings {
  const p = settingsPath();
  if (!existsSync(p)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const merged = { ...getSettings(), ...patch };
  writeFileSync(settingsPath(), JSON.stringify(merged, null, 2), 'utf8');
  app.setLoginItemSettings({ openAtLogin: merged.openAtLogin });
  return merged;
}
