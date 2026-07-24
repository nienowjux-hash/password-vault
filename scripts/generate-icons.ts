import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Gera um PNG RGBA sólido de w x h com um "L" simples desenhado (representando o cadeado/senha). */
function solidPng(w: number, h: number, bg: [number, number, number, number], fg: [number, number, number, number]): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const rowStart = y * (w * 4 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.32;
      const dist = Math.hypot(x - cx, y - cy + h * 0.05);
      const inShackle = dist < r && dist > r * 0.55 && y < cy;
      const inBody = x > w * 0.22 && x < w * 0.78 && y > h * 0.42 && y < h * 0.86;
      const isFg = inShackle || inBody;
      const [rr, gg, bb, aa] = isFg ? fg : bg;
      const off = rowStart + 1 + x * 4;
      raw[off] = rr;
      raw[off + 1] = gg;
      raw[off + 2] = bb;
      raw[off + 3] = aa;
    }
  }

  const idat = chunk('IDAT', deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdr, idat, iend]);
}

function icoFromPng(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

const outDir = join(__dirname, '..', 'resources');
mkdirSync(outDir, { recursive: true });

const transparent: [number, number, number, number] = [0, 0, 0, 0];
const accent: [number, number, number, number] = [91, 141, 239, 255];

writeFileSync(join(outDir, 'tray-icon.png'), solidPng(32, 32, transparent, accent));

const icon256 = solidPng(256, 256, transparent, accent);
writeFileSync(join(outDir, 'icon.png'), icon256);
writeFileSync(join(outDir, 'icon.ico'), icoFromPng(icon256, 256));

console.log('Ícones gerados em', outDir);
