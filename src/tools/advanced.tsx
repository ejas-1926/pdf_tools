import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Download } from 'lucide-react'
import { Dropzone, FileList, ToolCard, OutputName, formatSize } from '@/components/toolkit'
import { Status } from './basic'
import { compressPdf, compressPresets, extractText, imagesToPdf, downloadBlob, baseName } from '@/lib/pdf'

/* ---------------- Compress ---------------- */
type PresetKey = 'extreme' | 'small' | 'balanced' | 'custom'

const presets = compressPresets

export function CompressTool() {
  const [file, setFile] = useState<File | null>(null)
  const [level, setLevel] = useState<PresetKey>('balanced')
  const [scale, setScale] = useState(1.8)
  const [quality, setQuality] = useState(0.7)
  const [grayscale, setGrayscale] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<{ before: number; after: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const effScale = level === 'custom' ? scale : presets[level].scale
  const effQuality = level === 'custom' ? quality : presets[level].quality
  const effGray = level === 'custom' ? grayscale : presets[level].grayscale
  const approxDpi = Math.round(effScale * 72)

  const run = async () => {
    setError(null); setSuccess(null); setResult(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true); setProgress('Starting…')
    try {
      const after = await compressPdf(
        file,
        effScale,
        effQuality,
        effGray,
        `${baseName(file.name)}-minimized.pdf`,
        (done, total) => setProgress(`Processing page ${done} of ${total}…`)
      )
      setResult({ before: file.size, after })
      setSuccess('Minimized PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compression failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard
      title="Minimize PDF file size"
      description="Shrink the file as far as you need. Pages are re-rendered as optimized images — text becomes non-selectable, so this is best for scans and sharing. Everything runs locally."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => { setFile(fs[0]); setResult(null) }} />
      ) : (
        <>
          <FileList files={[file]} onRemove={() => { setFile(null); setResult(null) }} />
          <p className="text-sm text-muted-foreground">Original size: <span className="font-medium text-foreground">{formatSize(file.size)}</span></p>
        </>
      )}
      <div>
        <Label>How small?</Label>
        <RadioGroup value={level} onValueChange={(v) => setLevel(v as PresetKey)} className="mt-2 gap-3">
          {(Object.keys(presets) as Exclude<PresetKey, 'custom'>[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <RadioGroupItem value={k} id={`p-${k}`} />
              <Label htmlFor={`p-${k}`} className="cursor-pointer font-normal capitalize">
                {k}
                <span className="ml-2 text-xs text-muted-foreground">{presets[k].hint}</span>
              </Label>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <RadioGroupItem value="custom" id="p-custom" />
            <Label htmlFor="p-custom" className="cursor-pointer font-normal">
              Custom
              <span className="ml-2 text-xs text-muted-foreground">tune it yourself below</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      {level === 'custom' && (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <Label htmlFor="dpi">Resolution</Label>
              <span className="text-muted-foreground">{approxDpi} DPI</span>
            </div>
            <input
              id="dpi"
              type="range"
              min={72}
              max={300}
              step={12}
              value={approxDpi}
              onChange={(e) => setScale(parseInt(e.target.value, 10) / 72)}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">72 DPI is fine for screen reading; 150–300 DPI if you need to print.</p>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <Label htmlFor="q">Image quality</Label>
              <span className="text-muted-foreground">{Math.round(effQuality * 100)}%</span>
            </div>
            <input
              id="q"
              type="range"
              min={30}
              max={95}
              step={5}
              value={Math.round(effQuality * 100)}
              onChange={(e) => setQuality(parseInt(e.target.value, 10) / 100)}
              className="w-full accent-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <input id="gray" type="checkbox" checked={grayscale} onChange={(e) => setGrayscale(e.target.checked)} className="h-4 w-4 accent-primary" />
            <Label htmlFor="gray" className="cursor-pointer font-normal">Convert to grayscale — big extra savings, no color</Label>
          </div>
        </div>
      )}
      {level !== 'custom' && effGray && (
        <p className="text-xs text-muted-foreground">This preset converts pages to grayscale.</p>
      )}
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Minimizing…' : 'Minimize & download'}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
      {result && (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p>
            {formatSize(result.before)} → <span className="font-semibold">{formatSize(result.after)}</span>
          </p>
          <p className={result.after < result.before ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}>
            {result.after < result.before
              ? `${Math.round((1 - result.after / result.before) * 100)}% smaller`
              : 'No savings — try a stronger preset'}
          </p>
        </div>
      )}
    </ToolCard>
  )
}

/* ---------------- Extract text ---------------- */
export function ExtractTextTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null); setText(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      const t = await extractText(file)
      setText(t)
      setSuccess(t ? 'Text extracted below.' : 'No selectable text found — this PDF may be scanned images.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Text extraction failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Extract text" description="Pull selectable text out of a PDF. Scanned/image-only PDFs produce no text — use OCR software for those.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => { setFile(null); setText(null) }} />
      )}
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Extracting…' : 'Extract text'}</Button>
      <Status error={error} success={success} />
      {text && (
        <div className="space-y-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${file ? baseName(file.name) : 'pdf'}-text.txt`)
            }
          >
            <Download className="mr-2 h-4 w-4" /> Download as .txt
          </Button>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-xs">{text}</pre>
        </div>
      )}
    </ToolCard>
  )
}

/* ---------------- Images to PDF ---------------- */
export function ImagesToPdfTool() {
  const [files, setFiles] = useState<File[]>([])
  const [pageSize, setPageSize] = useState<'a4' | 'image'>('a4')
  const [outName, setOutName] = useState('images.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!files.length) { setError('Add at least one image.'); return }
    setBusy(true)
    try {
      await imagesToPdf(files, pageSize === 'a4', 36, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Images to PDF" description="Turn JPG/PNG images into a single PDF — one image per page. Use the camera button to scan pages straight into the PDF.">
      <Dropzone accept="image/png,image/jpeg,.png,.jpg,.jpeg" multiple label="Drop images here, or click to browse" hint="PNG and JPEG supported." onFiles={(fs) => setFiles((prev) => [...prev, ...fs])} />
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={() => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'image/*'
          input.capture = 'environment'
          input.onchange = () => setFiles((prev) => [...prev, ...Array.from(input.files ?? [])])
          input.click()
        }}
      >
        Use camera / scan a page
      </Button>
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
      <div>
        <Label>Page size</Label>
        <RadioGroup value={pageSize} onValueChange={(v) => setPageSize(v as typeof pageSize)} className="mt-2 gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="a4" id="ps-a4" />
            <Label htmlFor="ps-a4" className="cursor-pointer font-normal">A4 page, image fitted with margins</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="image" id="ps-img" />
            <Label htmlFor="ps-img" className="cursor-pointer font-normal">Page exactly the size of each image</Label>
          </div>
        </RadioGroup>
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !files.length}>{busy ? 'Converting…' : 'Create PDF'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
