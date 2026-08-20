/* eslint-env node */
/**
 * 应用图标生成脚本（纯 Node，无外部依赖）
 * @description 读取 apps/web/public/favicon.ico（实际为 PNG 内容），放大至 256×256，
 *              封装为合法 ICO（ICONDIR + 单条目 + 内嵌 PNG），输出 apps/desktop/build/icon.ico。
 *              用法：node scripts/generate-icon.mjs（或 pnpm icon）
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync, deflateSync } from 'node:zlib'
import { Buffer } from 'node:buffer'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC = join(ROOT, '../web/public/favicon.ico')
const OUT = join(ROOT, 'build/icon.ico')
const TARGET_SIZE = 256

// ---------- PNG 解码（最小实现：支持 RGBA/RGB 8bit 非隔行） ----------
const decodePng = (buf) => {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('源文件不是 PNG 格式')
    let width = 0
    let height = 0
    let bitDepth = 0
    let colorType = 0
    let idat = []
    let offset = 8
    while (offset < buf.length) {
        const len = buf.readUInt32BE(offset)
        const type = buf.toString('ascii', offset + 4, offset + 8)
        const data = buf.subarray(offset + 8, offset + 8 + len)
        if (type === 'IHDR') {
            width = data.readUInt32BE(0)
            height = data.readUInt32BE(4)
            bitDepth = data[8]
            colorType = data[9]
        } else if (type === 'IDAT') {
            idat.push(data)
        } else if (type === 'IEND') {
            break
        }
        offset += 12 + len
    }
    if (bitDepth !== 8) throw new Error(`不支持的位深：${bitDepth}`)
    const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
    if (!channels) throw new Error(`不支持的颜色类型：${colorType}`)
    // 解压 + 逐扫描线去滤波
    const raw = inflateSync(Buffer.concat(idat))
    const stride = width * channels
    const out = Buffer.alloc(height * stride)
    let pos = 0
    for (let y = 0; y < height; y++) {
        const filter = raw[pos++]
        const line = raw.subarray(pos, pos + stride)
        const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride)
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? line[x - channels] : 0
            const b = prev ? prev[x] : 0
            const c = x >= channels && prev ? prev[x - channels] : 0
            const rawPx = line[x]
            let val
            switch (filter) {
                case 0:
                    val = rawPx
                    break // None
                case 1:
                    val = rawPx + a
                    break // Sub
                case 2:
                    val = rawPx + b
                    break // Up
                case 3:
                    val = rawPx + ((a + b) >> 1)
                    break // Average
                case 4: {
                    const p = a + b - c
                    const pa = Math.abs(p - a)
                    const pb = Math.abs(p - b)
                    const pc = Math.abs(p - c)
                    val = rawPx + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
                    break // Paeth
                }
                default:
                    throw new Error(`未知滤波类型：${filter}`)
            }
            out[y * stride + x] = val & 0xff
        }
        pos += stride
    }
    return { width, height, channels, pixels: out }
}

// ---------- 最近邻放大 ----------
const scalePixels = (src, srcW, srcH, channels, dstW, dstH) => {
    const dst = Buffer.alloc(dstW * dstH * channels)
    for (let y = 0; y < dstH; y++) {
        const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH))
        for (let x = 0; x < dstW; x++) {
            const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW))
            const si = (sy * srcW + sx) * channels
            const di = (y * dstW + x) * channels
            for (let c = 0; c < channels; c++) dst[di + c] = src[si + c]
        }
    }
    return dst
}

// ---------- PNG 编码（RGBA 8bit 非隔行） ----------
const crcTable = (() => {
    const t = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
    }
    return t
})()

const crc32 = (buf) => {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
}

const encodePng = (width, height, rgba) => {
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(width, 0)
    ihdr.writeUInt32BE(height, 4)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // RGBA
    // 逐扫描线：滤波类型 0（None）
    const stride = width * 4
    const rawData = Buffer.alloc((stride + 1) * height)
    for (let y = 0; y < height; y++) {
        rawData[y * (stride + 1)] = 0
        rgba.copy(rawData, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', deflateSync(rawData)),
        chunk('IEND', Buffer.alloc(0))
    ])
}

// ---------- ICO 封装（单 256×256 条目，内嵌 PNG） ----------
const wrapIco = (png) => {
    const header = Buffer.alloc(22)
    header.writeUInt16LE(0, 0) // reserved
    header.writeUInt16LE(1, 2) // type: icon
    header.writeUInt16LE(1, 4) // count
    header[6] = 0 // width 256（0 表示 256）
    header[7] = 0 // height 256
    header[8] = 0 // palette
    header[9] = 0 // reserved
    header.writeUInt16LE(1, 10) // planes
    header.writeUInt16LE(32, 12) // bpp
    header.writeUInt32LE(png.length, 14) // size
    header.writeUInt32LE(22, 18) // offset
    return Buffer.concat([header, png])
}

// ---------- 主流程 ----------
const src = readFileSync(SRC)
const { width, height, channels, pixels } = decodePng(src)
if (channels === 3) {
    // RGB → RGBA（alpha 255）
    const rgba = Buffer.alloc(width * height * 4)
    for (let i = 0; i < width * height; i++) {
        rgba[i * 4] = pixels[i * 3]
        rgba[i * 4 + 1] = pixels[i * 3 + 1]
        rgba[i * 4 + 2] = pixels[i * 3 + 2]
        rgba[i * 4 + 3] = 255
    }
    const scaled = scalePixels(rgba, width, height, 4, TARGET_SIZE, TARGET_SIZE)
    const png = encodePng(TARGET_SIZE, TARGET_SIZE, scaled)
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, wrapIco(png))
} else {
    const scaled = scalePixels(pixels, width, height, channels, TARGET_SIZE, TARGET_SIZE)
    const png = encodePng(TARGET_SIZE, TARGET_SIZE, scaled)
    mkdirSync(dirname(OUT), { recursive: true })
    writeFileSync(OUT, wrapIco(png))
}
console.log(
    `已生成 ${OUT}（${TARGET_SIZE}×${TARGET_SIZE}，${src.length} → ${TARGET_SIZE * TARGET_SIZE * 4}px RGBA）`
)