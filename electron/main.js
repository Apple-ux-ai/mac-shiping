const { app, BrowserWindow, ipcMain, dialog, protocol, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

const UPDATE_SERVER_URL = 'http://software.kunqiongai.com:8000';
const SOFT_NUMBER = '10030';

let pythonProcess = null;
let pendingRequests = new Map();
let lastConversionTargets = null;

function getWindowIconPath() {
  const base = path.join(__dirname, '../build');
  if (process.platform === 'win32') {
    const ico = path.join(base, 'icon.ico');
    return fs.existsSync(ico) ? ico : undefined;
  }
  const icns = path.join(base, 'icon.icns');
  return fs.existsSync(icns) ? icns : undefined;
}

function getBackendExecutableName() {
  return process.platform === 'win32' ? 'api.exe' : 'api';
}

function getUpdaterLogDir() {
  if (process.platform === 'win32') {
    return path.join(process.env.LOCALAPPDATA || os.homedir(), 'convert-tool-updater');
  }
  return path.join(os.homedir(), 'Library', 'Logs', 'convert-tool-updater');
}

function logUpdater(message) {
  try {
    const baseDir = getUpdaterLogDir();
    fs.mkdirSync(baseDir, { recursive: true });
    const logFile = path.join(baseDir, 'main_log.txt');
    const line = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (e) {
  }
}

function createWindow() {
  const iconPath = getWindowIconPath();
  const mainWindow = new BrowserWindow({
    width: 1350,
    height: 875,
    minWidth: 1125,
    minHeight: 740,
    center: true,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff', // Set background color to avoid white flash
    frame: false,
    ...(iconPath ? { icon: iconPath } : {}),
    titleBarStyle: 'hiddenInset', // Better for macOS, ignored on Windows unless we use frame: false
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Handle external links to open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
    mainWindow.webContents.closeDevTools();
  } else {
    // In dev mode, retry loading the URL if it fails initially
    const loadURL = () => {
      mainWindow.loadURL('http://localhost:5173').catch(() => {
        console.log('Vite server not ready, retrying in 1s...');
        setTimeout(loadURL, 1000);
      });
    };
    loadURL();
    mainWindow.webContents.openDevTools();
  }

  const notifyMaximizedState = () => {
    if (mainWindow.isDestroyed() || mainWindow.webContents.isDestroyed()) {
      return;
    }
    mainWindow.webContents.send('window-maximized-state-changed', mainWindow.isMaximized());
  };

  mainWindow.webContents.on('did-finish-load', () => {
    notifyMaximizedState();
  });
  mainWindow.on('maximize', notifyMaximizedState);
  mainWindow.on('unmaximize', notifyMaximizedState);

  // Handle F12 to toggle DevTools
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      // Allow F12 in dev mode OR if --debug flag is passed (for testing packaged app)
      if (!app.isPackaged || process.argv.includes('--debug')) {
        mainWindow.webContents.toggleDevTools();
      }
      event.preventDefault();
    }
  });
}

