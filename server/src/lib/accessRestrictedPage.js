const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPE[c])

/**
 * A small, self-contained "Access Restricted" page for anyone outside
 * ALLOWED_IPS: inline CSS only, no script, no form, no link back into the
 * app - a blocked visitor must never receive the app bundle or a login form
 * (improvements.md Phase 8). The address is escaped, never trusted as HTML.
 */
export function accessRestrictedHtml(ip) {
  const safeIp = escapeHtml(ip || 'unknown')
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Access Restricted</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #0f172a; color: #e2e8f0; font-family: system-ui, -apple-system, sans-serif; padding: 2rem; box-sizing: border-box; }
  main { max-width: 32rem; text-align: center; }
  h1 { font-size: 1.5rem; margin: 0 0 1rem; }
  p { line-height: 1.6; margin: 0 0 1rem; }
  .ip { font-family: ui-monospace, monospace; font-size: 0.875rem; color: #94a3b8; }
</style>
</head>
<body>
<main>
  <h1>Access Restricted</h1>
  <p>AKM is only available on the Adspark office network. Connect to the office Wi-Fi or LAN and try again. If you are in the office and still see this, contact IT.</p>
  <p class="ip">Your address: ${safeIp}</p>
</main>
</body>
</html>
`
}
