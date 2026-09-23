import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader.jsx'
import Button from '../components/ui/Button.jsx'
import Icon from '../components/ui/Icon.jsx'
import ErrorBanner from '../components/ui/ErrorBanner.jsx'
import QrLabel from '../components/labels/QrLabel.jsx'
import { useInventorySession } from '../hooks/useInventorySessions.js'
import { listSessionItems } from '../api/inventorySessions.js'

const PAGE_SIZE = 200

export default function PrintLabelsPage() {
  const { id } = useParams()
  const { data: session, isPending: sessionLoading, error: sessionError } = useInventorySession(id)
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setItems(null)
    setError(null)

    async function loadAll() {
      // Pages through the item list rather than one giant request - a
      // session can hold thousands of rows.
      const all = []
      let page = 1
      for (;;) {
        const { data } = await listSessionItems(id, { page, page_size: PAGE_SIZE })
        all.push(...data.items)
        if (cancelled || data.items.length === 0 || all.length >= data.total) break
        page += 1
      }
      if (!cancelled) setItems(all)
    }

    loadAll().catch((err) => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
  }, [id])

  if (sessionLoading || (!items && !error)) {
    return <p role="status" className="p-8 text-sm text-slate-500">Loading…</p>
  }
  if (sessionError) return <ErrorBanner error={sessionError} className="m-8" />
  if (error) return <ErrorBanner error={error} className="m-8" />
  if (!session) return null

  const captionColumn = (session.display_columns ?? session.columns)?.[0]

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          back={<Link to={`/sessions/${id}`} className="mb-1 block text-sm text-brand-700 hover:underline">← {session.name}</Link>}
          title="Print QR labels"
          subtitle={session.name}
          actions={<Button onClick={() => window.print()}><Icon name="printer" size={16} /> Print</Button>}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
        {items.map((item) => (
          <QrLabel key={item.id} code={item.item_code} caption={captionColumn ? item.data?.[captionColumn] : undefined} />
        ))}
      </div>
    </div>
  )
}
