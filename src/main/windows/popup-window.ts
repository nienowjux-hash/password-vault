import { BrowserWindow, app, screen } from 'electron';
import { join } from 'node:path';

let popupWindow: BrowserWindow | null = null;

export function getPopupWindow(): BrowserWindow | null {
  return popupWindow;
}

export function createOrShowPopupWindow(): BrowserWindow {
  if (popupWindow) {
    popupWindow.show();
    popupWindow.focus();
    return popupWindow;
  }

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  popupWindow = new BrowserWindow({
    width: 380,
    height: 440,
    x: Math.round((width - 380) / 2),
    y: 90,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/popup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  popupWindow.on('blur', () => closePopupWindow());
  popupWindow.on('ready-to-show', () => popupWindow?.show());
  popupWindow.on('closed', () => {
    popupWindow = null;
  });

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    popupWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/popup-window/index.html`);
  } else {
    popupWindow.loadFile(join(__dirname, '../renderer/popup-window/index.html'));
  }

  return popupWindow;
}

export function closePopupWindow(): void {
  popupWindow?.close();
  popupWindow = null;
}
