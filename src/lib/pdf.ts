import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup, StandardFonts, degrees, rgb } from 'pdf-lib'
import { PDFDocument as SecurePDFDocument } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import Tesseract from 'tesseract.js'
import type { Paragraph as DocxParagraph } from 'docx'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer()
  return PDFDocument.load(bytes, { ignoreEncryption: true })
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename)
}

export function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
}

export function baseName(name: string): string {
  return name.replace(/\.pdf$/i, '')
}

/* ---------------- Merge ---------------- */
export async function mergePdfs(files: File[], outName: string): Promise<void> {
  const out = await PDFDocument.create()
  for (const f of files) {
    const src = await loadPdf(f)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  const bytes = await out.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Split ---------------- */
export type PageRange = { from: number; to: number }

export function parseRanges(input: string, pageCount: number): PageRange[] {
  const ranges: PageRange[] = []
  for (const part of input.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(\d+)\s*-\s*(\d+)$/)
    if (m) {
      let a = parseInt(m[1], 10)
      let b = parseInt(m[2], 10)
      if (a > b) [a, b] = [b, a]
      ranges.push({ from: clamp(a, pageCount), to: clamp(b, pageCount) })
    } else if (/^\d+$/.test(trimmed)) {
      const n = clamp(parseInt(trimmed, 10), pageCount)
      ranges.push({ from: n, to: n })
    } else {
      throw new Error(`Cannot understand "${trimmed}". Use e.g. 1-3, 5, 7-9.`)
    }
  }
  return ranges
}

function clamp(n: number, max: number): number {
  if (n < 1) return 1
  if (n > max) return max
  return n
}

export async function splitPdf(
  file: File,
  ranges: PageRange[],
  zipName: string
): Promise<void> {
  const src = await loadPdf(file)
  const zip = new JSZip()
  const stem = baseName(file.name)
  for (let i = 0; i < ranges.length; i++) {
    const { from, to } = ranges[i]
    const idx = Array.from({ length: to - from + 1 }, (_, k) => from - 1 + k)
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, idx)
    pages.forEach((p) => out.addPage(p))
    const bytes = await out.save()
    zip.file(`${stem}-pages-${from}-${to}.pdf`, bytes)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, zipName)
}

/* ---------------- Compress (rasterize) ---------------- */
export const compressPresets = {
  extreme: { scale: 1.0, quality: 0.4, grayscale: true, hint: 'smallest possible — grayscale, low res' },
  small: { scale: 1.3, quality: 0.55, grayscale: false, hint: 'very small, still color' },
  balanced: { scale: 1.8, quality: 0.7, grayscale: false, hint: 'recommended balance' },
} as const
export type CompressPresetKey = keyof typeof compressPresets

function toGrayscale(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000
    d[i] = d[i + 1] = d[i + 2] = g
  }
  ctx.putImageData(img, 0, 0)
}

/** Rasterize a PDF into an optimized PDF, returning the bytes (no download). */
export async function compressPdfToBytes(
  file: File,
  scale: number,
  quality: number,
  grayscale: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const out = await PDFDocument.create()
  const total = doc.numPages
  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    if (grayscale) toGrayscale(canvas)
    const jpg = canvas.toDataURL('image/jpeg', quality)
    const img = await out.embedJpg(jpg)
    const pdfPage = out.addPage([viewport.width, viewport.height])
    pdfPage.drawImage(img, { x: 0, y: 0, width: viewport.width, height: viewport.height })
    onProgress?.(i, total)
  }
  return out.save({ useObjectStreams: true })
}

export async function compressPdf(
  file: File,
  scale: number,
  quality: number,
  grayscale: boolean,
  outName: string,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const bytes = await compressPdfToBytes(file, scale, quality, grayscale, onProgress)
  downloadBlob(pdfBlob(bytes), outName)
  return bytes.length
}

/* ---------------- Protect / Unlock ---------------- */
export type ProtectPerms = {
  printing: boolean
  copying: boolean
  editing: boolean
}

