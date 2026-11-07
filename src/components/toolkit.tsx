import { useCallback, useState, type ReactNode } from 'react'
import { Upload, X, ArrowUp, ArrowDown, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function Dropzone({
  accept,
  multiple = false,
  onFiles,
  label,
  hint,
}: {
  accept: string
  multiple?: boolean
  onFiles: (files: File[]) => void
  label: string
  hint?: string
}) {
  const [dragOver, setDragOver] = useState(false)
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        accept.split(',').some((a) => f.type.match(a.trim().replace('*', '.*')) || f.name.toLowerCase().endsWith(a.trim().replace('*', '').replace('application/', '.').replace('image/', '.')))
      )
      if (files.length) onFiles(files)
    },
    [accept, onFiles]
  )
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer ${
        dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/60'
      }`}
      onClick={() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.multiple = multiple
        input.onchange = () => onFiles(Array.from(input.files ?? []))
        input.click()
      }}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{label}</p>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function FileList({
  files,
  onRemove,
  onMove,
  showOrder = false,
}: {
  files: File[]
  onRemove?: (i: number) => void
  onMove?: (i: number, dir: -1 | 1) => void
  showOrder?: boolean
}) {
  if (!files.length) return null
  return (
    <ul className="space-y-2">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
          <FileText className="h-4 w-4 shrink-0 text-primary" />
          {showOrder && <span className="w-6 text-sm text-muted-foreground tabular-nums">{i + 1}.</span>}
          <span className="min-w-0 flex-1 truncate text-sm">{f.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{formatSize(f.size)}</span>
          {onMove && (
            <span className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === 0} onClick={() => onMove(i, -1)} aria-label="Move up">
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={i === files.length - 1} onClick={() => onMove(i, 1)} aria-label="Move down">
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
            </span>
          )}
          {onRemove && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRemove(i)} aria-label="Remove">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export function ToolCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden bg-white/95 shadow-lg shadow-indigo-950/5 backdrop-blur-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

export function OutputName({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">Output file name</label>
      <input
        className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
