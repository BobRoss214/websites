// Tests for app/js/qr.js, the QR code encoder.
//   JSQR_DIR=/folder/with/node_modules/jsqr node tests/qr.test.mjs
//
// Each case is encoded with qrMatrix, drawn into an RGBA image and decoded by the
// jsQR library, which must give back the exact input. Each matrix is also read back
// module by module by an independent checker below (fixed patterns, format and
// version info, Reed-Solomon syndromes, padding, minimal version, mask choice), and
// qrSVG output is parsed and compared with the matrix.
// Optional: SEED=<number> changes the random strings.

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { qrMatrix, qrSVG } from '../app/js/qr.js';

// jsQR 1.4.0 lists version 23's alignment centres as 6,30,54,74,102; the spec
// (ISO/IEC 18004 Annex E) says 6,30,54,78,102. That typo makes it misread every
// version 23 code (level L has too little redundancy to hide it), so if the
// typo is present we load a copy with that one entry corrected.
const JSQR_V23_TYPO = '[6, 30, 54, 74, 102]';
let jsqrPatched = false;

const DEFAULT_JSQR_DIR = '/tmp/claude-0/-home-user-websites/151c12e6-958e-5f3e-bc40-00ce024b4ed1/scratchpad/qrtest';
const jsQR = loadJsQR(process.env.JSQR_DIR || DEFAULT_JSQR_DIR);
if (!jsQR) {
  console.log('jsqr not installed, skipping');
  process.exit(0);
}

function loadJsQR(dir) {
  const require = createRequire(path.join(path.resolve(dir), 'index.js'));
  for (const id of ['jsqr', path.resolve(dir)]) {
    let file;
    try {
      file = require.resolve(id);
    } catch {
      continue;
    }
    const source = fs.readFileSync(file, 'utf8');
    if (!source.includes(JSQR_V23_TYPO)) {
      const mod = require(file);
      return mod.default || mod;
    }
    const module = { exports: {} };
    new Function('module', 'exports', source.replace(JSQR_V23_TYPO, '[6, 30, 54, 78, 102]'))(module, module.exports);
    jsqrPatched = true;
    return module.exports.default || module.exports;
  }
  return null;
}

const LEVELS = ['L', 'M', 'Q', 'H'];

// ---- Spec tables, typed in separately from the encoder -----------------------------

// Byte-mode capacity (ISO/IEC 18004 Table 7), [L, M, Q, H] for versions 1-40.
const CAPACITY = [null,
  [17, 14, 11, 7], [32, 26, 20, 14], [53, 42, 32, 24], [78, 62, 46, 34], [106, 84, 60, 44],
  [134, 106, 74, 58], [154, 122, 86, 64], [192, 152, 108, 84], [230, 180, 130, 98], [271, 213, 151, 119],
  [321, 251, 177, 137], [367, 287, 203, 155], [425, 331, 241, 177], [458, 362, 258, 194], [520, 412, 292, 220],
  [586, 450, 322, 250], [644, 504, 364, 280], [718, 560, 394, 310], [792, 624, 442, 338], [858, 666, 482, 382],
  [929, 711, 509, 403], [1003, 779, 565, 439], [1091, 857, 611, 461], [1171, 911, 661, 511], [1273, 997, 715, 535],
  [1367, 1059, 751, 593], [1465, 1125, 805, 625], [1528, 1190, 868, 658], [1628, 1264, 908, 698], [1732, 1370, 982, 742],
  [1840, 1452, 1030, 790], [1952, 1538, 1112, 842], [2068, 1628, 1168, 898], [2188, 1722, 1228, 958], [2303, 1809, 1283, 983],
  [2431, 1911, 1351, 1051], [2563, 1989, 1423, 1093], [2699, 2099, 1499, 1139], [2809, 2213, 1579, 1219], [2953, 2331, 1663, 1273],
];

