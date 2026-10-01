// QR code encoder (ISO/IEC 18004), no dependencies. Runs in browsers and Node.
// Byte mode with UTF-8 text, error correction levels L/M/Q/H, and the smallest
// version (1-40) that fits.
//
//   qrMatrix('https://youtu.be/dQw4w9WgXcQ')  -> { size, modules }  (true = dark)
//   qrSVG('https://youtu.be/dQw4w9WgXcQ')     -> '<svg ...>...</svg>'

const MAX_VERSION = 40;

// The two format-info bits for each error correction level.
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

// Error correction codewords in each block, by level and version (index 0 unused).
const EC_CODEWORDS_PER_BLOCK = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};

// Number of error correction blocks, by level and version (index 0 unused).
const EC_BLOCKS = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

// The eight mask patterns; a module is flipped where the function returns true.
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r, c) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// ---- GF(256) and Reed-Solomon ------------------------------------------------

// Log/antilog tables for GF(256) with the QR polynomial x^8+x^4+x^3+x^2+1 (0x11D).
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
let gfValue = 1;
for (let i = 0; i < 255; i++) {
  GF_EXP[i] = gfValue;
  GF_LOG[gfValue] = i;
  gfValue <<= 1;
  if (gfValue & 0x100) gfValue ^= 0x11D;
}
for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

// Generator polynomial (x - a^0)(x - a^1)...(x - a^(degree-1)), highest power first.
const generatorCache = new Map();
function rsGenerator(degree) {
  if (generatorCache.has(degree)) return generatorCache.get(degree);
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i]);
    }
    poly = next;
  }
  generatorCache.set(degree, poly);
  return poly;
}

// Remainder of data(x) * x^degree divided by the generator: the EC codewords.
function rsRemainder(data, generator) {
  const degree = generator.length - 1;
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(generator[i + 1], factor);
  }
  return rem;
}

// ---- Capacity ------------------------------------------------------------------

function sizeOf(version) {
  return version * 4 + 17;
}

// Centre rows/columns of the alignment patterns: 6, then evenly spaced up to size-7.
function alignmentPositions(version) {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const last = sizeOf(version) - 7;
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count - 1) / 2) * 2;
  const positions = [6];
  for (let pos = last - step * (count - 2); pos <= last; pos += step) positions.push(pos);
  return positions;
}

// Modules left for data once the function patterns are drawn.
function dataModuleCount(version) {
  const size = sizeOf(version);
  let count = size * size;
  count -= 3 * 64;             // finder patterns with separators
  count -= 2 * (size - 16);    // timing patterns
  count -= 31;                 // two copies of format info, plus the dark module
  const n = alignmentPositions(version).length;
  if (n > 0) count -= 25 * (n * n - 3) - 10 * (n - 2);  // alignment patterns, minus overlap with timing
  if (version >= 7) count -= 36;                        // two copies of version info
  return count;
}

function totalCodewords(version) {
  return Math.floor(dataModuleCount(version) / 8);
}

function dataCodewords(version, ecc) {
  return totalCodewords(version) - EC_CODEWORDS_PER_BLOCK[ecc][version] * EC_BLOCKS[ecc][version];
}

function countBits(version) {
  return version <= 9 ? 8 : 16;
}

// Largest number of bytes that fit in this version at this level.
function byteCapacity(version, ecc) {
  return Math.floor((dataCodewords(version, ecc) * 8 - 4 - countBits(version)) / 8);
}

function chooseVersion(byteLength, ecc) {
  for (let version = 1; version <= MAX_VERSION; version++) {
    if (byteLength <= byteCapacity(version, ecc)) return version;
  }
  throw new Error(`QR: text is too long (${byteLength} bytes in UTF-8); ` +
    `the most that fits at error correction level ${ecc} is ${byteCapacity(MAX_VERSION, ecc)} bytes (version ${MAX_VERSION}).`);
}

// ---- Data codewords ----------------------------------------------------------------

function utf8Bytes(text) {
  return new TextEncoder().encode(text);
}

// Mode indicator, character count, data, terminator and padding, as bytes.
function encodeData(bytes, version, ecc) {
  const bits = [];
  const put = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  const capacity = dataCodewords(version, ecc) * 8;

  put(0b0100, 4);                              // byte mode
  put(bytes.length, countBits(version));
  for (const byte of bytes) put(byte, 8);
  put(0, Math.min(4, capacity - bits.length)); // terminator
  put(0, (8 - (bits.length % 8)) % 8);         // fill to a byte boundary

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  for (let pad = 0xEC; codewords.length < capacity / 8; pad ^= 0xEC ^ 0x11) codewords.push(pad);
  return codewords;
}

