import 'dotenv/config'
import { createTestPdf, printPdfTo, TestPdfOptions } from '../src/utils/printer-pdf'
import { printPdfViaShell } from '../src/utils/printer-win'

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function parseSize(val: string | undefined): TestPdfOptions['size'] | undefined {
  if (!val) return undefined
  const v = val.toUpperCase()
  if (['A4', 'A5', 'A6', 'LETTER', 'LEGAL'].includes(v)) return v as any
  // custom WxH in points, e.g., 298x420
  const m = v.match(/^(\d+)x(\d+)$/)
  if (m) return [Number(m[1]), Number(m[2])] as any
  return undefined
}

async function main() {
  const printerName = getArg('printer') || process.env.WINDOWS_PRINTER_NAME
  const message = getArg('message') || process.env.PRINTER_TEST_MESSAGE || 'Hello from Pizza & Pasta (PDF via Windows spooler)'
  const sizeArg = parseSize(getArg('size') || process.env.PRINTER_PAGE_SIZE || 'A6')
  const pdf = await createTestPdf(message, { size: sizeArg })
  console.log(`[printer:pdf] printing ${pdf} ${printerName ? 'to ' + printerName : '(default printer)'}...`)
  try {
    await printPdfTo(printerName, pdf)
  } catch (e) {
    console.warn('[printer:pdf] pdf-to-printer failed, trying PowerShell print...')
    await printPdfViaShell(printerName, pdf)
  }
  console.log('[printer:pdf] done')
}

main().catch((e) => {
  console.error('[printer:pdf] failed:', e?.message || e)
  process.exit(1)
})
