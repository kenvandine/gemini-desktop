// Hosts allowed to navigate in-app.
const allowedNavigation = {
  appHosts: [
    'gemini.google.com',
  ],
  // Google sign-in; where a login starts.
  loginHosts: [
    'accounts.google.com',
  ],
  // Enterprise IdP domains (matched as any subdomain) so SSO logins finish in-app.
  enterpriseSuffixes: [
    '.okta.com',
    '.okta-emea.com',
    '.oktapreview.com',
    '.microsoftonline.com',
    '.b2clogin.com',
    '.pingone.com',
    '.onelogin.com',
    '.auth0.com',
    '.jumpcloud.com',
  ],
  // MFA providers a login may redirect through mid-flow.
  mfaSuffixes: [
    '.duosecurity.com',
    '.securid.com',
  ],
};

// SSO allowed paths
const sso = {
  // SAML ACS endpoint. Reached by form POST during login, never by a link
  // click, so only the main process enforces this path rule.
  acsPrefix: 'www.google.com/a/',
};

function isLoginHost(hostname) {
  if (!hostname) return false;
  if (allowedNavigation.loginHosts.includes(hostname)) return true;
  const suffixes = [
    ...allowedNavigation.enterpriseSuffixes,
    ...allowedNavigation.mfaSuffixes,
  ];
  return suffixes.some((suffix) => hostname.endsWith(suffix));
}

function allowedHostRules() {
  return {
    hosts: [
      ...allowedNavigation.appHosts,
      ...allowedNavigation.loginHosts,
    ],
    suffixes: [
      ...allowedNavigation.enterpriseSuffixes,
      ...allowedNavigation.mfaSuffixes,
    ],
  };
}

function matchesHostRules(hostname, rules) {
  if (!hostname) return false;
  return rules.hosts.includes(hostname)
    || rules.suffixes.some((suffix) => hostname.endsWith(suffix));
}

function isAllowedHost(hostname) {
  return matchesHostRules(hostname, allowedHostRules());
}

function isSsoAcsHost(hostname) {
  if (!hostname) return false;
  return sso.acsPrefix.startsWith(`${hostname}/`);
}

function isSsoAcsUrl(parsedUrl) {
  if (!parsedUrl) return false;
  return `${parsedUrl.hostname}${parsedUrl.pathname}`.startsWith(sso.acsPrefix);
}

function isPathSensitiveHost(hostname) {
  if (!hostname) return false;
  return allowedNavigation.appHosts.includes(hostname)
    || isLoginHost(hostname)
    || isSsoAcsHost(hostname);
}

module.exports = {
  isAllowedHost,
  isPathSensitiveHost,
  isLoginHost,
  isSsoAcsUrl,
  allowedHostRules,
};
