const { app, BrowserWindow } = require('electron');
const { join } = require('path');
const fs = require('fs');

const appURL = 'https://gemini.google.com';
const screenshotPath = process.env.SCREENSHOT_PATH || 'screenshot.png';

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false, // Don't show the window
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: true,
      sandbox: false
    }
  });

  win.removeMenu();

  win.loadURL(appURL);

  // Wait for the page to load
  win.webContents.on('did-finish-load', async () => {
    console.log('Page loaded, waiting for content to render...');
    
    // Wait a bit more for dynamic content to load
    setTimeout(async () => {
      try {
        console.log('Capturing screenshot...');
        const image = await win.capturePage();
        fs.writeFileSync(screenshotPath, image.toPNG());
        console.log(`Screenshot saved to ${screenshotPath}`);
        app.quit();
      } catch (error) {
        console.error('Error capturing screenshot:', error);
        app.exit(1);
      }
    }, 5000); // Wait 5 seconds for content to fully load
  });

  // Handle load failures
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorDescription} (${errorCode})`);
    // Take a screenshot anyway to show the error state
    setTimeout(async () => {
      try {
        const image = await win.capturePage();
        fs.writeFileSync(screenshotPath, image.toPNG());
        console.log(`Screenshot of error state saved to ${screenshotPath}`);
      } catch (error) {
        console.error('Error capturing error screenshot:', error);
      }
      app.exit(1);
    }, 2000);
  });
}

// Ensure single instance
const firstInstance = app.requestSingleInstanceLock();

if (!firstInstance) {
  app.quit();
} else {
  app.on('ready', () => {
    console.log(`Electron Version: ${process.versions.electron}`);
    console.log(`App Version: ${app.getVersion()}`);
    console.log('Creating window for screenshot...');
    createWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
