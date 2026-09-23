import { useEffect, useState } from 'react'

/** One QR code label. Generated as an SVG string (G-13: jsdom/print has no
 *  canvas) with the `qrcode` package, loaded lazily so a session that is
 *  never printed never pays for it. Encodes only the item code. */
export default function QrLabel({ code, caption }) {
  const [svg, setSvg] = useState(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode').then((mod) => {
      const QRCode = mod.default ?? mod
      return QRCode.toString(code, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
    }).then((result) => { if (!cancelled) setSvg(result) })
    return () => { cancelled = true }
  }, [code])

  return (
    <div className="flex break-inside-avoid flex-col items-center gap-1 rounded-lg border border-slate-200 p-3 text-center">
      {svg
        ? <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} alt={code} className="h-28 w-28" />
        : <div className="h-28 w-28 animate-pulse rounded bg-slate-100" aria-hidden="true" />}
      <p className="font-mono text-xs text-slate-900">{code}</p>
      {caption && <p className="text-xs text-slate-500">{caption}</p>}
    </div>
  )
}
