/**
 * gen-favicon.mjs
 * Wraps public/logo.png into a valid .ico file (ICO-with-PNG format).
 * No image manipulation needed — the PNG bytes are embedded as-is.
 * Modern browsers + Google accept PNG-in-ICO for any size.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const src  = path.join(root, 'public', 'logo.png')
const dest = path.join(root, 'public', 'favicon.ico')

const pngData = fs.readFileSync(src)
const pngSize = pngData.length

// ICO header (6 bytes)
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)  // reserved
header.writeUInt16LE(1, 2)  // type: 1 = ICO
header.writeUInt16LE(1, 4)  // image count: 1

// ICONDIRENTRY (16 bytes)
// width/height of 0 means 256 — modern renderers read the embedded PNG header
// for the real dimensions; Google and Chrome handle this correctly for 512x512
const entry = Buffer.alloc(16)
entry.writeUInt8(0, 0)          // width  (0 = 256 / read from PNG)
entry.writeUInt8(0, 1)          // height (0 = 256 / read from PNG)
entry.writeUInt8(0, 2)          // color count (0 = full color)
entry.writeUInt8(0, 3)          // reserved
entry.writeUInt16LE(1, 4)       // planes
entry.writeUInt16LE(32, 6)      // bit count
entry.writeUInt32LE(pngSize, 8) // size of PNG data in bytes
entry.writeUInt32LE(6 + 16, 12) // offset = after header (6) + entry (16)

const ico = Buffer.concat([header, entry, pngData])
fs.writeFileSync(dest, ico)

console.log(`✓ favicon.ico written — ${ico.length} bytes (embeds logo.png ${pngData.length} bytes)`)
