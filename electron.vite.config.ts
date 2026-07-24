import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const shared = resolve(__dirname, 'src/shared');

export default defineConfig({
  main: {
    resolve: { alias: { '@shared': shared } },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    resolve: { alias: { '@shared': shared } },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          'main-preload': resolve(__dirname, 'src/preload/main-preload.ts'),
          'popup-preload': resolve(__dirname, 'src/preload/popup-preload.ts'),
        },
      },
    },
  },
  renderer: {
    resolve: { alias: { '@shared': shared } },
    build: {
      rollupOptions: {
        input: {
          'main-window': resolve(__dirname, 'src/renderer/main-window/index.html'),
          'popup-window': resolve(__dirname, 'src/renderer/popup-window/index.html'),
        },
      },
    },
  },
});
