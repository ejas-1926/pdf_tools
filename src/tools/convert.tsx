import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dropzone, FileList, ToolCard } from '@/components/toolkit'
import { Status } from './basic'
import { pdfToDocument } from '@/lib/pdf'

const languages = [
  { code: 'eng', name: 'English' },
  { code: 'ara', name: 'Arabic' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'spa', name: 'Spanish' },
  { code: 'chi_sim', name: 'Chinese (simplified)' },
]

export function ConvertTool() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<'docx' | 'txt' | 'md'>('docx')
  const [useOcr, setUseOcr] = useState(true)
  const [lang, setLang] = useState('eng')
  const [pageHeaders, setPageHeaders] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true); setProgress('Starting…')
    try {
      await pdfToDocument(file, {
        format,
        useOcr,
        lang,
        pageHeaders,
        onProgress: setProgress,
      })
      const label = format === 'docx' ? 'Word document' : format === 'md' ? 'Markdown file' : 'Text file'
      setSuccess(`${label} downloaded.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard
      title="PDF to Word / Markdown / text"
      description="Export a PDF as an editable .docx, a clean .md, or plain .txt. Pages with selectable text are read directly; scanned pages are recognized with OCR. The first OCR run downloads language data (needs internet once, then cached)."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
      <div>
        <Label>Output format</Label>
        <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'docx' | 'txt' | 'md')} className="mt-2 gap-3">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="docx" id="f-docx" />
            <Label htmlFor="f-docx" className="cursor-pointer font-normal">
              Word (.docx)
              <span className="ml-2 text-xs text-muted-foreground">editable, one PDF page per Word page</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="md" id="f-md" />
            <Label htmlFor="f-md" className="cursor-pointer font-normal">
              Markdown (.md)
              <span className="ml-2 text-xs text-muted-foreground">clean text for notes, wikis, AI tools</span>
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="txt" id="f-txt" />
            <Label htmlFor="f-txt" className="cursor-pointer font-normal">
              Plain text (.txt)
              <span className="ml-2 text-xs text-muted-foreground">simplest, works everywhere</span>
            </Label>
          </div>
        </RadioGroup>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="ocr" checked={useOcr} onCheckedChange={(v) => setUseOcr(!!v)} />
        <Label htmlFor="ocr" className="cursor-pointer">OCR scanned pages (pages without selectable text)</Label>
      </div>
      {useOcr && (
        <div className="sm:w-64">
          <Label>OCR language</Label>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Checkbox id="headers" checked={pageHeaders} onCheckedChange={(v) => setPageHeaders(!!v)} />
        <Label htmlFor="headers" className="cursor-pointer">Mark page boundaries ("Page N")</Label>
      </div>
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Converting…' : 'Convert & download'}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
    </ToolCard>
  )
}
