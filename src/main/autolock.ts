import { powerMonitor } from 'electron';
import { getSettings } from './config';
import { isUnlocked, lock } from './vault/vault-store';
import { getMainWindow } from './windows/main-window';

let intervalHandle: NodeJS.Timeout | null = null;

const CHECK_INTERVAL_MS = 30_000;

function tick(): void {
  if (!isUnlocked()) return;
  const { autoLockMinutes } = getSettings();
  const idleSeconds = powerMonitor.getSystemIdleTime();
  if (idleSeconds >= autoLockMinutes * 60) {
    lock();
    getMainWindow()?.webContents.send('vault:auto-locked');
  }
}

export function startAutoLock(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopAutoLock(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}
