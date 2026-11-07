import { useState } from 'react'
import JSZip from 'jszip'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dropzone, FileList, ToolCard, OutputName } from '@/components/toolkit'
import { Status } from './basic'
import {
  pdfToJpgBlobs,
  watermarkPdf,
  signPdf,
  repairPdfToBytes,
  cropPdf,
  parseRanges,
  downloadBlob,
  pdfBlob,
  baseName,
  type SignPosition,
} from '@/lib/pdf'

/* ---------------- PDF to JPG ---------------- */
export function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null)
  const [dpi, setDpi] = useState(150)
  const [progress, setProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      const blobs = await pdfToJpgBlobs(file, dpi / 72, 0.9, (done, total) =>
        setProgress(`Rendering page ${done} of ${total}…`)
      )
      const zip = new JSZip()
      blobs.forEach((b, i) => zip.file(`${baseName(file.name)}-page-${i + 1}.jpg`, b))
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `${baseName(file.name)}-jpg.zip`)
      setSuccess(`${blobs.length} JPG image${blobs.length === 1 ? '' : 's'} downloaded as ZIP.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard title="PDF to JPG" description="Turn every PDF page into a JPG image, delivered as a ZIP.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <Label htmlFor="jpg-dpi">Image resolution</Label>
          <span className="text-muted-foreground">{dpi} DPI</span>
        </div>
        <input id="jpg-dpi" type="range" min={72} max={300} step={12} value={dpi}
          onChange={(e) => setDpi(parseInt(e.target.value, 10))} className="w-full accent-primary" />
      </div>
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Converting…' : 'Convert to JPG'}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Watermark ---------------- */
export function WatermarkTool() {
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('CONFIDENTIAL')
  const [fontSize, setFontSize] = useState(48)
  const [opacity, setOpacity] = useState(0.25)
  const [color, setColor] = useState('#888888')
  const [diagonal, setDiagonal] = useState(true)
  const [onlyText, setOnlyText] = useState('')
  const [outName, setOutName] = useState('watermarked.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    if (!text.trim()) { setError('Enter watermark text.'); return }
    setBusy(true)
    try {
      await watermarkPdf(file, {
        text: text.trim(),
        fontSize,
        opacity,
        colorHex: color,
        diagonal,
        pages: onlyText.trim() ? parseRanges(onlyText, 9999) : null,
      }, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Watermarked PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Watermarking failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Watermark" description="Stamp a text watermark across every page — or just some pages.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div>
        <Label htmlFor="wm-text">Watermark text</Label>
        <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="CONFIDENTIAL" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="wm-size">Size</Label>
          <Input id="wm-size" type="number" min={8} max={144} value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value, 10) || 48)} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <Label htmlFor="wm-op">Opacity</Label>
            <span className="text-muted-foreground">{Math.round(opacity * 100)}%</span>
          </div>
          <input id="wm-op" type="range" min={5} max={90} value={Math.round(opacity * 100)}
            onChange={(e) => setOpacity(parseInt(e.target.value, 10) / 100)} className="w-full accent-primary" />
        </div>
        <div>
          <Label htmlFor="wm-color">Color</Label>
          <Input id="wm-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full p-1" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="wm-diag" checked={diagonal} onCheckedChange={(v) => setDiagonal(!!v)} />
        <Label htmlFor="wm-diag" className="cursor-pointer font-normal">Tile diagonally across the page (uncheck for one centered watermark)</Label>
      </div>
      <div>
        <Label htmlFor="wm-only">Only pages (optional)</Label>
        <Input id="wm-only" value={onlyText} onChange={(e) => setOnlyText(e.target.value)} placeholder="e.g. 1, 3-4 — blank = all pages" />
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Working…' : 'Add watermark & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Sign PDF ---------------- */
export function SignTool() {
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const [position, setPosition] = useState<SignPosition>('bottom-right')
  const [width, setWidth] = useState(160)
  const [canvasKey, setCanvasKey] = useState(0)
  const [outName, setOutName] = useState('signed.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = e.currentTarget
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    const rect = canvas.getBoundingClientRect()
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    const move = (ev: MouseEvent) => {
      ctx.lineTo(ev.clientX - rect.left, ev.clientY - rect.top)
      ctx.stroke()
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const makeSignaturePng = (): string => {
    if (mode === 'type') {
      const c = document.createElement('canvas')
      c.width = 600; c.height = 160
      const ctx = c.getContext('2d')!
      ctx.font = 'italic 72px Georgia, serif'
      ctx.fillStyle = '#1a1a1a'
      ctx.textBaseline = 'middle'
      ctx.fillText(typed || 'Signature', 20, 85)
      return c.toDataURL('image/png')
    }
    const canvas = document.getElementById('sig-canvas') as HTMLCanvasElement
    return canvas.toDataURL('image/png')
  }

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    if (mode === 'type' && !typed.trim()) { setError('Type your signature first.'); return }
    setBusy(true)
    try {
      await signPdf(file, makeSignaturePng(), position, width, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Signed PDF downloaded — signature applied to every page.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Signing failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Sign PDF" description="Draw or type your signature and stamp it onto every page of a PDF.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div className="flex gap-2">
        <Button variant={mode === 'draw' ? 'default' : 'outline'} size="sm" onClick={() => setMode('draw')}>Draw</Button>
        <Button variant={mode === 'type' ? 'default' : 'outline'} size="sm" onClick={() => setMode('type')}>Type</Button>
      </div>
      {mode === 'draw' ? (
        <div>
          <canvas
            id="sig-canvas"
            key={canvasKey}
            width={600}
            height={160}
            onMouseDown={startDraw}
            className="w-full max-w-xl cursor-crosshair rounded-lg border bg-white"
          />
          <Button variant="ghost" size="sm" className="mt-1" onClick={() => setCanvasKey((k) => k + 1)}>Clear</Button>
        </div>
      ) : (
        <div>
          <Label htmlFor="sig-type">Your signature</Label>
          <Input id="sig-type" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type your name" />
          <p className="mt-1 font-serif text-2xl italic text-slate-700 dark:text-slate-300">{typed || 'Signature'}</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Position on page</Label>
          <Select value={position} onValueChange={(v) => setPosition(v as SignPosition)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom-right">Bottom right</SelectItem>
              <SelectItem value="bottom-left">Bottom left</SelectItem>
              <SelectItem value="top-right">Top right</SelectItem>
              <SelectItem value="top-left">Top left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <Label htmlFor="sig-w">Width</Label>
            <span className="text-muted-foreground">{width} pt</span>
          </div>
          <input id="sig-w" type="range" min={60} max={300} step={10} value={width}
            onChange={(e) => setWidth(parseInt(e.target.value, 10))} className="w-full accent-primary" />
        </div>
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Signing…' : 'Sign & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Repair PDF ---------------- */
export function RepairTool() {
  const [file, setFile] = useState<File | null>(null)
  const [outName, setOutName] = useState('repaired.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      const { bytes, method } = await repairPdfToBytes(file)
      downloadBlob(pdfBlob(bytes), outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess(method === 'lossless'
        ? 'Repaired with no quality loss — the structure was fixed and the file re-saved.'
        : 'The file was badly damaged: pages were rebuilt as high-quality images. Content is preserved visually, but text is no longer selectable.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This file is too damaged to repair here.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard title="Repair PDF" description="Fix a damaged or corrupt PDF by re-saving its structure. If that fails, pages are rebuilt visually.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a damaged PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Repairing…' : 'Repair & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Crop PDF ---------------- */
export function CropTool() {
  const [file, setFile] = useState<File | null>(null)
  const [top, setTop] = useState(0)
  const [right, setRight] = useState(0)
  const [bottom, setBottom] = useState(0)
  const [left, setLeft] = useState(0)
  const [onlyText, setOnlyText] = useState('')
  const [outName, setOutName] = useState('cropped.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      await cropPdf(
        file,
        { top, right, bottom, left },
        onlyText.trim() ? parseRanges(onlyText, 9999) : null,
        outName.endsWith('.pdf') ? outName : `${outName}.pdf`
      )
      setSuccess('Cropped PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crop failed.')
    } finally {
      setBusy(false)
    }
  }

  const num = (v: string) => Math.max(0, parseFloat(v) || 0)

  return (
    <ToolCard title="Crop PDF" description="Trim margins from pages by setting how many points to cut from each edge (72 points = 1 inch). Original content is preserved outside the crop and can be restored by viewers that ignore crop boxes.">
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><Label htmlFor="c-t">Top (pt)</Label><Input id="c-t" type="number" min={0} value={top} onChange={(e) => setTop(num(e.target.value))} /></div>
        <div><Label htmlFor="c-r">Right (pt)</Label><Input id="c-r" type="number" min={0} value={right} onChange={(e) => setRight(num(e.target.value))} /></div>
        <div><Label htmlFor="c-b">Bottom (pt)</Label><Input id="c-b" type="number" min={0} value={bottom} onChange={(e) => setBottom(num(e.target.value))} /></div>
        <div><Label htmlFor="c-l">Left (pt)</Label><Input id="c-l" type="number" min={0} value={left} onChange={(e) => setLeft(num(e.target.value))} /></div>
      </div>
      <div>
        <Label htmlFor="c-only">Only pages (optional)</Label>
        <Input id="c-only" value={onlyText} onChange={(e) => setOnlyText(e.target.value)} placeholder="e.g. 1, 3-4 — blank = all pages" />
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Cropping…' : 'Crop & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
