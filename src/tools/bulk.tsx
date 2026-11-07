import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import JSZip from 'jszip'
import { Dropzone, FileList, ToolCard, formatSize } from '@/components/toolkit'
import { Status } from './basic'
import {
  compressPdfToBytes,
  compressPresets,
  downloadBlob,
  pdfBlob,
  baseName,
  type CompressPresetKey,
} from '@/lib/pdf'

type Level = CompressPresetKey | 'custom'

type Row = { name: string; before: number; after: number }

export function BulkCompressTool() {
  const [files, setFiles] = useState<File[]>([])
  const [level, setLevel] = useState<Level>('balanced')
  const [scale, setScale] = useState(1.8)
  const [quality, setQuality] = useState(0.7)
  const [grayscale, setGrayscale] = useState(false)
  const [asZip, setAsZip] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const effScale = level === 'custom' ? scale : compressPresets[level].scale
  const effQuality = level === 'custom' ? quality : compressPresets[level].quality
  const effGray = level === 'custom' ? grayscale : compressPresets[level].grayscale

  const totalBefore = rows.reduce((s, r) => s + r.before, 0)
  const totalAfter = rows.reduce((s, r) => s + r.after, 0)

  const run = async () => {
    setError(null); setSuccess(null); setRows([])
    if (!files.length) { setError('Add at least one PDF.'); return }
    setBusy(true)
    const zip = new JSZip()
    const results: Row[] = []
    try {
      for (let f = 0; f < files.length; f++) {
        const file = files[f]
        setProgress(`File ${f + 1} of ${files.length}: ${file.name}`)
        try {
          const bytes = await compressPdfToBytes(file, effScale, effQuality, effGray, (done, total) =>
            setProgress(`File ${f + 1} of ${files.length} (${file.name}) — page ${done} of ${total}`)
          )
          results.push({ name: file.name, before: file.size, after: bytes.length })
          const outName = `${baseName(file.name)}-minimized.pdf`
          if (asZip) zip.file(outName, bytes)
          else downloadBlob(pdfBlob(bytes), outName)
        } catch {
          results.push({ name: file.name, before: file.size, after: file.size })
        }
      }
      if (asZip) {
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, 'minimized-pdfs.zip')
      }
      setRows(results)
      setSuccess(`Done — ${results.length} file${results.length === 1 ? '' : 's'} processed.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch processing failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard
      title="Bulk minimize"
      description="Shrink many PDFs at once with the same settings. Files are processed one by one, in your browser — nothing is uploaded. Files that fail are skipped and marked below."
    >
      <Dropzone
        accept="application/pdf,.pdf"
        multiple
        label="Drop PDF files here, or click to browse"
        hint="Add as many as you like — they will be processed in order."
        onFiles={(fs) => { setFiles((prev) => [...prev, ...fs]); setRows([]) }}
      />
      <FileList files={files} onRemove={(i) => { setFiles((prev) => prev.filter((_, k) => k !== i)); setRows([]) }} />
      {files.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Total size: <span className="font-medium text-foreground">{formatSize(files.reduce((s, f) => s + f.size, 0))}</span> across {files.length} file{files.length === 1 ? '' : 's'}
        </p>
      )}
      <div>
        <Label>How small?</Label>
        <RadioGroup value={level} onValueChange={(v) => setLevel(v as Level)} className="mt-2 gap-3">
          {(Object.keys(compressPresets) as CompressPresetKey[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <RadioGroupItem value={k} id={`bp-${k}`} />
              <Label htmlFor={`bp-${k}`} className="cursor-pointer font-normal capitalize">
                {k}
                <span className="ml-2 text-xs text-muted-foreground">{compressPresets[k].hint}</span>
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="bp-custom" />
            <Label htmlFor="bp-custom" className="cursor-pointer font-normal">Custom</Label>
          </div>
        </RadioGroup>
      </div>
      {level === 'custom' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <Label htmlFor="bdpi">Resolution</Label>
              <span className="text-muted-foreground">{Math.round(effScale * 72)} DPI</span>
            </div>
            <input
              id="bdpi" type="range" min={72} max={300} step={12}
              value={Math.round(effScale * 72)}
              onChange={(e) => setScale(parseInt(e.target.value, 10) / 72)}
              className="w-full accent-primary"
            />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <Label htmlFor="bq">Image quality</Label>
              <span className="text-muted-foreground">{Math.round(effQuality * 100)}%</span>
            </div>
            <input
              id="bq" type="range" min={30} max={95} step={5}
              value={Math.round(effQuality * 100)}
              onChange={(e) => setQuality(parseInt(e.target.value, 10) / 100)}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="bgray" checked={grayscale} onCheckedChange={(v) => setGrayscale(!!v)} />
            <Label htmlFor="bgray" className="cursor-pointer font-normal">Convert to grayscale</Label>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox id="zip" checked={asZip} onCheckedChange={(v) => setAsZip(!!v)} />
        <Label htmlFor="zip" className="cursor-pointer font-normal">Download all as one ZIP (uncheck to download files individually)</Label>
      </div>
      <Button onClick={run} disabled={busy || !files.length}>{busy ? 'Processing batch…' : `Minimize ${files.length || ''} file${files.length === 1 ? '' : 's'}`}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
      {rows.length > 0 && (
        <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-medium">
            Total: {formatSize(totalBefore)} → {formatSize(totalAfter)}{' '}
            <span className={totalAfter < totalBefore ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
              ({totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0}% smaller)
            </span>
          </p>
          <ul className="space-y-1 text-sm">
            {rows.map((r) => (
              <li key={r.name} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">{r.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {formatSize(r.before)} → {r.after < r.before ? formatSize(r.after) : 'skipped'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolCard>
  )
}
