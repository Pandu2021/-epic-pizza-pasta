import net from 'node:net'

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1]
  return undefined
}

function checkPort(host: string, port: number, timeout = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      try { socket.end(); socket.destroy() } catch {}
      resolve(ok)
    }
    socket.setTimeout(timeout)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
    socket.once('close', () => finish(done))
  })
}

async function main() {
  const host = getArg('host') || process.env.PRINTER_HOST
  if (!host) {
    console.error('Usage: tsx scripts/probe-printer.ts --host <ip>')
    process.exit(1)
  }
  const ports = [9100, 631, 515]
  console.log(`[probe] Checking ${host} on ports ${ports.join(', ')}`)
  for (const p of ports) {
    const ok = await checkPort(host, p)
    console.log(`[probe] ${host}:${p} => ${ok ? 'OPEN' : 'CLOSED/NO-RESPONSE'}`)
  }
}

main().catch((e) => {
  console.error('[probe] failed:', e?.message || e)
  process.exit(1)
})
