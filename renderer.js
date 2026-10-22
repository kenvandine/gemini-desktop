const { ipcRenderer } = require('electron');
const isOnline = require('is-online');

let isOnlineStatus = true;
let retryTimeout = null;

// Function to update the UI based on network status
function updateNetworkStatus(online) {
  isOnlineStatus = online;
  
  // Clear any existing retry timeout
  if (retryTimeout) {
    clearTimeout(retryTimeout);
    retryTimeout = null;
  }
  
  // Remove offline screen if it exists
  const offlineScreen = document.getElementById('offline-screen');
  if (offlineScreen) {
    offlineScreen.remove();
  }
  
  // Update the title to "Gemini"
  document.title = 'Gemini';
  
  // If online, load the main content
  if (online) {
    loadMainContent();
  } else {
    // Show offline screen
    showOfflineScreen();
  }
}

// Function to show offline screen
function showOfflineScreen() {
  // Remove any existing offline screen
  const existingScreen = document.getElementById('offline-screen');
  if (existingScreen) {
    existingScreen.remove();
  }
  
  // Create offline screen
  const offlineScreen = document.createElement('div');
  offlineScreen.id = 'offline-screen';
  offlineScreen.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #f3f2f1;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    flex-direction: column;
    text-align: center;
    padding: 20px;
  `;
  
  offlineScreen.innerHTML = `
    <div style="max-width: 500px; background: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <h1 style="color: #323130; margin-bottom: 16px;">You're Offline</h1>
      <p style="color: #5f6368; margin-bottom: 24px;">Please check your internet connection and try again.</p>
      <button id="retry-button" style="background: #4285F4; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">Retry</button>
    </div>
  `;
  
  document.body.appendChild(offlineScreen);
  
  // Add event listener to retry button
  const retryButton = document.getElementById('retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', checkNetworkStatus);
  }
}

// Function to load main content
function loadMainContent() {
  // Create a new iframe to load the Gemini web app
  const iframe = document.createElement('iframe');
  iframe.id = 'gemini-iframe';
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
  `;
  
  // Set the source to the Gemini web app
  iframe.src = 'https://gemini.google.com/';
  
  // Replace the loading screen with the iframe
  const container = document.querySelector('.container');
  if (container) {
    container.innerHTML = '';
    container.appendChild(iframe);
  }
  
  // Update the title to "Gemini"
  document.title = 'Gemini';
}

// Function to check network status
async function checkNetworkStatus() {
  try {
    const online = await isOnline();
    updateNetworkStatus(online);
  } catch (error) {
    console.error('Network check error:', error);
    updateNetworkStatus(false);
  }
}

// Function to handle window focus events
function handleWindowFocus() {
  // Only check network status if we're not already online
  if (!isOnlineStatus) {
    // Delay the check to avoid immediate offline triggers
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    retryTimeout = setTimeout(() => {
      checkNetworkStatus();
    }, 1000); // 1 second delay
  }
}

// Initialize the app
function initApp() {
  // Listen for window focus events
  window.addEventListener('focus', handleWindowFocus);
  
  // Check network status on startup
  checkNetworkStatus();
}

// Start the app when the DOM is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Listen for messages from the main process
ipcRenderer.on('window-focused', () => {
  // Handle window focus event
  handleWindowFocus();
});

// Listen for network status updates from main process
ipcRenderer.on('network-status', (event, online) => {
  updateNetworkStatus(online);
});