// Split into blocks, add EC codewords to each, then interleave as the spec requires.
function addErrorCorrection(data, version, ecc) {
  const blockCount = EC_BLOCKS[ecc][version];
  const ecLength = EC_CODEWORDS_PER_BLOCK[ecc][version];
  const total = totalCodewords(version);
  const longBlocks = total % blockCount;       // these carry one extra data codeword
  const shortLength = Math.floor(total / blockCount) - ecLength;
  const generator = rsGenerator(ecLength);

  const blocks = [];
  let offset = 0;
  for (let i = 0; i < blockCount; i++) {
    const length = shortLength + (i >= blockCount - longBlocks ? 1 : 0);
    const blockData = data.slice(offset, offset + length);
    offset += length;
    blocks.push({ data: blockData, ec: rsRemainder(blockData, generator) });
  }

  const result = [];
  for (let i = 0; i <= shortLength; i++) {
    for (const block of blocks) if (i < block.data.length) result.push(block.data[i]);
  }
  for (let i = 0; i < ecLength; i++) {
    for (const block of blocks) result.push(block.ec[i]);
  }
  return result;
}

// ---- Matrix ----------------------------------------------------------------------

function grid(size) {
  return Array.from({ length: size }, () => new Array(size).fill(false));
}

// Draws everything except the data; marks those modules as off-limits for data.
function drawFunctionPatterns(qr, version) {
  const { size } = qr;
  const set = (r, c, dark) => {
    qr.modules[r][c] = dark;
    qr.isFunction[r][c] = true;
  };

  // Timing patterns (the finders below overwrite the ends).
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // Finder patterns with their light separators.
  for (const [cr, cc] of [[3, 3], [3, size - 4], [size - 4, 3]]) {
    for (let dr = -4; dr <= 4; dr++) {
      for (let dc = -4; dc <= 4; dc++) {
        const r = cr + dr;
        const c = cc + dc;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const ring = Math.max(Math.abs(dr), Math.abs(dc));
        set(r, c, ring !== 2 && ring !== 4);
      }
    }
  }

  // Alignment patterns, skipping the three that would sit on finders.
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  positions.forEach((cr, i) => {
    positions.forEach((cc, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) set(cr + dr, cc + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
      }
    });
  });

  // Reserve the format-info areas (real bits are drawn per mask) and set the dark module.
  drawFormatInfo(qr, 'M', 0);
  set(size - 8, 8, true);

  if (version >= 7) drawVersionInfo(qr, version);
}

// Remainder of value * x^(degree) divided by a BCH generator polynomial.
function bchRemainder(value, generator, degree) {
  let rem = value << degree;
  for (let bit = 31 - Math.clz32(rem); bit >= degree; bit--) {
    if (rem & (1 << bit)) rem ^= generator << (bit - degree);
  }
  return rem;
}

// 15 bits: level and mask, BCH(15,5) check bits, XOR 0x5412. Two copies.
function drawFormatInfo(qr, ecc, mask) {
  const { size } = qr;
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  const bits = ((data << 10) | bchRemainder(data, 0x537, 10)) ^ 0x5412;
  const bit = i => ((bits >>> i) & 1) === 1;
  const set = (r, c, dark) => {
    qr.modules[r][c] = dark;
    qr.isFunction[r][c] = true;
  };

  // Around the top-left finder: down column 8, then left along row 8.
  for (let i = 0; i <= 5; i++) set(i, 8, bit(i));
  set(7, 8, bit(6));
  set(8, 8, bit(7));
  set(8, 7, bit(8));
  for (let i = 9; i < 15; i++) set(8, 14 - i, bit(i));

  // Split between the top-right and bottom-left finders.
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, bit(i));
}

// 18 bits: 6-bit version and BCH(18,6) check bits. Two 6x3 copies.
function drawVersionInfo(qr, version) {
  const { size } = qr;
  const bits = (version << 12) | bchRemainder(version, 0x1F25, 12);
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    qr.modules[b][a] = dark;          // top right
    qr.modules[a][b] = dark;          // bottom left
    qr.isFunction[b][a] = true;
    qr.isFunction[a][b] = true;
  }
}

