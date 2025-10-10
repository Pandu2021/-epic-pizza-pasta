import fs from 'node:fs'
import path from 'node:path'

// Try to find a font that supports the Thai Baht symbol (฿)
// Priority: env override -> common Windows fonts
export function resolvePrintFontPath(): string | undefined {
  const envPath = process.env.PRINTER_FONT_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  const winFonts = [
    'segoeui.ttf',
    'arial.ttf',
    'tahoma.ttf',
    'calibri.ttf',
    'verdana.ttf',
  ]

  const windowsFontsDir = process.platform === 'win32'
    ? (process.env.WINDIR ? path.join(process.env.WINDIR, 'Fonts') : 'C:\\Windows\\Fonts')
    : undefined

  if (windowsFontsDir && fs.existsSync(windowsFontsDir)) {
    for (const f of winFonts) {
      const p = path.join(windowsFontsDir, f)
      if (fs.existsSync(p)) return p
    }
  }

  // macOS/Linux fallbacks (in case used elsewhere)
  const candidates = [
    '/Library/Fonts/Arial Unicode.ttf',
    '/Library/Fonts/Arial Unicode MS.ttf',
    '/Library/Fonts/Arial.ttf',
    '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return undefined
}

export function applyPrintFont(doc: PDFKit.PDFDocument): string | undefined {
  try {
    const fontPath = resolvePrintFontPath()
    if (fontPath) {
      doc.font(fontPath)
      return fontPath
    }
  } catch {
    // ignore and keep default font
  }
  return undefined
}
