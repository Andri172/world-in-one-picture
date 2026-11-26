// The World in One Picture — Thursday 26 November 2026 (Node 22, standard library only).
//
// A program that draws one editorial poster summing up the world's news of
// Thursday 26 November 2026 and writes it to /output/entry.png: a dot-matrix
// world map with the day's five biggest stories marked and labelled, the date
// in the masthead, and an "also today" strip for the rest. Everything is drawn
// from constants in this file — no network, no clock, no randomness — so two
// runs write the same bytes.
//
// The day's stories, as reported on 26 November 2026 (UTC):
//   1. Washington — the US proposed new tariffs on 14 trading partners.
//   2. Cairo — a fuel tanker fire on the ring road killed at least 31 people.
//   3. Riyadh — Yemen's Houthis struck Saudi ports and the Ras Tanura refinery.
//   4. Kyiv — Ukraine struck a Russian airbase, hitting five military jets.
//   5. Orbit — Muhammad Zeeshan Ali became the first foreign astronaut to
//      board China's Tiangong space station (Shenzhou-24).
//   Also: an AI stock sell-off pushed the Nasdaq toward a bear market; the FCC
//   cleared SpaceX for up to a million satellites; Colombian forces freed 76
//   hostages in Cartagena; Israeli judges urged dropping Netanyahu's Case 4000.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// PNG encoder (RGBA rows, filter 0, zlib deflate — deterministic output).

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(px: Uint8Array): Uint8Array {
  const raw = new Uint8Array(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0;
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), y * (1 + W * 4) + 1);
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W);
  dv.setUint32(4, H);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Framebuffer and drawing primitives.

type Rgb = [number, number, number];
const px = new Uint8Array(W * H * 4);

function setPix(x: number, y: number, [r, g, b]: Rgb): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = r;
  px[i + 1] = g;
  px[i + 2] = b;
  px[i + 3] = 255;
}

function fillAll(c: Rgb): void {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) setPix(x, y, c);
}

function rect(x0: number, y0: number, w: number, h: number, c: Rgb): void {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) setPix(x, y, c);
}

function disc(cx: number, cy: number, r: number, c: Rgb): void {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPix(x, y, c);
    }
}

function ring(cx: number, cy: number, r: number, thick: number, c: Rgb): void {
  for (let y = Math.floor(cy - r - thick); y <= cy + r + thick; y++)
    for (let x = Math.floor(cx - r - thick); x <= cx + r + thick; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r + thick / 2 && d >= r - thick / 2) setPix(x, y, c);
    }
}

function line(x0: number, y0: number, x1: number, y1: number, thick: number, c: Rgb): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    disc(x, y, thick / 2, c);
  }
}

// ---------------------------------------------------------------------------
// A 5x7 pixel font. Each glyph is seven rows of five pixels, drawn as text so
// the shapes stay easy to check. Text is set by scaling the pixels up; "bold"
// draws the glyph twice with a one-pixel shift.