// Place codeword bits in the two-column zigzag, from the bottom-right corner up.
function placeData(qr, codewords) {
  const { size } = qr;
  const totalBits = codewords.length * 8;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;                // skip the vertical timing column
    const upward = ((right + 1) & 2) === 0;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let k = 0; k < 2; k++) {
        const c = right - k;
        if (qr.isFunction[r][c]) continue;
        // Leftover remainder bits stay light (0).
        qr.modules[r][c] = i < totalBits && ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
        i++;
      }
    }
  }
}

function applyMask(qr, mask) {
  const test = MASKS[mask];
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (!qr.isFunction[r][c] && test(r, c)) qr.modules[r][c] = !qr.modules[r][c];
    }
  }
}

// ---- Mask penalty (the four standard rules) ---------------------------------------

const FINDER_LIKE = [true, false, true, true, true, false, true];

// Rules 1 and 3 for a single row or column.
function linePenalty(line) {
  let score = 0;

  // Rule 1: a run of 5 or more same-colored modules scores 3, plus 1 per extra module.
  let run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      run++;
      continue;
    }
    if (run >= 5) score += run - 2;
    run = 1;
  }

  // Rule 3: 1:1:3:1:1 finder-like pattern with 4 light modules on a side scores 40
  // per side. Modules past the edge count as light.
  const lightFrom = start => {
    for (let i = start; i < start + 4; i++) if (line[i]) return false;
    return true;
  };
  for (let i = 0; i + 7 <= line.length; i++) {
    if (!FINDER_LIKE.every((dark, k) => line[i + k] === dark)) continue;
    if (lightFrom(i - 4)) score += 40;
    if (lightFrom(i + 7)) score += 40;
  }
  return score;
}

function penalty(modules) {
  const size = modules.length;
  let score = 0;

  for (let i = 0; i < size; i++) {
    score += linePenalty(modules[i]);
    score += linePenalty(modules.map(row => row[i]));
  }

  // Rule 2: every 2x2 block of one color scores 3.
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const dark = modules[r][c];
      if (dark === modules[r][c + 1] && dark === modules[r + 1][c] && dark === modules[r + 1][c + 1]) score += 3;
    }
  }

  // Rule 4: 10 points for each full 5% the dark share is away from 50%.
  let darkCount = 0;
  for (const row of modules) for (const dark of row) if (dark) darkCount++;
  const total = size * size;
  score += 10 * Math.floor(Math.abs(darkCount * 20 - total * 10) / total);
  return score;
}

// ---- Public API ------------------------------------------------------------------

export function qrMatrix(text, { ecc = 'M' } = {}) {
  const level = String(ecc).toUpperCase();
  if (!(level in ECC_FORMAT_BITS)) throw new Error(`QR: unknown error correction level "${ecc}" (use L, M, Q or H).`);

  const bytes = utf8Bytes(String(text));
  const version = chooseVersion(bytes.length, level);
  const size = sizeOf(version);
  const codewords = addErrorCorrection(encodeData(bytes, version, level), version, level);

  const qr = { size, modules: grid(size), isFunction: grid(size) };
  drawFunctionPatterns(qr, version);
  placeData(qr, codewords);

  // Try all eight masks and keep the one with the lowest penalty.
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = { size, modules: qr.modules.map(row => row.slice()), isFunction: qr.isFunction };
    applyMask(candidate, mask);
    drawFormatInfo(candidate, level, mask);
    const score = penalty(candidate.modules);
    if (best === null || score < best.score) best = { score, modules: candidate.modules };
  }
  return { size, modules: best.modules };
}

function escapeAttr(value) {
  return String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
}

export function qrSVG(text, { ecc = 'M', margin = 4, dark = '#000', light = '#fff' } = {}) {
  const { size, modules } = qrMatrix(text, { ecc });
  const pad = Math.max(0, Math.floor(Number(margin) || 0));
  const full = size + pad * 2;

  // One rectangle per horizontal run of dark modules, all in a single path.
  let d = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      let run = 1;
      while (c + run < size && modules[r][c + run]) run++;
      d += `M${c + pad} ${r + pad}h${run}v1h-${run}z`;
      c += run - 1;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges">` +
    `<rect width="${full}" height="${full}" fill="${escapeAttr(light)}"/>` +
    `<path fill="${escapeAttr(dark)}" d="${d}"/></svg>`;
}
