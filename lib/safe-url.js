const { isPathSensitiveHost } = require('./allowed-hosts');
const { isInAppContentHost } = require('./in-app-content');
const { isHttpProtocol } = require('./utils');

function firstPathSegment(pathname) {
  const [, first] = pathname.split('/');
  return first ? `/${first}` : pathname;
}

function safeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'file:') return `file://${u.pathname}`;
    if (!isHttpProtocol(u.protocol)) {
      return u.protocol;
    }
    if (isInAppContentHost(u.hostname)) return u.origin;
    if (isPathSensitiveHost(u.hostname)) return `${u.origin}${firstPathSegment(u.pathname)}`;
    return `${u.origin}${u.pathname}`;
  } catch (e) {
    return `<unparsable: ${String(url).slice(0, 40)}>`;
  }
}

module.exports = { safeUrl };
