import { useState, type ComponentType } from 'react'
import headerBand from '@/assets/header-band.png'
import {
  Combine,
  Scissors,
  Minimize2,
  RotateCw,
  Hash,
  Type,
  ImagePlus,
  LayoutGrid,
  FileText,
  ShieldCheck,
  Lock,
  FileDown,
  Layers,
  Shield,
  Image,
  Stamp,
  PenLine,
  Wrench,
  Crop,
  Eraser,
  ScanSearch,
  FormInput,
  Code,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { MergeTool, SplitTool, RotateTool, PageNumbersTool } from '@/tools/basic'
import { CompressTool, ExtractTextTool, ImagesToPdfTool } from '@/tools/advanced'
import { OrganizeTool } from '@/tools/organize'
import { ProtectTool } from '@/tools/protect'
import { ConvertTool } from '@/tools/convert'
import { BulkCompressTool } from '@/tools/bulk'
import { BulkProtectTool } from '@/tools/bulkprotect'
import { PdfToJpgTool, WatermarkTool, SignTool, RepairTool, CropTool } from '@/tools/extra'
import { RedactTool } from '@/tools/redact'
import { OcrSearchableTool, FormsTool, HtmlToPdfTool } from '@/tools/more'

type ToolId =
  | 'merge'
  | 'split'
  | 'organize'
  | 'compress'
  | 'bulk'
  | 'bulkprotect'
  | 'rotate'
  | 'numbers'
  | 'extract'
  | 'convert'
  | 'images'
  | 'protect'
  | 'pdf2jpg'
  | 'watermark'
  | 'sign'
  | 'repair'
  | 'crop'
  | 'redact'
  | 'ocr'
  | 'forms'
  | 'html'

const tools: { id: ToolId; name: string; desc: string; icon: typeof Combine }[] = [
  { id: 'merge', name: 'Merge PDF', desc: 'Combine multiple PDFs into one', icon: Combine },
  { id: 'split', name: 'Split PDF', desc: 'Extract page ranges as separate PDFs', icon: Scissors },
  { id: 'organize', name: 'Organize pages', desc: 'Delete and reorder pages visually', icon: LayoutGrid },
  { id: 'compress', name: 'Minimize size', desc: 'Shrink the file as far as you need', icon: Minimize2 },
  { id: 'bulk', name: 'Bulk minimize', desc: 'Shrink many PDFs at once, with savings report', icon: Layers },
  { id: 'bulkprotect', name: 'Bulk protect', desc: 'Encrypt many PDFs with one password', icon: Shield },
  { id: 'rotate', name: 'Rotate PDF', desc: 'Rotate pages 90° / 180°', icon: RotateCw },
  { id: 'numbers', name: 'Page numbers', desc: 'Stamp numbers on pages', icon: Hash },
  { id: 'extract', name: 'Extract text', desc: 'Copy text out of a PDF', icon: Type },
  { id: 'convert', name: 'PDF to Word', desc: 'Export to .docx, .md or .txt, with OCR', icon: FileDown },
  { id: 'ocr', name: 'OCR PDF', desc: 'Make scanned PDFs searchable', icon: ScanSearch },
  { id: 'images', name: 'Images to PDF', desc: 'JPG/PNG or camera scans into a PDF', icon: ImagePlus },
  { id: 'pdf2jpg', name: 'PDF to JPG', desc: 'Every page becomes a JPG image', icon: Image },
  { id: 'protect', name: 'Protect / unlock', desc: 'Password-encrypt or decrypt a PDF', icon: Lock },
  { id: 'sign', name: 'Sign PDF', desc: 'Draw or type a signature onto pages', icon: PenLine },
  { id: 'watermark', name: 'Watermark', desc: 'Stamp text across pages', icon: Stamp },
  { id: 'redact', name: 'Redact PDF', desc: 'Permanently black out sensitive areas', icon: Eraser },
  { id: 'crop', name: 'Crop PDF', desc: 'Trim page margins', icon: Crop },
  { id: 'repair', name: 'Repair PDF', desc: 'Fix damaged or corrupt PDFs', icon: Wrench },
  { id: 'forms', name: 'Fill forms', desc: 'Detect and fill PDF form fields', icon: FormInput },
  { id: 'html', name: 'HTML to PDF', desc: 'Paste HTML, get a PDF', icon: Code },
]

const components: Record<ToolId, ComponentType> = {
  merge: MergeTool,
  split: SplitTool,
  organize: OrganizeTool,
  compress: CompressTool,
  bulk: BulkCompressTool,
  bulkprotect: BulkProtectTool,
  rotate: RotateTool,
  numbers: PageNumbersTool,
  extract: ExtractTextTool,
  convert: ConvertTool,
  images: ImagesToPdfTool,
  protect: ProtectTool,
  pdf2jpg: PdfToJpgTool,
  watermark: WatermarkTool,
  sign: SignTool,
  repair: RepairTool,
  crop: CropTool,
  redact: RedactTool,
  ocr: OcrSearchableTool,
  forms: FormsTool,
  html: HtmlToPdfTool,
}

const toolById = Object.fromEntries(tools.map((t) => [t.id, t])) as Record<ToolId, (typeof tools)[number]>

const groups: { name: string; ids: ToolId[] }[] = [
  { name: 'Organize', ids: ['merge', 'split', 'organize', 'rotate', 'numbers', 'crop'] },
  { name: 'Optimize', ids: ['compress', 'bulk', 'repair'] },
  { name: 'Convert & extract', ids: ['convert', 'ocr', 'extract', 'images', 'pdf2jpg', 'html'] },
  { name: 'Edit', ids: ['watermark', 'sign', 'redact', 'forms'] },
  { name: 'Protect', ids: ['protect', 'bulkprotect'] },
]

export default function App() {
  const [active, setActive] = useState<ToolId>('merge')
  const ActiveTool = components[active]

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="border-b border-indigo-950/20 bg-cover bg-center shadow-md"
        style={{ backgroundImage: `url(${headerBand})` }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-sm">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">
              PDF Tools
              <span className="ml-3 rounded-full bg-[hsl(var(--gold))] px-2.5 py-0.5 align-middle text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                21 tools
              </span>
            </h1>
            <p className="mt-0.5 text-sm text-indigo-100">
              Your files never leave this device — everything runs locally in the browser.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <nav className="md:w-64 md:shrink-0">
          <div className="space-y-5 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-lg shadow-indigo-950/5 backdrop-blur-md md:sticky md:top-6">
            {groups.map((g) => (
              <div key={g.name}>
                <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-900/60">
                  {g.name}
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
                  {g.ids.map((id) => {
                    const t = toolById[id]
                    return (
                      <Button
                        key={t.id}
                        variant={active === t.id ? 'default' : 'ghost'}
                        className="justify-start gap-3"
                        onClick={() => setActive(t.id)}
                      >
                        <t.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-left">
                          <span className="block text-sm font-medium leading-tight">{t.name}</span>
                          <span className="hidden text-xs opacity-70 md:block">{t.desc}</span>
                        </span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          <ActiveTool key={active} />
          <Separator className="my-6" />
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" />
            Private by design: no uploads, no servers, no tracking. Powered by pdf-lib and PDF.js.
          </p>
        </main>
      </div>
    </div>
  )
}
