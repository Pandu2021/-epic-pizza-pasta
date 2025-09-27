import net from 'node:net'

export type PrintRaw9100Options = {
  host: string
  port?: number
  data: Buffer | string
  /** When data is string, encoding used to convert to Buffer */
  encoding?: BufferEncoding
  /** Socket timeout in ms */
  timeoutMs?: number
}

/**
 * Send raw bytes to a network printer via HP JetDirect (port 9100).
 * Most LaserJet printers accept plain text; add a form feed (\x0C) to eject page.
 */
export function printRaw9100({ host, port = 9100, data, encoding = 'utf8', timeoutMs = 5000 }: PrintRaw9100Options): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port })

    let finished = false
    const done = (err?: Error) => {
      if (finished) return
      finished = true
      try {
        socket.end()
        socket.destroy()
      } catch {}
      if (err) reject(err)
      else resolve()
    }

    socket.setTimeout(timeoutMs)
    socket.on('timeout', () => done(new Error('Printer connection timed out')))
    socket.on('error', (err) => done(err))
    socket.on('close', () => done())

    socket.on('connect', () => {
      const buffer = typeof data === 'string' ? Buffer.from(data, encoding) : data
      socket.write(buffer)
      // Small delay then half-close to signal end of job
      setTimeout(() => socket.end(), 50)
    })
  })
}

/**
 * Helper to create a simple text test page. Adds a form feed at the end.
 */
export function buildTextTestPage(text: string): string {
  const now = new Date().toISOString()
  const lines = [
    '*** Pizza & Pasta Print Test ***',
    '',
    text,
    '',
    `Printed at: ${now}`,
    'Printer mode: RAW 9100',
    '',
    'Thank you for printing with Pizza & Pasta!'
  ]
  // Form feed to eject page
  return lines.join('\r\n') + '\f'
}
