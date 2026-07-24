import { Tray, Menu, app, nativeImage } from 'electron';
import { join } from 'node:path';
import { createMainWindow } from './windows/main-window';
import { lock } from './vault/vault-store';
import { setQuitting } from './app-state';

let tray: Tray | null = null;

export function showMainWindowForUnlock(): void {
  createMainWindow();
}

function trayIconPath(): string {
  return join(__dirname, app.isPackaged ? '../../resources/tray-icon.png' : '../../resources/tray-icon.png');
}

export function createTray(): Tray {
  const icon = nativeImage.createFromPath(trayIconPath());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('App Senhas');

  const menu = Menu.buildFromTemplate([
    { label: 'Abrir Cofre', click: () => createMainWindow() },
    { label: 'Bloquear Agora', click: () => lock() },
    { type: 'separator' },
    {
      label: 'Sair',
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on('click', () => createMainWindow());

  return tray;
}

export function getTray(): Tray | null {
  return tray;
}
