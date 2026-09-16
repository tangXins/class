// 生成多尺寸 Windows ICO → build/icon.ico
// ICO 容器内嵌 PNG（Vista+ / Win10/11 原生支持），electron-builder/rcedit 可用
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const C1 = [0, 90, 130]
const C2 = [0, 200, 220]

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n >>> 0
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = (CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const tb = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])))
  return Buffer.concat([len, tb, data, crc])
}

// 绘制指定尺寸的蓝青渐变 + 白框 + T 形符号 PNG
function makePng(S) {
  const px = Buffer.alloc(S * S * 4)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const t = (x / S + y / S) / 2
      const i = (y * S + x) * 4
      px[i]   = Math.round(C1[0] + (C2[0] - C1[0]) * t)
      px[i+1] = Math.round(C1[1] + (C2[1] - C1[1]) * t)
      px[i+2] = Math.round(C1[2] + (C2[2] - C1[2]) * t)
      px[i+3] = 255
    }
  }
  const set = (y, x) => {
    if (y < 0 || y >= S || x < 0 || x >= S) return
    const i = (y * S + x) * 4
    px[i] = px[i+1] = px[i+2] = 255; px[i+3] = 255
  }
  // 边框（按尺寸缩放，约 S/21 厚度）
  const b = Math.max(1, Math.round(S * 0.05))
  for (let i = 0; i < S; i++)
    for (let t = 0; t < b; t++) {
      set(t, i); set(S - 1 - t, i); set(i, t); set(i, S - 1 - t)
    }
  // T 形符号：顶横 + 中竖 + 底短横，相对尺寸 0.44 宽
  const th = Math.max(1, Math.round(S * 0.045))
  const halfW = Math.round(S * 0.22), halfH = Math.round(S * 0.28)
  const cx = S / 2, cy = S / 2
  for (let x = cx - halfW; x < cx + halfW; x++)
    for (let t = 0; t < th; t++) set(cy - halfH + t, x)
  for (let y = cy - halfH; y < cy + halfH; y++)
    for (let t = 0; t < th; t++) set(y, cx - th / 2 + t)
  const halfW2 = Math.round(S * 0.14)
  for (let x = cx - halfW2; x < cx + halfW2; x++)
    for (let t = 0; t < th; t++) set(cy + halfH - th + t, x)

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc(S * (S * 4 + 1))
  for (let y = 0; y < S; y++) {
    raw[y * (S * 4 + 1)] = 0
    px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4)
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = sizes.map(s => makePng(s))

const count = sizes.length
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)       // reserved
header.writeUInt16LE(1, 2)       // type: icon
header.writeUInt16LE(count, 4)   // image count

const entries = []
let offset = 6 + count * 16
pngs.forEach((png, i) => {
  const s = sizes[i]
  const e = Buffer.alloc(16)
  e.writeUInt8(s >= 256 ? 0 : s, 0)   // width (0 = 256)
  e.writeUInt8(s >= 256 ? 0 : s, 1)   // height
  e.writeUInt8(0, 2)                  // palette
  e.writeUInt8(0, 3)                  // reserved
  e.writeUInt16LE(1, 4)               // color planes
  e.writeUInt16LE(32, 6)              // bpp
  e.writeUInt32LE(png.length, 8)      // size
  e.writeUInt32LE(offset, 12)         // offset
  entries.push(e)
  offset += png.length
})

const ico = Buffer.concat([header, ...entries, ...pngs])
const outDir = path.join(__dirname, '..', 'build')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'icon.ico')
fs.writeFileSync(out, ico)
console.log('✓', out, `(${ico.length} B, ${count} sizes: ${sizes.join('/')})`)
