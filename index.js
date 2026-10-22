const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const isOnline = require('is-online');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      sandbox: false,
    },
    icon: path.join(__dirname, 'icon.png'),
    title: 'Gemini',
  });

  // Set the window title to "Gemini" to avoid "Offline - Copilot" issue
  mainWindow.setTitle('Gemini');

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Handle window focus events to prevent unnecessary offline checks
  mainWindow.on('focus', () => {
    // Send a message to renderer to check network status if needed
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window-focused');
    }
  });

  // Handle window blur events
  mainWindow.on('blur', () => {
    // No action needed on blur
  });

  // Handle window close event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation events to ensure correct title
  mainWindow.webContents.on('did-navigate', (event, url) => {
    // Ensure title is set correctly after navigation
    mainWindow.setTitle('Gemini');
  });

  // Handle page title changes
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    // Prevent "Offline - Copilot" title
    if (title.includes('Offline - Copilot')) {
      event.preventDefault();
      mainWindow.setTitle('Gemini');
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle network status changes
ipcMain.on('check-network', async (event) => {
  try {
    const online = await isOnline();
    event.reply('network-status', online);
  } catch (error) {
    console.error('Network check error:', error);
    event.reply('network-status', false);
  }
});

// Handle window title updates
ipcMain.on('update-title', (event, title) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Only update title if it's not the default "Offline - Copilot"
    if (!title.includes('Offline - Copilot')) {
      mainWindow.setTitle(title);
    }
  }
});
