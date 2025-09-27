import { listPrinters } from '../src/utils/printer-pdf'
import { listWindowsPrinters } from '../src/utils/printer-win'

async function main() {
  try {
    const printers = await listPrinters()
    console.log('[printers] (pdf-to-printer)', JSON.stringify(printers, null, 2))
  } catch (e) {
    console.warn('[printers] pdf-to-printer failed, trying PowerShell...')
    const winPrinters = await listWindowsPrinters()
    console.log('[printers] (powershell)', JSON.stringify(winPrinters, null, 2))
  }
}

main().catch((e) => {
  console.error('[printers] failed:', e?.message || e)
  process.exit(1)
})
