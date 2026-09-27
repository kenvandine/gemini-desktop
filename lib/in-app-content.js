// Google content kept in-app to reuse the app session's auth cookies.
const inAppContent = {
  // Generated files and attachments.
  downloadSuffixes: [
    '.usercontent.google.com',
  ],
  // Viewer/print pages.
  viewerSuffixes: [
    '.googleusercontent.com',
  ],
};

function isDownloadHost(hostname) {
  if (!hostname) return false;
  return inAppContent.downloadSuffixes.some((suffix) => hostname.endsWith(suffix));
}

function isViewerHost(hostname) {
  if (!hostname) return false;
  return inAppContent.viewerSuffixes.some((suffix) => hostname.endsWith(suffix));
}

function isInAppContentHost(hostname) {
  return isDownloadHost(hostname) || isViewerHost(hostname);
}

module.exports = { isDownloadHost, isViewerHost, isInAppContentHost };