// Number of error correction blocks (ISO/IEC 18004 Table 9), [L, M, Q, H].
const BLOCKS = [null,
  [1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 2, 2], [1, 2, 2, 4], [1, 2, 4, 4],
  [2, 4, 4, 4], [2, 4, 6, 5], [2, 4, 6, 6], [2, 5, 8, 8], [4, 5, 8, 8],
  [4, 5, 8, 11], [4, 8, 10, 11], [4, 9, 12, 16], [4, 9, 16, 16], [6, 10, 12, 18],
  [6, 10, 17, 16], [6, 11, 16, 19], [6, 13, 18, 21], [7, 14, 21, 25], [8, 16, 20, 25],
  [8, 17, 23, 25], [9, 17, 23, 34], [9, 18, 25, 30], [10, 20, 27, 32], [12, 21, 29, 35],
  [12, 23, 34, 37], [12, 25, 34, 40], [13, 26, 35, 42], [14, 28, 38, 45], [15, 29, 40, 48],
  [16, 31, 43, 51], [17, 33, 45, 54], [18, 35, 48, 57], [19, 37, 51, 60], [19, 38, 53, 63],
  [20, 40, 56, 66], [21, 43, 59, 70], [22, 45, 62, 74], [24, 47, 65, 77], [25, 49, 68, 81],
];

// Alignment pattern centres (ISO/IEC 18004 Annex E).
const ALIGNMENT = [null, [],
  [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
  [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
  [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
  [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

const FORMAT_LEVEL = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' };
const MASK_TESTS = [
  (i, j) => (i + j) % 2 === 0,
  (i, j) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

// ---- Test strings ----------------------------------------------------------------

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SEED = Number(process.env.SEED) || 20261001;
const rand = mulberry32(SEED);
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = list => list[int(0, list.length - 1)];
const randomFrom = (chars, n) => Array.from({ length: n }, () => pick(chars)).join('');

const PRINTABLE = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
const ID_CHARS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'];
const ytId = () => randomFrom(ID_CHARS, 11);

function randomUrl() {
  const id = ytId();
  return pick([
    () => `https://youtu.be/${id}`,
    () => `https://youtu.be/${id}?t=${int(1, 9999)}`,
    () => `https://youtu.be/${id}?si=${randomFrom(ID_CHARS, 16)}`,
    () => `https://www.youtube.com/watch?v=${id}`,
    () => `https://www.youtube.com/watch?v=${id}&t=${int(0, 9999)}s`,
    () => `https://www.youtube.com/watch?v=${id}&list=PL${randomFrom(ID_CHARS, 32)}&index=${int(1, 200)}`,
    () => `https://m.youtube.com/watch?v=${id}&feature=share`,
    () => `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&start=${int(0, 600)}`,
    () => `https://www.youtube.com/playlist?list=PL${randomFrom(ID_CHARS, 32)}`,
    () => `https://www.youtube.com/@${randomFrom(ID_CHARS, int(3, 20))}/videos`,
    () => `https://www.youtube.com/results?search_query=${encodeURIComponent(randomFrom(PRINTABLE, int(1, 30)))}`,
    () => `http://192.168.${int(0, 255)}.${int(1, 254)}:${int(1024, 65535)}/remote.html#pin=${int(1000, 9999)}`,
  ])();
}

const WORDS = [
  'café', 'naïve', 'résumé', 'façade', 'jalapeño', 'Ångström', 'Zürich', 'smørrebrød', 'crème brûlée', 'São Paulo',
  'Łódź', 'Dvořák', 'İstanbul', 'ß', 'œuvre', 'Ελληνικά', 'Русский', 'українська', 'עברית', 'العربية',
  'हिन्दी', 'ไทย', '日本語', 'テレビ', '中文频道', '한국어', 'é', '½', '€100', '“quotes”', '— dash …',
  '😀', '📺', '🎬', '🍿', '👍🏽', '🇺🇸', '🇯🇵', '👨‍👩‍👧‍👦', '🏳️‍🌈', '❤️', '✓', '♫', '𝄞', '🧑‍💻',
  'TV', 'channel', 'surf', 'plus', 'remote', '42',
];
function randomUtf8() {
  const target = int(1, 60);
  let s = pick(WORDS);
  while ([...s].length < target) s += pick([' ', '', ', ', ' - ']) + pick(WORDS);
  return s;
}

const strings = [
  'https://youtu.be/dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123s',
  'é', '😀', 'naïve café 📺', '日本語のテキスト', '👨‍👩‍👧‍👦', 'Ünïcödé — “quotes” …',
];
while (strings.length < 300) {
  const n = strings.length;
  if (n < 150) strings.push(randomFrom(PRINTABLE, int(1, 150)));
  else if (n < 225) strings.push(randomUrl());
  else strings.push(randomUtf8());
}

// ---- Independent reader -------------------------------------------------------------

function grid(size, value) {
  return Array.from({ length: size }, () => new Array(size).fill(value));
}

// Remainder of a binary polynomial divided by gen (both as integers).
function polyMod(value, gen) {
  const genBits = 32 - Math.clz32(gen);
  for (let bit = 31 - Math.clz32(value); bit >= genBits - 1; bit--) {
    if (value & (1 << bit)) value ^= gen << (bit - genBits + 1);
  }
  return value;
}

// GF(256), mod x^8+x^4+x^3+x^2+1, multiplying the slow way (no tables).
function gfMul(a, b) {
  let p = 0;
  while (b) {
    if (b & 1) p ^= a;
    a <<= 1;
    if (a & 0x100) a ^= 0x11D;
    b >>= 1;
  }
  return p;
}
function gfPow2(n) {
  let x = 1;
  for (let i = 0; i < n; i++) x = gfMul(x, 2);
  return x;
}

function functionModules(version) {
  const size = 17 + 4 * version;
  const fn = grid(size, false);
  const mark = (r, c) => { fn[r][c] = true; };
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) { mark(r, c); mark(r, size - 1 - c); mark(size - 1 - r, c); }
  }
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  for (const r of ALIGNMENT[version]) {
    for (const c of ALIGNMENT[version]) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) mark(r + dr, c + dc);
    }
  }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(8, size - 1 - i); mark(size - 1 - i, 8); }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { mark(i, size - 11 + j); mark(size - 11 + j, i); }
  }
  return fn;
}