/** Encrypt a PDF with AES-256, returning the bytes (no download). */
export async function protectPdfToBytes(
  file: File,
  userPassword: string,
  ownerPassword: string,
  perms: ProtectPerms
): Promise<Uint8Array> {
  const bytes = await file.arrayBuffer()
  const doc = await SecurePDFDocument.load(bytes, { ignoreEncryption: true })
  await doc.encrypt({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: perms.printing ? 'highResolution' : false,
      copying: perms.copying,
      modifying: perms.editing,
      annotating: perms.editing,
      fillingForms: perms.editing,
      documentAssembly: perms.editing,
      contentAccessibility: perms.copying,
    },
    algorithm: 'AES-256',
  })
  return doc.save()
}

export async function protectPdf(
  file: File,
  userPassword: string,
  ownerPassword: string,
  perms: ProtectPerms,
  outName: string
): Promise<void> {
  const out = await protectPdfToBytes(file, userPassword, ownerPassword, perms)
  downloadBlob(pdfBlob(out), outName)
}

export async function unlockPdf(file: File, password: string, outName: string): Promise<void> {
  const bytes = await file.arrayBuffer()
  // Loading an encrypted doc with the correct password and re-saving
  // produces an unencrypted PDF.
  const doc = await SecurePDFDocument.load(bytes, { password })
  const out = await doc.save()
  downloadBlob(pdfBlob(out), outName)
}

/* ---------------- Rotate ---------------- */
export async function rotatePdf(
  file: File,
  degreesToTurn: number,
  onlyPages: PageRange[] | null,
  outName: string
): Promise<void> {
  const doc = await loadPdf(file)
  const pageCount = doc.getPageCount()
  const targets = onlyPages
    ? new Set(onlyPages.flatMap((r) => Array.from({ length: r.to - r.from + 1 }, (_, k) => r.from - 1 + k)))
    : new Set(doc.getPageIndices())
  doc.getPages().forEach((page, idx) => {
    if (targets.has(idx)) {
      const current = page.getRotation().angle
      page.setRotation(degrees(current + degreesToTurn))
    }
  })
  void pageCount
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Page numbers ---------------- */
export type NumberPosition = 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'

export async function addPageNumbers(
  file: File,
  startAt: number,
  position: NumberPosition,
  fontSize: number,
  skipFirst: boolean,
  outName: string
): Promise<void> {
  const doc = await loadPdf(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  pages.forEach((page, idx) => {
    if (skipFirst && idx === 0) return
    const { width, height } = page.getSize()
    const label = String(startAt + idx)
    const tw = font.widthOfTextAtSize(label, fontSize)
    const margin = 24
    let x: number
    let y: number
    if (position.includes('center')) x = (width - tw) / 2
    else if (position.includes('right')) x = width - margin - tw
    else x = margin
    if (position.startsWith('bottom')) y = margin
    else y = height - margin - fontSize
    page.drawText(label, { x, y, size: fontSize, font, color: rgb(0.25, 0.25, 0.25) })
  })
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Extract text ---------------- */
export async function extractText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const strings = (content.items as Array<{ str?: string }>).map((it) => it.str ?? '')
    text += `\n\n----- Page ${i} -----\n\n${strings.join(' ')}`
  }
  return text.trim()
}

/* ---------------- Images to PDF ---------------- */
async function fileToImageData(file: File): Promise<{ dataUrl: string; w: number; h: number }> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(file)
  })
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => reject(new Error(`Could not decode ${file.name}`))
    img.src = dataUrl
  })
  return { dataUrl, ...dims }
}

export async function imagesToPdf(
  files: File[],
  fitToA4: boolean,
  marginPts: number,
  outName: string
): Promise<void> {
  const out = await PDFDocument.create()
  const A4 = { w: 595.28, h: 841.89 }
  for (const f of files) {
    const { dataUrl, w, h } = await fileToImageData(f)
    const isPng = f.type === 'image/png' || /\.png$/i.test(f.name)
    const img = isPng ? await out.embedPng(dataUrl) : await out.embedJpg(dataUrl)
    if (fitToA4) {
      const page = out.addPage([A4.w, A4.h])
      const availW = A4.w - marginPts * 2
      const availH = A4.h - marginPts * 2
      const ratio = Math.min(availW / w, availH / h)
      const dw = w * ratio
      const dh = h * ratio
      page.drawImage(img, { x: (A4.w - dw) / 2, y: (A4.h - dh) / 2, width: dw, height: dh })
    } else {
      // one image-sized page, 72 dpi
      const page = out.addPage([w, h])
      page.drawImage(img, { x: 0, y: 0, width: w, height: h })
    }
  }
  const bytes = await out.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Page thumbnails + organize ---------------- */
export async function renderThumbnails(
  file: File,
  maxWidth = 140,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const urls: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const base = page.getViewport({ scale: 1 })
    const scale = maxWidth / base.width
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    urls.push(canvas.toDataURL('image/jpeg', 0.7))
    onProgress?.(i, doc.numPages)
  }
  return urls
}

