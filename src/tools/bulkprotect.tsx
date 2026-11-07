import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import JSZip from 'jszip'
import { Dropzone, FileList, ToolCard } from '@/components/toolkit'
import { Status } from './basic'
import { protectPdfToBytes, downloadBlob, pdfBlob, baseName } from '@/lib/pdf'

type Row = { name: string; ok: boolean }

export function BulkProtectTool() {
  const [files, setFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [allowPrint, setAllowPrint] = useState(true)
  const [allowCopy, setAllowCopy] = useState(true)
  const [allowEdit, setAllowEdit] = useState(false)
  const [asZip, setAsZip] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const run = async () => {
    setError(null); setSuccess(null); setRows([])
    if (!files.length) { setError('Add at least one PDF.'); return }
    if (!password) { setError('Enter a password to encrypt with.'); return }
    if (password.length < 4) { setError('Use at least 4 characters for the password.'); return }
    setBusy(true)
    const zip = new JSZip()
    const results: Row[] = []
    try {
      for (let f = 0; f < files.length; f++) {
        const file = files[f]
        setProgress(`Encrypting file ${f + 1} of ${files.length}: ${file.name}`)
        try {
          const bytes = await protectPdfToBytes(file, password, ownerPassword, {
            printing: allowPrint,
            copying: allowCopy,
            editing: allowEdit,
          })
          results.push({ name: file.name, ok: true })
          const outName = `${baseName(file.name)}-protected.pdf`
          if (asZip) zip.file(outName, bytes)
          else downloadBlob(pdfBlob(bytes), outName)
        } catch {
          results.push({ name: file.name, ok: false })
        }
      }
      if (asZip) {
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, 'protected-pdfs.zip')
      }
      setRows(results)
      const okCount = results.filter((r) => r.ok).length
      setSuccess(`Done — ${okCount} of ${results.length} file${results.length === 1 ? '' : 's'} encrypted with AES-256.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch encryption failed.')
    } finally {
      setBusy(false); setProgress(null)
    }
  }

  return (
    <ToolCard
      title="Bulk protect"
      description="Encrypt many PDFs at once with the same password (AES-256). Already-encrypted files are re-encrypted with the new password. Everything runs locally."
    >
      <Dropzone
        accept="application/pdf,.pdf"
        multiple
        label="Drop PDF files here, or click to browse"
        hint="All files will be protected with the password below."
        onFiles={(fs) => { setFiles((prev) => [...prev, ...fs]); setRows([]) }}
      />
      <FileList files={files} onRemove={(i) => { setFiles((prev) => prev.filter((_, k) => k !== i)); setRows([]) }} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="bpw">Password to open the PDFs *</Label>
          <Input id="bpw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required" />
        </div>
        <div>
          <Label htmlFor="bopw">Owner password (optional)</Label>
          <Input id="bopw" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Defaults to the open password" />
        </div>
      </div>
      <div>
        <Label>Allow people who have the password to…</Label>
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="bap" checked={allowPrint} onCheckedChange={(v) => setAllowPrint(!!v)} />
            <Label htmlFor="bap" className="cursor-pointer font-normal">Print the documents</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="bac" checked={allowCopy} onCheckedChange={(v) => setAllowCopy(!!v)} />
            <Label htmlFor="bac" className="cursor-pointer font-normal">Copy text and images</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="bae" checked={allowEdit} onCheckedChange={(v) => setAllowEdit(!!v)} />
            <Label htmlFor="bae" className="cursor-pointer font-normal">Edit / annotate</Label>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="bzip" checked={asZip} onCheckedChange={(v) => setAsZip(!!v)} />
        <Label htmlFor="bzip" className="cursor-pointer font-normal">Download all as one ZIP (uncheck for individual downloads)</Label>
      </div>
      <Button onClick={run} disabled={busy || !files.length}>{busy ? 'Encrypting batch…' : `Protect ${files.length || ''} file${files.length === 1 ? '' : 's'}`}</Button>
      {progress && <p className="text-sm text-muted-foreground">{progress}</p>}
      <Status error={error} success={success} />
      {rows.length > 0 && (
        <ul className="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
          {rows.map((r) => (
            <li key={r.name} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className={r.ok ? 'shrink-0 text-green-600 dark:text-green-400' : 'shrink-0 text-amber-600 dark:text-amber-400'}>
                {r.ok ? 'protected' : 'skipped'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ToolCard>
  )
}
