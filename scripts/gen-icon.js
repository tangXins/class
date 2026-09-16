// 生成班级管理大师应用图标 → public/icon.png + 打印 base64
// 不引任何依赖，纯 Node（zlib 内置）
const fs = require('fs')
const zlib = require('zlib')
const path = require('path')

const SIZE = 128

// ===== 像素填充（RGBA） =====
const pixels = Buffer.alloc(SIZE * SIZE * 4)
const C1 = [0, 90, 130]
const C2 = [0, 200, 220]

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const t = (x / SIZE + y / SIZE) / 2
    const i = (y * SIZE + x) * 4
    pixels[i]   = Math.round(C1[0] + (C2[0] - C1[0]) * t)
    pixels[i+1] = Math.round(C1[1] + (C2[1] - C1[1]) * t)
    pixels[i+2] = Math.round(C1[2] + (C2[2] - C1[2]) * t)
    pixels[i+3] = 255
  }
}

// 白色边框 + 白色"班"形符号（抽象：顶横+中竖+底短横）
function setPx(y, x) {
  if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) return
  const i = (y * SIZE + x) * 4
  pixels[i] = pixels[i+1] = pixels[i+2] = 255; pixels[i+3] = 255
}

// 外描边（双层：6px 内 + 外轮廓）
for (let i = 0; i < SIZE; i++) {
  setPx(0, i); setPx(SIZE-1, i); setPx(i, 0); setPx(i, SIZE-1)
  setPx(6, i); setPx(SIZE-7, i); setPx(i, 6); setPx(i, SIZE-7)
}

// 白色符号
const cx = 64, cy = 64, W = 56, THICK = 5
// 顶部横
for (let x = cx - W/2; x < cx + W/2; x++)
  for (let t = 0; t < THICK; t++) setPx(cy - 36 + t, x)
// 中竖
for (let y = cy - 36; y < cy + 36; y++)
  for (let t = 0; t < THICK; t++) setPx(y, cx - THICK/2 + t)
// 底部短横
for (let x = cx - W/4; x < cx + W/4; x++)
  for (let t = 0; t < THICK; t++) setPx(cy + 36 - THICK + t, x)

// ===== PNG 组装 =====
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

const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}

const idatData = zlib.deflateSync(raw, { level: 9 })
const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))])

// ===== 输出 =====
const outDir = path.join(__dirname, '..', 'public')
fs.mkdirSync(outDir, { recursive: true })
const outPath = path.join(outDir, 'icon.png')
fs.writeFileSync(outPath, png)
console.log('✓ icon.png:', outPath, `(${png.length} B, ${SIZE}×${SIZE})`)

// 同时输出 256×256 版本（windows 托盘/窗口图标更清晰）
const SIZE2 = 256
const px2 = Buffer.alloc(SIZE2 * SIZE2 * 4)
for (let y = 0; y < SIZE2; y++) {
  for (let x = 0; x < SIZE2; x++) {
    const t = (x / SIZE2 + y / SIZE2) / 2
    const i = (y * SIZE2 + x) * 4
    px2[i]   = Math.round(C1[0] + (C2[0] - C1[0]) * t)
    px2[i+1] = Math.round(C1[1] + (C2[1] - C1[1]) * t)
    px2[i+2] = Math.round(C1[2] + (C2[2] - C1[2]) * t)
    px2[i+3] = 255
  }
}
function setPx256(y, x) {
  if (y < 0 || y >= SIZE2 || x < 0 || x >= SIZE2) return
  const i = (y * SIZE2 + x) * 4
  px2[i] = px2[i+1] = px2[i+2] = 255; px2[i+3] = 255
}
for (let i = 0; i < SIZE2; i++) {
  setPx256(0, i); setPx256(SIZE2-1, i); setPx256(i, 0); setPx256(i, SIZE2-1)
  setPx256(12, i); setPx256(SIZE2-13, i); setPx256(i, 12); setPx256(i, SIZE2-13)
}
const cx2 = 128, cy2 = 128, W2 = 112, TH2 = 10
for (let x = cx2 - W2/2; x < cx2 + W2/2; x++)
  for (let t = 0; t < TH2; t++) setPx256(cy2 - 72 + t, x)
for (let y = cy2 - 72; y < cy2 + 72; y++)
  for (let t = 0; t < TH2; t++) setPx256(y, cx2 - TH2/2 + t)
for (let x = cx2 - W2/4; x < cx2 + W2/4; x++)
  for (let t = 0; t < TH2; t++) setPx256(cy2 + 72 - TH2 + t, x)

const ihdr2 = Buffer.alloc(13)
ihdr2.writeUInt32BE(SIZE2, 0); ihdr2.writeUInt32BE(SIZE2, 4)
ihdr2[8] = 8; ihdr2[9] = 6
const raw2 = Buffer.alloc(SIZE2 * (SIZE2 * 4 + 1))
for (let y = 0; y < SIZE2; y++) {
  raw2[y * (SIZE2 * 4 + 1)] = 0
  px2.copy(raw2, y * (SIZE2 * 4 + 1) + 1, y * SIZE2 * 4, (y + 1) * SIZE2 * 4)
}
const idat2 = zlib.deflateSync(raw2, { level: 9 })
const png256 = Buffer.concat([sig, chunk('IHDR', ihdr2), chunk('IDAT', idat2), chunk('IEND', Buffer.alloc(0))])
fs.writeFileSync(path.join(outDir, 'icon-256.png'), png256)
console.log('✓ icon-256.png:', path.join(outDir, 'icon-256.png'), `(${png256.length} B, 256×256)`)

// 打印 base64（256 版，用于托盘）
const b64 = png256.toString('base64')
console.log('\n// === 托盘图标 base64 dataURL（粘贴到 main.js）===')
console.log('const ICON_DATA_URL = "data:image/png;base64,' + b64 + '"')