export async function extractPages(
  file: File,
  pageIndices: number[],
  outName: string
): Promise<void> {
  const src = await loadPdf(file)
  const out = await PDFDocument.create()
  const pages = await out.copyPages(src, pageIndices)
  pages.forEach((p) => out.addPage(p))
  const bytes = await out.save()
  downloadBlob(pdfBlob(bytes), outName)
}


/* ---------------- PDF to Word / text (with OCR) ---------------- */
type TextItem = { str: string; transform: number[] }

/** Group PDF.js text items into visual lines, preserving reading order. */
export function contentToLines(items: TextItem[]): string[] {
  const rows: { y: number; parts: { x: number; str: string }[] }[] = []
  for (const item of items) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue
    const x = item.transform[4]
    const y = item.transform[5]
    let row = rows.find((r) => Math.abs(r.y - y) < 3)
    if (!row) {
      row = { y, parts: [] }
      rows.push(row)
    }
    row.parts.push({ x, str: item.str })
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) =>
      r.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
}

export interface ConvertOptions {
  format: 'docx' | 'txt' | 'md'
  useOcr: boolean
  lang: string
  pageHeaders: boolean
  onProgress?: (message: string) => void
}

const OCR_MIN_CHARS = 15

export async function pdfToDocument(file: File, opts: ConvertOptions): Promise<void> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const total = doc.numPages

  let worker: Tesseract.Worker | null = null
  if (opts.useOcr) {
    opts.onProgress?.('Loading OCR engine (first run downloads language data)…')
    worker = await Tesseract.createWorker(opts.lang)
  }

  const pageTexts: string[] = []
  try {
    for (let i = 1; i <= total; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      let lines = contentToLines(content.items as TextItem[])

      if (worker && lines.join('').trim().length < OCR_MIN_CHARS) {
        opts.onProgress?.(`OCR on page ${i} of ${total}…`)
        const viewport = page.getViewport({ scale: 2.5 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvas, canvasContext: ctx, viewport }).promise
        const result = await worker.recognize(canvas)
        lines = result.data.text.split('\n').map((l) => l.trim()).filter(Boolean)
      } else {
        opts.onProgress?.(`Reading page ${i} of ${total}…`)
      }
      pageTexts.push(lines.join('\n'))
    }
  } finally {
    if (worker) await worker.terminate()
  }

  const stem = baseName(file.name)
  if (opts.format === 'txt') {
    const body = pageTexts
      .map((t, i) => (opts.pageHeaders ? `----- Page ${i + 1} -----\n${t}` : t))
      .join('\n\n')
    downloadBlob(new Blob([body], { type: 'text/plain;charset=utf-8' }), `${stem}.txt`)
    return
  }

  if (opts.format === 'md') {
    const esc = (s: string) => s.replace(/^#/gm, '\\#')
    const body = [
      `# ${stem}`,
      '',
      ...pageTexts.flatMap((t, i) => [
        ...(opts.pageHeaders ? [`## Page ${i + 1}`, ''] : []),
        ...t
          .split('\n')
          .filter((l) => l.trim())
          .map((l) => esc(l) + '  '),
        '',
      ]),
    ].join('\n')
    downloadBlob(new Blob([body], { type: 'text/markdown;charset=utf-8' }), `${stem}.md`)
    return
  }

  const { Document, HeadingLevel, Packer, PageBreak, Paragraph, TextRun } = await import('docx')
  const children: DocxParagraph[] = []
  pageTexts.forEach((text, i) => {
    if (opts.pageHeaders) {
      children.push(new Paragraph({ text: `Page ${i + 1}`, heading: HeadingLevel.HEADING_2 }))
    }
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length === 0) children.push(new Paragraph({ children: [new TextRun('')] }))
    for (const line of lines) children.push(new Paragraph({ children: [new TextRun(line)] }))
    if (i < pageTexts.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }))
  })
  const wordDoc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(wordDoc)
  downloadBlob(blob, `${stem}.docx`)
}