const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['.####', '....#', '....#', '....#', '....#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '.#.#.', '..#..', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '#####'],
  '2': ['.###.', '#...#', '....#', '..##.', '.#...', '#....', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  "'": ['.##..', '.##..', '.#...', '.....', '.....', '.....', '.....'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '$': ['..#..', '.####', '#.#.#', '.###.', '.#.#.', '####.', '..#..'],
  '%': ['##..#', '##.#.', '....#', '...#.', '..#..', '.#...', '#..##'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '(': ['...##', '..#..', '.#...', '.#...', '.#...', '..#..', '...##'],
  ')': ['##...', '..#..', '...#.', '...#.', '...#.', '..#..', '##...'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
};

function textWidth(s: string, scale: number, spacing: number): number {
  return s.length === 0 ? 0 : s.length * (5 * scale + spacing) - spacing;
}

function drawText(x: number, y: number, s: string, scale: number, c: Rgb, opts: { bold?: boolean; spacing?: number } = {}): number {
  const spacing = opts.spacing ?? scale;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const glyph = GLYPHS[ch] ?? GLYPHS[' '];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++)
        if (glyph[row][col] === '#') {
          rect(cx + col * scale, y + row * scale, scale, scale, c);
          if (opts.bold) rect(cx + col * scale + Math.max(1, scale >> 1), y + row * scale, scale, scale, c);
        }
    cx += 5 * scale + spacing;
  }
  return cx - spacing;
}

function drawTextCentered(cx: number, y: number, s: string, scale: number, c: Rgb, opts: { bold?: boolean; spacing?: number } = {}): void {
  const w = textWidth(s, scale, opts.spacing ?? scale) + (opts.bold ? Math.max(1, scale >> 1) : 0);
  drawText(Math.round(cx - w / 2), y, s, scale, c, opts);
}

// ---------------------------------------------------------------------------
// The world map as land segments on a 96x48 equirectangular grid (each cell
// 3.75 degrees). A segment is [row, firstColumn, lastColumn]. Rough shapes are
// enough: at dot scale the continents read clearly, and the numbered markers
// carry the geography that matters.

const LAND: Array<[number, number, number]> = [
  // Arctic islands and Greenland
  [0, 14, 14], [0, 21, 21], [0, 58, 58], [0, 71, 71], [0, 84, 84],
  [1, 13, 13], [1, 20, 20], [1, 27, 27], [1, 57, 57], [1, 70, 70], [1, 83, 83],
  [2, 12, 30], [2, 36, 38], [2, 56, 90],
  [3, 11, 31], [3, 34, 40], [3, 51, 53], [3, 57, 92],
  [4, 10, 32], [4, 34, 39], [4, 49, 55], [4, 56, 93],
  // North America, Scandinavia, Siberia
  [5, 2, 33], [5, 35, 38], [5, 49, 56], [5, 57, 93],
  [6, 1, 33], [6, 36, 37], [6, 48, 56], [6, 57, 94],
  [7, 2, 32], [7, 48, 55], [7, 57, 94],
  [8, 9, 23], [8, 27, 31], [8, 44, 46], [8, 47, 56], [8, 57, 93],
  [9, 9, 24], [9, 27, 30], [9, 44, 45], [9, 46, 57], [9, 57, 92],
  [10, 10, 29], [10, 45, 58], [10, 58, 91],
  [11, 10, 29], [11, 46, 57], [11, 60, 90], [11, 88, 88],
  // USA, Europe, Turkey, Central and East Asia
  [12, 10, 28], [12, 44, 47], [12, 49, 57], [12, 57, 61], [12, 62, 85], [12, 86, 86], [12, 88, 89],
  [13, 10, 28], [13, 44, 47], [13, 52, 53], [13, 55, 56], [13, 57, 62], [13, 63, 84], [13, 89, 89],
  // USA south, North Africa, Arabia, Persia, South China
  [14, 11, 27], [14, 46, 60], [14, 58, 63], [14, 64, 68], [14, 74, 83],
  // Mexico, Sahara, India, South-East Asia
  [15, 11, 27], [15, 45, 60], [15, 58, 62], [15, 64, 70], [15, 72, 77], [15, 75, 82],
  [16, 11, 24], [16, 27, 28], [16, 45, 61], [16, 59, 62], [16, 65, 69], [16, 73, 78],
  [17, 12, 20], [17, 45, 61], [17, 59, 61], [17, 65, 69], [17, 74, 78],
  [18, 13, 19], [18, 45, 60], [18, 60, 60], [18, 66, 68], [18, 74, 77], [18, 71, 72],
  [19, 14, 21], [19, 46, 59], [19, 60, 62], [19, 66, 68], [19, 71, 74],
  // Central America, Africa and the Horn, India tip, Indonesia
  [20, 17, 23], [20, 46, 58], [20, 61, 63], [20, 66, 67], [20, 70, 72], [20, 76, 79],
  [21, 19, 24], [21, 46, 57], [21, 61, 63], [21, 67, 67], [21, 76, 79], [21, 80, 80],
  // South America north, Africa, Indonesia
  [22, 25, 34], [22, 47, 56], [22, 60, 62], [22, 70, 71], [22, 75, 79], [22, 85, 88],
  [23, 25, 36], [23, 47, 55], [23, 59, 61], [23, 75, 79], [23, 84, 89],
  [24, 26, 37], [24, 48, 55], [24, 57, 59], [24, 85, 88],
  // Brazil bulge, Africa, Australia north
  [25, 27, 38], [25, 49, 56], [25, 57, 58], [25, 79, 86],
  [26, 28, 38], [26, 49, 56], [26, 78, 87],
  [27, 28, 37], [27, 50, 56], [27, 61, 61], [27, 78, 88],
  [28, 28, 36], [28, 50, 57], [28, 61, 61], [28, 78, 88],
  [29, 28, 35], [29, 50, 57], [29, 61, 61], [29, 79, 87],
  [30, 27, 34], [30, 51, 56], [30, 79, 85],
  [31, 28, 33], [31, 51, 55], [31, 87, 87],
  [32, 28, 32], [32, 52, 54], [32, 91, 91],
  [33, 28, 32], [33, 92, 92],
  [34, 28, 31], [34, 92, 93],
  [35, 28, 31], [36, 28, 30], [37, 28, 30], [38, 29, 30], [39, 29, 30], [40, 29, 29],
];

// ---------------------------------------------------------------------------
// The poster.

const PAPER: Rgb = [247, 242, 230];
const INK: Rgb = [26, 28, 38];
const MAPDOT: Rgb = [58, 90, 120];
const RED: Rgb = [178, 34, 40];
const GRAY: Rgb = [110, 112, 118];
const WHITE: Rgb = [255, 255, 255];

fillAll(PAPER);

// Double-rule frame.
for (const [off, thick] of [[20, 3], [30, 1]] as Array<[number, number]>) {
  rect(off, off, W - 2 * off, thick, INK);
  rect(off, H - off - thick, W - 2 * off, thick, INK);
  rect(off, off, thick, H - 2 * off, INK);
  rect(W - off - thick, off, thick, H - 2 * off, INK);
}

// Masthead and date.
drawTextCentered(W / 2, 52, 'THE WORLD IN ONE PICTURE', 3, INK, { spacing: 6 });
rect(180, 102, W - 360, 2, INK);
drawTextCentered(W / 2, 118, 'THURSDAY 26 NOVEMBER 2026', 3, RED, { bold: true, spacing: 4 });

// Headline and subline.
drawTextCentered(W / 2, 168, 'TARIFFS, FIRE AND FIRSTS', 6, INK, { bold: true });
drawTextCentered(W / 2, 238, 'US PROPOSES TARIFFS ON 14 PARTNERS - CAIRO BLAZE KILLS AT LEAST 31', 2, INK);
drawTextCentered(W / 2, 264, "A PAKISTANI ASTRONAUT REACHES CHINA'S SPACE STATION", 2, INK);
rect(180, 300, W - 360, 2, INK);

// Dot-matrix world map.
const MAP_X = 80;
const MAP_Y = 316;
const CELL = 9;
for (const [row, c0, c1] of LAND)
  for (let col = c0; col <= c1; col++)
    disc(MAP_X + col * CELL + 4, MAP_Y + row * CELL + 4, 3, MAPDOT);

// Story markers: [longitude, latitude, number].
const MARKERS: Array<[number, number, string]> = [
  [-77, 39, '1'], // Washington
  [31, 30, '2'], // Cairo
  [50, 27, '3'], // Ras Tanura, Saudi Arabia
  [43, 56, '4'], // Savasleyka airbase, Russia
  [112, 42, '5'], // Tiangong, in orbit over China
];
function markerXY(lon: number, lat: number): [number, number] {
  return [
    Math.round(MAP_X + ((lon + 180) / 360) * 96 * CELL),
    Math.round(MAP_Y + ((90 - lat) / 180) * 48 * CELL),
  ];
}
for (const [lon, lat, n] of MARKERS) {
  const [x, y] = markerXY(lon, lat);
  if (n === '5') ring(x, y, 21, 2, GRAY); // a hint of an orbit ring
  disc(x, y, 13, RED);
  drawText(x - 5, y - 7, n, 2, WHITE, { bold: true });
}

// The legend: the day's five biggest stories, keyed to the markers.
const LEGEND: Array<[string, string]> = [
  ['1', 'WASHINGTON - US PROPOSES TARIFFS ON 14 PARTNERS'],
  ['2', 'CAIRO - TANKER FIRE ON RING ROAD KILLS 31'],
  ['3', 'RIYADH - HOUTHI STRIKES HIT SAUDI PORTS AND REFINERY'],
  ['4', 'KYIV - UKRAINE STRIKES RUSSIAN AIRBASE, 5 JETS HIT'],
  ['5', "ORBIT - FIRST PAKISTANI ASTRONAUT AT CHINA'S TIANGONG"],
];
let ly = 772;
for (const [n, text] of LEGEND) {
  drawText(84, ly, n, 2, RED, { bold: true });
  drawText(118, ly, text, 2, INK);
  ly += 27;
}
drawText(84, ly + 4, 'ALSO - AI SELL-OFF - SPACEX 1M SATELLITES - COLOMBIA HOSTAGES FREED', 2, GRAY);

// Footer.
rect(180, 956, W - 360, 2, INK);
drawTextCentered(W / 2, 972, "ONE DAY - ONE IMAGE - THE WORLD'S NEWS OF 26 NOVEMBER 2026", 1, GRAY, { spacing: 2 });

const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'entry.png'), encodePng(px));
