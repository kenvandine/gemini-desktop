function isHttpProtocol(protocol) {
  return protocol === 'http:' || protocol === 'https:';
}

function errDetail(e) {
  return (e && (e.code || e.message)) || String(e);
}

function loadFailed(context) {
  return (e) => console.warn(`${context}: load failed`, errDetail(e));
}

module.exports = { isHttpProtocol, errDetail, loadFailed };
