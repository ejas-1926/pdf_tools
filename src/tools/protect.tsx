import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dropzone, FileList, ToolCard, OutputName } from '@/components/toolkit'
import { Status } from './basic'
import { protectPdf, unlockPdf, baseName } from '@/lib/pdf'

export function ProtectTool() {
  const [tab, setTab] = useState<'protect' | 'unlock'>('protect')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [allowPrint, setAllowPrint] = useState(true)
  const [allowCopy, setAllowCopy] = useState(true)
  const [allowEdit, setAllowEdit] = useState(false)
  const [outName, setOutName] = useState('protected.pdf')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const switchTab = (v: string) => {
    setTab(v as 'protect' | 'unlock')
    setError(null); setSuccess(null)
    setOutName(v === 'protect' ? 'protected.pdf' : 'unlocked.pdf')
  }

  const pick = (fs: File[]) => {
    setFile(fs[0]); setError(null); setSuccess(null)
    setOutName(tab === 'protect' ? `${baseName(fs[0].name)}-protected.pdf` : `${baseName(fs[0].name)}-unlocked.pdf`)
  }

  const runProtect = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    if (!password) { setError('Enter a password — the whole point is the password.'); return }
    if (password.length < 4) { setError('Use at least 4 characters for the password.'); return }
    setBusy(true)
    try {
      await protectPdf(file, password, ownerPassword, {
        printing: allowPrint,
        copying: allowCopy,
        editing: allowEdit,
      }, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Password-protected PDF downloaded.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Protection failed.')
    } finally {
      setBusy(false)
    }
  }

  const runUnlock = async () => {
    setError(null); setSuccess(null)
    if (!file) { setError('Choose a PDF first.'); return }
    if (!password) { setError('Enter the password for this PDF.'); return }
    setBusy(true)
    try {
      await unlockPdf(file, password, outName.endsWith('.pdf') ? outName : `${outName}.pdf`)
      setSuccess('Unlocked PDF downloaded.')
    } catch {
      setError('Wrong password, or this PDF cannot be unlocked (owner-password protected).')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ToolCard
      title="Protect & unlock PDF"
      description="Add password encryption to keep prying eyes out, or remove a password you own using standard PDF encryption (AES)."
    >
      <Tabs value={tab} onValueChange={switchTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="protect">Protect (encrypt)</TabsTrigger>
          <TabsTrigger value="unlock">Unlock (decrypt)</TabsTrigger>
        </TabsList>

        <TabsContent value="protect" className="space-y-4 pt-4">
          {!file ? (
            <Dropzone accept="application/pdf,.pdf" label="Drop a PDF here, or click to browse" onFiles={pick} />
          ) : (
            <FileList files={[file]} onRemove={() => setFile(null)} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pw">Password to open the PDF *</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Required" />
            </div>
            <div>
              <Label htmlFor="opw">Owner password (optional)</Label>
              <Input id="opw" type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} placeholder="Extra control password" />
            </div>
          </div>
          <div>
            <Label>Allow people who have the password to…</Label>
            <div className="mt-2 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="ap" checked={allowPrint} onCheckedChange={(v) => setAllowPrint(!!v)} />
                <Label htmlFor="ap" className="cursor-pointer font-normal">Print the document</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ac" checked={allowCopy} onCheckedChange={(v) => setAllowCopy(!!v)} />
                <Label htmlFor="ac" className="cursor-pointer font-normal">Copy text and images</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ae" checked={allowEdit} onCheckedChange={(v) => setAllowEdit(!!v)} />
                <Label htmlFor="ae" className="cursor-pointer font-normal">Edit / annotate (form filling, commenting)</Label>
              </div>
            </div>
          </div>
          <OutputName value={outName} onChange={setOutName} />
          <Button onClick={runProtect} disabled={busy || !file}>{busy ? 'Encrypting…' : 'Protect & download'}</Button>
        </TabsContent>

        <TabsContent value="unlock" className="space-y-4 pt-4">
          {!file ? (
            <Dropzone accept="application/pdf,.pdf" label="Drop a password-protected PDF here, or click to browse" onFiles={pick} />
          ) : (
            <FileList files={[file]} onRemove={() => setFile(null)} />
          )}
          <div>
            <Label htmlFor="pw2">Password</Label>
            <Input id="pw2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter the PDF's password" />
          </div>
          <OutputName value={outName} onChange={setOutName} />
          <Button onClick={runUnlock} disabled={busy || !file}>{busy ? 'Unlocking…' : 'Unlock & download'}</Button>
          <p className="text-xs text-muted-foreground">Only works if you know the password — this removes encryption, it does not crack it.</p>
        </TabsContent>
      </Tabs>
      <Status error={error} success={success} />
    </ToolCard>
  )
}