/* ---------------- PDF to JPG ---------------- */
export async function pdfToJpgBlobs(
  file: File,
  scale: number,
  quality: number,
  onProgress?: (done: number, total: number) => void
): Promise<Blob[]> {
  const data = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data }).promise
  const blobs: Blob[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: ctx, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encoding failed'))), 'image/jpeg', quality)
    )
    blobs.push(blob)
    onProgress?.(i, doc.numPages)
  }
  return blobs
}

/* ---------------- Watermark ---------------- */
export interface WatermarkOptions {
  text: string
  fontSize: number
  opacity: number
  colorHex: string
  diagonal: boolean
  pages: PageRange[] | null
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const v = parseInt(m.length === 3 ? m.split('').map((c) => c + c).join('') : m, 16)
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
}

export async function watermarkPdf(
  file: File,
  opts: WatermarkOptions,
  outName: string
): Promise<void> {
  const doc = await loadPdf(file)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const [r, g, b] = hexToRgb01(opts.colorHex)
  const color = rgb(r, g, b)
  const pageCount = doc.getPageCount()
  const targets = opts.pages
    ? new Set(opts.pages.flatMap((p) => Array.from({ length: p.to - p.from + 1 }, (_, k) => p.from - 1 + k)))
    : new Set(doc.getPageIndices())
  doc.getPages().forEach((page, idx) => {
    if (!targets.has(idx)) return
    void pageCount
    const { width, height } = page.getSize()
    if (opts.diagonal) {
      const stepX = opts.fontSize * 14
      const stepY = opts.fontSize * 9
      for (let y = stepY / 2; y < height + stepY; y += stepY) {
        for (let x = -width / 2; x < width + stepX; x += stepX) {
          page.drawText(opts.text, {
            x: x + ((Math.round(y / stepY) % 2) * stepX) / 2,
            y,
            size: opts.fontSize,
            font,
            color,
            opacity: opts.opacity,
            rotate: degrees(-45),
          })
        }
      }
    } else {
      const tw = font.widthOfTextAtSize(opts.text, opts.fontSize)
      page.drawText(opts.text, {
        x: (width - tw) / 2,
        y: height / 2,
        size: opts.fontSize,
        font,
        color,
        opacity: opts.opacity,
      })
    }
  })
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Sign PDF ---------------- */
export type SignPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'

export async function signPdf(
  file: File,
  pngDataUrl: string,
  position: SignPosition,
  maxWidth: number,
  outName: string
): Promise<void> {
  const doc = await loadPdf(file)
  const img = await doc.embedPng(pngDataUrl)
  const ratio = img.height / img.width
  const w = maxWidth
  const h = maxWidth * ratio
  const margin = 36
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    let x: number
    let y: number
    if (position.includes('right')) x = width - margin - w
    else if (position.includes('left')) x = margin
    else x = (width - w) / 2
    if (position.startsWith('top')) y = height - margin - h
    else if (position.startsWith('bottom')) y = margin
    else y = (height - h) / 2
    page.drawImage(img, { x, y, width: w, height: h })
  })
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- Repair ---------------- */
export async function repairPdfToBytes(file: File): Promise<{ bytes: Uint8Array; method: 'lossless' | 'rebuild' }> {
  try {
    const doc = await loadPdf(file)
    return { bytes: await doc.save({ useObjectStreams: true }), method: 'lossless' }
  } catch {
    // Structural repair failed — rebuild by re-rendering every page.
    const bytes = await compressPdfToBytes(file, 2, 0.92, false)
    return { bytes, method: 'rebuild' }
  }
}

/* ---------------- Crop ---------------- */
export interface CropMargins {
  top: number
  right: number
  bottom: number
  left: number
}

