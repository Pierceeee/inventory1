import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Icon from '../ui/Icon.jsx'
import ErrorBanner from '../ui/ErrorBanner.jsx'
import ManualScanForm from './ManualScanForm.jsx'
import CameraScanner from './CameraScanner.jsx'
import ScanResultBanner from './ScanResultBanner.jsx'
import RecentScans from './RecentScans.jsx'
import { useScanItem } from '../../hooks/useInventorySessions.js'

// A sticker held in front of the camera decodes every frame - ignore a
// repeat of the same code for a couple of seconds so it does not scan in a
// loop (D6).
const REPEAT_WINDOW_MS = 2000

export default function ScannerPanel({ session }) {
  const [expanded, setExpanded] = useState(false)
  const [mode, setMode] = useState('manual')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const lastDetect = useRef({ code: null, at: 0 })
  // Responses can arrive out of order (a slow request started first can
  // settle after a faster one started later) - only the most recently
  // STARTED request is allowed to update the banner, for both a result and
  // an error, or a stale response could overwrite what actually happened.
  const requestId = useRef(0)
  const scan = useScanItem(session.id)
  const qc = useQueryClient()

  function runScan(code) {
    const id = ++requestId.current
    setAccessDenied(false)
    setError(null)
    return scan.mutateAsync(code).then((data) => {
      if (requestId.current !== id) return
      setResult(data)
    }).catch((err) => {
      if (requestId.current !== id) return
      // A7: department reassigned mid-session - the next scan attempt gets a
      // 403. Say so plainly and refresh /me, rather than a generic error.
      if (err?.status === 403) {
        setAccessDenied(true)
        setResult(null)
        qc.invalidateQueries({ queryKey: ['me'] })
      } else {
        setResult(null)
        setError(err)
      }
    })
  }

  function handleCameraDetect(code) {
    const now = Date.now()
    if (scan.isPending) return
    if (lastDetect.current.code === code && now - lastDetect.current.at < REPEAT_WINDOW_MS) return
    lastDetect.current = { code, at: now }
    runScan(code)
  }

  return (
    <div className="mb-6 rounded-xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-900">
        <span className="inline-flex items-center gap-2"><Icon name="qr" size={18} /> QR Scanner</span>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>

      {expanded && (
        <div className="border-t border-slate-200 p-4">
          <div role="tablist" aria-label="Scan mode" className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
            <button
              type="button" role="tab" id="scan-tab-manual" aria-selected={mode === 'manual'}
              onClick={() => setMode('manual')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              Manual
            </button>
            <button
              type="button" role="tab" id="scan-tab-camera" aria-selected={mode === 'camera'}
              onClick={() => setMode('camera')}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${mode === 'camera' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              Camera
            </button>
          </div>

          {accessDenied && (
            <div role="alert" className="mb-3 rounded-lg bg-bad-50 px-4 py-3 text-sm text-bad-700 ring-1 ring-inset ring-red-200">
              You no longer have access to this session.
            </div>
          )}

          {mode === 'manual'
            ? <ManualScanForm onScan={runScan} />
            : <CameraScanner onDetect={handleCameraDetect} paused={scan.isPending} />}

          {!accessDenied && <ScanResultBanner result={result} />}
          {!accessDenied && error && <ErrorBanner error={error} className="mt-3" />}

          <RecentScans sessionId={session.id} />
        </div>
      )}
    </div>
  )
}
