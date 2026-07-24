import { app, globalShortcut } from 'electron';
import { createMainWindow } from './windows/main-window';
import { createTray } from './tray';
import { registerHotkey, unregisterHotkey } from './hotkey';
import { registerVaultHandlers } from './ipc/vault-handlers';
import { registerSettingsHandlers } from './ipc/settings-handlers';
import { startAutoLock, stopAutoLock } from './autolock';
import { setQuitting } from './app-state';

// instância única: evita múltiplos processos disputando o mesmo vault.dat e o mesmo atalho global
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createMainWindow();
  });

  app.whenReady().then(() => {
    registerVaultHandlers();
    registerSettingsHandlers();
    createTray();
    registerHotkey();
    startAutoLock();
    createMainWindow();
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
