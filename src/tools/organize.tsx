import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Trash2 } from 'lucide-react'
import { Dropzone, ToolCard, OutputName } from '@/components/toolkit'
import { Status } from './basic'
import { renderThumbnails, extractPages } from '@/lib/pdf'

type Page = { id: number; thumb: string }

export function OrganizeTool() {
  const [file, setFile] = useState<File | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [loadingThumbs, setLoadingThumbs] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [outName, setOutName] = useState('organized.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pick = async (fs: File[]) => {
    const f = fs[0]
    setFile(f); setError(null); setSuccess(null); setPages([])
    setLoadingThumbs(true); setProgress('Rendering thumbnails…')
    try {
      const thumbs = await renderThumbnails(f, 150, (done, total) => setProgress(`Rendering page ${done} of ${total}…`))
      setPages(thumbs.map((thumb, i) => ({ id: i, thumb })))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this PDF.')
    } finally {
      setLoadingThumbs(false); setProgress(null)
    }
  }

  const move = (i: number, dir: -1 | 1) =>
    setPages((prev) => {
      const next = [...prev]
      const j = i + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })

  const remove = (i: number) => setPages((prev) => prev.filter((_, k) => k !== i))

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file || !pages.length) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      await extractPages(file, pages.map((p) => p.id), outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('PDF downloaded with the page order shown above.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operation failed.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => { setFile(null); setPages([]) }

  return (
    <ToolCard
      title="Organize pages"
      description="Delete pages and rearrange their order using the thumbnails, then save the result."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={pick} />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">{file.name} — {pages.length} page{pages.length === 1 ? '' : 's'} kept</p>
          <Button variant="outline" size="sm" onClick={reset}>Choose another file</Button>
        </div>
      )}
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      {pages.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {pages.map((p, i) => (
            <div key={p.id} className="group relative rounded-lg border bg-card p-1.5">
              <img src={p.thumb} alt={`Page ${p.id + 1}`} className="w-full rounded" />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                #{i + 1} <span className="opacity-70">(was {p.id + 1})</span>
              </span>
              <div className="mt-1 flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move left">
                  <ArrowLeft className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(i)} aria-label="Delete page">
                  <Trash2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={i === pages.length - 1} onClick={() => move(i, 1)} aria-label="Move right">
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {file && pages.length > 0 && <OutputName value={outName} onChange={setOutName} />}
      <Button onClick={run} disabled={busy || loadingThumbs || !file || !pages.length}>
        {busy ? 'Saving…' : 'Save organized PDF'}
      </Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
