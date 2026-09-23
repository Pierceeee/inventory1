import { useState } from 'react'
import Icon from '../ui/Icon.jsx'

/** A file picker that also accepts drag-and-drop. The visible control is a
 *  <label> wrapping a visually-hidden file input, so it is reachable by
 *  keyboard and announced correctly by screen readers. */
export default function DropZone({ onFile, accept = '.xlsx,.xls,.csv', disabled = false }) {
  const [dragging, setDragging] = useState(false)

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0]
    if (file) onFile(file)
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <Icon name="upload" size={24} className="text-slate-400" />
      <p className="text-sm font-medium text-slate-700">Drag a spreadsheet here, or click to choose one</p>
      <p className="text-xs text-slate-500">.xlsx, .xls or .csv</p>
      <input
        type="file"
        accept={accept}
        disabled={disabled}
        aria-label="Choose a spreadsheet"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}