// Expected colors of the fixed patterns; null where something else lives.
function checkFixedPatterns(m, version) {
  const size = m.length;
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r, cc = c0 + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = inside ? Math.max(Math.abs(r - 3), Math.abs(c - 3)) : 4;
        if (m[rr][cc] !== (ring !== 2 && ring !== 4)) return `finder at ${r0},${c0} wrong at ${rr},${cc}`;
      }
    }
    return null;
  };
  const errors = [finder(0, 0), finder(0, size - 7), finder(size - 7, 0)];
  for (let i = 8; i < size - 8; i++) {
    if (m[6][i] !== (i % 2 === 0) || m[i][6] !== (i % 2 === 0)) errors.push(`timing wrong at ${i}`);
  }
  for (const r of ALIGNMENT[version]) {
    for (const c of ALIGNMENT[version]) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (m[r + dr][c + dc] !== (Math.max(Math.abs(dr), Math.abs(dc)) !== 1)) errors.push(`alignment ${r},${c}`);
        }
      }
    }
  }
  if (!m[size - 8][8]) errors.push('dark module missing');
  return errors.filter(Boolean)[0] || null;
}

// Format info, MSB first, for both copies.
function readFormat(m) {
  const s = m.length;
  const copy1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const copy2 = [];
  for (let i = 1; i <= 7; i++) copy2.push([s - i, 8]);
  for (let i = 8; i >= 1; i--) copy2.push([8, s - i]);
  const read = cells => cells.reduce((v, [r, c]) => (v << 1) | (m[r][c] ? 1 : 0), 0);
  return [read(copy1), read(copy2)];
}
function formatWord(level, mask) {
  const data = ({ L: 1, M: 0, Q: 3, H: 2 }[level] << 3) | mask;
  return ((data << 10) | polyMod(data << 10, 0x537)) ^ 0x5412;
}

function readVersion(m) {
  const s = m.length;
  let bottomLeft = 0, topRight = 0;
  for (let i = 17; i >= 0; i--) {
    const a = s - 11 + (i % 3), b = Math.floor(i / 3);
    bottomLeft = (bottomLeft << 1) | (m[a][b] ? 1 : 0);
    topRight = (topRight << 1) | (m[b][a] ? 1 : 0);
  }
  return [bottomLeft, topRight];
}

// Reads the bits in placement order (two-column zigzag, bottom-right first).
function readBits(m, fn, maskTest) {
  const size = m.length;
  const bits = [];
  // Column pairs from the right; direction flips after each pair.
  let up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let k = 0; k < size; k++) {
      const r = up ? size - 1 - k : k;
      for (const c of [right, right - 1]) {
        if (!fn[r][c]) bits.push(m[r][c] !== maskTest(r, c) ? 1 : 0);
      }
    }
    up = !up;
  }
  return bits;
}

