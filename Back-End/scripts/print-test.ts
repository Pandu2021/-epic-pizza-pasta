import 'dotenv/config'
import { buildTextTestPage, printRaw9100 } from '../src/utils/printer'
import { printIppText } from '../src/utils/printer-ipp'

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

async function main() {
  const host = getArg('host') || process.env.PRINTER_HOST
  const protocol = (getArg('protocol') || process.env.PRINTER_PROTOCOL || 'auto').toLowerCase()
  const port = Number(getArg('port') || (protocol === 'ipp' ? (process.env.PRINTER_IPP_PORT || 631) : (process.env.PRINTER_PORT || 9100)))
  const ippPath = getArg('path') || process.env.PRINTER_IPP_PATH || '/ipp/print'
  const message = getArg('message') || process.env.PRINTER_TEST_MESSAGE || 'Hello from Pizza & Pasta back-end!'

  if (!host) {
    console.error('Missing printer host. Provide --host <ip> or set PRINTER_HOST in .env')
    process.exit(1)
  }

  const payload = buildTextTestPage(message)
  if (protocol === 'raw') {
    console.log(`[printer] RAW 9100 -> ${host}:${port}`)
    await printRaw9100({ host, port, data: payload })
  } else if (protocol === 'ipp') {
    console.log(`[printer] IPP -> http://${host}:${port}${ippPath}`)
    await printIppText({ host, port, path: ippPath, data: payload })
  } else if (protocol === 'auto') {
    try {
      console.log(`[printer] AUTO: trying RAW 9100 -> ${host}:9100`)
      await printRaw9100({ host, port: 9100, data: payload, timeoutMs: 3000 })
    } catch (e) {
      console.warn(`[printer] RAW failed: ${(e as any)?.message}. Trying IPP...`)
      console.log(`[printer] IPP -> http://${host}:${631}${ippPath}`)
      await printIppText({ host, port: 631, path: ippPath, data: payload })
    }
  } else {
    console.error(`Unknown protocol: ${protocol}. Use raw or ipp.`)
    process.exit(1)
  }
  console.log('[printer] done')
}

main().catch((err) => {
  console.error('[printer] failed:', err?.message || err)
  process.exit(1)
})
