// canvas.toDataURL('image/png') nikdy nezapise DPI/hustotu do samotneho PNG suboru (ziadny pHYs
// chunk) — pixelove rozmery su spravne, ale ked subor otvoris v Photoshope/GIMPe alebo ho posles
// na tlac "v skutocnej velkosti", program bez tohto udaju predpoklada 72 (niekedy 96) DPI a
// vytlaci/zobrazi motiv v uplne inej fyzickej velkosti, nez na aku bol raster (LPI) navrhnuty.
// Tato funkcia po vygenerovani PNG rucne vlozi standardny pHYs chunk (fyzicke rozmery pixelu,
// PNG ich uklada v pixeloch na meter) hned za IHDR — presne tam, kde ho PNG specifikacia caka.
export function setPngDpi(dataUrl, dpi) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const pxPerMeter = Math.round(dpi / 0.0254);
  const data = new Uint8Array(9);
  writeUint32BE(data, 0, pxPerMeter); // pixels per unit, X axis
  writeUint32BE(data, 4, pxPerMeter); // pixels per unit, Y axis
  data[8] = 1; // unit specifier: 1 = meter

  const type = new Uint8Array([0x70, 0x48, 0x59, 0x73]); // 'pHYs'
  const typeAndData = new Uint8Array(type.length + data.length);
  typeAndData.set(type, 0);
  typeAndData.set(data, type.length);
  const crc = crc32(typeAndData);

  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  writeUint32BE(chunk, 0, data.length);
  chunk.set(typeAndData, 4);
  writeUint32BE(chunk, 4 + typeAndData.length, crc);

  // IHDR je vzdy hned po 8-bajtovej signature a je presne 13 bajtov dat (8+8+13+4=33) — pHYs
  // musi prist AZ PO IHDR, ale PRED prvym IDAT, co tento pevny offset vzdy splna.
  const IHDR_END = 33;
  const out = new Uint8Array(bytes.length + chunk.length);
  out.set(bytes.subarray(0, IHDR_END), 0);
  out.set(chunk, IHDR_END);
  out.set(bytes.subarray(IHDR_END), IHDR_END + chunk.length);

  let outBinary = '';
  for (let i = 0; i < out.length; i++) outBinary += String.fromCharCode(out[i]);
  return 'data:image/png;base64,' + btoa(outBinary);
}

function writeUint32BE(arr, offset, value) {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

// Standardny CRC-32 (PNG specifikacia) — tabulkovy vypocet, tabulka sa spocita raz pri prvom pouziti.
let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
