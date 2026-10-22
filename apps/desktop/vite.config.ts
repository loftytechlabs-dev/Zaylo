import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main/index.ts',
        onstart(options) {
          // Ensure static preload.cjs is copied into dist-electron
          const preloadSrc = path.resolve(__dirname, 'electron/preload.cjs');
          const preloadDestDir = path.resolve(__dirname, 'dist-electron');
          const preloadNestedDir = path.resolve(__dirname, 'dist-electron/preload');
          if (fs.existsSync(preloadSrc)) {
            if (!fs.existsSync(preloadDestDir)) fs.mkdirSync(preloadDestDir, { recursive: true });
            if (!fs.existsSync(preloadNestedDir)) fs.mkdirSync(preloadNestedDir, { recursive: true });
            fs.copyFileSync(preloadSrc, path.join(preloadDestDir, 'preload.cjs'));
            fs.copyFileSync(preloadSrc, path.join(preloadNestedDir, 'index.cjs'));
          }

          // Ensure forge python scripts are copied into dist-electron
          const scriptsSrc = path.resolve(__dirname, 'electron/forge/scripts');
          const scriptsDest1 = path.resolve(__dirname, 'dist-electron/main/scripts');
          const scriptsDest2 = path.resolve(__dirname, 'dist-electron/forge/scripts');
          if (fs.existsSync(scriptsSrc)) {
            fs.mkdirSync(scriptsDest1, { recursive: true });
            fs.mkdirSync(scriptsDest2, { recursive: true });
            fs.cpSync(scriptsSrc, scriptsDest1, { recursive: true });
            fs.cpSync(scriptsSrc, scriptsDest2, { recursive: true });
          }

          // Ensure image diffusion python scripts are copied into dist-electron
          const imgScriptsSrc = path.resolve(__dirname, 'electron/image/scripts');
          const imgScriptsDest2 = path.resolve(__dirname, 'dist-electron/image/scripts');
          if (fs.existsSync(imgScriptsSrc)) {
            fs.mkdirSync(scriptsDest1, { recursive: true });
            fs.mkdirSync(imgScriptsDest2, { recursive: true });
            fs.cpSync(imgScriptsSrc, scriptsDest1, { recursive: true });
            fs.cpSync(imgScriptsSrc, imgScriptsDest2, { recursive: true });
          }

          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: ['sql.js', 'electron', 'node:sqlite', 'better-sqlite3'],
            },
          },
        },
      },
    ]),
    {
      name: 'copy-preload-plugin',
      closeBundle() {
        const preloadSrc = path.resolve(__dirname, 'electron/preload.cjs');
        const preloadDestDir = path.resolve(__dirname, 'dist-electron');
        const preloadNestedDir = path.resolve(__dirname, 'dist-electron/preload');
        if (fs.existsSync(preloadSrc)) {
          if (!fs.existsSync(preloadDestDir)) fs.mkdirSync(preloadDestDir, { recursive: true });
          if (!fs.existsSync(preloadNestedDir)) fs.mkdirSync(preloadNestedDir, { recursive: true });
          fs.copyFileSync(preloadSrc, path.join(preloadDestDir, 'preload.cjs'));
          fs.copyFileSync(preloadSrc, path.join(preloadNestedDir, 'index.cjs'));
        }

        const scriptsSrc = path.resolve(__dirname, 'electron/forge/scripts');
        const scriptsDest1 = path.resolve(__dirname, 'dist-electron/main/scripts');
        const scriptsDest2 = path.resolve(__dirname, 'dist-electron/forge/scripts');
        if (fs.existsSync(scriptsSrc)) {
          fs.mkdirSync(scriptsDest1, { recursive: true });
          fs.mkdirSync(scriptsDest2, { recursive: true });
          fs.cpSync(scriptsSrc, scriptsDest1, { recursive: true });
          fs.cpSync(scriptsSrc, scriptsDest2, { recursive: true });
        }

        const imgScriptsSrc = path.resolve(__dirname, 'electron/image/scripts');
        const imgScriptsDest2 = path.resolve(__dirname, 'dist-electron/image/scripts');
        if (fs.existsSync(imgScriptsSrc)) {
          fs.mkdirSync(scriptsDest1, { recursive: true });
          fs.mkdirSync(imgScriptsDest2, { recursive: true });
          fs.cpSync(imgScriptsSrc, scriptsDest1, { recursive: true });
          fs.cpSync(imgScriptsSrc, imgScriptsDest2, { recursive: true });
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
  },
});