// Runs every structural check; returns a list of problems (empty when all is well).
function inspect(text, level, size, modules) {
  const problems = [];
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 40) return [`bad size ${size}`];
  if (modules.length !== size || modules.some(row => row.length !== size || row.some(v => typeof v !== 'boolean'))) {
    return ['modules is not a size x size boolean grid'];
  }

  const fixed = checkFixedPatterns(modules, version);
  if (fixed) problems.push(fixed);

  // Format info: both copies equal and valid, with the requested level.
  const [f1, f2] = readFormat(modules);
  if (f1 !== f2) problems.push('format copies differ');
  const fdata = (f1 ^ 0x5412) >> 10;
  const mask = fdata & 7;
  if (formatWord(FORMAT_LEVEL[fdata >> 3], mask) !== f1) problems.push('format info BCH invalid');
  if (FORMAT_LEVEL[fdata >> 3] !== level) problems.push(`format says level ${FORMAT_LEVEL[fdata >> 3]}`);

  // Version info for 7 and up.
  if (version >= 7) {
    const [v1, v2] = readVersion(modules);
    if (v1 !== v2) problems.push('version copies differ');
    if (v1 >> 12 !== version) problems.push(`version info says ${v1 >> 12}`);
    if (polyMod(v1, 0x1F25) !== 0) problems.push('version info BCH invalid');
  }

  // Codewords, de-interleaved into blocks.
  const fn = functionModules(version);
  const bits = readBits(modules, fn, MASK_TESTS[mask]);
  const total = Math.floor(bits.length / 8);
  if (bits.slice(total * 8).some(b => b)) problems.push('remainder bits not zero');
  const codewords = [];
  for (let i = 0; i < total; i++) codewords.push(parseInt(bits.slice(i * 8, i * 8 + 8).join(''), 2));

  const li = LEVELS.indexOf(level);
  const dataCount = CAPACITY[version][li] + (version <= 9 ? 2 : 3);
  const blockCount = BLOCKS[version][li];
  const ecLen = (total - dataCount) / blockCount;
  if (!Number.isInteger(ecLen)) return problems.concat(`EC length not whole: ${ecLen}`);
  const longBlocks = total % blockCount;
  const shortData = Math.floor(total / blockCount) - ecLen;
  const blocks = Array.from({ length: blockCount }, (_, b) => ({
    data: [], ec: [], dataLen: shortData + (b >= blockCount - longBlocks ? 1 : 0),
  }));
  let k = 0;
  for (let i = 0; i <= shortData; i++) for (const b of blocks) if (i < b.dataLen) b.data.push(codewords[k++]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) b.ec.push(codewords[k++]);

  // Every Reed-Solomon syndrome must be zero: no errors at all.
  const alphas = Array.from({ length: ecLen }, (_, i) => gfPow2(i));
  blocks.forEach((b, bi) => {
    const word = b.data.concat(b.ec);
    for (const alpha of alphas) {
      let s = 0;
      for (const cw of word) s = gfMul(s, alpha) ^ cw;
      if (s !== 0) { problems.push(`block ${bi} syndrome non-zero`); break; }
    }
  });

  // Data stream: byte mode, count, bytes, terminator, zero fill, EC/11 padding.
  const data = blocks.flatMap(b => b.data);
  const stream = data.flatMap(byte => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1));
  let pos = 0;
  const take = n => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | (stream[pos++] ?? 0); return v; };
  if (take(4) !== 0b0100) problems.push('not byte mode');
  const count = take(version <= 9 ? 8 : 16);
  const bytes = [];
  for (let i = 0; i < count; i++) bytes.push(take(8));
  const expected = [...new TextEncoder().encode(text)];
  if (bytes.length !== expected.length || bytes.some((b, i) => b !== expected[i])) problems.push('data bytes differ');
  const terminator = Math.min(4, stream.length - pos);
  if (take(terminator) !== 0) problems.push('terminator not zero');
  while (pos % 8) if (take(1) !== 0) problems.push('fill bits not zero');
  for (let pad = 0xEC; pos < stream.length; pad ^= 0xEC ^ 0x11) {
    if (take(8) !== pad) { problems.push('pad bytes wrong'); break; }
  }

  // Smallest version that fits.
  if (expected.length > CAPACITY[version][li]) problems.push('data exceeds capacity');
  if (version > 1 && expected.length <= CAPACITY[version - 1][li]) problems.push('a smaller version would fit');

  // The chosen mask must have the lowest penalty of all eight.
  const scores = MASK_TESTS.map((test, other) => {
    const alt = modules.map(row => row.slice());
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) if (!fn[r][c] && MASK_TESTS[mask](r, c) !== test(r, c)) alt[r][c] = !alt[r][c];
    }
    writeFormat(alt, formatWord(level, other));
    return penalty(alt);
  });
  if (scores[mask] > Math.min(...scores)) problems.push(`mask ${mask} scores ${scores[mask]}, best is ${Math.min(...scores)}`);

  return problems.length ? problems : { version, mask };
}

