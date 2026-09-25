import net from 'node:net'

/**
 * Strips an IPv6 zone id (`fe80::1%eth0` -> `fe80::1`) and unwraps an
 * IPv4-mapped IPv6 address (`::ffff:10.0.0.5` -> `10.0.0.5`), so a Node
 * process listening dual-stack compares like with like against ALLOWED_IPS.
 * Returns '' for anything `net.isIP` does not recognise (family 0).
 */
export function normaliseIp(ip) {
  if (!ip) return ''
  let value = String(ip).split('%')[0]
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(value)
  if (mapped) value = mapped[1]
  return net.isIP(value) ? value : ''
}

const PREFIX_RE = /^\d+$/
const MAX_PREFIX = { 4: 32, 6: 128 }

/**
 * Parses ALLOWED_IPS: a comma/whitespace-separated list of single IPv4/IPv6
 * addresses or CIDR ranges (D3 - either the office's public IPs, primary and
 * backup ISP, or a LAN subnet). Throws naming the first bad entry, rather
 * than silently dropping a typo'd address that would then never match.
 *
 * Built on `net.BlockList` (G1) with an EXPLICIT family passed to every
 * addAddress/addSubnet/check call - BlockList does not infer it.
 */
export function parseAllowList(text) {
  const blockList = new net.BlockList()
  const entries = []

  for (const raw of String(text ?? '').split(/[\s,]+/)) {
    const token = raw.trim()
    if (!token) continue

    const [address, prefixText] = token.split('/')
    const family = net.isIP(address)
    if (!family) {
      throw new Error(`ALLOWED_IPS has an entry that is not a valid IP address or CIDR: "${token}".`)
    }
    const familyName = family === 4 ? 'ipv4' : 'ipv6'

    if (prefixText === undefined) {
      blockList.addAddress(address, familyName)
    } else {
      if (!PREFIX_RE.test(prefixText) || Number(prefixText) > MAX_PREFIX[family]) {
        throw new Error(
          `ALLOWED_IPS has an invalid CIDR prefix (must be 0-${MAX_PREFIX[family]} for ${familyName}): "${token}".`)
      }
      blockList.addSubnet(address, Number(prefixText), familyName)
    }
    entries.push(token)
  }

  return {
    entries,
    // Never auto-allow loopback or anything else: this ONLY matches what was
    // actually listed. `ip` is normalised first, so an IPv4-mapped IPv6
    // client address matches a plain IPv4 entry.
    allows(ip) {
      const normalised = normaliseIp(ip)
      if (!normalised) return false
      const family = net.isIP(normalised)
      return blockList.check(normalised, family === 4 ? 'ipv4' : 'ipv6')
    },
  }
}

const TRUST_PROXY_KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal'])
const HOP_COUNT_RE = /^\d+$/

/**
 * Parses TRUST_PROXY. A bare hop count (`1`, `2`, ...) becomes a Number -
 * Express then trusts that many proxy hops. Otherwise a comma/whitespace list
 * where each token is an IP, a CIDR, or one of Express's own keywords
 * (loopback/linklocal/uniquelocal) is returned as the comma string Express
 * expects. `true`/`yes`/`*` are refused outright: any of those makes
 * `X-Forwarded-For` fully attacker-controlled, which would let anyone spoof
 * their way past `officeNetworkOnly`. Unset/blank returns undefined, meaning
 * "do not touch `trust proxy` at all" - Express's own default (false), so
 * X-Forwarded-For is ignored.
 */
export function parseTrustProxy(raw) {
  const value = raw?.trim()
  if (!value) return undefined

  const lower = value.toLowerCase()
  if (lower === 'true' || lower === 'yes' || lower === '*') {
    throw new Error(
      `TRUST_PROXY=${value} lets anyone fake their address with X-Forwarded-For. ` +
      'Set the number of proxy hops (usually 1), or a comma list of the exact proxy ' +
      'IP address(es)/CIDR(s), or loopback/linklocal/uniquelocal.')
  }
  if (HOP_COUNT_RE.test(value)) return Number(value)

  const tokens = value.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
  for (const token of tokens) {
    if (TRUST_PROXY_KEYWORDS.has(token.toLowerCase())) continue
    const [address, prefixText] = token.split('/')
    const family = net.isIP(address)
    if (!family) {
      throw new Error(
        `TRUST_PROXY has an entry that is not a hop count, IP, CIDR, or ` +
        `loopback/linklocal/uniquelocal: "${token}".`)
    }
    if (prefixText !== undefined && (!PREFIX_RE.test(prefixText) || Number(prefixText) > MAX_PREFIX[family])) {
      throw new Error(`TRUST_PROXY has an invalid CIDR prefix: "${token}".`)
    }
  }
  return tokens.join(',')
}
