import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseAllowList, parseTrustProxy } from './lib/ipAllowList.js'

const ROOT_ENV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env')

// Same loose check validation.js uses for every other email field.
const EMAIL_RE = /^\S+@\S+\.\S+$/

/** Loads the repo-root .env (one file for server and client). Real
 *  environment variables win over the file. */
export function loadEnvFile() {
  if (fs.existsSync(ROOT_ENV)) process.loadEnvFile(ROOT_ENV)
}

/**
 * ADMIN_EMAILS: the operator's recovery path when nobody can sign in as an
 * admin any more (e.g. a Supabase user was deleted and re-created, so its
 * profile is orphaned - see README "Locked out"). Comma- or whitespace-
 * separated, trimmed, lower-cased and deduped. Throws a clear, specific error
 * rather than silently accepting a typo'd address that would never match.
 */
function parseAdminEmails(raw) {
  const emails = new Set()
  for (const entry of (raw ?? '').split(/[\s,]+/)) {
    const email = entry.trim().toLowerCase()
    if (!email) continue
    if (!EMAIL_RE.test(email)) {
      throw new Error(`ADMIN_EMAILS has an entry that is not an email address: "${entry.trim()}".`)
    }
    emails.add(email)
  }
  return [...emails]
}

// R7 / OQ7: the zone the xlsx export writes "Scanned At" in (Group 5). Fails
// loudly at startup on a typo, rather than on the first export request -
// Intl.DateTimeFormat throws a RangeError for anything it does not recognise.
const DEFAULT_TIME_ZONE = 'Asia/Manila'

function parseOfficeTimeZone(raw) {
  const zone = raw?.trim() || DEFAULT_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
  } catch {
    throw new Error(`OFFICE_TIME_ZONE is not a valid time zone: "${zone}".`)
  }
  return zone
}

// G2 (Appendix A, binding): only decides whether readConfig's fail-closed
// ALLOWED_IPS check below applies - never whether any individual REQUEST is
// allowed through (that is ALLOWED_IPS/officeNetworkOnly's job alone, and it
// never auto-allows loopback either). A hostname other than "localhost" is
// not treated as loopback - HOST is meant to be an IP or "localhost", not an
// arbitrary DNS name.
const LOOPBACK_BLOCKLIST = new net.BlockList()
LOOPBACK_BLOCKLIST.addSubnet('127.0.0.0', 8, 'ipv4')
LOOPBACK_BLOCKLIST.addAddress('::1', 'ipv6')

// Exported for index.js's startup warning (review fix #5): a bare hop-count
// TRUST_PROXY trusts X-Forwarded-For from whoever connects directly, which
// only makes sense with an actual proxy in front - worth a loud warning when
// HOST isn't loopback (no proxy implied) and TRUST_PROXY is still a number.
export function isLoopbackHost(host) {
  const value = host?.trim().toLowerCase()
  if (!value || value === 'localhost') return true
  const family = net.isIP(value)
  if (!family) return false
  return LOOPBACK_BLOCKLIST.check(value, family === 4 ? 'ipv4' : 'ipv6')
}

// security MEDIUM (review fix #5): a bare hop-count TRUST_PROXY trusts
// X-Forwarded-For from whoever connects directly - Express's numeric trust
// proxy setting does not check the immediate peer's address, it just trusts
// the rightmost N entries of X-Forwarded-For unconditionally. That's safe
// enough on a loopback HOST (only a same-machine process - e.g. a genuine
// reverse proxy - can connect at all), but on a non-loopback HOST it lets
// ANY direct network client claim any address and walk straight past
// ALLOWED_IPS. Exported so index.js can warn at startup; kept pure/testable
// rather than folded into readConfig, since this is a warning, not a reason
// to refuse to start (unlike the fail-closed check above).
export function trustProxyHopCountIsRisky(host, trustProxy) {
  return typeof trustProxy === 'number' && !isLoopbackHost(host)
}

/** Reads the environment once at startup and fails loudly on anything
 *  missing, rather than on the first request that needs it. */
export function readConfig(env = process.env, { needAuth = true } = {}) {
  const missing = []
  const need = (key) => {
    const value = env[key]?.trim()
    if (!value) missing.push(key)
    return value
  }

  const host = env.HOST?.trim() || '127.0.0.1'
  // Parsed unconditionally (like ADMIN_EMAILS/OFFICE_TIME_ZONE above): a
  // typo'd entry must fail loudly at startup for every caller, scripts
  // included, rather than only once officeNetworkOnly is actually mounted.
  const allowedIps = parseAllowList(env.ALLOWED_IPS ?? '')

  const trustProxy = parseTrustProxy(env.TRUST_PROXY)

  const config = {
    port: Number(env.PORT) || 3001,
    host,
    databaseUrl: need('DATABASE_URL'),
    supabaseUrl: needAuth ? need('SUPABASE_URL') : env.SUPABASE_URL,
    supabaseKey: needAuth ? need('SUPABASE_ANON_KEY') : env.SUPABASE_ANON_KEY,
    // Optional (R2): lets Register create sign-in accounts. Missing it does
    // not stop the server starting - only POST /api/users needs it, and it
    // then answers 503 REGISTRATION_UNAVAILABLE rather than failing to boot.
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
    adminEmails: parseAdminEmails(env.ADMIN_EMAILS),
    officeTimeZone: parseOfficeTimeZone(env.OFFICE_TIME_ZONE),
    allowedIps,
    trustProxy,
  }

  if (missing.length) {
    throw new Error(
      `Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.\n` +
      'Copy .env.example to .env at the repo root and fill it in.')
  }

  // G2 (Appendix A, binding) + security review fix #2: fail closed rather
  // than silently listening with no allowlist. TWO independent things make
  // this app reachable from outside this machine: a non-loopback HOST, OR a
  // reverse proxy in front of a loopback HOST (TRUST_PROXY set - the proxy
  // itself is what the internet/LAN actually reaches, and TRUST_PROXY means
  // officeNetworkOnly trusts whatever address X-Forwarded-For claims). The
  // documented "cloud host behind Caddy on the same machine" recipe is
  // HOST=127.0.0.1 + TRUST_PROXY=loopback - exactly the case a HOST-only
  // check would miss. Gated on `needAuth`: the db:migrate/db:seed/user:role
  // scripts (`needAuth: false`) never bind a socket or sit behind a proxy,
  // and README "Running it for the office" has the human run
  // `npm run db:migrate` BEFORE ALLOWED_IPS is necessarily set - this check
  // must not block that.
  if (needAuth && allowedIps.entries.length === 0) {
    const reasons = []
    if (!isLoopbackHost(host)) {
      reasons.push(`HOST is set to "${host}", which can be reached from outside this machine`)
    }
    if (trustProxy !== undefined) {
      reasons.push('TRUST_PROXY is set, so X-Forwarded-For from a reverse proxy is trusted')
    }
    if (reasons.length) {
      throw new Error(
        `${reasons.join(', and ')}, but ALLOWED_IPS is empty. ` +
        'AKM refuses to start exposed with no office-network allowlist.\n' +
        'Set ALLOWED_IPS in .env to the office public IPs (cloud hosting, primary and backup ISP) ' +
        'or the office LAN subnet (office server), or unset TRUST_PROXY and set HOST back to ' +
        '127.0.0.1 for local-only access.')
    }
  }

  return config
}