function writeFormat(m, word) {
  const s = m.length;
  const copy1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const copy2 = [];
  for (let i = 1; i <= 7; i++) copy2.push([s - i, 8]);
  for (let i = 8; i >= 1; i--) copy2.push([8, s - i]);
  for (const cells of [copy1, copy2]) cells.forEach(([r, c], i) => { m[r][c] = ((word >> (14 - i)) & 1) === 1; });
}

// Standard penalty, written with strings and regexes (quiet zone counts as light).
function penalty(m) {
  const size = m.length;
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(m[i].map(v => (v ? '1' : '0')).join(''));
    lines.push(m.map(row => (row[i] ? '1' : '0')).join(''));
  }
  let score = 0;
  for (const line of lines) {
    for (const run of line.match(/0{5,}|1{5,}/g) || []) score += 3 + run.length - 5;
    const padded = '0000' + line + '0000';
    score += 40 * ((padded.match(/(?=00001011101)/g) || []).length + (padded.match(/(?=10111010000)/g) || []).length);
  }
  for (let r = 0; r + 1 < size; r++) {
    for (let c = 0; c + 1 < size; c++) {
      const v = m[r][c];
      if (m[r][c + 1] === v && m[r + 1][c] === v && m[r + 1][c + 1] === v) score += 3;
    }
  }
  const dark = m.flat().filter(Boolean).length;
  score += 10 * Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size));
  return score;
}

// ---- Image + jsQR ----------------------------------------------------------------

function rasterize({ size, modules }, scale = 4, margin = 4) {
  const width = (size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!modules[r][c]) continue;
      for (let y = 0; y < scale; y++) {
        const row = ((r + margin) * scale + y) * width;
        for (let x = 0; x < scale; x++) {
          const p = (row + (c + margin) * scale + x) * 4;
          pixels[p] = pixels[p + 1] = pixels[p + 2] = 0;
        }
      }
    }
  }
  return { pixels, width };
}

function decode(matrix) {
  const { pixels, width } = rasterize(matrix);
  return jsQR(pixels, width, width, { inversionAttempts: 'dontInvert' });
}

// ---- SVG check -------------------------------------------------------------------

