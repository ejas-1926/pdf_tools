import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Undo2, Trash2 } from 'lucide-react'
import { Dropzone, ToolCard, OutputName } from '@/components/toolkit'
import { Status } from './basic'
import { redactPdf, renderThumbnails, loadPdf } from '@/lib/pdf'

const THUMB_WIDTH = 560

interface PxBox {
  pageIndex: number
  x: number
  y: number
  w: number
  h: number
}

export function RedactTool() {
  const [file, setFile] = useState<File | null>(null)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [pageSizes, setPageSizes] = useState<{ width: number; height: number }[]>([])
  const [boxes, setBoxes] = useState<PxBox[]>([])
  const [draft, setDraft] = useState<(PxBox & { cur?: { x: number; y: number } }) | null>(null)
  const [loading, setLoading] = useState(false)
  const [outName, setOutName] = useState('redacted.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pick = async (fs: File[]) => {
    const f = fs[0]
    setFile(f); setBoxes([]); setError(null); setSuccess(null)
    setLoading(true)
    try {
      const doc = await loadPdf(f)
      setPageSizes(doc.getPages().map((p) => p.getSize()))
      setThumbs(await renderThumbnails(f, THUMB_WIDTH))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this PDF.')
    } finally {
      setLoading(false)
    }
  }

  const beginDraw = (pageIndex: number, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setDraft({ pageIndex, x, y, w: 0, h: 0, cur: { x, y } })
    const move = (ev: MouseEvent) => {
      const cx = ev.clientX - rect.left
      const cy = ev.clientY - rect.top
      setDraft((d) => (d ? { ...d, cur: { x: cx, y: cy } } : d))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const cx = ev.clientX - rect.left
      const cy = ev.clientY - rect.top
      setDraft((d) => {
        if (!d) return null
        const nx = Math.min(d.x, cx)
        const ny = Math.min(d.y, cy)
        const nw = Math.abs(cx - d.x)
        const nh = Math.abs(cy - d.y)
        if (nw > 4 && nh > 4) {
          setBoxes((prev) => [...prev, { pageIndex: d.pageIndex, x: nx, y: ny, w: nw, h: nh }])
        }
        return null
      })
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    if (!boxes.length) { setError('Drag over the pages to mark areas to redact first.'); return }
    setBusy(true)
    try {
      const pdfBoxes = boxes.map((b) => {
        const size = pageSizes[b.pageIndex] ?? { width: 595, height: 842 }
        const displayed = document.getElementById(`redact-page-${b.pageIndex}`)?.clientWidth ?? THUMB_WIDTH
        const scale = displayed / size.width
        return {
          pageIndex: b.pageIndex,
          x: b.x / scale,
          y: size.height - (b.y + b.h) / scale,
          width: b.w / scale,
          height: b.h / scale,
        }
      })
      await redactPdf(file, pdfBoxes, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Redacted PDF downloaded. Redacted pages were rebuilt as images, so the covered text is destroyed, not just hidden.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Redaction failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard
      title="Redact PDF"
      description="Drag black boxes over sensitive areas on the page previews. Redacted pages are rebuilt as images so the underlying text is permanently destroyed — this is real redaction, not a cover-up."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={pick} />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{file.name} — {boxes.length} area{boxes.length === 1 ? '' : 's'} marked</p>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!boxes.length} onClick={() => setBoxes((b) => b.slice(0, -1))} aria-label="Undo last box">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={!boxes.length} onClick={() => setBoxes([])} aria-label="Clear all boxes">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {loading && <p className="text-sm text-muted-foreground">Rendering pages…</p>}
      <div className="space-y-4">
        {thumbs.map((src, i) => {
          const pageBoxes = boxes.filter((b) => b.pageIndex === i)
          return (
            <div key={i} id={`redact-page-${i}`} className="relative inline-block max-w-full select-none">
              <img src={src} alt={`Page ${i + 1}`} className="block max-w-full rounded border" draggable={false} />
              <div
                className="absolute inset-0 cursor-crosshair"
                onMouseDown={(e) => beginDraw(i, e)}
              >
                {pageBoxes.map((b, k) => (
                  <div key={k} className="absolute bg-black/80" style={{ left: b.x, top: b.y, width: b.w, height: b.h }} />
                ))}
                {draft && draft.pageIndex === i && draft.cur && (
                  <div
                    className="absolute border border-dashed border-red-500 bg-black/60"
                    style={{
                      left: Math.min(draft.x, draft.cur.x),
                      top: Math.min(draft.y, draft.cur.y),
                      width: Math.abs(draft.cur.x - draft.x),
                      height: Math.abs(draft.cur.y - draft.y),
                    }}
                  />
                )}
              </div>
              <span className="absolute -top-2 left-0 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Page {i + 1}</span>
            </div>
          )
        })}
      </div>
      {file && thumbs.length > 0 && <OutputName value={outName} onChange={setOutName} />}
      <Button onClick={run} disabled={busy || loading || !file || !thumbs.length}>{busy ? 'Redacting…' : 'Redact & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
