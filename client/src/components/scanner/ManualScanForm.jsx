import { useRef, useState } from 'react'
import Button from '../ui/Button.jsx'

/**
 * A handheld barcode scanner acts like a keyboard: it types the code, then
 * "presses" Enter. The input is never disabled while a scan is in flight -
 * scanners fire faster than a network round trip - and it clears and
 * refocuses immediately on submit, not once the request settles (D3), so the
 * next code can be typed/scanned right away.
 */
export default function ManualScanForm({ onScan }) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  function submit() {
    const code = value
    if (!code.trim()) return
    setValue('')
    inputRef.current?.focus()
    Promise.resolve(onScan(code)).catch(() => {})
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); submit() }
  }

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label htmlFor="scan-code" className="mb-1 block text-xs font-medium text-slate-600">Item code</label>
        <input
          id="scan-code"
          ref={inputRef}
          type="text"
          aria-label="Item code"
          autoFocus
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
        />
      </div>
      <Button onClick={submit}>Scan</Button>
    </div>
  )
}