function checkSVG(svg, { size, modules }, margin, dark = '#000', light = '#fff') {
  const full = size + margin * 2;
  const m = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d+) (\d+)" shape-rendering="crispEdges"><rect width="(\d+)" height="(\d+)" fill="([^"]*)"\/><path fill="([^"]*)" d="([^"]*)"\/><\/svg>$/.exec(svg);
  if (!m) return 'SVG does not match the expected shape';
  if (+m[1] !== full || +m[2] !== full || +m[3] !== full || +m[4] !== full) return 'SVG viewBox/rect size wrong';
  if (m[5] !== light || m[6] !== dark) return 'SVG colors wrong';
  if ((svg.match(/<path/g) || []).length !== 1) return 'SVG needs exactly one path';
  const commands = [...m[7].matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
  if (commands.length === 0) return 'SVG path has no commands';
  if (commands.map(c => c[0]).join('') !== m[7]) return 'SVG path has unexpected text';
  const drawn = grid(size, false);
  for (const [, x, y, w, back] of commands) {
    if (w !== back) return 'SVG path rectangle not closed';
    for (let i = 0; i < +w; i++) {
      const r = +y - margin, c = +x - margin + i;
      if (r < 0 || c < 0 || r >= size || c >= size || drawn[r][c]) return 'SVG rectangle out of place';
      drawn[r][c] = true;
    }
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (drawn[r][c] !== modules[r][c]) return `SVG differs at ${r},${c}`;
  return null;
}

// ---- Run -------------------------------------------------------------------------

let passed = 0, failed = 0;
const failures = [];
const versionsByLevel = Object.fromEntries(LEVELS.map(l => [l, new Map()]));
const masksUsed = new Array(8).fill(0);
const show = s => JSON.stringify(s.length > 60 ? s.slice(0, 57) + '...' : s);

function runCase(group, text, level, expectVersion) {
  const problems = [];
  let matrix;
  try {
    matrix = qrMatrix(text, { ecc: level });
  } catch (e) {
    problems.push('threw: ' + e.message);
  }
  if (matrix) {
    const result = inspect(text, level, matrix.size, matrix.modules);
    if (Array.isArray(result)) problems.push(...result);
    else {
      if (group in groupCounts) {
        versionsByLevel[level].set(result.version, (versionsByLevel[level].get(result.version) || 0) + 1);
      }
      masksUsed[result.mask]++;
      if (expectVersion && result.version !== expectVersion) problems.push(`version ${result.version}, expected ${expectVersion}`);
    }
    const found = decode(matrix);
    const bytes = [...new TextEncoder().encode(text)];
    if (!found) problems.push('jsQR could not decode');
    else {
      if (found.data !== text) problems.push(`jsQR decoded ${show(found.data)}`);
      if (found.binaryData.length !== bytes.length || found.binaryData.some((b, i) => b !== bytes[i])) problems.push('jsQR bytes differ');
      if (found.version !== (matrix.size - 17) / 4) problems.push(`jsQR saw version ${found.version}`);
    }
    const svgProblem = checkSVG(qrSVG(text, { ecc: level }), matrix, 4);
    if (svgProblem) problems.push(svgProblem);
  }
  if (problems.length) {
    failed++;
    failures.push(`${group} ${level} ${show(text)}: ${problems.join('; ')}`);
  } else {
    passed++;
  }
  return problems.length === 0;
}

function check(name, ok, detail = '') {
  if (ok) passed++;
  else { failed++; failures.push(`${name}${detail ? ': ' + detail : ''}`); }
}

const started = Date.now();
const groupCounts = { ascii: 0, url: 0, utf8: 0 };

// 1. The 300 strings at every level.
strings.forEach((text, i) => {
  const group = i < 8 ? (i < 2 ? 'url' : 'utf8') : i < 150 ? 'ascii' : i < 225 ? 'url' : 'utf8';
  groupCounts[group]++;
  for (const level of LEVELS) runCase(group, text, level);
});
const mainPassed = passed, mainFailed = failed;

// 2. Every version and level at exactly full capacity (one byte more must move up).
const sweepStart = passed + failed, sweepFailedBefore = failed;
for (let version = 1; version <= 40; version++) {
  LEVELS.forEach((level, li) => {
    const cap = CAPACITY[version][li];
    const text = randomFrom(PRINTABLE, cap);
    runCase('capacity', text, level, version);
    if (version < 40) {
      const bigger = qrMatrix(text + 'x', { ecc: level });
      check(`capacity+1 v${version} ${level}`, bigger.size === 17 + 4 * (version + 1), `size ${bigger.size}`);
    }
  });
}

const sweepCount = passed + failed - sweepStart, sweepFailed = failed - sweepFailedBefore;

// 3. Errors, options and edge cases.
for (const [level, li] of LEVELS.map((l, i) => [l, i])) {
  const max = CAPACITY[40][li];
  let error = null;
  try { qrMatrix('a'.repeat(max + 1), { ecc: level }); } catch (e) { error = e; }
  check(`too long at ${level} throws`, error instanceof Error && /too long/.test(error.message), String(error && error.message));
}
{
  let error = null;
  try { qrMatrix('😀'.repeat(800), { ecc: 'H' }); } catch (e) { error = e; }
  check('long emoji text throws', error instanceof Error && /3200 bytes/.test(error.message), String(error && error.message));
  error = null;
  try { qrMatrix('hi', { ecc: 'X' }); } catch (e) { error = e; }
  check('unknown level throws', error instanceof Error && /level/.test(error.message), String(error && error.message));
}
check('default level is M', JSON.stringify(qrMatrix('hello')) === JSON.stringify(qrMatrix('hello', { ecc: 'M' })));
check('lowercase level accepted', JSON.stringify(qrMatrix('hello', { ecc: 'q' })) === JSON.stringify(qrMatrix('hello', { ecc: 'Q' })));
check('same input, same output', JSON.stringify(qrMatrix(strings[0])) === JSON.stringify(qrMatrix(strings[0])));
check('empty text encodes', runCase('edge', '', 'M'));
// 28 bytes: fits version 2 at L (32), needs version 3 at M (version 2 holds 26).
check('short URL is version 2 at L', qrMatrix('https://youtu.be/dQw4w9WgXcQ', { ecc: 'L' }).size === 25);
check('short URL is version 3 at M', qrMatrix('https://youtu.be/dQw4w9WgXcQ').size === 29);
{
  const matrix = qrMatrix('https://youtu.be/dQw4w9WgXcQ', { ecc: 'L' });
  const plain = qrSVG('https://youtu.be/dQw4w9WgXcQ', { ecc: 'L', margin: 0 });
  check('SVG with margin 0', checkSVG(plain, matrix, 0) === null, checkSVG(plain, matrix, 0));
  const colored = qrSVG('https://youtu.be/dQw4w9WgXcQ', { ecc: 'L', margin: 2, dark: '#123456', light: 'transparent' });
  check('SVG custom colors', checkSVG(colored, matrix, 2, '#123456', 'transparent') === null, checkSVG(colored, matrix, 2, '#123456', 'transparent'));
  const hostile = qrSVG('x', { dark: '"><script>', light: 'a&b' });
  check('SVG escapes attributes', !hostile.includes('<script>') && hostile.includes('&quot;&gt;&lt;script&gt;') && hostile.includes('a&amp;b'));
  check('SVG default output', qrSVG('x').startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29" shape-rendering="crispEdges">'));
}

// 4. Negative control: the checker must notice one flipped data module, and jsQR
// must still read the code thanks to error correction.
{
  const text = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=123s';
  const matrix = qrMatrix(text, { ecc: 'H' });
  const fn = functionModules((matrix.size - 17) / 4);
  const r = matrix.size - 1, c = matrix.size - 1;
  check('bottom-right module holds data', !fn[r][c]);
  matrix.modules[r][c] = !matrix.modules[r][c];
  const result = inspect(text, 'H', matrix.size, matrix.modules);
  check('checker catches a flipped module', Array.isArray(result) && result.some(p => /syndrome/.test(p)), JSON.stringify(result));
  const found = decode(matrix);
  check('jsQR corrects a flipped module', found && found.data === text);
}

// ---- Summary ---------------------------------------------------------------------

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`QR encoder tests (seed ${SEED}), ${secs}s`);
if (jsqrPatched) console.log('  note: jsQR\'s version 23 alignment table typo (74 -> 78) corrected before use');
console.log(`  300 strings x 4 levels: ${mainPassed} passed, ${mainFailed} failed ` +
  `(${groupCounts.ascii} random ASCII, ${groupCounts.url} URLs, ${groupCounts.utf8} UTF-8)`);
for (const level of LEVELS) {
  const versions = [...versionsByLevel[level].entries()].sort((a, b) => a[0] - b[0]);
  console.log(`    ${level} versions (version:cases): ${versions.map(([v, n]) => `${v}:${n}`).join(' ')}`);
}
console.log(`  capacity sweep, versions 1-40 x L/M/Q/H at full capacity and +1 byte: ` +
  `${sweepCount - sweepFailed} passed, ${sweepFailed} failed`);
console.log(`  masks chosen: ${masksUsed.map((n, i) => `${i}:${n}`).join(' ')}`);
console.log(`  total: ${passed} passed, ${failed} failed`);
for (const f of failures.slice(0, 40)) console.log('  FAIL ' + f);
if (failures.length > 40) console.log(`  ... and ${failures.length - 40} more`);
process.exit(failed ? 1 : 0);
