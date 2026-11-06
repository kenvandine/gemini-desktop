const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const Store = require('electron-store');

const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
    icon: path.join(__dirname, 'icon.png')
  });

  // Load the index.html file
  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation to Gemini
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.includes('gemini.google.com')) {
      // Allow navigation to Gemini
      return;
    }
    // Prevent navigation to other sites
    event.preventDefault();
  });

  // Handle new window creation (like sign-in)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('accounts.google.com') || url.includes('gemini.google.com')) {
      // Allow Google sign-in and Gemini navigation
      return { action: 'allow' };
    }
    // Open external links in default browser
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  // Set up session cookies
  setupSessionCookies();
}

function setupSessionCookies() {
  // Get saved cookies
  const savedCookies = store.get('cookies', []);
  
  if (savedCookies.length > 0) {
    // Set cookies for the session
    session.defaultSession.cookies.set(savedCookies)
      .then(() => {
        console.log('Cookies restored successfully');
      })
      .catch((error) => {
        console.error('Failed to restore cookies:', error);
      });
  }
}

// Handle IPC messages from renderer
ipcMain.handle('save-credentials', async (event, credentials) => {
  try {
    store.set('credentials', credentials);
    return { success: true };
  } catch (error) {
    console.error('Failed to save credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-credentials', async () => {
  try {
    const credentials = store.get('credentials', null);
    return { success: true, credentials };
  } catch (error) {
    console.error('Failed to get credentials:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-credentials', async () => {
  try {
    store.delete('credentials');
    return { success: true };
  } catch (error) {
    console.error('Failed to clear credentials:', error);
    return { success: false, error: error.message };
  }
});

// Handle cookie saving
ipcMain.handle('save-cookies', async (event, cookies) => {
  try {
    store.set('cookies', cookies);
    return { success: true };
  } catch (error) {
    console.error('Failed to save cookies:', error);
    return { success: false, error: error.message };
  }
});

// Handle cookie retrieval
ipcMain.handle('get-cookies', async () => {
  try {
    const cookies = store.get('cookies', []);
    return { success: true, cookies };
  } catch (error) {
    console.error('Failed to get cookies:', error);
    return { success: false, error: error.message };
  }
});

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
