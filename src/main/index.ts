import { app, globalShortcut } from 'electron';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMainWindow } from './windows/main-window';
import { createTray } from './tray';
import { registerHotkey, unregisterHotkey } from './hotkey';
import { registerVaultHandlers } from './ipc/vault-handlers';
import { registerSettingsHandlers } from './ipc/settings-handlers';
import { startAutoLock, stopAutoLock } from './autolock';
import { setQuitting } from './app-state';

function logCrash(label: string, err: unknown): void {
  try {
    const p = join(app.getPath('userData'), 'crash.log');
    const msg = `[${new Date().toISOString()}] ${label}: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`;
    writeFileSync(p, msg, { flag: 'a' });
  } catch {
    // ignora falha ao gravar o log de crash
  }
}

process.on('uncaughtException', (err) => logCrash('uncaughtException', err));
process.on('unhandledRejection', (err) => logCrash('unhandledRejection', err));

// instância única: evita múltiplos processos disputando o mesmo vault.dat e o mesmo atalho global
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  logCrash('startup', 'requestSingleInstanceLock() retornou false — outra instância já está rodando');
  app.quit();
} else {
  app.on('second-instance', () => {
    createMainWindow();
  });

  app.whenReady().then(() => {
    try {
      registerVaultHandlers();
      registerSettingsHandlers();
      createTray();
      registerHotkey();
      startAutoLock();
      createMainWindow();
    } catch (err) {
      logCrash('whenReady', err);
      throw err;
    }
  });

  app.on('window-all-closed', () => {
    // app continua rodando na bandeja para manter o atalho global ativo
  });

  app.on('before-quit', () => {
    setQuitting(true);
    unregisterHotkey();
    stopAutoLock();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('activate', () => {
    createMainWindow();
  });
}
