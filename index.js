const { app, BrowserWindow, screen, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const { join } = require('path');
const fs = require('fs');

let tray = null;
let win = null;
let wasOffline = false;
const appURL = 'https://gemini.google.com'
const icon = nativeImage.createFromPath(join(__dirname, 'icon.png'));

// IPC listeners (registered once, outside createWindow to avoid leaks)
ipcMain.on('zoom-in', () => {
  console.log('zoom-in');
  if (!win || win.isDestroyed()) {
    console.warn('zoom-in: window not available');
    return;
  }
  const currentZoom = win.webContents.getZoomLevel();
  win.webContents.setZoomLevel(currentZoom + 1);
});

ipcMain.on('zoom-out', () => {
  console.log('zoom-out');
  if (!win || win.isDestroyed()) {
    console.warn('zoom-out: window not available');
    return;
  }
  const currentZoom = win.webContents.getZoomLevel();
  win.webContents.setZoomLevel(currentZoom - 1);
});

ipcMain.on('zoom-reset', () => {
  console.log('zoom-reset');
  if (!win || win.isDestroyed()) {
    console.warn('zoom-reset: window not available');
    return;
  }
  win.webContents.setZoomLevel(0);
});

ipcMain.on('log-message', (event, message) => {
  console.log('Log from preload: ', message);
});

// Open links with default browser
ipcMain.on('open-external-link', (event, url) => {
  console.log('open-external-link: ', url);
  if (url) {
    shell.openExternal(url);
  }
});

// Retry connection from offline page
ipcMain.on('retry-connection', () => {
  console.log('Retrying connection...');
  if (!win || win.isDestroyed()) {
    console.warn('retry-connection: window not available');
    return;
  }
  wasOffline = false;
  win.loadURL(appURL);
});

// Listen for network status updates from the preload script
// Only act on transitions to avoid reload loops
ipcMain.on('network-status', (event, isOnline) => {
  console.log(`Network status: ${isOnline ? 'online' : 'offline'}`);
  if (!win || win.isDestroyed()) {
    console.warn('network-status: window not available');
    return;
  }
  if (isOnline && wasOffline) {
    wasOffline = false;
    win.loadURL(appURL);
  } else if (!isOnline && !wasOffline) {
    wasOffline = true;
    win.loadFile('offline.html');
  }
});

function createWindow () {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  // Log geometry information for easier debugging
  console.log(`Primary Screen Geometry - Width: ${width} Height: ${height} X: ${x} Y: ${y}`);

  win = new BrowserWindow({
    width: width * 0.6,
    height: height * 0.8,
    x: x + ((width - (width * 0.6)) / 2),
    y: y + ((height - (height * 0.8)) / 2),
    icon: icon,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.removeMenu();

  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide Gemini',
      icon: icon,
      click: () => {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
        }
      }
    },
    { type: 'separator' },
    { label: 'About',
      click: () => {
	console.log("About clicked");
	createAboutWindow();
      }
    },
    { label: 'Quit',
      click: () => {
	console.log("Quit clicked, Exiting");
	app.exit();
      }
    },
  ]);

  tray.setToolTip('Gemini');
  tray.setContextMenu(contextMenu);

  win.loadURL(appURL);

  // Show offline page if the URL fails to load (e.g. no internet)
  // Filter by network-related error codes to avoid incorrectly treating
  // in-app navigations/redirects as offline
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log(`did-fail-load: ${errorDescription} (${errorCode})`);
    
    // Network-related error codes that should trigger offline page
    const networkErrors = [
      -2,   // ERR_FAILED (generic network failure - may include some non-network cases)
      -7,   // ERR_TIMED_OUT
      -21,  // ERR_NETWORK_CHANGED
      -100, // ERR_CONNECTION_CLOSED
      -101, // ERR_CONNECTION_RESET
      -102, // ERR_CONNECTION_REFUSED
      -103, // ERR_CONNECTION_ABORTED
      -104, // ERR_CONNECTION_FAILED
      -105, // ERR_NAME_NOT_RESOLVED
      -106, // ERR_INTERNET_DISCONNECTED
      -109, // ERR_ADDRESS_UNREACHABLE
      -118, // ERR_CONNECTION_TIMED_OUT
      -137, // ERR_NAME_RESOLUTION_FAILED
      -324, // ERR_EMPTY_RESPONSE
    ];
    
    if (networkErrors.includes(errorCode)) {
      wasOffline = true;
      win.loadFile('offline.html');
    } else {
      console.log(`did-fail-load: ignoring non-network error ${errorCode}`);
    }
  });

  // Hosts allowed to navigate within the Electron window
  const allowedHosts = new Set([
    'gemini.google.com',
    'accounts.google.com',
  ]);

  // Intercept navigation and only allow app + auth hosts in-app
  win.webContents.on('will-navigate', (event, url) => {
    // Allow file:// protocol for offline.html and other app-internal files
    if (url.startsWith('file://')) {
      console.log('will-navigate: allowing file:// protocol', url);
      return;
    }
    
    try {
      const parsedUrl = new URL(url);
      const targetHost = parsedUrl.host;
      
      // Only handle http(s) protocols - prevent potentially unsafe protocols
      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        if (!allowedHosts.has(targetHost)) {
          console.log('will-navigate external: ', url);
          event.preventDefault();
          shell.openExternal(url);
        }
      } else {
        // Block other protocols (javascript:, data:, etc.) as they could be unsafe
        console.warn('will-navigate: blocked unsafe protocol', parsedUrl.protocol, url);
        event.preventDefault();
      }
    } catch (e) {
      console.warn('will-navigate: invalid URL, preventing navigation', url, e);
      event.preventDefault();
    }
  });

  const appHost = new URL(appURL).host;

  // New-window requests (window.open / target="_blank"): only keep the
  // app host in-app; everything else opens in the default browser with
  // a strict allowlist of URL schemes.
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log('windowOpenHandler: ', url);

    // Explicitly allow mailto links
    if (url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      console.warn('windowOpenHandler: invalid URL, denying navigation', url, e);
      return { action: 'deny' };
    }

    const { protocol, host } = parsedUrl;

    // Keep same-host http(s) links in-app
    if ((protocol === 'https:' || protocol === 'http:') && host === appHost) {
      win.loadURL(url);
      return { action: 'deny' };
    }

    // Open other http(s) links externally
    if (protocol === 'https:' || protocol === 'http:') {
      shell.openExternal(url);
    } else {
      // Block non-http(s) schemes (file:, javascript:, custom protocols, etc.)
      console.warn('windowOpenHandler: blocked non-http(s) URL', url);
    }

    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.key.toLowerCase() === 'r') {
      console.log('Pressed Control+R')
      event.preventDefault()
      win.loadURL(appURL);
    }
  })
}