ipcMain.handle('check-update', async (event, payload) => {
  const currentVersion = payload && payload.version ? String(payload.version) : '';

  if (!currentVersion) {
    return { success: false, error: 'Missing version' };
  }

  const url = `${UPDATE_SERVER_URL}/api/v1/updates/check/?software=${encodeURIComponent(SOFT_NUMBER)}&version=${encodeURIComponent(currentVersion)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Check update failed in main process:', error);
    return { success: false, error: error && error.message ? error.message : String(error) };
  }
});

ipcMain.on('start-update', (event, updateInfo) => {
  if (process.platform !== 'win32') {
    logUpdater('In-app update launcher is only supported on Windows.');
    return;
  }
  if (!updateInfo || !updateInfo.url || !updateInfo.hash) {
    logUpdater(`Error: Missing update info. updateInfo=${JSON.stringify(updateInfo)}`);
    return;
  }

  const { url, hash } = updateInfo;
  const pid = process.pid;
  let updaterPath;
  let appDir;
  const exeName = path.basename(process.execPath);

  if (app.isPackaged) {
    updaterPath = path.join(path.dirname(process.execPath), 'updater.exe');
    appDir = path.dirname(process.execPath);
  } else {
    updaterPath = path.join(__dirname, '../dist/updater.exe');
    appDir = path.join(__dirname, '..');
  }

  logUpdater(`Starting updater (Exec Start): ${updaterPath}`);
  logUpdater(`Params: url=${url} hash=${hash} dir=${appDir} exe=${exeName} pid=${pid}`);

  try {
    const args = [
      '--url', url,
      '--hash', hash,
      '--dir', appDir,
      '--exe', exeName,
      '--pid', String(pid),
    ];

    const cmdArgs = args.map(a => `"${String(a).replace(/"/g, '""')}"`).join(' ');
    const startCmd = `start "" "${updaterPath}" ${cmdArgs}`;

    require('child_process').exec(startCmd, (error) => {
      if (error) {
        logUpdater(`Exec start failed: ${error.message}`);
      } else {
        logUpdater('Exec start initiated successfully');
      }
    });

    setTimeout(() => app.quit(), 1000);
  } catch (e) {
    logUpdater(`Failed to start updater (exception): ${e && e.message ? e.message : String(e)}`);
  }
});

