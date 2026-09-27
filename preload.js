const { ipcRenderer } = require('electron');

// Pre-filter for link clicks; the main process guards do the enforcing.
let hostRules = null;
ipcRenderer.invoke('get-allowed-hosts')
    .then((rules) => { hostRules = rules; })
    .catch((e) => {
        console.warn('preload: could not fetch allowed hosts, deferring to main', e);
    });

function isAllowedHost(hostname) {
    if (!hostRules) return true; // not loaded yet: let the main process decide
    return hostRules.hosts.includes(hostname)
        || hostRules.suffixes.some((suffix) => hostname.endsWith(suffix));
}

// Network status detection
function updateNetworkStatus() {
    ipcRenderer.send('network-status', navigator.onLine);
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

// Listen for DOMContentLoaded event
window.addEventListener('DOMContentLoaded', () => {
    // Wire up retry button on offline page
    const retryBtn = document.getElementById('retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            ipcRenderer.send('retry-connection');
        });
    } else {
        // Only send initial network status if NOT on offline page
        // to avoid triggering reload loops
        updateNetworkStatus();
    }

    // Listen for click events and open non-allowed links externally
    document.addEventListener('click', (event) => {
        // Guard against non-Element targets (e.g., text nodes)
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const link = target.closest('a');
        if (link && link.href && link.href.startsWith('http')) {
            try {
                // Use hostname (not host) to exclude port from comparison
                const hostname = new URL(link.href).hostname;
                if (isAllowedHost(hostname)) {
                    return; // Allow app + auth links to navigate in-app
                }
            } catch (e) {
                // If URL parsing fails, open externally as a safety measure
            }
            event.preventDefault();
            ipcRenderer.send('open-external-link', link.href);
        }
    });
});

// Handle keyboard shortcuts for zoom
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey) {
        if (event.key === '+') {
            ipcRenderer.send('zoom-in');
        } else if (event.key === '-') {
            ipcRenderer.send('zoom-out');
        } else if (event.key === '0') {
            ipcRenderer.send('zoom-reset');
        }
    }
});

// Handle mouse wheel zoom
document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
        event.preventDefault(); // Prevent default scrolling
        if (event.deltaY < 0) {
            ipcRenderer.send('zoom-in');
        } else {
            ipcRenderer.send('zoom-out');
        }
    }
});
