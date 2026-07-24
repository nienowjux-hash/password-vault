import { BrowserWindow, app, shell } from 'electron';
import { join } from 'node:path';
import { isQuitting } from '../app-state';

let mainWindow: BrowserWindow | null = null;

// pequeno helper local para checar dev/prod sem depender de pacote externo
function isDev(): boolean {
  return !app.isPackaged;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function createMainWindow(): BrowserWindow {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 480,
    height: 640,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/main-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[preload-error]', preloadPath, error);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting()) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev() && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/main-window/index.html`);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/main-window/index.html'));
  }

  if (!app.isPackaged) mainWindow.webContents.openDevTools({ mode: 'detach' });

  return mainWindow;
}
