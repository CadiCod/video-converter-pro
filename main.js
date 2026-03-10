const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { convertVideo, probeVideo, cancelConversion } = require('./src/js/converter');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'src', 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Handle file drops via web contents event (most reliable in Electron)
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── Window Controls ───
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── File Dialogs ───
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video Files',
    filters: [
      {
        name: 'Video Files',
        extensions: [
          'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v',
          '3gp', 'mpg', 'mpeg', 'vob', 'ogv', 'ts', 'mts', 'm2ts',
          'divx', 'asf', 'rm', 'rmvb', 'f4v', 'swf'
        ]
      },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('dialog:selectOutputDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Output Directory',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Video Probe ───
ipcMain.handle('video:probe', async (event, filePath) => {
  try {
    return await probeVideo(filePath);
  } catch (err) {
    return { error: err.message };
  }
});

// ─── Video Conversion ───
ipcMain.handle('video:convert', async (event, options) => {
  try {
    const result = await convertVideo(options, (progress) => {
      mainWindow?.webContents.send('conversion:progress', {
        id: options.id,
        ...progress
      });
    });
    return result;
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.on('video:cancel', (event, id) => {
  cancelConversion(id);
});

// ─── File System ───
ipcMain.handle('fs:getDefaultOutputDir', () => {
  const videosDir = path.join(app.getPath('videos'), 'Converted');
  if (!fs.existsSync(videosDir)) {
    fs.mkdirSync(videosDir, { recursive: true });
  }
  return videosDir;
});

ipcMain.handle('fs:openInExplorer', async (event, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('fs:openFile', async (event, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('fs:openExternal', async (event, url) => {
  // Only allow http/https URLs for security
  if (url.startsWith('https://') || url.startsWith('http://')) {
    shell.openExternal(url);
  }
});

ipcMain.handle('fs:getFileSize', async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch {
    return 0;
  }
});

// ─── App Info ───
ipcMain.handle('app:getVersion', () => app.getVersion());
