import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Dropzone, FileList, ToolCard, OutputName } from '@/components/toolkit'
import { Status } from './basic'
import {
  ocrPdfToSearchable,
  listFormFields,
  fillFormPdf,
  htmlToPdf,
  baseName,
  type FormFieldInfo,
} from '@/lib/pdf'

const languages = [
  { code: 'eng', name: 'English' },
  { code: 'ara', name: 'Arabic' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'spa', name: 'Spanish' },
  { code: 'chi_sim', name: 'Chinese (simplified)' },
]

/* ---------------- OCR → searchable PDF ---------------- */
export function OcrSearchableTool() {
  const [file, setFile] = useState<File | null>(null)
  const [lang, setLang] = useState('eng')
  const [progress, setProgress] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      await ocrPdfToSearchable(file, lang, `${baseName(file.name)}-searchable.pdf`, setProgress)
      setSuccess('Searchable PDF downloaded — looks identical, but text can now be selected and searched.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard
      title="OCR PDF (make searchable)"
      description="Turn a scanned PDF into a searchable one: page images stay identical, and an invisible text layer is added so you can select, search, and copy. First run downloads language data (internet needed once)."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a scanned PDF here, or click to browse" onFiles={(fs) => setFile(fs[0])} />
      ) : (
        <FileList files={[file]} onRemove={() => setFile(null)} />
      )}
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
      <Button onClick={run} disabled={busy || !file}>{busy ? 'Recognizing…' : 'Make searchable & download'}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- Fill PDF forms ---------------- */
export function FormsTool() {
  const [file, setFile] = useState<File | null>(null)
  const [fields, setFields] = useState<FormFieldInfo[]>([])
  const [values, setValues] = useState<Record<string, string>>({})
  const [flatten, setFlatten] = useState(false)
  const [outName, setOutName] = useState('filled-form.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const pick = async (fs: File[]) => {
    const f = fs[0]
    setFile(f); setError(null); setSuccess(null)
    try {
      const list = await listFormFields(f)
      setFields(list)
      const init: Record<string, string> = {}
      for (const fld of list) init[fld.name] = fld.value ?? ''
      setValues(init)
      if (!list.length) setError('No form fields found in this PDF.')
    } catch (e) {
      setFields([])
      setError(e instanceof Error ? e.message : 'Could not read form fields.')
    }
  }

  const set = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }))

  const run = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    setBusy(true)
    try {
      await fillFormPdf(file, values, flatten, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess(flatten
        ? 'Form filled and flattened — fields are no longer editable.'
        : 'Form filled — the PDF stays fillable, so answers can still be changed.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Filling failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard
      title="Fill PDF forms"
      description="Detect the fillable fields in a PDF form (text boxes, checkboxes, dropdowns, radio groups) and fill them in. Save fillable or flattened."
    >
      {!file ? (
        <Dropzone accept="application/pdf,.pdf" label="Drop a PDF form here, or click to browse" onFiles={pick} />
      ) : (
        <FileList files={[file]} onRemove={() => { setFile(null); setFields([]) }} />
      )}
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((f) => (
            <div key={f.name}>
              <Label htmlFor={`fld-${f.name}`}>{f.name} <span className="text-xs text-muted-foreground">({f.type})</span></Label>
              {f.type === 'checkbox' ? (
                <div className="mt-1 flex items-center gap-2">
                  <Checkbox
                    id={`fld-${f.name}`}
                    checked={values[f.name] === 'yes'}
                    onCheckedChange={(v) => set(f.name, v ? 'yes' : '')}
                  />
                  <Label htmlFor={`fld-${f.name}`} className="cursor-pointer font-normal">Checked</Label>
                </div>
              ) : f.type === 'dropdown' || f.type === 'radio' ? (
                <Select value={values[f.name]} onValueChange={(v) => set(f.name, v)}>
                  <SelectTrigger id={`fld-${f.name}`}><SelectValue placeholder="— choose —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— none —</SelectItem>
                    {(f.options ?? []).map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : f.type === 'text' ? (
                <Input id={`fld-${f.name}`} value={values[f.name] ?? ''} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <p className="text-xs text-muted-foreground">This field type is not supported — it will be left unchanged.</p>
              )}
            </div>
          ))}
        </div>
      )}
      {fields.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox id="flatten" checked={flatten} onCheckedChange={(v) => setFlatten(!!v)} />
          <Label htmlFor="flatten" className="cursor-pointer font-normal">Flatten — bake the answers in so the form can't be edited</Label>
        </div>
      )}
      {fields.length > 0 && <OutputName value={outName} onChange={setOutName} />}
      <Button onClick={run} disabled={busy || !file || !fields.length}>{busy ? 'Filling…' : 'Fill form & download'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}

/* ---------------- HTML to PDF ---------------- */
const SAMPLE_HTML = `<h1 style="font-family: Georgia, serif; color: #333;">Quarterly Report</h1>
<p>This is a <b>sample document</b>. Replace this HTML with your own.</p>
<ul><li>Point one</li><li>Point two</li></ul>
<table border="1" cellpadding="8" style="border-collapse: collapse;">
  <tr><th>Item</th><th>Amount</th></tr>
  <tr><td>Revenue</td><td>$12,400</td></tr>
  <tr><td>Costs</td><td>$8,100</td></tr>
</table>`

export function HtmlToPdfTool() {
  const [html, setHtml] = useState(SAMPLE_HTML)
  const [outName, setOutName] = useState('document.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null)
    if (!html.trim()) { setError('Paste some HTML first.'); return }
    setBusy(true)
    try {
      await htmlToPdf(html, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('PDF downloaded. Rendering is done in your browser, so complex external CSS may look different.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Conversion failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard
      title="HTML to PDF"
      description="Paste HTML (with inline styles) and get a PDF. External stylesheets and remote images are blocked by the browser; use inline CSS and data URLs for best results."
    >
      <div>
        <Label htmlFor="html-in">HTML source</Label>
        <Textarea
          id="html-in"
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={12}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </div>
      <OutputName value={outName} onChange={setOutName} />
      <Button onClick={run} disabled={busy}>{busy ? 'Rendering…' : 'Convert to PDF'}</Button>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
