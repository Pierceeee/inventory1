import { useEffect, useRef, useState } from 'react'

/**
 * Isolated from ManualScanForm so a session that never opens Camera mode
 * never even evaluates `navigator.mediaDevices`, and the zxing bundle is
 * only requested (dynamic import) after that check passes (D6/G-13). jsdom
 * has no camera, so tests exercise the "unavailable" branch only.
 */
export default function CameraScanner({ onDetect, paused }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const onDetectRef = useRef(onDetect)
  const pausedRef = useRef(paused)
  const [error, setError] = useState(null)

  useEffect(() => { onDetectRef.current = onDetect }, [onDetect])
  useEffect(() => { pausedRef.current = paused }, [paused])

  const available = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  useEffect(() => {
    if (!available) return
    let cancelled = false

    async function start() {
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser')
        if (cancelled) return
        const reader = new BrowserQRCodeReader()
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
          if (result && !pausedRef.current) onDetectRef.current(result.getText())
        })
        // Effects mount/unmount/remount under StrictMode in development - if
        // cleanup already ran by the time this promise settles, stop the
        // stream we just started rather than leaking a live camera.
        if (cancelled) { controls.stop(); return }
        controlsRef.current = controls
      } catch (err) {
        if (cancelled) return
        setError(err?.name === 'NotAllowedError'
          ? 'Camera access was denied. Allow camera access, or use Manual mode.'
          : 'Could not start the camera. Use Manual mode instead.')
      }
    }
    start()

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [available])

  if (!available) {
    return (
      <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        Camera scanning needs a camera and a secure (https) connection. Use Manual mode.
      </p>
    )
  }

  if (error) {
    return <p role="alert" className="rounded-lg bg-bad-50 p-4 text-sm text-bad-700">{error}</p>
  }

  return (
    <div className="overflow-hidden rounded-lg bg-slate-900">
      <video ref={videoRef} muted playsInline aria-label="Camera preview" className="aspect-video w-full" />
    </div>
  )
}
