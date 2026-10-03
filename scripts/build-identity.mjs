import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rasterize } from './brand-raster.mjs';

const project = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(project, 'src', 'assets', 'brand', 'identity');
const handoff = join(project, 'src', 'assets', 'brand', 'handoff');

const palette = {
  primary: '#2563EB',
  bright: '#3B82F6',
  deep: '#1D4ED8',
  sky: '#38BDF8',
  light: '#EFF6FF',
  white: '#FFFFFF',
  navy: '#0F172A',
};

/*
 * Ribbon N with a message bubble. Geometry is in symbol units; the visible mark spans
 * x 32–356, y 8–245 (centre 194, 126.5). Draw order matters: the band runs behind both
 * stems, so its hidden ends are tucked inside them rather than sharing an edge.
 */
const SHAPES = {
  band: 'M40 150 L32 108 C32 62 78 26 126 28 C168 30 196 58 222 96 L290 196 L290 225 L258 218 C215 175 170 130 124 100 L114 120 L114 150 Z',
  left: 'M32 105 C32 85 124 85 124 105 V199 A46 46 0 0 1 32 199 Z',
  leftTop: 'M32 105 C32 85 124 85 124 105',
  right: 'M258 150 L300 113 Q320 100 320 125 V214 A31 31 0 0 1 258 214 Z',
  fold: 'M258 150 L300 113 L304 178 Z',
  bubble: 'M252 8 H332 A24 24 0 0 1 356 32 V72 A24 24 0 0 1 332 96 H268 L238 108 Q228 112 228 101 V32 A24 24 0 0 1 252 8 Z',
};
const DOTS = [266, 292, 318].map((cx) => ({ cx, cy: 52, r: 8 }));
const SYMBOL = { x: 32, y: 8, width: 324, height: 237, cx: 194, cy: 126.5 };

const grad = (id, x1, y1, x2, y2, stops) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">` +
  stops.map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('') +
  `</linearGradient>`;

