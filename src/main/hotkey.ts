import { globalShortcut } from 'electron';
import { getSettings } from './config';
import { captureForegroundWindow } from './native/autotype';
import { createOrShowPopupWindow } from './windows/popup-window';
import { isUnlocked } from './vault/vault-store';
import { showMainWindowForUnlock } from './tray';

function onHotkeyTriggered(): void {
  captureForegroundWindow();
  if (!isUnlocked()) {
    // sem cofre desbloqueado não há credenciais para listar; abre a janela principal
    // para o usuário desbloquear primeiro, em vez de abrir um popup vazio.
    showMainWindowForUnlock();
    return;
  }
  createOrShowPopupWindow();
}

export function registerHotkey(): void {
  const { hotkey } = getSettings();
  globalShortcut.register(hotkey, onHotkeyTriggered);
}

export function reregisterHotkey(newAccelerator: string): void {
  globalShortcut.unregisterAll();
  globalShortcut.register(newAccelerator, onHotkeyTriggered);
}

export function unregisterHotkey(): void {
  globalShortcut.unregisterAll();
}
