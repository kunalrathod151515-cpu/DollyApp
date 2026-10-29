import fs from 'fs';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // CRC32 table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ -1) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(2, 9); // truecolor (RGB)
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Raw Image Data (Filter byte 0 + RGB per pixel)
  const rowLen = 1 + width * 3;
  const rawData = Buffer.alloc(rowLen * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // No filter

    // Draw dark rounded frame with orange center
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 3;
      const isMargin = x < width * 0.1 || x > width * 0.9 || y < height * 0.1 || y > height * 0.9;
      if (isMargin) {
        rawData[pxOffset] = 15; // #0f172a
        rawData[pxOffset + 1] = 23;
        rawData[pxOffset + 2] = 42;
      } else {
        // Gradient orange
        rawData[pxOffset] = 255; // #ff5722
        rawData[pxOffset + 1] = 87;
        rawData[pxOffset + 2] = 34;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, chunk('IHDR', ihdr), idatChunk, iendChunk]);
}

// Generate PNG icons
fs.writeFileSync('public/pwa-192x192.png', createPNG(192, 192, 255, 87, 34));
fs.writeFileSync('public/pwa-512x512.png', createPNG(512, 512, 255, 87, 34));
fs.writeFileSync('public/pwa-maskable-512x512.png', createPNG(512, 512, 255, 87, 34));
fs.writeFileSync('public/apple-touch-icon.png', createPNG(180, 180, 255, 87, 34));

console.log('✅ Generated PWA icons in /public');
