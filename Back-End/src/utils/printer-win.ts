import { execFile } from 'node:child_process'
import path from 'node:path'

function runPwsh(args: string[], timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
      windowsHide: true
    }, (err, stdout, stderr) => {
      if (err) return reject(err)
      if (stderr && String(stderr).trim().length > 0) {
        // Some cmdlets write warnings to stderr; ignore unless no stdout
        if (!stdout || String(stdout).trim().length === 0) return reject(new Error(stderr.toString()))
      }
      resolve(stdout.toString())
    })
    setTimeout(() => {
      try { ps.kill() } catch {}
      reject(new Error('PowerShell command timed out'))
    }, timeoutMs)
  })
}

export async function listWindowsPrinters(): Promise<Array<{ Name: string }>> {
  const script = 'Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json'
  const out = await runPwsh(['-Command', script])
  try {
    const parsed = JSON.parse(out)
    if (Array.isArray(parsed)) return parsed.map((n: string) => ({ Name: n }))
    if (typeof parsed === 'string') return [{ Name: parsed }]
    return []
  } catch {
    // Fallback: split lines
    const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    return lines.map((Name) => ({ Name }))
  }
}

export async function printPdfViaShell(printerName: string | undefined, filePath: string): Promise<void> {
  const abs = path.resolve(filePath)
  const printerArg = printerName ? `"${printerName}"` : ''
  // Use default associated PDF viewer to print silently (may show UI depending on viewer)
  const cmd = `Start-Process -FilePath "${abs}" -Verb Print${printerName ? 'To' : ''} ${printerArg}`
  await runPwsh(['-Command', cmd])
}
