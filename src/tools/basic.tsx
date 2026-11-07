import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dropzone, FileList, ToolCard, OutputName } from '@/components/toolkit'
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  addPageNumbers,
  parseRanges,
  baseName,
  loadPdf,
  type NumberPosition,
} from '@/lib/pdf'

export function Status({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (success) return <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
  return null
}

/* ---------------- Merge ---------------- */
export function MergeTool() {
  const [files, setFiles] = useState<File[]>([])
  const [outName, setOutName] = useState('merged.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (files.length < 2) { setError('Add at least two PDF files to merge.'); return }
    setBusy(true)
    try {
      await mergePdfs(files, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Merged PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Merge failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Merge PDF" description="Combine several PDFs into one, in the order shown below.">
      <Dropzone accept="application/pdf,.pdf" multiple label="Drop PDF files here, or click to browse" hint="Files are merged top to bottom — reorder as needed." onFiles={(fs) => setFiles((prev) => [...prev, ...fs])} />
      <FileList
        files={files}
        showOrder
        onRemove={(i) => setFiles((prev) => prev.filter((_, k) => k !== i))}
        onMove={(i, dir) =>
          setFiles((prev) => {
            const next = [...prev]
            const j = i + dir
            ;[next[i], next[j]] = [next[j], next[i]]
            return next
          })
        }
      />
      {files.length > 0 && <OutputName value={outName} onChange={setOutName} />}
      <Button onClick={run} disabled={busy || files.length < 2}>{busy ? 'Merging…' : 'Merge & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Split ---------------- */
export function SplitTool() {
  const [file, setFile] = useState<File | null>(null)
  const [rangesText, setRangesText] = useState('1-3')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pick = async (fs: File[]) => {
    const f = fs[0]
    setFile(f); setError(null); setSuccess(null)
    try {
      const doc = await loadPdf(f)
      setPageCount(doc.getPageCount())
    } catch {
      setPageCount(null)
    }
  }

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    try {
      const count = pageCount ?? 9999
      const ranges = parseRanges(rangesText, count)
      setBusy(true)
      await splitPdf(file, ranges, `${baseName(file.name)}-split.zip`)
      setSuccess('ZIP with the split PDFs downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Split PDF" description="Extract page ranges into separate PDFs, delivered as a ZIP.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={pick} />
      ) : (
        <FileList files={[file]} onRemove={() => { setFile(null); setPageCount(null) }} />
      )}
      {pageCount && <p className="text-sm text-muted-foreground">This PDF has {pageCount} pages.</p>}
      <div>
        <Label htmlFor="ranges">Page ranges (e.g. 1-3, 5, 8-10)</Label>
        <Input id="ranges" value={rangesText} onChange={(e) => setRangesText(e.target.value)} placeholder="1-3, 5, 8-10" />
      </div>
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Splitting…' : 'Split & download ZIP'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Rotate ---------------- */
export function RotateTool() {
  const [file, setFile] = useState<File | null>(null)
  const [angle, setAngle] = useState('90')
  const [onlyText, setOnlyText] = useState('')
  const [outName, setOutName] = useState('rotated.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      const only = onlyText.trim() ? parseRanges(onlyText, 9999) : null
      await rotatePdf(file, parseInt(angle, 10), only, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Rotated PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rotation failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Rotate PDF" description="Rotate all pages, or only specific ones." >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Rotation</Label>
          <Select value={angle} onValueChange={setAngle}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="90">90° clockwise</SelectItem>
              <SelectItem value="-90">90° counter-clockwise</SelectItem>
              <SelectItem value="180">180°</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="only">Only pages (optional)</Label>
          <Input id="only" value={onlyText} onChange={(e) => setOnlyText(e.target.value)} placeholder="e.g. 1, 3-4 — blank = all" />
        </div>
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Rotating…' : 'Rotate & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Page numbers ---------------- */
export function PageNumbersTool() {
  const [file, setFile] = useState<File | null>(null)
  const [startAt, setStartAt] = useState(1)
  const [position, setPosition] = useState<NumberPosition>('bottom-center')
  const [fontSize, setFontSize] = useState(11)
  const [skipFirst, setSkipFirst] = useState(false)
  const [outName, setOutName] = useState('numbered.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      await addPageNumbers(file, startAt, position, fontSize, skipFirst, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Numbered PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add page numbers.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Add page numbers" description="Stamp page numbers on every page.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="start">Start at</Label>
          <Input id="start" type="number" min={1} value={startAt} onChange={(e) => setStartAt(parseInt(e.target.value, 10) || 1)} />
        </div>
        <div>
          <Label>Position</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as NumberPosition)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom-center">Bottom center</SelectItem>
              <SelectItem value="bottom-right">Bottom right</SelectItem>
              <SelectItem value="bottom-left">Bottom left</SelectItem>
              <SelectItem value="top-center">Top center</SelectItem>
              <SelectItem value="top-right">Top right</SelectItem>
              <SelectItem value="top-left">Top left</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="size">Font size</Label>
          <Input id="size" type="number" min={6} max={36} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 11)} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="skip" checked={skipFirst} onCheckedChange={(v) => setSkipFirst(!!v)} />
        <Label htmlFor="skip" className="cursor-pointer">Skip the first page (useful for a cover page)</Label>
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Working…' : 'Add numbers & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
