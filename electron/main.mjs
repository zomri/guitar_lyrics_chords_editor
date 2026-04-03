import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, Menu, dialog, ipcMain } from 'electron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function configureDataPath() {
  // Store Chromium localStorage/cookies under a folder next to the exe.
  // In dev, keep it under the project folder.
  const dataDir = app.isPackaged
    ? path.join(path.dirname(app.getPath('exe')), 'data')
    : path.join(process.cwd(), '.desktop-data');

  app.setPath('userData', dataDir);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  Menu.setApplicationMenu(null);

  const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(indexPath);
}

ipcMain.handle('desktop:save-file', async (_event, payload) => {
  const { defaultPath, content, filters } = payload || {};
  const result = await dialog.showSaveDialog({
    defaultPath,
    filters: Array.isArray(filters) ? filters : undefined,
  });
  if (result.canceled || !result.filePath) {
    return { ok: false, canceled: true };
  }
  await fs.writeFile(result.filePath, String(content ?? ''), 'utf8');
  return { ok: true, filePath: result.filePath };
});

ipcMain.handle('desktop:print-html', async (_event, payload) => {
  const html = String(payload?.html ?? '');
  if (!html) return { ok: false, error: 'No HTML content' };

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  try {
    await printWin.loadURL(dataUrl);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const printed = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
        },
        (success) => resolve(success),
      );
    });
    printWin.close();
    return { ok: Boolean(printed) };
  } catch (err) {
    printWin.close();
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('desktop:export-pdf', async (_event, payload) => {
  const html = String(payload?.html ?? '');
  const defaultPath = String(payload?.defaultPath || 'lyrics-chords.pdf');
  if (!html) return { ok: false, error: 'No HTML content' };

  const save = await dialog.showSaveDialog({
    defaultPath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (save.canceled || !save.filePath) {
    return { ok: false, canceled: true };
  }

  const printWin = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
    },
  });

  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  try {
    await printWin.loadURL(dataUrl);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const pdf = await printWin.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      landscape: false,
    });
    await fs.writeFile(save.filePath, pdf);
    printWin.close();
    return { ok: true, filePath: save.filePath };
  } catch (err) {
    printWin.close();
    return { ok: false, error: err?.message || String(err) };
  }
});

configureDataPath();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