// Ensure we're a single instance app
const firstInstance = app.requestSingleInstanceLock();

if (!firstInstance) {
  app.quit();
} else {
  app.on("second-instance", (event) => {
    console.log("second-instance");

    // If the main window doesn't exist yet (or was destroyed), create it
    if (!win || win.isDestroyed()) {
      if (app.isReady()) {
        createWindow();
      } else {
        app.whenReady().then(() => {
          if (!win || win.isDestroyed()) {
            createWindow();
          }
        });
      }
      return;
    }

    // If the window exists, restore and focus it
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  });
}

function createAboutWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x, y, width, height } = primaryDisplay.bounds;

  const aboutWindow = new BrowserWindow({
    width: 500,
    height: 420,
    x: x + ((width - 500) / 2),
    y: y + ((height - 420) / 2),
    title: 'About',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    modal: true,  // Make the About window modal
    parent: win  // Set the main window as parent
  });

  aboutWindow.loadFile('about.html');
  aboutWindow.removeMenu();

  // Read version from package.json
  const packageJson = JSON.parse(fs.readFileSync(join(__dirname, 'package.json')));
  const appVersion = packageJson.version;
  const appDescription = packageJson.description;
  const appTitle = packageJson.title;
  const appBugsUrl = packageJson.bugs.url;
  const appHomePage = packageJson.homepage;
  const appAuthor = packageJson.author;

  // Send version to the About window
  aboutWindow.webContents.on('did-finish-load', () => {
    console.log("did-finish-load", appTitle);
    aboutWindow.webContents.send('app-version', appVersion);
    aboutWindow.webContents.send('app-description', appDescription);
    aboutWindow.webContents.send('app-title', appTitle);
    aboutWindow.webContents.send('app-bugs-url', appBugsUrl);
    aboutWindow.webContents.send('app-homepage', appHomePage);
    aboutWindow.webContents.send('app-author', appAuthor);
  });
  // Link clicks open new windows, let's force them to open links in
  // the default browser
  aboutWindow.webContents.setWindowOpenHandler(({url}) => {
    console.log('windowOpenHandler: ', url);
    shell.openExternal(url);
    return { action: 'deny' }
  });
}

ipcMain.on('get-app-metadata', (event) => {
    const packageJson = JSON.parse(fs.readFileSync(join(__dirname, 'package.json')));
    const appVersion = packageJson.version;
    const appDescription = packageJson.description;
    const appTitle = packageJson.title;
    const appBugsUrl = packageJson.bugs.url;
    const appHomePage = packageJson.homepage;
    const appAuthor = packageJson.author;
    event.sender.send('app-version', appVersion);
    event.sender.send('app-description', appDescription);
    event.sender.send('app-title', appTitle);
    event.sender.send('app-bugs-url', appBugsUrl);
    event.sender.send('app-homepage', appHomePage);
    event.sender.send('app-author', appAuthor);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  console.log("window-all-closed");
});

app.on('activate', () => {
  console.log("ACTIVATE");
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('ready', () => {
  console.log(`Electron Version: ${process.versions.electron}`);
  console.log(`App Version: ${app.getVersion()}`);
});
