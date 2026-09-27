const { BrowserWindow, Menu, shell } = require('electron');
const { isAllowedHost, isLoginHost, isSsoAcsUrl } = require('./allowed-hosts');
const { isDownloadHost, isViewerHost } = require('./in-app-content');
const { isHttpProtocol, errDetail, loadFailed } = require('./utils');
const { safeUrl } = require('./safe-url');

// Injected by index.js. The main window is created after this module loads and
// can be replaced, so it is reached through a getter rather than captured.
let getMainWindow = () => null;
let icon = null;
let appURLHost = '';

function init({ getMainWindow: getWindow, icon: appIcon, appURLHost: host }) {
  getMainWindow = getWindow;
  icon = appIcon;
  appURLHost = host;
}

function mainWindow() {
  const w = getMainWindow();
  return w && !w.isDestroyed() ? w : null;
}

function startDownload(url, context) {
  const w = mainWindow();
  if (!w) {
    console.warn(`${context}: no app window to download through, ignoring`, safeUrl(url));
    return;
  }
  console.log(`${context}: routing download through app session`, safeUrl(url));
  w.webContents.downloadURL(url);
}

function closeUncommittedPopup(popupWin) {
  if (!popupWin || popupWin.isDestroyed()) return;
  const committed = popupWin.webContents.getURL();
  if (committed && committed !== 'about:blank') return;
  setImmediate(() => {
    if (!popupWin.isDestroyed()) popupWin.close();
  });
}

function navigationTarget(url, context) {
  try {
    const parsedUrl = new URL(url);
    if (isHttpProtocol(parsedUrl.protocol)) return parsedUrl;
    console.warn(`${context}: blocked unsafe protocol`, safeUrl(url));
  } catch (e) {
    console.warn(`${context}: invalid URL, preventing navigation`, safeUrl(url), errDetail(e));
  }
  return null;
}

function mayNavigateInApp(parsedUrl) {
  return isAllowedHost(parsedUrl.hostname) || isSsoAcsUrl(parsedUrl);
}

// A blocked redirect carries the rest of the login chain in `continue`, so
// dropping it drops the tail too. Resume at the first target in that chain the
// allowlist already accepts; it is untrusted input, so nothing new gets in-app.
const MAX_CONTINUE_HOPS = 5;

function continueTarget(parsedUrl) {
  let current = parsedUrl;
  for (let hop = 0; hop < MAX_CONTINUE_HOPS; hop += 1) {
    const next = current.searchParams.get('continue');
    if (!next) return null;
    try {
      current = new URL(next, current);
    } catch (e) {
      return null;
    }
    if (isHttpProtocol(current.protocol) && mayNavigateInApp(current)) return current.href;
  }
  return null;
}

// Caller has already prevented the navigation. True if resumed in `win`.
function resumeOrOpenExternal(win, target, url, context) {
  const resume = win ? continueTarget(target) : null;
  if (resume) {
    console.log(`${context}: skipping ${target.hostname} hop, resuming at`, safeUrl(resume));
    setImmediate(() => {
      if (!win.isDestroyed()) win.loadURL(resume).catch(loadFailed(context));
    });
    return true;
  }
  console.log(`${context} external (GET, any request body dropped): `, safeUrl(url));
  shell.openExternal(url);
  return false;
}

function guardAppNavigation(event, url, context) {
  const target = navigationTarget(url, context);
  if (target === null) {
    event.preventDefault();
  } else if (isDownloadHost(target.hostname)) {
    event.preventDefault();
    startDownload(url, context);
  } else if (isViewerHost(target.hostname)) {
    event.preventDefault();
    openGoogleViewerWindow(url);
  } else if (!mayNavigateInApp(target)) {
    event.preventDefault();
    resumeOrOpenExternal(mainWindow(), target, url, context);
  }
}

// A login popup that reaches the app has finished its job: the page belongs in
// the main window, not in a second app window left over from the login.
function handOffToMainWindow(url, popupWin, context) {
  const w = mainWindow();
  if (!w) return false;
  console.log(`${context}: login finished, moving to the main window`, safeUrl(url));
  setImmediate(() => {
    if (!w.isDestroyed()) w.loadURL(url).catch(loadFailed(context));
    if (!popupWin.isDestroyed()) popupWin.close();
  });
  return true;
}

function isAppUrl(url) {
  try {
    return new URL(url).host === appURLHost;
  } catch (e) {
    return false;
  }
}

function guardPopupNavigation(event, url, context, popupWin) {
  const target = navigationTarget(url, context);
  if (target === null) {
    event.preventDefault();
    closeUncommittedPopup(popupWin);
    return;
  }
  if (mayNavigateInApp(target)) {
    if (target.host === appURLHost && handOffToMainWindow(url, popupWin, context)) {
      event.preventDefault();
    }
    return;
  }
  const resume = continueTarget(target);
  if (resume && isAppUrl(resume) && handOffToMainWindow(resume, popupWin, context)) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  if (resumeOrOpenExternal(popupWin, target, url, context)) return;
  closeUncommittedPopup(popupWin);
}

