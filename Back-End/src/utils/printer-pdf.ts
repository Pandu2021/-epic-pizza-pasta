import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import PDFDocument from 'pdfkit'
import { applyPrintFont } from './print-font'
import { print, getPrinters } from 'pdf-to-printer'

export type TestPdfOptions = {
  size?: PDFKit.PDFDocumentOptions['size']
  margin?: number
}

export async function createTestPdf(content: string, opts: TestPdfOptions = {}): Promise<string> {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'pizza-print-'))
  const filePath = path.join(dir, 'test.pdf')
  const size = opts.size ?? 'A6' // default to A6 receipt size
  const margin = opts.margin ?? 18

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin, size })
    const stream = fs.createWriteStream(filePath)
  doc.pipe(stream)
  // Ensure font supports Baht symbol (฿) on Windows
  applyPrintFont(doc)

    // Header
  doc.fontSize(16).text('Pizza & Pasta - Test Cetak', { align: 'left' })
    doc.moveDown(0.5)
    doc.fontSize(9).text(`Waktu: ${new Date().toLocaleString()}`)
    doc.moveDown(0.5)
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke()

    // Body
    doc.moveDown(0.5)
    doc.fontSize(11).text(content)

    // Footer
    doc.moveDown(1)
    doc.fontSize(8).text('Ukuran halaman: ' + (typeof size === 'string' ? size : size.join('x')))
    doc.end()
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
  return filePath
}

export async function listPrinters() {
  return getPrinters()
}

export async function printPdfTo(printerName: string | undefined, filePath: string) {
  await print(filePath, printerName ? { printer: printerName } : undefined)
}
