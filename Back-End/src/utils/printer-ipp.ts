import ipp from 'ipp'

export type PrintIppTextOptions = {
  host: string
  port?: number
  path?: string
  data: string
  timeoutMs?: number
}

/**
 * Send a plain text document to an IPP printer (default port 631).
 */
export async function printIppText({ host, port = 631, path = '/ipp/print', data, timeoutMs = 8000 }: PrintIppTextOptions): Promise<void> {
  const url = `http://${host}:${port}${path}`
  const printer = new ipp.Printer(url)

  const msg = {
    'operation-attributes-tag': {
      'requesting-user-name': 'pizza-pasta',
      'job-name': 'Pizza & Pasta Test',
      'document-format': 'text/plain'
    },
    data: Buffer.from(data, 'utf8')
  }

  await new Promise<void>((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('IPP print timed out')), timeoutMs)
    ;(printer as any).execute('Print-Job', msg, (err: any /* eslint-disable-line */) => {
      clearTimeout(to)
      if (err) reject(err)
      else resolve()
    })
  })
}