export async function cropPdf(
  file: File,
  margins: CropMargins,
  onlyPages: PageRange[] | null,
  outName: string
): Promise<void> {
  const doc = await loadPdf(file)
  const targets = onlyPages
    ? new Set(onlyPages.flatMap((p) => Array.from({ length: p.to - p.from + 1 }, (_, k) => p.from - 1 + k)))
    : new Set(doc.getPageIndices())
  doc.getPages().forEach((page, idx) => {
    if (!targets.has(idx)) return
    const { width, height } = page.getSize()
    const x = Math.min(margins.left, width - 1)
    const y = Math.min(margins.bottom, height - 1)
    const w = Math.max(1, width - x - Math.min(margins.right, width - 1))
    const h = Math.max(1, height - y - Math.min(margins.top, height - 1))
    page.setCropBox(x, y, w, h)
  })
  const bytes = await doc.save()
  downloadBlob(pdfBlob(bytes), outName)
}


/* ---------------- Redact ---------------- */
export interface RedactBox {
  pageIndex: number // 0-based
  x: number
  y: number
  width: number
  height: number
}

/**
 * Cover the given rectangles with black, then rebuild redacted pages as
 * images so the underlying text is truly destroyed (not just hidden).
 * Pages without redactions are copied losslessly.
 */
export async function redactPdf(
  file: File,
  boxes: RedactBox[],
  outName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const SCALE = 2
  const data = new Uint8Array(await file.arrayBuffer())
  // pdf.js takes ownership of (detaches) the buffer passed to getDocument,
  // so pdf-lib needs its own copy — loading the detached buffer throws
  // "No PDF header found".
  const libData = data.slice()
  const jsDoc = await pdfjs.getDocument({ data }).promise
  const src = await PDFDocument.load(libData, { ignoreEncryption: true })
  const out = await PDFDocument.create()

  const byPage = new Map<number, RedactBox[]>()
  for (const b of boxes) {
    const list = byPage.get(b.pageIndex) ?? []
    list.push(b)
    byPage.set(b.pageIndex, list)
  }

  for (let i = 0; i < src.getPageCount(); i++) {
    onProgress?.(`Processing page ${i + 1} of ${src.getPageCount()}…`)
    const pageBoxes = byPage.get(i)
    const srcPage = src.getPage(i)
    const { width, height } = srcPage.getSize()
    if (!pageBoxes) {
      const [copied] = await out.copyPages(src, [i])
      out.addPage(copied)
      continue
    }
    const jsPage = await jsDoc.getPage(i + 1)
    const viewport = jsPage.getViewport({ scale: SCALE })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await jsPage.render({ canvas, canvasContext: ctx, viewport }).promise
    ctx.fillStyle = '#000000'
    for (const b of pageBoxes) {
      const px = b.x * SCALE
      const py = (height - b.y - b.height) * SCALE
      ctx.fillRect(px, py, b.width * SCALE, b.height * SCALE)
    }
    const jpg = canvas.toDataURL('image/jpeg', 0.92)
    const img = await out.embedJpg(jpg)
    const page = out.addPage([width, height])
    page.drawImage(img, { x: 0, y: 0, width, height })
  }
  const bytes = await out.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- OCR → searchable PDF ---------------- */
interface OcrLineBox {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

type TesseractBlock = {
  paragraphs?: {
    lines?: { text?: string; bbox?: { x0: number; y0: number; x1: number; y1: number } }[]
  }[]
}

/** Extract positioned lines from tesseract's structured block output. */
function blocksToLines(blocks: TesseractBlock[] | null | undefined): OcrLineBox[] {
  const lines: OcrLineBox[] = []
  for (const block of blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        const text = (line.text ?? '').trim()
        const bbox = line.bbox
        if (text && bbox) lines.push({ text, ...bbox })
      }
    }
  }
  return lines
}