function inAppPopupOptions() {
  return {
    icon: icon,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}

function openInAppContentOrBrowser(url, hostname, context) {
  if (isDownloadHost(hostname)) {
    startDownload(url, context);
  } else if (isViewerHost(hostname)) {
    openGoogleViewerWindow(url);
  } else {
    openInBrowser(url, hostname, context);
  }
}

function openInBrowser(url, hostname, context) {
  console.log(`${context}: opening in the browser`, safeUrl(url));
  shell.openExternal(url);
}

function currentHostname(browserWin) {
  if (!browserWin || browserWin.isDestroyed()) return '';
  try {
    return new URL(browserWin.webContents.getURL()).hostname;
  } catch (e) {
    return '';
  }
}

function mayContentWindowOpenInApp(parsedUrl) {
  if (isLoginHost(parsedUrl.hostname)) return true;
  return mayNavigateInApp(parsedUrl) && isLoginHost(currentHostname(mainWindow()));
}

function makeWindowOpenHandler({ context, mayOpenInApp = () => false, routeHttp, adoptAppHost = false }) {
  return ({ url, postBody }) => {
    console.log(`${context}: `, safeUrl(url));

    // Explicitly allow mailto links
    if (url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (e) {
      console.warn(`${context}: invalid URL, denying navigation`, safeUrl(url), errDetail(e));
      return { action: 'deny' };
    }

    // Block non-http(s) schemes (file:, javascript:, custom protocols, etc.)
    if (!isHttpProtocol(parsedUrl.protocol)) {
      console.warn(`${context}: blocked non-http(s) URL`, safeUrl(url));
      return { action: 'deny' };
    }

    // Keep same-host links in the window we already have.
    if (adoptAppHost && !postBody && parsedUrl.host === appURLHost) {
      const w = mainWindow();
      if (w) {
        w.loadURL(url).catch(loadFailed(context));
        return { action: 'deny' };
      }
    }

    if (mayOpenInApp(parsedUrl)) {
      console.log(`${context}: keeping new window in-app`, safeUrl(url));
      return { action: 'allow', overrideBrowserWindowOptions: inAppPopupOptions() };
    }

    // openExternal issues a GET, which would drop the POST body.
    if (postBody) {
      if (mayNavigateInApp(parsedUrl)) {
        console.log(`${context}: keeping form POST to allow-listed host in-app`, safeUrl(url));
        return { action: 'allow', overrideBrowserWindowOptions: inAppPopupOptions() };
      }
      console.warn(`${context}: handing a form POST to the browser, its body is dropped`, safeUrl(url));
    }

    routeHttp(url, parsedUrl.hostname, context);
    return { action: 'deny' };
  };
}

function mainWindowOpenHandler() {
  return makeWindowOpenHandler({
    context: 'windowOpenHandler',
    mayOpenInApp: mayContentWindowOpenInApp,
    routeHttp: openInAppContentOrBrowser,
    adoptAppHost: true,
  });
}

function attachPopupGuards(popupWin, context) {
  popupWin.removeMenu();
  popupWin.webContents.on('will-navigate', (event, url) => {
    guardPopupNavigation(event, url, `${context} will-navigate`, popupWin);
  });
  popupWin.webContents.on('will-redirect', (event) => {
    if (!event.isMainFrame) return;
    guardPopupNavigation(event, event.url, `${context} will-redirect`, popupWin);
  });
  popupWin.webContents.setWindowOpenHandler(makeWindowOpenHandler({
    context: `${context} windowOpenHandler`,
    mayOpenInApp: mayNavigateInApp,
    routeHttp: openInBrowser,
  }));
  popupWin.webContents.on('did-create-window', (childWin) => {
    attachPopupGuards(childWin, `${context} popup`);
  });
}

function createViewerMenu(viewerWin) {
  return Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Print...',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (viewerWin.isDestroyed()) return;
            try {
              viewerWin.webContents.print({}, (success, failureReason) => {
                if (!success) console.warn('viewer print failed', failureReason);
              });
            } catch (e) {
              console.warn('viewer print failed', errDetail(e));
            }
          },
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            const current = viewerWin.isDestroyed()
              ? ''
              : viewerWin.webContents.getURL();
            if (!current) {
              console.warn('viewer save-as: nothing loaded');
              return;
            }
            viewerWin.webContents.downloadURL(current);
          },
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'reload' },
      ],
    },
  ]);
}

function openGoogleViewerWindow(url) {
  console.log('opening Google viewer in new in-app window', safeUrl(url));
  const viewerWin = new BrowserWindow({
    width: 900,
    height: 700,
    icon: icon,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    }
  });
  viewerWin.loadURL(url).catch((e) => {
    console.log('viewer load did not complete', safeUrl(url), errDetail(e));
    if (!viewerWin.isDestroyed() && !viewerWin.webContents.getURL()) {
      viewerWin.close();
    }
  });
  viewerWin.setMenu(createViewerMenu(viewerWin));
}

module.exports = {
  init,
  guardAppNavigation,
  attachPopupGuards,
  mainWindowOpenHandler,
  openInAppContentOrBrowser,
};