/** Full-colour symbol, or a single-colour silhouette (`mono`) with separation gaps cut by a mask. */
function symbol(id, { mono, dots = true } = {}) {
  if (mono) {
    const gap = 'fill="none" stroke="#000000" stroke-width="7" stroke-linejoin="round"';
    const mask =
      `<mask id="${id}-m" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="260">` +
      `<path d="${SHAPES.band}" fill="#FFFFFF"/>` +
      `<path d="${SHAPES.leftTop}" ${gap}/><path d="${SHAPES.left}" fill="#FFFFFF"/>` +
      `<path d="${SHAPES.right}" ${gap}/><path d="${SHAPES.right}" fill="#FFFFFF"/>` +
      `<path d="${SHAPES.bubble}" ${gap}/><path d="${SHAPES.bubble}" fill="#FFFFFF"/>` +
      (dots ? DOTS.map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="#000000"/>`).join('') : '') +
      `</mask>`;
    return { defs: mask, body: `<rect width="400" height="260" fill="${mono}" mask="url(#${id}-m)"/>` };
  }
  return {
    defs:
      grad(`${id}-band`, 70, 20, 280, 230, [[0, '#38BDF8'], [0.4, '#3B82F6'], [0.75, '#2563EB'], [1, '#1D4ED8']]) +
      grad(`${id}-left`, 0, 88, 0, 245, [[0, '#1E3A8A'], [0.32, '#2563EB'], [1, '#3B8BFF']]) +
      grad(`${id}-right`, 0, 108, 0, 245, [[0, '#4F8EF7'], [0.55, '#2563EB'], [1, '#1D4ED8']]) +
      grad(`${id}-fold`, 262, 140, 302, 176, [[0, '#1E3A8A', 0.35], [1, '#1E3A8A', 0]]) +
      grad(`${id}-bubble`, 340, 8, 236, 108, [[0, '#38BDF8'], [1, '#2563EB']]) +
      `<clipPath id="${id}-rc"><path d="${SHAPES.right}"/></clipPath>`,
    body:
      `<path d="${SHAPES.band}" fill="url(#${id}-band)"/>` +
      `<path d="${SHAPES.left}" fill="url(#${id}-left)"/>` +
      `<path d="${SHAPES.right}" fill="url(#${id}-right)"/>` +
      `<path d="${SHAPES.fold}" fill="url(#${id}-fold)" clip-path="url(#${id}-rc)"/>` +
      `<path d="${SHAPES.bubble}" fill="url(#${id}-bubble)"/>` +
      (dots ? DOTS.map((d) => `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="#FFFFFF"/>`).join('') : ''),
  };
}

/* Rounded geometric wordmark; baseline at y=0, cap height 71.4, x 7.1–298.4. The "i" tittle is a mini bubble. */
const WORD_GLYPHS = [
  'M14.30 0.90L14.30 0.90Q10.80 0.90 8.95-1.05Q7.10-3 7.10-6.60L7.10-6.60L7.10-63.60Q7.10-67.40 8.95-69.40Q10.80-71.40 13.90-71.40L13.90-71.40Q16.60-71.40 18.05-70.35Q19.50-69.30 21.40-66.90L21.40-66.90L56.50-22.20L53.80-22.20L53.80-64Q53.80-67.50 55.65-69.45Q57.50-71.40 61-71.40L61-71.40Q64.50-71.40 66.35-69.45Q68.20-67.50 68.20-64L68.20-64L68.20-6.30Q68.20-3 66.50-1.05Q64.80 0.90 61.90 0.90L61.90 0.90Q59.10 0.90 57.45-0.20Q55.80-1.30 53.90-3.70L53.90-3.70L18.90-48.40L21.50-48.40L21.50-6.60Q21.50-3 19.70-1.05Q17.90 0.90 14.30 0.90Z',
  'M105.10 1.10L105.10 1.10Q96.40 1.10 90.15-2.05Q83.90-5.20 80.55-10.95Q77.20-16.70 77.20-24.50L77.20-24.50Q77.20-32.10 80.40-37.85Q83.60-43.60 89.35-46.85Q95.10-50.10 102.40-50.10L102.40-50.10Q107.70-50.10 112-48.35Q116.30-46.60 119.40-43.35Q122.50-40.10 124.10-35.45Q125.70-30.80 125.70-25.10L125.70-25.10Q125.70-23.20 124.50-22.25Q123.30-21.30 121-21.30L121-21.30L89.60-21.30L89.60-29.10L114.80-29.10L113.20-27.70Q113.20-31.80 112-34.55Q110.80-37.30 108.55-38.70Q106.30-40.10 103-40.10L103-40.10Q99.30-40.10 96.70-38.40Q94.10-36.70 92.70-33.50Q91.30-30.30 91.30-25.80L91.30-25.80L91.30-25Q91.30-17.40 94.85-13.80Q98.40-10.20 105.40-10.20L105.40-10.20Q107.80-10.20 110.90-10.80Q114-11.40 116.70-12.70L116.70-12.70Q119-13.80 120.80-13.45Q122.60-13.10 123.60-11.80Q124.60-10.50 124.75-8.80Q124.90-7.10 124-5.45Q123.10-3.80 121-2.70L121-2.70Q117.60-0.80 113.35 0.15Q109.10 1.10 105.10 1.10Z',
  'M138 0.70L138 0.70Q135.20 0.70 133.50-0.85Q131.80-2.40 131.75-4.80Q131.70-7.20 133.70-9.70L133.70-9.70L149.20-28.70L149.20-21.90L134.80-39.50Q132.70-42.10 132.80-44.50Q132.90-46.90 134.60-48.40Q136.30-49.90 139.10-49.90L139.10-49.90Q141.80-49.90 143.60-49Q145.40-48.10 147-46L147-46L157.70-32.30L152.40-32.30L163.10-46Q164.80-48.10 166.60-49Q168.40-49.90 171-49.90L171-49.90Q173.80-49.90 175.50-48.35Q177.20-46.80 177.25-44.40Q177.30-42 175.20-39.50L175.20-39.50L160.80-21.90L160.80-28.70L176.40-9.70Q178.50-7.30 178.40-4.90Q178.30-2.50 176.55-0.90Q174.80 0.70 172 0.70L172 0.70Q169.30 0.70 167.55-0.25Q165.80-1.20 164.10-3.20L164.10-3.20L152.40-18.10L157.50-18.10L145.80-3.20Q144.20-1.30 142.45-0.30Q140.70 0.70 138 0.70Z',
  'M194.80 0.80L194.80 0.80Q191.10 0.80 189.15-1.35Q187.20-3.50 187.20-7.40L187.20-7.40L187.20-41.60Q187.20-45.60 189.15-47.75Q191.10-49.90 194.80-49.90L194.80-49.90Q198.40-49.90 200.35-47.75Q202.30-45.60 202.30-41.60L202.30-41.60L202.30-7.40Q202.30-3.50 200.40-1.35Q198.50 0.80 194.80 0.80Z',
  'M236.60 1.10L236.60 1.10Q229.70 1.10 225.05-1.20Q220.40-3.50 218.15-7.90Q215.90-12.30 215.90-19L215.90-19L215.90-37.80L211.70-37.80Q208.90-37.80 207.35-39.30Q205.80-40.80 205.80-43.40L205.80-43.40Q205.80-46.20 207.35-47.65Q208.90-49.10 211.70-49.10L211.70-49.10L215.90-49.10L215.90-56.70Q215.90-60.50 217.90-62.45Q219.90-64.40 223.50-64.40L223.50-64.40Q227.20-64.40 229.10-62.45Q231.00-60.50 231.00-56.70L231.00-56.70L231.00-49.10L240.50-49.10Q243.30-49.10 244.80-47.65Q246.30-46.20 246.30-43.40L246.30-43.40Q246.30-40.80 244.80-39.30Q243.30-37.80 240.50-37.80L240.50-37.80L231.00-37.80L231.00-19.60Q231.00-15.40 232.95-13.30Q234.90-11.20 239.20-11.20L239.20-11.20Q240.70-11.20 242.00-11.50Q243.30-11.80 244.40-11.90L244.40-11.90Q245.80-12 246.70-11.05Q247.60-10.10 247.60-6.90L247.60-6.90Q247.60-4.50 246.80-2.70Q246.00-0.90 244.00-0.10L244.00-0.10Q242.70 0.40 240.45 0.75Q238.20 1.10 236.60 1.10Z',
  'M265.70 18.90L265.70 18.90Q263.10 18.90 261.40 17.50Q259.70 16.10 259.40 13.85Q259.10 11.60 260.20 9.10L260.20 9.10L266.90-5.70L266.90 0.50L249.20-40.10Q248.20-42.70 248.55-44.95Q248.90-47.20 250.75-48.55Q252.60-49.90 255.90-49.90L255.90-49.90Q258.60-49.90 260.25-48.65Q261.90-47.40 263.30-43.90L263.30-43.90L275.10-13.90L271.90-13.90L284.10-44Q285.50-47.40 287.25-48.65Q289-49.90 292-49.90L292-49.90Q294.60-49.90 296.15-48.55Q297.70-47.20 298.05-45Q298.40-42.80 297.20-40.20L297.20-40.20L273.70 13.10Q272.20 16.50 270.35 17.70Q268.50 18.90 265.70 18.90Z',
];
const TITTLE_PATH = 'M195.2 -75 A8.5 8.5 0 0 1 203.7 -66.5 A8.5 8.5 0 0 1 195.2 -58 H188.6 A2.4 2.4 0 0 1 186.2 -60.4 V-66.5 A8.5 8.5 0 0 1 195.2 -75 Z';
const WORD = { width: 291.3, cap: 71.4, left: 7.1, center: 152.75 };

function wordmark(id, { tone = 'color', mono } = {}) {
  if (mono) {
    return { defs: '', body: [...WORD_GLYPHS, TITTLE_PATH].map((d) => `<path d="${d}" fill="${mono}"/>`).join('') };
  }
  const letters = tone === 'dark' ? palette.white : `url(#${id}-w)`;
  return {
    defs: tone === 'dark' ? '' : grad(`${id}-w`, 7, -40, 298, 0, [[0, '#2563EB'], [1, '#1D4ED8']]),
    body: WORD_GLYPHS.map((d) => `<path d="${d}" fill="${letters}"/>`).join('') + `<path d="${TITTLE_PATH}" fill="${palette.sky}"/>`,
  };
}

const svgDoc = (viewBox, defs, body) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" fill="none">` +
  `<defs>${defs}</defs>${body}</svg>\n`;

const place = (inner, x, y, scale) => `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})">${inner}</g>`;

/** Symbol positioned so its visual centre lands on (cx, cy) at the given scale. */
const centred = (s, cx, cy, scale) => place(s.body, cx - SYMBOL.cx * scale, cy - SYMBOL.cy * scale, scale);

function symbolOnly(id, opts = {}) {
  const s = symbol(id, opts);
  const pad = 8;
  return svgDoc(`${SYMBOL.x - pad} ${SYMBOL.y - pad} ${SYMBOL.width + 2 * pad} ${SYMBOL.height + 2 * pad}`, s.defs, s.body);
}

/* Horizontal lock-up: symbol 98 high, 22-unit gap, wordmark cap height centred on the symbol. */
const H_SCALE = 98 / SYMBOL.height;
const H_WORD = 0.756;
const H_WORD_X = SYMBOL.width * H_SCALE + 22;
const HORIZONTAL = { width: H_WORD_X + WORD.width * H_WORD, height: 98 };

function horizontal(id, opts = {}) {
  const s = symbol(id, opts);
  const w = wordmark(id, opts);
  return svgDoc(
    `0 0 ${HORIZONTAL.width.toFixed(2)} ${HORIZONTAL.height}`,
    s.defs + w.defs,
    place(s.body, -SYMBOL.x * H_SCALE, -SYMBOL.y * H_SCALE, H_SCALE.toFixed(4)) +
      place(w.body, H_WORD_X - WORD.left * H_WORD, 76, H_WORD),
  );
}

/* Stacked lock-up (200 × 174): symbol above a centred wordmark. Used on HomeScreen and splash. */
const S_SCALE = 0.443;
const S_WORD = 0.515;

function stackedBody(id, opts = {}) {
  const s = symbol(id, opts);
  const w = wordmark(id, opts);
  return {
    defs: s.defs + w.defs,
    body: centred(s, 100, 4 + (SYMBOL.height * S_SCALE) / 2, S_SCALE) + place(w.body, 100 - WORD.center * S_WORD, 159.8, S_WORD),
  };
}

function stacked(id, opts = {}) {
  const s = stackedBody(id, opts);
  return svgDoc('0 0 200 174', s.defs, s.body);
}

/* Splash: stacked lock-up inside the central 2/3 circle that Android 12+ keeps (1152 canvas). */
function splash(id, opts = {}) {
  const s = stackedBody(id, opts);
  return svgDoc('0 0 1152 1152', s.defs, place(s.body, 297, 333, 2.79));
}

/* App icon: full-bleed square master on a soft white-to-ice background; the symbol sits in a 66% safe circle. */
const ICON_SCALE = 1.78;

function appIcon(id, { rounded = false, background = true } = {}) {
  const s = symbol(id);
  const clip = rounded ? `<clipPath id="${id}-r"><rect width="1024" height="1024" rx="229"/></clipPath>` : '';
  const bg = background
    ? grad(`${id}-bg`, 0, 0, 1024, 1024, [[0, '#FFFFFF'], [1, '#EAF2FF']])
    : '';
  return svgDoc(
    '0 0 1024 1024',
    bg + s.defs + clip,
    `<g${rounded ? ` clip-path="url(#${id}-r)"` : ''}>` +
      (background ? `<rect width="1024" height="1024" fill="url(#${id}-bg)"/>` : '') +
      centred(s, 512, 520, ICON_SCALE) +
      `</g>`,
  );
}

function notificationIcon(id) {
  const s = symbol(id, { mono: palette.white, dots: false });
  return svgDoc('0 0 96 96', s.defs, centred(s, 48, 48, 0.259));
}

function write(dir, file, data) {
  const path = join(dir, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(path.substring(project.length + 1));
}

const assets = {
  'nexity-logo-horizontal': { svg: horizontal('h'), width: 1504 },
  'nexity-logo-horizontal-dark': { svg: horizontal('hd', { tone: 'dark' }), width: 1504 },
  'nexity-logo-horizontal-mono-navy': { svg: horizontal('hm', { mono: palette.navy }), width: 1504 },
  'nexity-logo-horizontal-mono-white': { svg: horizontal('hw', { mono: palette.white }), width: 1504 },
  'nexity-logo-stacked': { svg: stacked('st'), width: 1000 },
  'nexity-logo-stacked-dark': { svg: stacked('std', { tone: 'dark' }), width: 1000 },
  'nexity-symbol': { svg: symbolOnly('s'), width: 1024 },
  'nexity-symbol-mono-navy': { svg: symbolOnly('sm', { mono: palette.navy }), width: 1024 },
  'nexity-symbol-mono-white': { svg: symbolOnly('sw', { mono: palette.white }), width: 1024 },
  'nexity-app-icon': { svg: appIcon('a'), width: 1024, opaque: true },
  'nexity-app-icon-rounded': { svg: appIcon('ar', { rounded: true }), width: 1024 },
};

for (const [name, { svg, width, opaque }] of Object.entries(assets)) {
  write(out, `svg/${name}.svg`, svg);
  write(out, `png/${name}.png`, rasterize(svg, { width, opaque }));
}

/* App masters consumed by export-brand.mjs. */
write(handoff, 'app-icon/app-icon.svg', appIcon('ha'));
write(handoff, 'app-icon/app-icon-foreground.svg', appIcon('hf', { background: false }));
write(handoff, 'app-icon/notification-icon.svg', notificationIcon('hn'));
write(handoff, 'splash/splash-logo-light.svg', splash('hsl'));
write(handoff, 'splash/splash-logo-dark.svg', splash('hsd', { tone: 'dark' }));
write(handoff, 'home/logo-stacked.svg', stacked('hl'));
write(handoff, 'home/logo-stacked-dark.svg', stacked('hdk', { tone: 'dark' }));

/* Presentation board. */
const nest = (svg, x, y, w, h) =>
  svg.replace(/<\?xml[^>]*\?>\s*/, '').replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
const text = (x, y, value, { size = 22, fill = '#64748B', weight = 500, anchor = 'start', spacing = 0 } = {}) =>
  `<text x="${x}" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" ` +
  `fill="${fill}" text-anchor="${anchor}" letter-spacing="${spacing}">${value}</text>`;
const tile = (x, y, w, h, fill, stroke) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="2"` : ''}/>`;

const W = 2400;
const H = 1700;
const M = 80;
const SYMBOL_RATIO = (SYMBOL.height + 16) / (SYMBOL.width + 16);

let board = `<rect width="${W}" height="${H}" fill="#FFFFFF"/>`;
board += text(M, 92, 'NEXITY', { size: 24, fill: palette.navy, weight: 700, spacing: 6 });
board += text(M + 128, 92, 'Brand Identity', { size: 24 });
board += text(W - M, 92, 'Connect · Converse · Discover', { size: 24, anchor: 'end' });

const heroH = 700;
board += tile(M, 140, W - 2 * M, heroH, '#F8FAFC');
const stackW = 640;
const stackH = (stackW * 174) / 200;
board += nest(stacked('bst'), (W - stackW) / 2, 140 + (heroH - stackH) / 2, stackW, stackH);
board += text(M + 40, 140 + heroH - 30, 'Primary logo · symbol with wordmark', { size: 20, fill: '#94A3B8' });

const rowY = 140 + heroH + 40;
const rowH = 400;
const colW = (W - 2 * M - 3 * 40) / 4;
const col = (i) => M + i * (colW + 40);
const label = (i, value, fill = palette.navy) => text(col(i) + colW / 2, rowY + rowH - 36, value, { anchor: 'middle', fill, weight: 600 });

board += tile(col(0), rowY, colW, rowH, '#E8EEF8');
board += nest(appIcon('ba', { rounded: true }), col(0) + (colW - 240) / 2, rowY + 50, 240, 240);
board += label(0, 'App icon');

board += tile(col(1), rowY, colW, rowH, '#FFFFFF', '#E2E8F0');
const symW = 300;
board += nest(symbolOnly('bs'), col(1) + (colW - symW) / 2, rowY + 170 - (symW * SYMBOL_RATIO) / 2, symW, symW * SYMBOL_RATIO);
board += label(1, 'Icon only');

const hW = 440;
const hH = (hW * HORIZONTAL.height) / HORIZONTAL.width;
board += tile(col(2), rowY, colW, rowH, palette.navy);
board += nest(horizontal('bd', { tone: 'dark' }), col(2) + (colW - hW) / 2, rowY + 170 - hH / 2, hW, hH);
board += label(2, 'Dark background', '#CBD5E1');

const mW = 330;
const mH = (mW * HORIZONTAL.height) / HORIZONTAL.width;
board += tile(col(3), rowY, colW, rowH / 2 - 10, '#F8FAFC');
board += nest(horizontal('bm', { mono: palette.navy }), col(3) + (colW - mW) / 2, rowY + 95 - mH / 2, mW, mH);
board += tile(col(3), rowY + rowH / 2 + 10, colW, rowH / 2 - 10, palette.primary);
board += nest(horizontal('bw', { mono: palette.white }), col(3) + (colW - mW) / 2, rowY + rowH / 2 + 105 - mH / 2, mW, mH);
board += text(col(3) + 24, rowY + rowH / 2 - 24, 'Monochrome', { size: 18, fill: '#94A3B8' });

const lowY = rowY + rowH + 40;
const lowH = H - lowY - M;
const halfW = (W - 2 * M - 40) / 2;

board += tile(M, lowY, halfW, lowH, '#FFFFFF', '#E2E8F0');
board += text(M + 40, lowY + 56, 'Small-size legibility', { fill: palette.navy, weight: 600 });
let sx = M + 40;
for (const size of [64, 48, 24]) {
  board += nest(appIcon(`bi${size}`, { rounded: true }), sx, lowY + 160 - size / 2, size, size);
  board += text(sx + size / 2, lowY + 240, `${size}px`, { size: 18, anchor: 'middle' });
  sx += size + 56;
}
sx += 40;
for (const size of [64, 48, 24]) {
  board += nest(symbolOnly(`bt${size}`), sx, lowY + 160 - (size * SYMBOL_RATIO) / 2, size, size * SYMBOL_RATIO);
  board += text(sx + size / 2, lowY + 240, `${size}px`, { size: 18, anchor: 'middle' });
  sx += size + 56;
}

const px = M + halfW + 40;
board += tile(px, lowY, halfW, lowH, '#FFFFFF', '#E2E8F0');
board += text(px + 40, lowY + 56, 'Colour palette', { fill: palette.navy, weight: 600 });
const swatches = [
  ['Primary', palette.primary],
  ['Bright', palette.bright],
  ['Deep', palette.deep],
  ['Sky', palette.sky],
  ['Light', palette.light],
  ['Navy', palette.navy],
];
const swW = (halfW - 80 - 5 * 24) / 6;
swatches.forEach(([name, hex], i) => {
  const x = px + 40 + i * (swW + 24);
  board += `<rect x="${x}" y="${lowY + 84}" width="${swW}" height="${swW * 0.6}" rx="18" fill="${hex}" stroke="#E2E8F0" stroke-width="2"/>`;
  board += text(x, lowY + 106 + swW * 0.6 + 12, name, { size: 18, fill: palette.navy, weight: 600 });
  board += text(x, lowY + 106 + swW * 0.6 + 38, hex, { size: 17 });
});

const boardSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${board}</svg>`;
write(out, 'nexity-brand-board.png', rasterize(boardSvg, { width: W }));