/** Build a searchable PDF: page images + invisible OCR text layer. */
export async function ocrPdfToSearchable(
  file: File,
  lang: string,
  outName: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const SCALE = 2
  const data = new Uint8Array(await file.arrayBuffer())
  const jsDoc = await pdfjs.getDocument({ data }).promise
  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  onProgress?.('Loading OCR engine (first run downloads language data)…')
  const worker = await Tesseract.createWorker(lang)
  try {
    for (let i = 1; i <= jsDoc.numPages; i++) {
      onProgress?.(`Page ${i} of ${jsDoc.numPages}: rendering…`)
      const jsPage = await jsDoc.getPage(i)
      const base = jsPage.getViewport({ scale: 1 })
      const viewport = jsPage.getViewport({ scale: SCALE })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await jsPage.render({ canvas, canvasContext: ctx, viewport }).promise
      const jpg = canvas.toDataURL('image/jpeg', 0.9)
      const img = await out.embedJpg(jpg)
      const page = out.addPage([base.width, base.height])
      page.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height })

      onProgress?.(`Page ${i} of ${jsDoc.numPages}: recognizing…`)
      // Request the structured blocks output — parsing hOCR HTML silently
      // produced no text layer, which is why the PDFs weren't searchable.
      const result = await worker.recognize(canvas, {}, { text: true, blocks: true })
      for (const line of blocksToLines(result.data.blocks as TesseractBlock[] | null)) {
        const size = Math.max(4, (line.y1 - line.y0) / SCALE)
        const x = line.x0 / SCALE
        const y = base.height - line.y1 / SCALE
        try {
          page.drawText(line.text, { x, y, size, font, color: rgb(0, 0, 0), opacity: 0 })
        } catch {
          // Line contains characters Helvetica can't encode — skip it.
        }
      }
    }
  } finally {
    await worker.terminate()
  }
  const bytes = await out.save()
  downloadBlob(pdfBlob(bytes), outName)
}

/* ---------------- PDF Forms ---------------- */
export interface FormFieldInfo {
  name: string
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'other'
  value: string
  options?: string[]
}

export async function listFormFields(file: File): Promise<FormFieldInfo[]> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  return form.getFields().map((f) => {
    const name = f.getName()
    // NOTE: instanceof must be used here — f.constructor.name is minified
    // away in production builds, which breaks field detection.
    try {
      if (f instanceof PDFTextField) {
        return { name, type: 'text' as const, value: f.getText() ?? '' }
      }
      if (f instanceof PDFCheckBox) {
        return { name, type: 'checkbox' as const, value: f.isChecked() ? 'yes' : '' }
      }
      if (f instanceof PDFDropdown) {
        return { name, type: 'dropdown' as const, value: f.getSelected()[0] ?? '', options: f.getOptions() }
      }
      if (f instanceof PDFRadioGroup) {
        return { name, type: 'radio' as const, value: f.getSelected() ?? '', options: f.getOptions() }
      }
    } catch {
      // fall through to 'other'
    }
    return { name, type: 'other' as const, value: '' }
  })
}

export async function fillFormPdf(
  file: File,
  values: Record<string, string>,
  flatten: boolean,
  outName: string
): Promise<void> {
  const bytes = await file.arrayBuffer()
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const form = doc.getForm()
  for (const f of form.getFields()) {
    const name = f.getName()
    const val = values[name]
    if (val === undefined) continue
    try {
      if (f instanceof PDFTextField) f.setText(val)
      else if (f instanceof PDFCheckBox) {
        if (val === 'yes') f.check()
        else f.uncheck()
      } else if (f instanceof PDFDropdown) {
        if (val) f.select(val)
      } else if (f instanceof PDFRadioGroup) {
        if (val) f.select(val)
      }
    } catch {
      // skip fields that reject the value
    }
  }
  if (flatten) form.flatten()
  const out = await doc.save()
  downloadBlob(pdfBlob(out), outName)
}

/* ---------------- HTML to PDF ---------------- */
export async function htmlToPdf(
  html: string,
  outName: string
): Promise<void> {
  const { default: html2canvas } = await import('html2canvas')
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;background:#fff;'
  host.innerHTML = html
  document.body.appendChild(host)
  try {
    const canvas = await html2canvas(host, { scale: 2, backgroundColor: '#ffffff' })
    const out = await PDFDocument.create()
    const img = await out.embedPng(canvas.toDataURL('image/png'))
    const A4w = 595.28
    const A4h = 841.89
    const ratio = Math.min(A4w / canvas.width, A4h / canvas.height)
    const w = canvas.width * ratio
    const h = canvas.height * ratio
    const page = out.addPage([A4w, A4h])
    page.drawImage(img, { x: (A4w - w) / 2, y: (A4h - h) / 2, width: w, height: h })
    const bytes = await out.save()
    downloadBlob(pdfBlob(bytes), outName)
  } finally {
    host.remove()
  }
}