// Start Python Backend
function startPythonBackend() {
  let command;
  let args;

  if (app.isPackaged) {
    // In production, use the bundled executable
    const scriptPath = path.join(process.resourcesPath, 'backend', getBackendExecutableName());
    command = scriptPath;
    args = [];
    console.log('Starting Python backend (prod):', scriptPath);
  } else {
    // In dev, use python command
    const scriptPath = path.join(__dirname, '../backend/main.py');
    command = 'python';
    args = [scriptPath];
    console.log('Starting Python backend (dev):', scriptPath);
  }
  
  try {
    pythonProcess = spawn(command, args);
  } catch (e) {
    console.error('Failed to spawn Python process:', e);
    return;
  }

  setupResponseHandler();

  pythonProcess.stdout.on('data', (data) => {
    const str = data.toString();
    console.log(`Python stdout: ${str}`);
    
    const lines = str.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.includes('"type"')) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.type === 'output') {
          if (Array.isArray(parsed.targets) && parsed.targets.length > 0) {
            lastConversionTargets = parsed.targets;
          } else if (parsed.output) {
            lastConversionTargets = [parsed.output];
          }
        }
        if (parsed && (parsed.type === 'progress' || parsed.type === 'output')) {
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('conversion-progress', parsed);
          });
        }
      } catch (e) {
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`);
    // Reject all pending requests
    for (const [id, { reject }] of pendingRequests) {
      reject(new Error('Cancelled'));
    }
    pendingRequests.clear();
  });
}

// Helper to send request to Python and wait for response
function sendToPython(data) {
  return new Promise((resolve, reject) => {
    if (!pythonProcess) {
      reject(new Error('Python backend not running'));
      return;
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const request = { ...data, id };
    
    pendingRequests.set(id, { resolve, reject });
    pythonProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Global response handler for Python process
function setupResponseHandler() {
  if (!pythonProcess) return;

  pythonProcess.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const response = JSON.parse(line);
        if (response.id && pendingRequests.has(response.id)) {
          const { resolve } = pendingRequests.get(response.id);
          pendingRequests.delete(response.id);
          resolve(response.result);
        }
      } catch (e) {
        // Ignore parse errors for partial lines or logs
      }
    }
  });
}

app.whenReady().then(() => {
  // Register 'media' protocol to serve local files
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error(error);
    }
  });

  startPythonBackend();
  createWindow();

  // IPC Handlers
  ipcMain.handle('perform-conversion', async (event, { action, payload }) => {
    try {
      if (action === 'get-video-info' || action === 'generate-preview') {
         return await sendToPython({ action, payload });
      }

      // If outputDir is not specified, we should probably throw an error or ask user
      // But based on user request, we must NOT automatically create a default folder
      if (!payload.outputDir) {
         // Fallback to desktop if absolutely needed, but don't create a specific folder automatically
         // Ideally, the frontend should ensure a directory is selected.
         // For now, let's just use Desktop directly to avoid creating "ConvertOutput"
         payload.outputDir = app.getPath('desktop');
      }
      return await sendToPython({ action, payload });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('dialog:openFile', async (event, filters) => {
    const options = {
      properties: ['openFile', 'multiSelections']
    };
    if (Array.isArray(filters) && filters.length > 0) {
      options.filters = filters;
    } else {
      options.filters = [{ name: 'Videos', extensions: ['avi', 'mp4', 'mkv', 'mov'] }];
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(options);
    if (canceled) {
      return [];
    } else {
      return filePaths;
    }
  });

  ipcMain.handle('shell:openPath', async (event, path) => {
    await require('electron').shell.openPath(path);
  });

  ipcMain.handle('shell:openOutputDir', async (event, customPath) => {
    // If a custom path is provided (e.g. from frontend state), open that.
    // Otherwise open Desktop as a safe fallback instead of creating a new folder.
    const outputDir = customPath || app.getPath('desktop');
    try {
      await require('electron').shell.openPath(outputDir);
    } catch (error) {
      console.error('Failed to open output directory:', error);
    }
  });

  ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });

  ipcMain.handle('cancel-conversion', async (event, payload) => {
    try {
      console.log('Cancelling conversion...');
      
      if (pythonProcess) {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
        } else {
          pythonProcess.kill('SIGKILL');
        }
        pythonProcess = null;
      }

      await new Promise(resolve => setTimeout(resolve, 800));

      startPythonBackend();

      const fs = require('fs');
      const deletePathSafe = (targetPath) => {
        try {
          if (!targetPath) {
            return;
          }

          if (!fs.existsSync(targetPath)) {
            const ext = path.extname(targetPath).toLowerCase();
            if (ext === '.mp4' || ext === '.mov') {
              const dir = path.dirname(targetPath);
              const base = path.basename(targetPath, ext);
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              const hexPattern = /^[0-9a-f]{8}$/i;
              for (const entry of entries) {
                if (!entry.isFile()) continue;
                if (!entry.name.toLowerCase().endsWith(ext)) continue;
                const nameWithoutExt = entry.name.slice(0, -ext.length);
                if (nameWithoutExt === base) {
                  const fullPath = path.join(dir, entry.name);
                  if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log('Deleted partial conversion file:', fullPath);
                  }
                  continue;
                }
                const idx = nameWithoutExt.indexOf('_');
                if (idx > 0) {
                  const prefix = nameWithoutExt.slice(0, idx);
                  const suffix = nameWithoutExt.slice(idx + 1);
                  if (prefix === base && hexPattern.test(suffix)) {
                    const fullPath = path.join(dir, entry.name);
                    if (fs.existsSync(fullPath)) {
                      fs.unlinkSync(fullPath);
                      console.log('Deleted partial conversion file:', fullPath);
                    }
                  }
                }
              }
            }
          }

          if (!fs.existsSync(targetPath)) {
            return;
          }

          const stats = fs.statSync(targetPath);
          if (stats.isDirectory()) {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log('Deleted partial conversion directory:', targetPath);
          } else {
            fs.unlinkSync(targetPath);
            console.log('Deleted partial conversion file:', targetPath);
          }
        } catch (e) {
          console.error('Failed to delete path during cancel:', targetPath, e);
        }
      };

      if (payload && payload.targetDir) {
        deletePathSafe(payload.targetDir);
      }

      if (payload && payload.targetPath) {
        if (Array.isArray(payload.targetPath)) {
          payload.targetPath.forEach(deletePathSafe);
        } else {
          deletePathSafe(payload.targetPath);
        }
      }

      if (Array.isArray(lastConversionTargets)) {
        lastConversionTargets.forEach(deletePathSafe);
      }

      return { success: true };
    } catch (error) {
      console.error('Cancel conversion error:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.minimize();
  });

  ipcMain.handle('window:toggleMaximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    if (win.isMaximized()) {
      win.unmaximize();
      return false;
    }
    win.maximize();
    return true;
  });

  ipcMain.handle('window:isMaximized', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });

  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    win?.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
