/* Wise Acres — seasonal hero.
 *
 * The first screen is an illustrated farm that follows the calendar:
 *   spring  strawberry field (tap to pick)
 *   summer  blueberry bushes (tap to pick)
 *   fall    pumpkin patch + a tractor pulling a wagon ride (tap to pick / toot)
 *   winter  Christmas-tree farm with campfires and a snowman (tap to light / stoke)
 *
 * js/season.js decides which season is "now". A small switcher lets visitors
 * preview the others while the site is being reviewed (WISE_ACRES.seasonPicker).
 */
(() => {
  'use strict';

  const W = window.WISE_ACRES;
  if (!W || !W.seasons) return;

  const doc = document;
  const $ = (s, c = doc) => c.querySelector(s);
  const $$ = (s, c = doc) => Array.from(c.querySelectorAll(s));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = W.rand;
  const T = (s) => s;   // marks a text for translation; t() translates it at the moment it is shown
  const t = (s, v) => (W.t ? W.t(s, v) : String(s).replace(/\{(\w+)\}/g, (m, k) => (v && k in v ? v[k] : m)));

  const hero = $('#top');
  const sceneEl = $('#hero-scene');
  const farEl = $('#far');
  const midEl = $('#mid');
  const fieldEl = $('#field');
  const foreEl = $('#fore');
  const crittersEl = $('#critters');
  const hasHero = !!(hero && sceneEl && fieldEl && foreEl && farEl && midEl);   // inner pages only use the footer art

  const INK = '#3a2416';
  const VPY = 262, BOT = 600, SPAN = BOT - VPY;   // vanishing line + bottom of the field, in viewBox units

  /* ------------------------------------------------------------------ *
   * Drawing helpers
   * ------------------------------------------------------------------ */
  const f1 = (n) => Math.round(n * 10) / 10;
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const use = (id, x, y, w, h, extra = '') => `<use href="#${id}" x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" ${extra}/>`;
  const rowX = (k, t) => 720 + k * 230 * t;
  const rowY = (t) => VPY + SPAN * t;

  const FAR_HILL = 'M0 210C120 158 260 148 400 182 520 212 640 156 780 146 930 136 1040 190 1180 176 1290 164 1370 146 1440 156V520H0Z';
  const FAR_LINE = 'M0 210C120 158 260 148 400 182 520 212 640 156 780 146 930 136 1040 190 1180 176 1290 164 1370 146 1440 156';
  const MID_LINE = 'M0 262C160 224 300 234 460 256 620 278 760 236 920 244 1080 252 1240 226 1440 252';
  const MID_HILL = 'M0 262C160 224 300 234 460 256 620 278 760 236 920 244 1080 252 1240 226 1440 252V520H0Z';
  const groundPath = () => `M0 ${VPY + 10}C240 ${VPY - 8} 480 ${VPY + 8} 720 ${VPY}S1200 ${VPY - 8} 1440 ${VPY - 2}V${BOT}H0Z`;

  // Rows that fan out toward the viewer (soil strips, mulch, snow lanes…)
  function rowPolys(ks, { fill, stroke, sw = 2.5, hw = 58, inner, innerHw = 26, t0 = 0.05, innerOpacity = 0.55 }) {
    let s = '';
    ks.forEach((k) => {
      const P = (t, side, w) => `${f1(rowX(k, t) + side * (6 + w * t))} ${f1(rowY(t))}`;
      s += `<path d="M${P(t0, -1, hw)}L${P(t0, 1, hw)}L${P(1, 1, hw)}L${P(1, -1, hw)}Z" fill="${fill}"` +
           (stroke ? ` stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"` : '') + '/>';
      if (inner) s += `<path d="M${P(t0, -1, innerHw)}L${P(t0, 1, innerHw)}L${P(1, 1, innerHw)}L${P(1, -1, innerHw)}Z" fill="${inner}" opacity="${innerOpacity}"/>`;
    });
    return s;
  }

  const round = (x, base, s, c1, c2, trunk = '#a5673f') =>
    `<g transform="translate(${x} ${base}) scale(${s})" stroke="${INK}" stroke-width="${f1(3 / s)}" stroke-linejoin="round">` +
    `<ellipse cx="0" cy="1" rx="27" ry="4" fill="rgba(58,36,22,.2)" stroke="none"/>` +
    `<rect x="-4" y="-28" width="8" height="28" fill="${trunk}"/><path d="M-1 -4v-16M2.4 -2v-12" stroke="#7a4b2a" stroke-width="${f1(1.7 / s)}" fill="none" opacity=".7"/>` +
    `<path d="M0 -24l-9 -8M0 -22l8 -9" stroke-width="${f1(3.4 / s)}" fill="none"/>` +
    `<circle cx="0" cy="-46" r="26" fill="${c1}"/><circle cx="-15" cy="-32" r="15" fill="${c2}"/><circle cx="15" cy="-34" r="14" fill="${c2}"/>` +
    `<g stroke="none" fill="#fff" opacity=".24"><ellipse cx="-8" cy="-57" rx="9" ry="5" transform="rotate(-24 -8 -57)"/><circle cx="-20" cy="-37" r="3.4"/></g>` +
    `<path d="M-16 -30l4 3M6 -32l4 3M-6 -51l4 3M11 -47l4 3M-3 -39l4 3M-21 -43l4 3M18 -42l4 3M-12 -22l4 3M8 -24l4 3" fill="none" stroke-width="${f1(1.8 / s)}" opacity=".35"/></g>`;

  const snowFir = (x, base, s) => {
    const h = 100 * s, w = h * 0.727;
    return use('fir', x - w / 2, base - h + 4 * s, w, h) + use('fir-snow', x - w / 2, base - h + 4 * s, w, h);
  };

  const barn = (x, y, w, snow) => {
    const s = w / 220;
    return `<g transform="translate(${x} ${y}) scale(${f1(s * 1000) / 1000})"><use href="#barn" width="220" height="180"/>` +
      (snow ? `<path d="M16 90L32 47L87 16L142 47L158 90Q148 80 138 88Q128 76 118 86Q108 74 98 84Q87 72 76 84Q66 74 56 86Q46 76 36 88Q26 80 16 90Z" fill="#fff" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>` : '') +
      '</g>';
  };

  // Grass / snow-drift edge along the bottom. Overflowing the viewBox avoids seams while parallax scrolls.
  const blades = (base, minH, maxH, step, fill, seed) => {
    const r = rand(seed);
    let d = `M-40 700V${base}`;
    for (let x = -40; x <= 1480; x += step) d += `L${x + step / 2} ${(base - minH - r() * (maxH - minH)).toFixed(0)}L${x + step} ${base}`;
    return `<path d="${d}V700Z" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
  };
  // Crop-row stripes that follow a hill, so the far fields read as farmland
  const rows = (line, color, n, gap) => {
    let o = '';
    for (let i = 1; i <= n; i++) o += `<path d="${line}" transform="translate(0 ${i * gap})" fill="none" stroke="${color}" stroke-width="${f1(2 + i * 0.35)}" stroke-linecap="round" opacity="${f1(0.55 - i * 0.05)}"/>`;
    return o;
  };
  // Little wildflowers scattered through the grass
  const meadow = (seed, n, y0, y1, pal) => {
    const r = rand(seed);
    let o = '';
    for (let i = 0; i < n; i++) {
      const x = r() * 1440, y = y0 + r() * (y1 - y0), c = pal[Math.floor(r() * pal.length)], q = 2.4 + r() * 2;
      o += `<path d="M${f1(x)} ${f1(y)}v${f1(8 + r() * 7)}" stroke="#2e8b3a" stroke-width="1.8" stroke-linecap="round"/>` +
        `<g transform="translate(${f1(x)} ${f1(y)})" fill="${c}" stroke="${INK}" stroke-width="1"><circle cx="${f1(-q)}" r="${f1(q)}"/><circle cx="${f1(q)}" r="${f1(q)}"/><circle cy="${f1(-q)}" r="${f1(q)}"/><circle cy="${f1(q)}" r="${f1(q)}"/><circle r="${f1(q * 0.8)}" fill="#ffc928"/></g>`;
    }
    return o;
  };
  const sunflower = (x, y, w, cls) =>
    `<g><g class="sway ${cls}"><use href="#sunflower-plant" x="${x}" y="${y}" width="${w}" height="${f1(w * 380 / 140)}"/></g></g>`;

  /* A pickable thing: a group that is clickable, animates when picked and regrows. */
  const pickable = (x, y, inner, hit, origin = '50% 0', kind = 'fruit', cls = '') =>
    `<g class="berry-hit${cls ? ' ' + cls : ''}" transform="translate(${f1(x)} ${f1(y)})" data-pick="${kind}"><g class="berry" style="--o:${origin}">${inner}</g>` +
    `<rect x="${f1(hit.x)}" y="${f1(hit.y)}" width="${f1(hit.w)}" height="${f1(hit.h)}" fill="transparent"/></g>`;

  /* ------------------------------------------------------------------ *
   * SPRING — strawberry field
   * ------------------------------------------------------------------ */
  // A child bent over the rows with a basket, feet hidden by the plants in front.
  function kid(cx, cy, w, shirt, hat, flip) {
    const sc = w / 30, f = flip ? -1 : 1;
    return `<g transform="translate(${f1(cx)} ${f1(cy - 20 * sc)}) scale(${f1(sc * f * 100) / 100} ${f1(sc * 100) / 100})"><g class="npc" data-npc="kid"><g class="kid-pick" style="animation-delay:${f1((cx % 7) * -0.4)}s">` +
      person(0, 0, shirt, hat, false) +
      `<g transform="translate(11 6) scale(.55)"><use href="#basket" width="64" height="52"/></g></g>` +
      `<rect class="npc-hit" x="-13" y="-27" width="46" height="58" fill="transparent"/></g></g>`;
  }

  // A blueberry picker: a child (or a grown-up, a bit bigger) reaching into the bushes with a pail that has a few berries on top.
  function berryPicker(cx, cy, w, shirt, hat, flip) {
    const sc = w / 30, f = flip ? -1 : 1;
    const pail = `<g transform="translate(10 5)" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round">` +
      `<path d="M-7 0L-5.4 13H5.4L7 0Z" fill="#b9c2cc"/><path d="M-6.2 6h12.4" stroke="#8c97a3" fill="none"/>` +
      `<circle cx="-3" cy="-1" r="2.3" fill="#4d5fc9"/><circle cx="2.2" cy="-1.4" r="2.3" fill="#4d5fc9"/><circle cx="-0.4" cy="-3.2" r="2.3" fill="#3f4fb8"/>` +
      `<path d="M-7 0C-7 -10 7 -10 7 0" fill="none"/></g>`;
    return `<g transform="translate(${f1(cx)} ${f1(cy - 20 * sc)}) scale(${f1(sc * f * 100) / 100} ${f1(sc * 100) / 100})"><g class="npc" data-npc="berrykid"><g class="kid-pick" style="animation-delay:${f1((cx % 7) * -0.4)}s">` +
      person(0, 0, shirt, hat, false) + pail + `</g>` +
      `<rect class="npc-hit" x="-13" y="-27" width="46" height="58" fill="transparent"/></g></g>`;
  }

  // A farm lane (ruts, pebbles, grass tufts). `k` squashes it for the distance; `y0` is where its top edge sits.
  function roadArt(fill = '#c69a63', rut = '#a9794a', hi = '#dcb57c', seed = 5, k = 1, y0 = VPY + 16) {
    const r = rand(seed), Y = (o) => f1(y0 + (o - 16) * k), sz = Math.max(k, 0.4);
    let o = `<path d="M-20 ${Y(16)}C260 ${Y(6)} 560 ${Y(22)} 860 ${Y(12)}S1300 ${Y(8)} 1470 ${Y(16)}V${Y(62)}C1240 ${Y(70)} 980 ${Y(58)} 700 ${Y(66)}S180 ${Y(62)} -20 ${Y(68)}Z" fill="${fill}" stroke="${INK}" stroke-width="${f1(1.4 + 1.6 * k)}" stroke-linejoin="round"/>` +
      `<path d="M-10 ${Y(34)}C260 ${Y(28)} 560 ${Y(42)} 860 ${Y(34)}S1300 ${Y(30)} 1460 ${Y(36)}" fill="none" stroke="${rut}" stroke-width="${f1(1.2 + 1.8 * k)}" stroke-dasharray="14 12" stroke-linecap="round"/>` +
      `<path d="M-10 ${Y(50)}C260 ${Y(46)} 560 ${Y(58)} 860 ${Y(50)}S1300 ${Y(46)} 1460 ${Y(52)}" fill="none" stroke="${hi}" stroke-width="${f1(1.2 + 1.8 * k)}" stroke-dasharray="10 14" stroke-linecap="round"/>`;
    for (let i = 0, n = Math.round(46 * k) + 10; i < n; i++) {
      const x = r() * 1440, y = Y(22 + r() * 40), w = (2 + r() * 4) * sz;
      o += `<ellipse cx="${f1(x)}" cy="${y}" rx="${f1(w)}" ry="${f1(w * 0.62)}" fill="${r() < 0.5 ? rut : hi}" stroke="${INK}" stroke-width="1" opacity=".85"/>`;
    }
    for (let i = 0, n = Math.round(40 * k) + 12; i < n; i++) {
      const x = r() * 1440, top = r() < 0.5, y = Y(top ? 14 + Math.sin(x / 190) * 4 : 64 + Math.sin(x / 150) * 3);
      o += `<path d="M${f1(x)} ${y}l${f1(-3 * sz)} ${f1(-9 * sz)}M${f1(x)} ${y}l${f1(sz)} ${f1(-11 * sz)}M${f1(x)} ${y}l${f1(4 * sz)} ${f1(-8 * sz)}" stroke="#3f8f3a" stroke-width="${f1(1.2 + sz)}" stroke-linecap="round" fill="none"/>`;
    }
    return o;
  }

  // The field runs from the horizon all the way to the front of the scene; the farm lanes sit behind it.
  const FIELD_T = [0.1, 0.125, 0.152, 0.182, 0.215, 0.25, 0.29, 0.335, 0.385, 0.44, 0.5, 0.565, 0.635, 0.71];
  const LANES = { w: { y0: VPY - 4, k: 0.28, ground: VPY + 4, scale: 0.46 }, b: { y0: VPY + 16, k: 0.26, ground: VPY + 21, scale: 0.36 } };
  // back lane: the wagon ride; front lane: the little barrel train
  const lanes = (season, fill, rut, hi, seed) =>
    roadArt(fill, rut, hi, seed, LANES.w.k, LANES.w.y0) + buildRig({ season, y: LANES.w.ground, scale: LANES.w.scale }) +
    roadArt(fill, rut, hi, seed + 1, LANES.b.k, LANES.b.y0) + barrelRig(LANES.b.ground, LANES.b.scale);

  function springField() {
    const rnd = rand(11);
    let out = `<path d="${groundPath()}" fill="#69b84c"/>`;
    out += lanes('spring', '#cfa571', '#b0804f', '#e3c18a', 6);
    out += rowPolys(range(-5, 5), { fill: '#8a5a35', stroke: INK, inner: '#a4714a', t0: 0.08 });
    const KIDS = { 6: [[-1.5, '#e5334b', HAT.straw, 0], [1.5, '#4b5bb8', HAT.cap, 1]], 9: [[0.5, '#ffc928', HAT.beanie, 0]], 11: [[-3.2, '#43a047', HAT.pony, 1]] };
    FIELD_T.forEach((t, ti) => {
      (KIDS[ti] || []).forEach(([k, shirt, hat, flip]) => { out += kid(rowX(k, t), rowY(t) - 2, 22 + 130 * t, shirt, hat, flip); });
      for (let k = -4; k <= 4; k++) {
        const cx = rowX(k, t), cy = rowY(t);
        const w = 22 + 130 * t, h = w * 0.75;
        out += use('sb-plant', cx - w / 2, cy - h * 0.94, w, h);
        const r = rnd();
        const count = r < 0.2 ? 0 : r < 0.6 ? 1 : 2;
        const bw = w * 0.27, bh = bw * 72 / 64;
        const spots = [[cx - w * 0.3 - bw / 2, cy - h * 0.56], [cx + w * 0.13, cy - h * 0.5]];
        for (let i = 0; i < count; i++) {
          const [bx, by] = spots[i];
          const berry = use('strawberry', 0, 0, bw, bh);
          if (t >= 0.2) {
            const pad = bw * 0.3;
            out += pickable(bx, by, berry, { x: -pad, y: -pad, w: bw + pad * 2, h: bh + pad * 2 });
          } else out += `<g transform="translate(${f1(bx)} ${f1(by)})">${berry}</g>`;
        }
      }
    });
    return out;
  }

  const springFore = () =>
    blades(520, 10, 30, 26, '#5cb85c', 4) +
    meadow(31, 34, 496, 528, ['#fff', '#ffd54f', '#ff8fb1', '#b79bff']) +
    sunflower(24, 205, 128, '') + sunflower(170, 300, 88, 's2') + sunflower(1236, 250, 112, 's3') + sunflower(1330, 178, 138, 's2') + sunflower(1160, 340, 78, '') +
    blades(538, 12, 34, 22, '#2e8b3a', 9);

  // Summer: the same sunflowers, but tap one and it is snipped. A kid cuts a flower for the bucket every few seconds.
  const snippable = (x, y, w, cls) => {
    const h = w * 380 / 140;
    return pickable(x, y, sunflower(0, 0, w, cls), { x: -4, y: -4, w: w + 8, h: h * 0.42 }, '50% 100%', 'fruit', 'flower-cut');
  };

  function flowerCutter(x, y) {
    const head = (sx, sy, sz) => `<use href="#sunflower" x="${sx}" y="${sy}" width="${sz}" height="${sz}"/>`;
    return `<g transform="translate(${x} ${y})">` +
      `<ellipse cx="14" cy="4" rx="74" ry="9" fill="rgba(58,36,22,.2)"/>` +
      // bucket
      `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M40 -58L48 -2H92L100 -58Z" fill="#b9c2cc"/>` +
      `<path d="M41 -46h58M43 -30h54" stroke="#8c97a3" stroke-width="2" fill="none"/><path d="M38 -58C38 -92 102 -92 102 -58" fill="none" stroke-width="3"/></g>` +
      head(26, -96, 40) + head(54, -108, 46) + head(86, -96, 38) +
      `<path d="M40 -58L48 -2H92L100 -58Z" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      // the flower that drops in
      `<g class="cut-flower"><path d="M-7 -24v-12" stroke="#3f9b45" stroke-width="5" stroke-linecap="round"/>${head(-24, -62, 34)}</g>` +
      // the kid, reaching up with scissors
      `<g class="npc" data-npc="cutter" transform="translate(-30 -12) scale(1.35)"><g class="npc-body">` +
      `<path d="M-7 18l-3 14M7 18l3 14" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M-7 18l-3 14M7 18l3 14" stroke="#4b5bb8" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
      person(0, 0, '#e5334b', HAT.straw, true) +
      `<g transform="translate(18 -14)"><g class="snip"><path d="M0 0l9-5M0 0l9 4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle cx="-2" cy="-1" r="1.6" fill="none" stroke="${INK}" stroke-width="1.6"/></g></g></g>` +
      `<rect class="npc-hit" x="-15" y="-30" width="54" height="68" fill="transparent"/></g></g>`;
  }

  const summerFore = () =>
    blades(520, 10, 30, 26, '#5cb85c', 4) +
    meadow(37, 30, 496, 528, ['#fff', '#ffd54f', '#ff8fb1', '#8fbfff']) +
    snippable(24, 205, 128, '') + snippable(170, 300, 88, 's2') + snippable(1236, 250, 112, 's3') + snippable(1330, 178, 138, 's2') + snippable(1160, 340, 78, '') +
    flowerCutter(1010, 474) +
    blades(538, 12, 34, 22, '#2e8b3a', 9);


  /* ------------------------------------------------------------------ *
   * SUMMER — blueberry bushes
   * ------------------------------------------------------------------ */
  const blueBerry = (r, ripe = true) =>
    `<circle r="${f1(r)}" fill="${ripe ? '#4d5fc9' : '#a8b4ea'}" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M0 ${f1(-r * 0.46)}l${f1(r * 0.3)} ${f1(r * 0.24)}-${f1(r * 0.12)} ${f1(r * 0.36)}h-${f1(r * 0.36)}l-${f1(r * 0.12)}-${f1(r * 0.36)}Z" transform="translate(${f1(r * 0.12)} ${f1(r * 0.18)})" fill="${ripe ? '#2c3a86' : '#7d8acb'}"/>` +
    `<ellipse cx="${f1(-r * 0.38)}" cy="${f1(-r * 0.4)}" rx="${f1(r * 0.24)}" ry="${f1(r * 0.34)}" fill="#fff" opacity=".5" transform="rotate(30 ${f1(-r * 0.38)} ${f1(-r * 0.4)})"/>`;

  // local bush coordinates: 100 x 80, base centre (50, 80)
  const BUSH_RIPE = [[22, 54], [36, 44], [52, 36], [66, 42], [79, 52], [45, 60], [62, 60], [30, 68], [72, 68]];
  const BUSH_GREEN = [[14, 62], [86, 60], [54, 70]];

  function bush(cx, cy, w, pickN) {
    const s = w / 100, h = 80 * s, ox = cx - w / 2, oy = cy - h;
    const sw = f1(2.8 / s);
    let out = `<g transform="translate(${f1(ox)} ${f1(oy)}) scale(${f1(s * 1000) / 1000})">` +
      `<ellipse cx="50" cy="80" rx="52" ry="7" fill="rgba(58,36,22,.2)"/>` +
      `<path d="M6 80C-2 60 6 40 22 38C20 20 44 6 58 18C72 4 96 20 92 38C106 46 102 70 94 80Z" fill="#2e7d3a" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>` +
      `<g fill="#43a047"><ellipse cx="30" cy="48" rx="15" ry="8" transform="rotate(-24 30 48)"/><ellipse cx="66" cy="34" rx="16" ry="8" transform="rotate(18 66 34)"/><ellipse cx="50" cy="62" rx="17" ry="8" transform="rotate(-6 50 62)"/><ellipse cx="82" cy="58" rx="11" ry="7" transform="rotate(26 82 58)"/></g>` +
      `<g fill="#66bb6a"><ellipse cx="34" cy="42" rx="8" ry="4" transform="rotate(-24 34 42)"/><ellipse cx="62" cy="30" rx="8" ry="4" transform="rotate(18 62 30)"/></g>` +
      `<g fill="none" stroke="#1f5f2b" stroke-width="1.3" stroke-linecap="round" opacity=".55"><path d="M17 51l26-6M52 62l28-6M56 34l22 6M72 55l22 4M26 44l16-2M44 30l12 2"/><path d="M20 46c2 4 5 6 9 6M70 60c3 3 7 4 11 3M60 38c2 3 6 4 9 3"/></g>` +
      `<g fill="#86c98a" opacity=".7"><ellipse cx="22" cy="40" rx="6" ry="3" transform="rotate(-30 22 40)"/><ellipse cx="76" cy="44" rx="6" ry="3" transform="rotate(25 76 44)"/><ellipse cx="42" cy="22" rx="6" ry="3" transform="rotate(-10 42 22)"/></g>` +
      `<path d="M14 66c14 5 30 6 44 4" fill="none" stroke="#1f5f2b" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>`;
    BUSH_GREEN.forEach(([x, y]) => { out += `<g transform="translate(${x} ${y})">${blueBerry(4.2, false)}</g>`; });
    if (pickN === 0) BUSH_RIPE.slice(0, 5).forEach(([x, y]) => { out += `<g transform="translate(${x} ${y})">${blueBerry(5.6)}</g>`; });
    out += '</g>';
    // pickable ripe berries live in global coordinates so their hit areas stay a sensible size
    if (pickN > 0) {
      BUSH_RIPE.slice(0, pickN).forEach(([bx, by]) => {
        const r = 5.6 * s, hit = r + 5;
        out += pickable(ox + bx * s, oy + by * s, blueBerry(r), { x: -hit, y: -hit, w: hit * 2, h: hit * 2 }, '50% 50%');
      });
    }
    return out;
  }

  // Two open walking lanes through the bushes (a column of bushes left out) where people stand and pick, and two people in front of the field.
  const BERRY_LANES = [{ k: 1, from: 7 }, { k: -2, from: 9 }];
  // row index -> [column, shirt, hat, faces left?, size] (size 1 = a child, 1.3 = a grown-up)
  const BERRY_PICKERS = {
    8: [[1, '#e5334b', 'straw', 1, 1]],
    9: [[-2, '#43a047', 'pony', 0, 1]],
    10: [[1, '#4b5bb8', 'cap', 0, 1.3], [1.5, '#ffc928', 'beanie', 1, 0.9]],
    11: [[-2, '#e5334b', 'beanie', 1, 1.25]]
  };
  const BERRY_FRONT = [[640, '#ffc928', 'cap', 0, 1], [1190, '#4b5bb8', 'pony', 1, 1.05]];

  function summerField() {
    const rnd = rand(23);
    let out = `<path d="${groundPath()}" fill="#63b34a"/>`;
    out += lanes('summer', '#d9b27a', '#b88e56', '#ecd0a0', 8);
    out += rowPolys(range(-5, 5), { fill: '#c9a06a', stroke: '#6b4a28', inner: '#dcb884', hw: 60, innerHw: 30, t0: 0.08 });
    FIELD_T.forEach((t, ti) => {
      for (let k = -4; k <= 4; k++) {
        const w = 36 + 150 * t;
        const n = t >= 0.22 ? 4 + Math.floor(rnd() * 3) : 0;   // always draw the random number, so the other bushes look the same with or without the lanes
        if (BERRY_LANES.some((l) => l.k === k && ti >= l.from)) continue;
        out += bush(rowX(k, t), rowY(t) + 2, w, n);
      }
      (BERRY_PICKERS[ti] || []).forEach(([k, shirt, hat, flip, size]) => {
        out += berryPicker(rowX(k, t), rowY(t) + 6, (22 + 130 * t) * 0.64 * size, shirt, HAT[hat], flip);
      });
    });
    BERRY_FRONT.forEach(([x, shirt, hat, flip, size]) => { out += berryPicker(x, rowY(0.71) + 24, (22 + 130 * 0.8) * 0.64 * size, shirt, HAT[hat], flip); });
    // bees working the bushes
    [[420, 372, 30, 'a', 0], [566, 340, 24, 'b', -2.5], [760, 360, 28, 'c', -5], [930, 338, 24, 'a', -1.2], [1052, 380, 32, 'b', -6]]
      .forEach(([x, y, w, v, dl]) => { out += miniBee(x, y, w, v, dl); });
    return out;
  }

  // A small bee: its own little flight path, wings blurring.
  function miniBee(x, y, w, v, dl) {
    return `<g transform="translate(${x} ${y})"><g class="bzz bzz-${v}" style="animation-delay:${dl}s">` +
      `<g transform="scale(${f1(w / 64 * 100) / 100})">` +
      `<g class="wing-a"><ellipse class="wing" cx="26" cy="12" rx="9" ry="13" transform="rotate(-22 26 12)" fill="#e6f6ff" stroke="${INK}" stroke-width="2.6"/></g>` +
      `<g class="wing-b"><ellipse class="wing" cx="37" cy="12" rx="8" ry="12" transform="rotate(18 37 12)" fill="#f3fbff" stroke="${INK}" stroke-width="2.6"/></g>` +
      `<path d="M11 28 3 28 11 32Z" fill="${INK}"/><ellipse cx="32" cy="28" rx="21" ry="13" fill="#ffc928"/>` +
      `<path d="M24 16.5h6v23h-6ZM36 16.5h6v23h-6Z" fill="${INK}"/><ellipse cx="32" cy="28" rx="21" ry="13" fill="none" stroke="${INK}" stroke-width="3.4"/>` +
      `<circle cx="53" cy="27" r="8.5" fill="#ffd54f" stroke="${INK}" stroke-width="3.4"/><circle cx="56" cy="25" r="2.4" fill="${INK}"/></g></g></g>`;
  }

  /* ------------------------------------------------------------------ *
   * FALL — pumpkin patch, road with a tractor + wagon, scarecrow
   * ------------------------------------------------------------------ */
  const leafUse = (x, y, a, s, fill = '#4aa04a') =>
    `<use href="#pumpkin-leaf" transform="translate(${f1(x)} ${f1(y)}) rotate(${a}) scale(${s})" fill="${fill}" stroke="${INK}" stroke-width="${f1(2.4 / s)}" stroke-linejoin="round"/>`;

  function person(x, y, shirt, hat, wave) {
    const skin = '#f7c9a0';
    return `<g transform="translate(${x} ${y})" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">` +
      (wave ? `<g class="wave"><path d="M7 3l10-11" stroke-width="5.4"/><path d="M7 3l10-11" stroke-width="2.6" stroke="${shirt}"/><circle cx="18" cy="-12" r="3.3" fill="${skin}"/></g>` : '') +
      `<rect x="-8" y="0" width="16" height="18" rx="6" fill="${shirt}"/>` +
      `<path d="M-3.4 0.6 0 5l3.4-4.4" fill="#fff" stroke-width="1.6"/><path d="M-8 12h16" stroke="#fff" stroke-width="1.6" opacity=".45" fill="none"/>` +
      `<rect x="-2.6" y="-2" width="5.2" height="4.6" rx="1.6" fill="${skin}" stroke-width="1.6"/>` +
      `<circle cx="-8.6" cy="-8.4" r="2.5" fill="${skin}" stroke-width="1.8"/><circle cx="8.6" cy="-8.4" r="2.5" fill="${skin}" stroke-width="1.8"/>` +
      `<circle cx="0" cy="-9" r="9" fill="${skin}"/>` + hat +
      `<ellipse cx="-5.6" cy="-5.6" rx="2.2" ry="1.4" fill="#ff8fa3" opacity=".6" stroke="none"/><ellipse cx="5.6" cy="-5.6" rx="2.2" ry="1.4" fill="#ff8fa3" opacity=".6" stroke="none"/>` +
      `<path d="M-5.4 -12.6q2.2-1.4 4 0M1.4 -12.6q2 -1.4 4 0" fill="none" stroke-width="1.2"/>` +
      `<circle cx="-3.2" cy="-9.4" r="1.2" fill="${INK}" stroke="none"/><circle cx="3.2" cy="-9.4" r="1.2" fill="${INK}" stroke="none"/>` +
      `<circle cx="-2.7" cy="-9.9" r=".42" fill="#fff" stroke="none"/><circle cx="3.7" cy="-9.9" r=".42" fill="#fff" stroke="none"/>` +
      `<path d="M-.7 -7.4h1.4" fill="none" stroke-width="1.2"/>` +
      `<path d="M-3 -5.2q3 2.8 6 0" fill="none" stroke-width="1.6"/></g>`;
  }
  const HAT = {
    beanie: '<path d="M-9.4 -12a9.4 9.4 0 0 1 18.8 0Z" fill="#e5334b"/><path d="M-9.6 -13h19.2" stroke-width="3" stroke="#ffc928"/>',
    straw:  '<path d="M-13.5 -13h27" stroke-width="3"/><path d="M-8 -13a8 8 0 0 1 16 0Z" fill="#e9c46a"/><path d="M-8 -14.5h16" stroke="#e5334b" stroke-width="2.2"/>',
    cap:    '<path d="M-9 -13a9 9 0 0 1 18 0Z" fill="#4b5bb8"/><path d="M-1 -13h13" stroke-width="3"/>',
    hair:   '<path d="M-9.4 -11a9.4 9.4 0 0 1 18.8 0c-4-4.5-14-4.5-18.8 0Z" fill="#8a5a35"/><path d="M-6 -17.4q3-1.8 6 0" fill="none" stroke="#b97a4a" stroke-width="1.4"/>',
    pony:   '<path d="M-9.4 -11a9.4 9.4 0 0 1 18.8 0c-4-4.5-14-4.5-18.8 0Z" fill="#c8602a"/><path d="M8 -15q9 1 6 9" fill="none" stroke="#c8602a" stroke-width="3.6"/><path d="M8 -15q9 1 6 9" fill="none" stroke-width=".8"/><circle cx="8.6" cy="-14.4" r="1.9" fill="#ff4d8d" stroke-width="1.4"/>',
  };

  // Wheels: `cls` makes them turn (see css/hero.css)
  const tractorWheel = (cx, cy, r, cls, big) => {
    let bolts = '';
    for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 - Math.PI / 2; bolts += `<circle cx="${f1(cx + Math.cos(a) * r * 0.4)}" cy="${f1(cy + Math.sin(a) * r * 0.4)}" r="${f1(r * 0.05 + 0.6)}" fill="${INK}"/>`; }
    return `<g class="wheel ${cls}"><circle cx="${cx}" cy="${cy}" r="${f1(r + 1.2)}" fill="none" stroke="#2b2b30" stroke-width="${big ? 7 : 4.6}" stroke-dasharray="${big ? '6.6 5.6' : '4.2 4'}"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#2b2b30" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.8)}" fill="none" stroke="#4a4a55" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.56)}" fill="#c92b25" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.34)}" fill="none" stroke="#8f1d19" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.24)}" fill="#f4ead2" stroke="${INK}" stroke-width="2.4"/>` + bolts + `</g>`;
  };
  const wheelWood = (cx, cy, r, cls) => {
    let sp = '', nails = '';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; sp += `M${cx} ${cy}L${f1(cx + Math.cos(a) * r * 0.84)} ${f1(cy + Math.sin(a) * r * 0.84)}`; nails += `<circle cx="${f1(cx + Math.cos(a + .26) * r * 0.9)}" cy="${f1(cy + Math.sin(a + .26) * r * 0.9)}" r="1" fill="${INK}"/>`; }
    return `<g class="wheel ${cls}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#9aa4ad" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.88)}" fill="#d9a066" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.7)}" fill="#e8bb7e" stroke="${INK}" stroke-width="1.8"/>` +
      `<path d="${sp}" stroke="${INK}" stroke-width="3.6" stroke-linecap="round" fill="none"/><path d="${sp}" stroke="#b8794a" stroke-width="1.6" stroke-linecap="round" fill="none"/>` + nails +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.24)}" fill="#7a4b2a" stroke="${INK}" stroke-width="2.4"/><circle cx="${cx}" cy="${cy}" r="${f1(r * 0.09)}" fill="#9aa4ad" stroke="${INK}" stroke-width="1.2"/></g>`;
  };

  // The tractor is red and OPEN: seat, steering wheel and exhaust, no cab and no roof.
  // Local box -10..140 x 0..100, ground at y = 100, facing right. `wheels` = false draws the plain icon version.
  function tractorOpen(wheels = true) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    const RED = '#d8322b', RED_D = '#a8221d';
    return `<g ${sk}>` +
      // drawbar + hook at the back
      `<rect x="-6" y="82" width="38" height="7" rx="3" fill="#5d6770"/><circle cx="-6" cy="85.5" r="3.6" fill="none"/>` +
      // rear axle housing
      `<path d="M26 60H78V88H26Z" fill="${RED_D}"/>` +
      (wheels ? tractorWheel(38, 73, 27, 'wt1', true) : `<circle cx="38" cy="73" r="27" fill="#2b2b30"/><circle cx="38" cy="73" r="15" fill="#c92b25"/><circle cx="38" cy="73" r="6.5" fill="#f4ead2" stroke-width="2.4"/>`) +
      // fender over the big wheel
      `<path d="M1 73A37 37 0 0 1 75 73H70.5A32.5 32.5 0 0 0 5.5 73Z" fill="${RED}"/>` +
      `<path d="M7 66A32 32 0 0 1 34 41" fill="none" stroke="#fff" stroke-width="2.6" opacity=".45"/>` +
      `<circle cx="3.4" cy="71" r="2.6" fill="#ffb300" stroke-width="2"/>` +
      // foot plate and engine hood
      `<rect x="48" y="58" width="26" height="6" rx="2" fill="#8c96a0"/><path d="M52 61h18" stroke-width="1.6" opacity=".5"/>` +
      `<path d="M70 88V58c0-6 4-10 10-10h30c6 0 10 3 12 8l8 16v16Z" fill="${RED}"/>` +
      `<path d="M72 80H128" fill="none" stroke="${RED_D}" stroke-width="5"/>` +
      `<path d="M80 53h30" fill="none" stroke="#fff" stroke-width="3" opacity=".42"/>` +
      `<path d="M84 61h20M84 67h20M84 73h20" fill="none" stroke="${RED_D}" stroke-width="2.2"/>` +
      `<circle cx="93" cy="47.4" r="3.2" fill="#9aa4ad" stroke-width="2"/>` +
      `<path d="M121 57l8 15v15h-8Z" fill="#7a1713" stroke-width="2.6"/><path d="M121 64h8M121 71h8M121 78h8" fill="none" stroke="#c9d1d8" stroke-width="2"/>` +
      `<circle cx="127" cy="62" r="4.6" fill="#fff2a8" stroke-width="2.4"/><circle cx="127" cy="62" r="1.8" fill="#ffd54f" stroke="none"/>` +
      `<rect x="128" y="76" width="9" height="9" rx="2.4" fill="#5d6770" stroke-width="2.6"/>` +
      // exhaust pipe
      `<rect x="101" y="20" width="7" height="29" rx="2.5" fill="#78848f"/><rect x="98.5" y="16" width="12" height="6" rx="2.4" fill="#5d6770" stroke-width="2.6"/><path d="M103.6 26v18" fill="none" stroke="#fff" stroke-width="1.8" opacity=".45"/>` +
      // seat and the open operator's station
      `<rect x="33" y="40" width="6" height="6" fill="#5d6770" stroke-width="2.4"/><rect x="21" y="35" width="28" height="6.4" rx="3" fill="#3c3c46"/><rect x="19" y="16" width="8" height="22" rx="3.6" fill="#3c3c46"/>` +
      `<path d="M42 38l15 1 7 18" fill="none" stroke-width="8.6"/><path d="M42 38l15 1 7 18" fill="none" stroke="#3b5ba5" stroke-width="5.4"/>` +
      `<rect x="59" y="54.6" width="11" height="6.4" rx="2.2" fill="#3c3c46" stroke-width="2.4"/>` +
      `<path d="M69 54L58 32" fill="none" stroke-width="6"/><path d="M69 54L58 32" fill="none" stroke="#6c7a86" stroke-width="3"/>` +
      person(36, 19, '#e8e2cf', HAT.straw, false) +
      `<path d="M43 25l13 4" fill="none" stroke-width="7"/><path d="M43 25l13 4" fill="none" stroke="#e8e2cf" stroke-width="4"/><circle cx="57" cy="29.4" r="3.4" fill="#f7c9a0" stroke-width="2"/>` +
      `<ellipse cx="56.4" cy="29" rx="11.5" ry="4" transform="rotate(-22 56.4 29)" fill="none" stroke-width="5.6"/><ellipse cx="56.4" cy="29" rx="11.5" ry="4" transform="rotate(-22 56.4 29)" fill="none" stroke="#4a4a54" stroke-width="2.6"/>` +
      // front wheel
      `<rect x="106" y="86" width="26" height="6" rx="2.4" fill="#5d6770" stroke-width="2.6"/>` +
      (wheels ? tractorWheel(124, 87, 13, 'wt2', false) : `<circle cx="124" cy="87" r="13" fill="#2b2b30"/><circle cx="124" cy="87" r="7" fill="#c92b25"/><circle cx="124" cy="87" r="3" fill="#f4ead2" stroke-width="2"/>`) +
      `</g>`;
  }

  // What rides on the wagon depends on the season (never hay: this is a wagon ride, not a hay ride)
  function wagonProps(season) {
    const bucket = (x, fill) => `<path d="M${x} -107h30l-3 22H${x + 3}Z" fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M${x + 3} -100h24" stroke="rgba(58,36,22,.35)" stroke-width="1.6" fill="none"/>`;
    if (season === 'spring') {
      const pint = (x) => `<g transform="translate(${x} -107)"><use href="#strawberry" x="1" y="-14" width="11" height="12.4"/><use href="#strawberry" x="14" y="-13" width="11" height="12.4"/><use href="#strawberry" x="7" y="-20" width="11" height="12.4"/>` +
        `<path d="M0 0h26l-3 22H3Z" fill="#7fb6a4" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M5 8h16M6 15h14" stroke="#4d8a78" stroke-width="1.6" fill="none"/></g>`;
      return pint(-134) + pint(106);
    }
    if (season === 'summer') {
      return `<path d="M-123 -107L-128 -124M-123 -107L-110 -118" stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M-123 -107L-128 -124M-123 -107L-110 -118" stroke="#3f9b45" stroke-width="3" stroke-linecap="round" fill="none"/>` +
        `<use href="#sunflower" x="-148" y="-146" width="38" height="38"/><use href="#sunflower" x="-124" y="-137" width="32" height="32"/>` + bucket(-138, '#b9c2cc') +
        `<g transform="translate(106 0)">${bucket(0, '#b9c2cc')}<circle cx="8" cy="-109" r="5.6" fill="#4d5fc9" stroke="${INK}" stroke-width="2"/><circle cx="17" cy="-112" r="5.6" fill="#5b6bcc" stroke="${INK}" stroke-width="2"/><circle cx="25" cy="-108" r="5.2" fill="#4d5fc9" stroke="${INK}" stroke-width="2"/><circle cx="13" cy="-116" r="5" fill="#4d5fc9" stroke="${INK}" stroke-width="2"/></g>`;
    }
    return `<use href="#pumpkin" x="-134" y="-112" width="32" height="27"/><use href="#pumpkin-w" x="106" y="-108" width="28" height="24"/>`;
  }

  // The five kids on the wagon; the invisible tap targets are added after the rig's own (see buildRig) so they sit on top of it.
  const RIDERS = [[-96, -100, '#e5334b', HAT.beanie, true], [-44, -96, '#4b5bb8', HAT.cap, false], [8, -98, '#43a047', HAT.straw, true], [56, -94, '#ffc928', HAT.pony, false], [100, -98, '#ff7a3d', HAT.hair, true]];
  const riderHits = () => RIDERS.map(([x, y], i) => `<rect class="npc-hit" data-npc="rider" data-r="${i}" x="${x - 16}" y="${y - 30}" width="32" height="50" fill="transparent"/>`).join('');

  // The wagon (ground at y = 0, centre x = 0): kids behind the side boards, wooden wheels. No hay.
  function wagonArt(season, tongue = true) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    let planks = '', studs = '';
    [[-70, '#b8794a'], [-59, '#c98a4b'], [-48, '#b8794a']].forEach(([y, f]) => { planks += `<rect x="-138" y="${y}" width="276" height="11" fill="${f}"/>`; });
    for (let x = -126; x <= 126; x += 28) studs += `<circle cx="${x}" cy="-64" r="1.3" fill="${INK}" stroke="none"/><circle cx="${x}" cy="-53" r="1.3" fill="${INK}" stroke="none"/>`;
    const posts = [-138, -92, -46, 0, 46, 92, 138].map((x) => `<rect x="${x - 4}" y="-82" width="8" height="38" rx="2" fill="#8a5a35"/>`).join('');
    return `<ellipse cx="0" cy="3" rx="160" ry="6" fill="rgba(58,36,22,.25)"/>` +
      // the riders sit behind the side boards
      RIDERS.map(([x, y, shirt, hat, wave], i) => `<g class="npc-body" data-r="${i}">${person(x, y, shirt, hat, wave)}</g>`).join('') +
      `<g ${sk}>` +
        // chassis: axles, beam and the deck
        `<rect x="-100" y="-26" width="200" height="7" rx="2" fill="#7a4b2a"/><rect x="-92" y="-22" width="8" height="12" fill="#5c3720"/><rect x="84" y="-22" width="8" height="12" fill="#5c3720"/>` +
        `<rect x="-146" y="-33" width="14" height="6" rx="2" fill="#8a5a35"/>` +
        `<rect x="-140" y="-48" width="280" height="24" rx="4" fill="#a5673f"/><path d="M-132 -37h264M-132 -30h264" stroke="#7a4b2a" stroke-width="2" fill="none"/>` +
        // the side boards, with posts and a painted sign
        `<g>${planks}</g><path d="M-138 -59H138M-138 -48H138" stroke="${INK}" stroke-width="2.4" fill="none"/>` +
        `<rect x="-138" y="-48" width="276" height="4.6" fill="#d8322b" stroke-width="2.4"/>` + studs +
        posts + `<rect x="-142" y="-86" width="284" height="7" rx="3.4" fill="#d9a066"/><path d="M-136 -83h272" stroke="#fff" stroke-width="1.8" opacity=".45" fill="none"/>` +
        `<rect x="-52" y="-68" width="104" height="19" rx="4" fill="#fff3d6" stroke-width="2.6"/>` +
        `<path d="M138 -86V-50" stroke-width="3.4"/>` +
      `</g>` + wagonProps(season) +
      `<text x="0" y="-54.4" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11.5" fill="${INK}" letter-spacing=".8">WAGON RIDES</text>` +
      wheelWood(-88, -22, 24, 'wg1') + wheelWood(88, -22, 24, 'wg2') +
      (tongue ? `<path d="M138 -36L194 -17" stroke="${INK}" stroke-width="8" stroke-linecap="round" fill="none"/><path d="M138 -36L194 -17" stroke="#8a5a35" stroke-width="3.8" stroke-linecap="round" fill="none"/>` : '');
  }

  function buildRig(cfg = {}) {
    const c = Object.assign({ y: VPY + 52, scale: 1, season: 'fall' }, cfg);
    const trailer = wagonArt(c.season);

    const S = 1.08, TX = 202, TY = -108;
    const tractor = `<g transform="translate(${TX} ${TY}) scale(${S})">${tractorOpen(true)}</g>` +
      `<g class="rig-smoke" transform="translate(${f1(TX + 105 * S)} ${f1(TY + 13 * S)})" fill="#fff" stroke="#cfcfcf" stroke-width="1.5">` +
        `<circle class="puff p1" r="7"/><circle class="puff p2" r="5.5"/><circle class="puff p3" r="6.5"/></g>` +
      `<g transform="translate(292 -168) scale(${f1(0.78 / c.scale * 100) / 100})"><g class="toot"><rect x="-42" y="-17" width="84" height="28" rx="14" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M-6 10l6 11 6-11" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-7 8.5h14" stroke="#fff" stroke-width="5"/>` +
      `<text class="toot-say" x="0" y="3" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="${INK}">${t('Toot toot!')}</text></g></g>`;

    // wheels turn at a speed that matches how far the tractor travels per second at this size
    const sc = c.scale, vars = `--wt1:${f1(3.7 * sc)}s;--wt2:${f1(2.1 * sc)}s;--wg1:${f1(2.9 * sc)}s;--wg2:${f1(2.9 * sc)}s;`;
    return `<g transform="translate(0 ${c.y})"><g class="rig" style="${vars}"><g transform="scale(${sc})"><g class="rig-bounce">${trailer}${tractor}</g>` +
      `<rect class="scene-hit" data-rig x="-150" y="-190" width="520" height="200" fill="transparent"/>${riderHits()}</g></g></g>`;
  }

  // A small tractor pulling plastic barrels laid on their sides. Each barrel has a hole cut in the top,
  // a chair inside and a steering wheel for the kid (who waves with the other hand), wheels underneath,
  // and they are hitched together. Local box 0..334 x -20..100 (ground y = 96).
  // `animated` adds the wheel classes and the puffs of smoke; `ref` points at the #tractor icon instead of drawing it.
  function barrelTrain(animated = false, ref = false) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    const kids = [['#e5334b', 'beanie'], ['#ffc928', 'cap'], ['#43a047', 'straw']];
    const skin = '#f7c9a0';
    const hatSvg = (h) => h === 'beanie' ? `<path d="M-8.6 -9.2a8.6 8.6 0 0 1 17.2 0Z" fill="#e5334b"/><path d="M-8.8 -10h17.6" stroke="#ffc928" stroke-width="2.6"/>`
      : h === 'cap' ? `<path d="M-8.2 -9.4a8.2 8.2 0 0 1 16.4 0Z" fill="#4b5bb8"/><path d="M-1 -9.6h12" stroke-width="2.8"/>`
      : `<path d="M-12 -10h24" stroke-width="2.8"/><path d="M-7.4 -10a7.4 7.4 0 0 1 14.8 0Z" fill="#e9c46a"/><path d="M-7.4 -11.4h14.8" stroke="#e5334b" stroke-width="2"/>`;
    let out = `<ellipse cx="167" cy="97" rx="162" ry="3.8" fill="rgba(58,36,22,.22)"/>`;
    for (let i = 0; i < 3; i++) {
      const ox = 8 + i * 64, [shirt, hat] = kids[i], cx = ox + 29;
      // wheels and frame under the barrel
      out += `<g ${sk}><rect x="${ox + 4}" y="76" width="50" height="5" rx="2" fill="#5d6770"/>` +
        [ox + 13, ox + 45].map((x, k) => `<g class="${animated ? 'wheel bt' + (i * 2 + k) : ''}"><circle cx="${x}" cy="86" r="9.4" fill="#2b2b30"/><circle cx="${x}" cy="86" r="4.8" fill="#c9d1d8" stroke-width="2.2"/><circle cx="${x}" cy="86" r="1.5" fill="${INK}" stroke="none"/></g>`).join('') + `</g>`;
      // the barrel: blue plastic, ribbed
      out += `<g ${sk}><rect x="${ox}" y="42" width="58" height="38" rx="15" fill="#2f6fd6"/>` +
        `<path d="M${ox + 12} 42v38M${ox + 29} 42v38M${ox + 46} 42v38" fill="none" stroke="#1f4fa0" stroke-width="2.6"/>` +
        `<path d="M${ox + 9} 50h40" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/><path d="M${ox + 9} 73h40" fill="none" stroke="#1a3f86" stroke-width="2.4" opacity=".5"/></g>` +
        `<ellipse cx="${ox + 8}" cy="61" rx="3.2" ry="5" fill="#1f4fa0" stroke="${INK}" stroke-width="1.8"/>`;
      // the hole cut in the top, the chair, the kid (one hand waving), and the front lip of the hole
      out += `<ellipse cx="${cx}" cy="44" rx="17" ry="6" fill="#0f1b3d" stroke="${INK}" stroke-width="3"/>` +
        `<g ${sk}><rect x="${cx - 15}" y="26" width="6.4" height="19" rx="2.6" fill="#ff8a3d"/></g>` +
        `<g class="npc-body" data-r="${i}"><g transform="translate(${cx + 2} 38)" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">` +
          `<g class="${animated ? 'wave' : ''}"><path d="M-4 3l-8 -12" fill="none" stroke-width="5.2"/><path d="M-4 3l-8 -12" fill="none" stroke="${shirt}" stroke-width="2.6"/><circle cx="-12.6" cy="-10" r="3.1" fill="${skin}"/></g>` +
          `<rect x="-7.6" y="-1" width="15.2" height="12" rx="5" fill="${shirt}"/>` +
          `<circle cx="0" cy="-9" r="8.4" fill="${skin}"/>${hatSvg(hat)}` +
          `<circle cx="-3" cy="-9.2" r="1.1" fill="${INK}" stroke="none"/><circle cx="3" cy="-9.2" r="1.1" fill="${INK}" stroke="none"/><path d="M-2.6 -5.2q2.6 2.4 5.2 0" fill="none" stroke-width="1.5"/>` +
          `<ellipse cx="-5.4" cy="-5.8" rx="2" ry="1.3" fill="#ff8fa3" opacity=".6" stroke="none"/><ellipse cx="5.4" cy="-5.8" rx="2" ry="1.3" fill="#ff8fa3" opacity=".6" stroke="none"/>` +
          `<path d="M5 3l11 3" fill="none" stroke-width="5.2"/><path d="M5 3l11 3" fill="none" stroke="${shirt}" stroke-width="2.6"/></g></g>` +
        (animated ? `<rect class="npc-hit" data-npc="barrel" data-r="${i}" x="${ox}" y="20" width="58" height="62" fill="transparent"/>` : '') +
        // steering wheel on a short post
        `<g ${sk}><path d="M${cx + 19} 45L${cx + 17} 36" fill="none" stroke-width="4.6"/><path d="M${cx + 19} 45L${cx + 17} 36" fill="none" stroke="#6c7a86" stroke-width="2"/>` +
        `<ellipse cx="${cx + 17}" cy="35" rx="8" ry="3" transform="rotate(-22 ${cx + 17} 35)" fill="none" stroke-width="4.4"/><ellipse cx="${cx + 17}" cy="35" rx="8" ry="3" transform="rotate(-22 ${cx + 17} 35)" fill="none" stroke="#ffc928" stroke-width="2"/></g>` +
        `<path d="M${cx - 17} 44a17 6 0 0 0 34 0" fill="none" stroke="#dbe7ff" stroke-width="2.4" stroke-linecap="round"/>` +
        // the hitch to the next car
        (i < 2 ? `<g ${sk}><rect x="${ox + 56}" y="68" width="10" height="4.6" rx="2" fill="#5d6770"/><circle cx="${ox + 62}" cy="70.3" r="1.5" fill="#c9d1d8" stroke-width="1.4"/></g>` : '');
    }
    // the tractor up front: clearly bigger than the kids, with a puff of smoke from its exhaust
    const S = 0.8, TX = 218.8, TY = 16;
    out += `<g ${sk}><path d="M196 71L214 86" fill="none" stroke-width="8"/><path d="M196 71L214 86" fill="none" stroke="#5d6770" stroke-width="3.6"/></g>` +
      `<g transform="translate(${TX} ${TY}) scale(${S})">${ref ? '<use href="#tractor" x="-10" y="0" width="150" height="100"/>' : tractorOpen(animated)}</g>` +
      (animated ? `<g class="rig-smoke" transform="translate(${f1(TX + 105 * S)} ${f1(TY + 13 * S)})" fill="#fff" stroke="#cfcfcf" stroke-width="1.5"><circle class="puff p1" r="7"/><circle class="puff p2" r="5.5"/><circle class="puff p3" r="6.5"/></g>` : '');
    return out;
  }

  // The little barrel train, drawn small for the distance (the lane itself comes from `lanes`)
  function barrelRig(y, sc) {
    const sp = sc / 0.46;
    return `<g transform="translate(0 ${y})"><g class="rig rig-barrel" style="--wt1:${f1(1.9 * sp)}s;--wt2:${f1(1.1 * sp)}s;"><g transform="scale(${sc})"><g class="rig-bounce"><g transform="translate(-167 -96)">${barrelTrain(true)}</g></g></g></g></g>`;
  }

  function fallField() {
    const rnd = rand(31);
    let out = `<path d="${groundPath()}" fill="#a9bd45"/>`;
    out += lanes('fall', '#c69a63', '#a9794a', '#dcb57c', 5);
    out += rowPolys(range(-5, 5), { fill: '#8a5a35', stroke: INK, inner: '#a4714a', t0: 0.08 });

    const variants = ['pumpkin', 'pumpkin', 'pumpkin-b', 'pumpkin-b', 'pumpkin-w'];
    FIELD_T.forEach((t) => {
      for (let k = -4; k <= 4; k++) {
        const hw = 6 + 58 * t;
        const cx = rowX(k, t) + (rnd() - 0.5) * hw * 0.9, cy = rowY(t) + (rnd() - 0.5) * 6;
        const w = (26 + 118 * t) * (0.85 + rnd() * 0.3), h = w * 92 / 110;
        const id = variants[Math.floor(rnd() * variants.length)];
        const flip = rnd() < 0.5 ? -1 : 1;
        // leaves + a curl of vine behind each pumpkin
        let plant = leafUse(cx - w * 0.42 * flip, cy - h * 0.2, -70 * flip, w / 105) + leafUse(cx + w * 0.5 * flip, cy - h * 0.16, 62 * flip, w / 120, '#3f9b45') +
          `<path d="M${f1(cx + w * 0.05)} ${f1(cy - h * 0.86)}c${f1(w * 0.18)} ${f1(-h * 0.2)} ${f1(w * 0.42)} ${f1(-h * 0.08)} ${f1(w * 0.36)} ${f1(h * 0.14)}" fill="none" stroke="#2f8f3a" stroke-width="${f1(2 + t * 2.6)}" stroke-linecap="round"/>`;
        const body = `<ellipse cx="0" cy="${f1(h * 0.02)}" rx="${f1(w * 0.44)}" ry="${f1(w * 0.09)}" fill="rgba(58,36,22,.25)"/>` + use(id, -w / 2, -h * 0.94, w, h);
        const pad = w * 0.12;
        out += plant + pickable(cx, cy, body, { x: -w / 2 - pad, y: -h - pad, w: w + pad * 2, h: h + pad * 2 }, '50% 100%');
      }
    });
    return out;
  }

  const bale = (x, y, w, h) =>
    `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#f0c95a"/>` +
    `<path d="M${x + 8} ${f1(y + h * 0.3)}h${w - 16}M${x + 8} ${f1(y + h * 0.62)}h${w - 16}" stroke="#c19a2c" stroke-width="2" fill="none"/>` +
    `<path d="M${f1(x + w * 0.3)} ${y}v${h}M${f1(x + w * 0.7)} ${y}v${h}" stroke="#8f6f16" stroke-width="3" fill="none"/>` +
    `<path d="M${x + 4} ${y + 4}l6 -6M${x + w - 12} ${y - 1}l6 -6M${f1(x + w * 0.5)} ${y}l3 -7" stroke="#e9c35b" stroke-width="3" fill="none"/></g>`;

  const roundBale = (x, y, r) =>
    `<g transform="translate(${x} ${y})" stroke="${INK}" stroke-width="2.6"><circle r="${r}" fill="#e9c35b"/><circle r="${f1(r * 0.62)}" fill="none" stroke="#b8902d" stroke-width="2"/><circle r="${f1(r * 0.26)}" fill="#c9a23a"/></g>`;

  function corn(x, base, h) {
    const s = h / 300;
    const leaf = (y, dir, len) => `<path d="M0 ${y}C${dir * 30} ${y - 16} ${dir * len} ${y - 4} ${dir * (len + 14)} ${y + 46}C${dir * (len - 12)} ${y + 30} ${dir * 22} ${y + 14} 0 ${y}Z" fill="#a9c03c" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    return `<g transform="translate(${x} ${base}) scale(${f1(s * 100) / 100})"><g class="sway ${x % 2 ? 's2' : 's3'}">` +
      `<path d="M0 0V-300" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M0 0V-300" stroke="#8fb03a" stroke-width="7" stroke-linecap="round"/>` +
      leaf(-60, -1, 80) + leaf(-105, 1, 86) + leaf(-150, -1, 78) + leaf(-195, 1, 72) + leaf(-240, -1, 60) +
      `<path d="M4 -150C30 -164 38 -122 24 -102C15 -96 5 -110 4 -150Z" fill="#7cae3a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M10 -146C22 -150 30 -128 22 -108M16 -142C24 -136 28 -124 24 -110" fill="none" stroke="#4f8a2a" stroke-width="2" opacity=".7"/>` +
      `<path d="M14 -120C22 -126 30 -118 22 -104Z" fill="#ffcf3d"/><path d="M16 -118l5 -3M17 -112l6 -3M18 -106l4 -2" stroke="#d99a00" stroke-width="1.6" stroke-linecap="round" fill="none"/>` +
      `<path d="M-2 -230C-20 -244 -22 -206 -12 -190C-6 -188 0 -200 -2 -230Z" fill="#7cae3a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-12 -200l-6 -4M-8 -196l-7 -2" stroke="#d99a00" stroke-width="2" stroke-linecap="round"/>` +
      `<path d="M0 -300l-8-26M0 -300l4-30M0 -300l14-24" stroke="#d9b45a" stroke-width="4" stroke-linecap="round" fill="none"/></g></g>`;
  }

  function scarecrow(x, y) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    return `<g class="npc" data-npc="scarecrow" transform="translate(${x} ${y})"><g class="sway s2"><g class="sc-all">` +
      `<rect x="-6" y="-176" width="12" height="176" rx="3" fill="#8a5a35" ${sk}/>` +
      `<path d="M-62 -122H62" stroke="${INK}" stroke-width="15" stroke-linecap="round"/><path d="M-62 -122H62" stroke="#a5673f" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M-30 -132H30L38 -66H-38Z" fill="#d9482f" ${sk}/>` +
      `<path d="M-15 -132L-19 -66M0 -132V-66M15 -132L19 -66M-34 -110H34M-37 -88H37" stroke="#ffd166" stroke-width="3" opacity=".85" fill="none"/>` +
      `<rect x="6" y="-104" width="16" height="16" fill="#4b5bb8" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2"/>` +
      `<path d="M-62 -122l-16-6M-62 -122l-18 1M-62 -122l-16 8M62 -122l16-6M62 -122l18 1M62 -122l16 8" stroke="#e9c35b" stroke-width="4" stroke-linecap="round" fill="none"/>` +
      `<path d="M-36 -66H-2V-30L-19-20L-36-30Z" fill="#4b5bb8" ${sk}/><path d="M2 -66H36V-30L19-20L2-30Z" fill="#4b5bb8" ${sk}/>` +
      `<path d="M-30 -30l-5 14M-22 -24l-3 14M22 -24l3 14M30 -30l5 14" stroke="#e9c35b" stroke-width="4" stroke-linecap="round" fill="none"/>` +
      `<circle cx="0" cy="-150" r="22" fill="#e8cf9a" ${sk}/>` +
      `<circle cx="-8" cy="-154" r="3.6" fill="${INK}"/><circle cx="8" cy="-154" r="3.6" fill="${INK}"/><circle cx="-7" cy="-155" r="1.2" fill="#fff"/><circle cx="9" cy="-155" r="1.2" fill="#fff"/>` +
      `<path d="M0 -150l7 9h-14Z" fill="#f57c1f" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` +
      `<path d="M-11 -139q11 9 22 0" fill="none" stroke="${INK}" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/>` +
      `<g class="sc-head"><path d="M-34 -166H34" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-32 -166H32" stroke="#7a4b2a" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M-20 -166C-22 -198 22 -198 20 -166Z" fill="#7a4b2a" ${sk}/><rect x="-20" y="-176" width="40" height="8" fill="#e5334b" stroke="${INK}" stroke-width="2.4"/>` +
      `<path d="M-30 -164l-12 6M-26 -166l-14 -2M30 -164l12 6M26 -166l14 -2" stroke="#e9c35b" stroke-width="3.4" stroke-linecap="round" fill="none"/></g>` +
      `<circle cx="-4" cy="-118" r="2.4" fill="#fff3d6" stroke="${INK}" stroke-width="1.6"/><circle cx="-4" cy="-100" r="2.4" fill="#fff3d6" stroke="${INK}" stroke-width="1.6"/><circle cx="-4" cy="-82" r="2.4" fill="#fff3d6" stroke="${INK}" stroke-width="1.6"/>` +
      `<path d="M-36 -68H36" stroke="#8a5a35" stroke-width="5" stroke-linecap="round"/><path d="M-36 -68H36" stroke="#c98a4b" stroke-width="2" stroke-linecap="round"/><rect x="-4" y="-72" width="8" height="8" rx="1.6" fill="#ffc928" stroke="${INK}" stroke-width="2"/>` +
      `<g transform="translate(-66 -130)"><g class="crow"><ellipse cx="0" cy="0" rx="12" ry="8" fill="#2b2b33" ${sk}/><circle cx="-10" cy="-7" r="6.4" fill="#2b2b33" ${sk}/>` +
      `<path d="M-15 -8l-9 3 9 3Z" fill="#f5a300" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="-11" cy="-8" r="1.4" fill="#fff"/><path d="M11 -2l15 4-13 3Z" fill="#2b2b33" ${sk}/></g></g>` +
      `</g></g>` +
      `<rect class="npc-hit" x="-74" y="-208" width="148" height="212" fill="transparent"/></g>`;
  }

  const fallFore = () =>
    blades(524, 10, 28, 26, '#dcb85c', 6) +
    corn(28, 540, 300) + corn(96, 546, 240) + corn(1338, 546, 250) + corn(1408, 540, 310) +
    meadow(41, 26, 498, 530, ['#f58a1f', '#ffc928', '#d2492a', '#e5642f']) +
    bale(430, 468, 116, 60) + bale(550, 468, 116, 60) + bale(490, 410, 116, 60) +
    use('pumpkin', 500, 366, 58, 49) + use('pumpkin-w', 566, 428, 44, 37) +
    scarecrow(1196, 526) +
    blades(540, 12, 32, 22, '#93a533', 12);

  const fallFar = () =>
    `<path d="${FAR_HILL}" fill="#f1c27b"/>` + rows(FAR_LINE, '#d9a65f', 5, 9) +
    round(150, 176, 0.8, '#e8893a', '#f5c033') + round(228, 182, 1, '#d2492a', '#e8893a') + round(300, 198, 0.75, '#f5c033', '#e8893a') +
    round(1010, 196, 0.7, '#e8893a', '#d2492a') + round(1290, 178, 0.9, '#f5c033', '#e8893a') + round(1385, 166, 0.8, '#d2492a', '#f5c033') +
    barn(1130, 70, 170);

  function fallMid() {
    let fence = '';
    for (let x = 600; x <= 900; x += 38) fence += `<rect x="${x}" y="${232 + Math.sin(x / 90) * 5}" width="6" height="28" fill="#8a5a35" stroke="${INK}" stroke-width="2"/>`;
    return `<path d="${MID_HILL}" fill="#c6d05e"/>` + rows(MID_LINE, '#a9b645', 3, 8) + fence +
      `<path d="M598 242H906M598 252H906" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M598 242H906M598 252H906" stroke="#a5673f" stroke-width="1.5" fill="none"/>` +
      roundBale(230, 246, 15) + roundBale(272, 250, 15) + roundBale(251, 232, 15);
  }

  /* ------------------------------------------------------------------ *
   * WINTER — Christmas-tree farm, campfires, snowman
   * ------------------------------------------------------------------ */
  // A string of lights swagged across each tier of the tree, in the 80×110 tree space.
  // Bulbs are numbered bottom tier first so they switch on in a ripple from the trunk up to the star.
  const LIGHT_COLORS = ['#ff4d6d', '#ffd54f', '#5ee0ff', '#8dff7a', '#ff9ad5'];
  const TIERS = [{ top: 62, base: 100, hw: 37, n: 6 }, { top: 44, base: 82, hw: 31, n: 5 }, { top: 26, base: 62, hw: 24, n: 4 }, { top: 10, base: 40, hw: 17, n: 3 }];
  const STAR = `<path d="M40 -1.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L40 14.4l-6 3.1 1.3-6.6-4.9-4.6 6.7-.8Z" fill="#ffc928" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  const LIGHTS = (() => {
    let swags = '', bulbs = '', i = 0;
    TIERS.forEach((ti, row) => {
      const yl = ti.top + (ti.base - ti.top) * 0.6, half = ti.hw * 0.54, dip = 7;
      swags += `<path d="M${f1(40 - half)} ${f1(yl)}Q40 ${f1(yl + dip * 2)} ${f1(40 + half)} ${f1(yl)}" fill="none" stroke="#17482a" stroke-width="1.5" stroke-linecap="round"/>`;
      for (let j = 0; j < ti.n; j++) {
        const u = (j + 0.5) / ti.n, x = 40 - half + 2 * half * u, y = yl + 4 * dip * u * (1 - u) + 1;   // point on the swag
        const c = LIGHT_COLORS[(i + row) % LIGHT_COLORS.length];
        bulbs += `<g class="bulb" style="--d:${(i * 0.06).toFixed(2)}s;--c:${c}"><circle class="halo" cx="${f1(x)}" cy="${f1(y)}" r="7.5"/><circle class="core" cx="${f1(x)}" cy="${f1(y)}" r="3"/></g>`;
        i += 1;
      }
    });
    const sparks = [[-26, -4], [26, -8], [-30, 24], [30, 28], [0, -22], [-16, 46], [18, 50]]
      .map(([dx, dy], k) => `<path class="pop" d="M0 -4.5l1.3 3.2L4.5 0l-3.2 1.3L0 4.5l-1.3-3.2L-4.5 0l3.2-1.3Z" transform="translate(40 40)" style="--dx:${dx}px;--dy:${dy}px;--dl:${(k * 0.07).toFixed(2)}s"/>`).join('');
    return { swags, bulbs, sparks, star: `<g class="star"><circle class="star-halo" cx="40" cy="9" r="17" fill="url(#treeGlow)"/><g class="star-art">${STAR}</g></g>` };
  })();

  // x,y = bottom centre of the trunk. mode: 'pick' (click to light), 'lit' (always lit, decoration), 'plain' (far trees)
  function tree(x, y, w, h, mode = 'plain') {
    const s = w / 80, at = `translate(${f1(-w / 2)} ${f1(-h)}) scale(${f1(s * 1000) / 1000})`;
    const body = `<ellipse cx="0" cy="0" rx="${f1(w * 0.46)}" ry="${f1(w * 0.09)}" fill="#e3edf7" stroke="#c9dcef" stroke-width="1.5"/>` +
      use('xmas-tree', -w / 2, -h, w, h) + use('fir-snow', -w / 2, -h, w, h);
    if (mode === 'plain') return `<g transform="translate(${f1(x)} ${f1(y)})">${body}<g transform="${at}">${STAR}</g></g>`;
    const lights = `<g class="lights" transform="${at}"><circle class="tree-glow" cx="40" cy="58" r="78" fill="url(#treeGlow)"/>${LIGHTS.swags}${LIGHTS.bulbs}${LIGHTS.sparks}${LIGHTS.star}</g>`;
    const pad = w * 0.1;
    if (mode === 'lit') return `<g class="xt lit still" transform="translate(${f1(x)} ${f1(y)})"><g class="tree-body">${body}${lights}</g></g>`;
    return `<g class="xt berry-hit tree-pick" transform="translate(${f1(x)} ${f1(y)})" data-pick="tree"><g class="tree-body">${body}${lights}</g>` +
      `<rect x="${f1(-w / 2 - pad)}" y="${f1(-h - pad)}" width="${f1(w + pad * 2)}" height="${f1(h + pad * 2)}" fill="transparent"/></g>`;
  }

  function campfire(x, y, s) {
    let back = '', front = '';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2, sx = Math.cos(a) * 50, sy = Math.sin(a) * 13;
      const stone = `<ellipse cx="${f1(sx)}" cy="${f1(sy)}" rx="9.5" ry="6.4" fill="${i % 2 ? '#b9bdc7' : '#9aa0ac'}" stroke="${INK}" stroke-width="2.6"/>`;
      if (sy < 0) back += stone; else front += stone;
    }
    const log = (rot, x0) => `<g transform="translate(${x0} -5) rotate(${rot})"><rect x="-44" y="-8" width="88" height="16" rx="8" fill="#7a4b2a" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M-30 -2h50M-22 3h38" stroke="#5c3720" stroke-width="2" stroke-linecap="round"/><circle cx="44" cy="0" r="6.6" fill="#c98a4b" stroke="${INK}" stroke-width="2.4"/><circle cx="44" cy="0" r="2.6" fill="#8a5a35"/></g>`;
    const flames =
      `<g class="fire-scale">` +
      `<path class="flame f3" d="M-38 -10C-44 -24 -34 -34 -32 -48C-26 -38 -22 -30 -24 -22C-20 -30 -18 -36 -20 -46C-8 -34 -10 -20 -14 -10Z" fill="#ff9a3c" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path class="flame f2" d="M38 -10C44 -22 36 -32 34 -44C28 -36 25 -28 26 -20C22 -28 21 -34 22 -42C12 -30 14 -18 17 -10Z" fill="#ff9a3c" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
      `<path class="flame f1" d="M-28 -10C-38 -36 -16 -54 -14 -84C-2 -70 6 -60 3 -46C12 -58 16 -70 14 -84C34 -62 40 -32 28 -10Z" fill="#ff7a1a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path class="flame f2" d="M-17 -10C-22 -30 -8 -42 -6 -62C4 -50 9 -42 7 -32C14 -41 16 -50 12 -58C25 -44 27 -24 17 -10Z" fill="#ffb300"/>` +
      `<path class="flame f3" d="M-8 -10C-11 -21 -4 -30 0 -40C6 -30 10 -21 8 -10Z" fill="#ffe066"/>` +
      `</g>`;
    const sparks = [[-10, 0.0], [8, 0.7], [-2, 1.3], [14, 1.9], [-16, 2.4]].map(([dx, dl], i) => `<circle class="spark sp${i % 3}" cx="${dx}" cy="-60" r="2.4" fill="#ffd54f" style="animation-delay:${dl}s"/>`).join('');
    return `<g class="campfire" transform="translate(${x} ${y}) scale(${s})" data-fire>` +
      `<circle class="fire-glow" cx="0" cy="-34" r="128" fill="url(#fireGlow)"/>` +
      `<ellipse cx="0" cy="6" rx="64" ry="15" fill="#fff" stroke="#c9dcef" stroke-width="3"/><ellipse cx="0" cy="3" rx="44" ry="10" fill="#5a3d30"/>` +
      back + log(-16, -4) + log(16, 4) + `<g fill="#ff6a1a" opacity=".85"><rect x="-24" y="-8" width="9" height="4" rx="2"/><rect x="-6" y="-6" width="12" height="4" rx="2"/><rect x="14" y="-8" width="10" height="4" rx="2"/></g>` + flames + sparks + front +
      `<rect class="scene-hit" x="-72" y="-116" width="144" height="140" fill="transparent"/></g>`;
  }

  const FIRES = [{ x: 560, y: 458, s: 1 }, { x: 890, y: 452, s: 0.94 }];   // kept clear of the picking card (bottom left) and the snowman (right)

  // Rows of trees planted on the snow lanes, evenly stepped toward the viewer; every other row is shifted
  // a lane so it reads like a real planted lot. Clearings are left around the campfires.
  const TREE_ROWS = [0.13, 0.2, 0.29, 0.4, 0.52, 0.65];
  function winterField() {
    let out = `<path d="${groundPath()}" fill="#f5f9fd" stroke="#c9dcef" stroke-width="3"/>`;
    out += rowPolys(range(-5, 5), { fill: '#e6f0f9', inner: '#ffffff', hw: 60, innerHw: 28, innerOpacity: 0.7 });
    TREE_ROWS.forEach((t, r) => {
      const h = 18 + 188 * t, w = h * 0.727, y = rowY(t), step = t < 0.25 ? 2 : 1;
      for (let k = (r % 2 ? -3.5 : -4); k <= 4; k += step) {   // odd rows sit half a lane over, so each tree peeks between two in front
        const x = rowX(k, t);
        if (FIRES.some((f) => Math.abs(x - f.x) < 108 && Math.abs(y - f.y) < 62)) continue;
        out += tree(x, y, w, h, t >= 0.25 ? 'pick' : 'plain');
      }
    });
    FIRES.forEach((f) => { out += campfire(f.x, f.y, f.s); });
    return out;
  }

  function snowman(x, y) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    return `<g class="npc" data-npc="snowman" transform="translate(${x} ${y}) scale(.95)"><g class="sway s3">` +
      `<ellipse cx="0" cy="2" rx="58" ry="9" fill="rgba(58,36,22,.18)"/>` +
      `<path d="M-31 -102L-80 -130M-58 -116L-62 -138M-68 -122L-92 -122" stroke="${INK}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M-31 -102L-80 -130M-58 -116L-62 -138M-68 -122L-92 -122" stroke="#8a5a35" stroke-width="4.6" stroke-linecap="round" fill="none"/>` +
      `<path d="M31 -102L80 -122M58 -112L64 -132M70 -117L92 -112" stroke="${INK}" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M31 -102L80 -122M58 -112L64 -132M70 -117L92 -112" stroke="#8a5a35" stroke-width="4.6" stroke-linecap="round" fill="none"/>` +
      `<circle cx="0" cy="-46" r="48" fill="#fff" ${sk}/><path d="M-30 -20a48 48 0 0 0 44 24" fill="none" stroke="#cfe0f0" stroke-width="6" stroke-linecap="round"/>` +
      `<circle cx="0" cy="-108" r="35" fill="#fff" ${sk}/><path d="M-22 -88a35 35 0 0 0 34 14" fill="none" stroke="#cfe0f0" stroke-width="5" stroke-linecap="round"/>` +
      `<circle cx="0" cy="-160" r="26" fill="#fff" ${sk}/>` +
      `<circle cx="0" cy="-92" r="4.4" fill="${INK}"/><circle cx="0" cy="-108" r="4.4" fill="${INK}"/><circle cx="0" cy="-58" r="4.6" fill="${INK}"/><circle cx="0" cy="-42" r="4.6" fill="${INK}"/><circle cx="0" cy="-26" r="4.6" fill="${INK}"/>` +
      `<circle cx="-9" cy="-166" r="3.6" fill="${INK}"/><circle cx="9" cy="-166" r="3.6" fill="${INK}"/><circle cx="-8" cy="-167" r="1.1" fill="#fff"/><circle cx="10" cy="-167" r="1.1" fill="#fff"/>` +
      `<path d="M0 -161l28 5-28 6Z" fill="#f57c1f" ${sk}/>` +
      `<path d="M-13 -150q3 4 7 5M-4 -147q4 2 8 1M5 -148q3 1 8-1M12 -152q2 2 4 2" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="M-28 -136q28 12 56 0v12q-28 12 -56 0Z" fill="#e5334b" ${sk}/><path d="M12 -128l6 30q3 8 12 6l-4-30Z" fill="#e5334b" ${sk}/><path d="M-14 -134v10M0 -132v11M14 -134v10" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/>` +
      `<path d="M16 -102l3 14M24 -100l2 12" stroke="${INK}" stroke-width="2" stroke-linecap="round" opacity=".45" fill="none"/>` +
      `<g fill="#cfe0f0" opacity=".9"><circle cx="-26" cy="-70" r="2.4"/><circle cx="-34" cy="-40" r="2"/><circle cx="26" cy="-30" r="2.4"/><circle cx="20" cy="-72" r="2"/></g>` +
      `<g fill="#fff" stroke="none" opacity=".95"><path d="M-72 -150l2 4 4 1-4 1-2 4-2-4-4-1 4-1Z"/><path d="M70 -166l2 4 4 1-4 1-2 4-2-4-4-1 4-1Z"/></g>` +
      `<circle cx="-1.4" cy="-93.4" r="1.2" fill="#fff" opacity=".6"/><circle cx="-1.4" cy="-59.4" r="1.2" fill="#fff" opacity=".6"/>` +
      `<g class="sn-hat"><rect x="-27" y="-186" width="54" height="10" rx="3" fill="#2b2b33" ${sk}/><rect x="-17" y="-214" width="34" height="30" rx="3" fill="#2b2b33" ${sk}/><rect x="-17" y="-192" width="34" height="8" fill="#43a047" stroke="${INK}" stroke-width="2.4"/>` +
      `<rect x="-4" y="-191" width="8" height="6" rx="1.4" fill="#ffc928" stroke="${INK}" stroke-width="1.6"/><path d="M-12 -208h6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".35"/></g>` +
      `</g><rect class="npc-hit" x="-62" y="-232" width="124" height="238" fill="transparent"/></g>`;
  }

  const winterFore = () =>
    `<path d="M-40 700V532C60 508 180 512 300 524S540 506 700 520 980 506 1120 520 1360 506 1480 516V700Z" fill="#dce9f5" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    tree(51, 460, 170, 234, 'lit') + tree(1393, 464, 150, 206, 'lit') +
    snowman(1236, 512) +
    `<path d="M-40 700V548C80 522 220 530 340 542S580 524 720 538 1000 524 1140 538 1380 526 1480 536V700Z" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M0 588c80-12 160-12 240 0M700 592c90-12 180-10 270 2M1180 590c60-10 130-10 200 0" fill="none" stroke="#cfe0f0" stroke-width="4" stroke-linecap="round"/>`;

  // The GreenHouse in winter: a cream building with a green roof (not a glass greenhouse), snow on top,
  // and the ice cream bar built onto the side. Local box: ground at y = 0, x from -34 to 290.
  function greenhouse(x, base, sc) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    let siding = '', shingles = '', lights = '', shingles2 = '';
    for (let i = 10; i < 150; i += 10) siding += `M${i} -62v52`;
    for (const y of [-70, -78, -86, -94]) { const d = ((-62 - y) / 36) * 32; shingles += `M${f1(-10 + d)} ${y}H${f1(160 - d)}`; }
    for (const y of [-52, -60, -68]) { const d = ((-46 - y) / 26) * 20; shingles2 += `M${f1(146 + d)} ${y}H${f1(252 - d)}`; }
    const cols = ['#e5334b', '#ffd54f', '#43a047', '#4b5bb8'];
    for (let i = 0; i < 14; i++) lights += `<circle cx="${-4 + i * 12}" cy="-57" r="2.4" fill="${cols[i % 4]}" stroke="${INK}" stroke-width="1.2"/>`;
    for (let i = 0; i < 8; i++) lights += `<circle cx="${158 + i * 12}" cy="-43" r="2.2" fill="${cols[(i + 1) % 4]}" stroke="${INK}" stroke-width="1.2"/>`;
    const win = (wx) => `<rect x="${wx}" y="-42" width="34" height="26" rx="2" fill="#ffe08a" ${sk} stroke-width="2.6"/><path d="M${wx + 17} -42v26M${wx} -29h34" fill="none" stroke="${INK}" stroke-width="2"/>` +
      `<path d="M${wx + 3} -39h12" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
      `<rect x="${wx - 3}" y="-16" width="40" height="7" rx="2" fill="#8a5a35" ${sk} stroke-width="2.4"/><circle cx="${wx + 6}" cy="-19" r="3" fill="#e5334b"/><circle cx="${wx + 17}" cy="-20" r="3.4" fill="#e5334b"/><circle cx="${wx + 28}" cy="-19" r="3" fill="#e5334b"/><path d="M${wx + 2} -17h30" stroke="#2b7a3a" stroke-width="3" stroke-linecap="round"/>`;
    const rug = `<ellipse cx="46" cy="2" rx="40" ry="4" fill="#ffd166" opacity=".3"/><ellipse cx="124" cy="2" rx="40" ry="4" fill="#ffd166" opacity=".3"/>`;
    return `<g transform="translate(${x} ${base}) scale(${sc})">` +
      `<path d="M-40 6C-10 -6 60 -8 130 -6S250 -8 300 6V16H-40Z" fill="#fff" stroke="#c9dcef" stroke-width="3"/>` + rug +
      // chimney with smoke
      `<g ${sk}><rect x="108" y="-112" width="17" height="38" fill="#b5533a"/><path d="M108 -100h17M108 -88h17M116 -112v12M116 -88v14" fill="none" stroke-width="1.8" opacity=".6"/><rect x="105" y="-117" width="23" height="7" rx="2" fill="#8a5a35"/></g>` +
      `<g class="rig-smoke" transform="translate(116 -124)" fill="#fff" stroke="#cfcfcf" stroke-width="1.6"><circle class="puff p1" r="7"/><circle class="puff p2" r="5.5"/><circle class="puff p3" r="6.5"/></g>` +
      // main building
      `<g ${sk}><rect x="0" y="-64" width="150" height="64" fill="#f7f0df"/><path d="${siding}" fill="none" stroke="#e1d4b6" stroke-width="1.6"/><rect x="-2" y="-9" width="154" height="9" fill="#9aa0a6" stroke-width="2.6"/></g>` +
      // roof: green, with shingles, a dormer and snow on top
      `<g ${sk}><path d="M-10 -62L22 -98H128L160 -62Z" fill="#2e8b4a"/><path d="${shingles}" fill="none" stroke="#1f6b3a" stroke-width="1.8" opacity=".65"/>` +
      `<path d="M52 -98L75 -122L98 -98Z" fill="#2e8b4a"/><rect x="66" y="-110" width="18" height="12" fill="#ffe08a" stroke-width="2.2"/><path d="M75 -110v12M66 -104h18" fill="none" stroke-width="1.6"/>` +
      `<path d="M62 -112l13 -13 13 13Q82 -108 75 -112Q68 -108 62 -112Z" fill="#fff" stroke-width="2.4"/>` +
      `<path d="M18 -100H132L140 -92Q131 -84 123 -92Q113 -84 103 -92Q93 -84 83 -92Q73 -84 63 -92Q53 -84 43 -92Q33 -84 27 -92Z" fill="#fff"/></g>` +
      `<path d="M-6 -62H156" stroke="#ffffff" stroke-width="3" stroke-linecap="round" opacity=".9"/>` +
      lights +
      // windows, sign, door
      win(10) + win(106) +
      `<g ${sk}><rect x="34" y="-59" width="82" height="15" rx="3" fill="#2b7a3a"/></g>` +
      `<text x="75" y="-48.4" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="8.8" fill="#fff" letter-spacing=".4">THE GREENHOUSE</text>` +
      `<g ${sk}><rect x="63" y="-38" width="24" height="38" rx="2" fill="#c8412f"/><path d="M69 -32h12v12H69Z" fill="#ffe08a" stroke-width="2"/><path d="M75 -32v12M69 -26h12" fill="none" stroke-width="1.4"/><circle cx="83" cy="-14" r="1.8" fill="#ffc928" stroke-width="1.6"/><rect x="60" y="-3" width="30" height="3" fill="#cfd8dc" stroke-width="2"/></g>` +
      `<g><circle cx="75" cy="-8" r="5.4" fill="none" stroke="#2b7a3a" stroke-width="3.4"/><circle cx="75" cy="-2.6" r="2.2" fill="#e5334b"/></g>` +
      // little Christmas trees by the door
      use('fir', -28, -50, 30, 41) + use('fir-snow', -28, -50, 30, 41) +
      // the ice cream bar, built onto the side
      `<g ${sk}><rect x="150" y="-48" width="96" height="48" fill="#ffe3ec"/><rect x="150" y="-12" width="96" height="12" fill="#f4b6c7" stroke-width="2.6"/>` +
      `<path d="M144 -46L166 -72H232L254 -46Z" fill="#2e8b4a"/><path d="${shingles2}" fill="none" stroke="#1f6b3a" stroke-width="1.8" opacity=".65"/>` +
      `<path d="M164 -74H234L240 -66Q232 -60 224 -66Q214 -58 204 -66Q194 -58 184 -66Q174 -58 168 -66Z" fill="#fff" stroke-width="2.6"/>` +
      `<rect x="166" y="-38" width="52" height="26" rx="2" fill="#cfe9f7" stroke-width="2.6"/><path d="M192 -38v26M166 -25h52" fill="none" stroke-width="1.8"/>` +
      `<rect x="162" y="-12" width="60" height="6" rx="2" fill="#a5673f" stroke-width="2.4"/></g>` +
      `<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M164 -46h13l-2 10h-9Z" fill="#e5334b"/><path d="M177 -46h13l-1 10h-13Z" fill="#fff"/><path d="M190 -46h13l-1 10h-13Z" fill="#e5334b"/><path d="M203 -46h13l1 10h-13Z" fill="#fff"/><path d="M216 -46h8l2 10h-8Z" fill="#e5334b"/></g>` +
      `<path d="M170 -34h12M170 -28h20" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>` +
      `<g ${sk}><rect x="226" y="-40" width="16" height="22" rx="2" fill="#2a3b36" stroke-width="2.4"/></g><path d="M230 -34h8M230 -28h6M230 -22h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>` +
      `<g ${sk}><rect x="172" y="-94" width="54" height="17" rx="4" fill="#ffb3c7"/></g>` +
      `<text x="199" y="-81.6" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="8.2" fill="${INK}" letter-spacing=".4">ICE CREAM</text>` +
      use('icecream', 188, -128, 22, 33) +
      use('fir', 254, -62, 34, 47) + use('fir-snow', 254, -62, 34, 47) +
      '</g>';
  }

  const winterFar = () =>
    `<path d="${FAR_HILL}" fill="#f7fbff" stroke="#c5d8ea" stroke-width="3"/>` +
    [[34, 186, 0.78], [72, 190, 0.62], [388, 208, 0.8], [1118, 200, 0.85], [1222, 194, 0.7], [1292, 184, 1.05], [1388, 176, 0.95]].map(([x, b, s]) => snowFir(x, b, s)).join('') +
    greenhouse(136, 202, 0.92) +
    barn(1130, 70, 170, true);

  const winterMid = () => `<path d="${MID_HILL}" fill="#ffffff" stroke="#c9dcef" stroke-width="3"/>`;

  /* ------------------------------------------------------------------ *
   * Footer: a row of the season's crops standing on the dark soil of the footer
   * ------------------------------------------------------------------ */
  const footerEl = $('#footer-field');
  function footerArt(id) {
    const r = rand(77 + id.length), W_ = 1440, BASE = 130;
    let out = '';
    if (id === 'fall') {
      const kinds = ['pumpkin', 'pumpkin', 'pumpkin-b', 'pumpkin-w'];
      out += corn(44, 142, 150) + corn(84, 146, 118) + corn(1372, 142, 146) + corn(1400, 146, 112);
      for (let x = 130; x < 1300; x += 48 + r() * 62) {
        const w = 32 + r() * 36, h = w * 92 / 110;
        out += leafUse(x + w * 0.1, BASE - 8, -50, w / 120, '#4aa04a') + use(kinds[Math.floor(r() * 4)], x, BASE - h - 2, w, h);
      }
      out += bale(650, BASE - 40, 76, 40) + blades(BASE, 5, 13, 20, '#dcb85c', 5);
    } else if (id === 'winter') {
      for (let x = 20; x < W_; x += 40 + r() * 54) {
        const h = 62 + r() * 54, w = h * 0.727;
        out += use('fir', x, BASE - h - 6, w, h) + use('fir-snow', x, BASE - h - 6, w, h);
      }
      out += `<g transform="translate(1040 ${BASE + 6}) scale(.3)">${snowman(0, 0)}</g>` +
        `<path d="M-20 ${BASE + 20}V${BASE - 6}C120 ${BASE - 14} 260 ${BASE - 2} 420 ${BASE - 8}S720 ${BASE - 16} 900 ${BASE - 6} 1200 ${BASE - 14} 1460 ${BASE - 6}V${BASE + 20}Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
    } else if (id === 'spring') {
      for (let x = 40; x < W_; x += 78 + r() * 26) {
        const w = 58 + r() * 18, h = w * 0.75;
        out += use('sb-plant', x - w / 2, BASE - h * 0.94 - 4, w, h) + use('strawberry', x - w * 0.36, BASE - h * 0.62, w * 0.24, w * 0.27) + use('strawberry', x + w * 0.16, BASE - h * 0.5, w * 0.2, w * 0.225);
      }
      out += sunflower(18, BASE - 118, 42, '') + sunflower(1378, BASE - 126, 44, 's2') + blades(BASE, 5, 13, 20, '#5cb85c', 15);
    } else {
      for (let x = 60; x < W_; x += 96 + r() * 34) out += bush(x, BASE + 2, 76 + r() * 26, 0);
      out += sunflower(14, BASE - 122, 44, '') + sunflower(74, BASE - 96, 34, 's2') + sunflower(1352, BASE - 124, 44, 's3') + sunflower(1402, BASE - 96, 34, '') + blades(BASE, 5, 13, 20, '#5cb85c', 19);
    }
    return `<svg viewBox="0 0 ${W_} ${BASE}" preserveAspectRatio="xMidYMax slice" focusable="false">${out}</svg>`;
  }

  /* ------------------------------------------------------------------ *
   * Scene table: what each season draws, says and does
   * ------------------------------------------------------------------ */
  const reserveHref = ($('.hero-cta a') || {}).href || '#reserve';
  const reserveA = (text) => '<a href="' + reserveHref + '" target="_blank" rel="noopener">' + text + '</a>';
  const TEN = 'Wow, ten! {spot} and pick real ones.';

  const SCENES = {
    spring: {
      far: () => `<path d="${FAR_HILL}" fill="#b5e59a"/>` + rows(FAR_LINE, '#8fd078', 5, 9) + round(228, 182, 1, '#6cbf5b', '#5cb85c') + round(300, 198, 0.75, '#7ccf62', '#6cbf5b') + barn(1130, 70, 170),
      mid: () => `<path d="${MID_HILL}" fill="#8ed46b"/>` + rows(MID_LINE, '#6fba55', 3, 8),
      field: springField, fore: springFore,
      hud: { art: 'basket', hint: 'Try it! Tap the strawberries to pick them.', btn: 'Pick a strawberry',
        msgs: [[1, 'Yum! Keep going.'], [3, 'You’re a natural picker!'], [5, 'Basket’s filling up! Ready for the real thing? {reserve}'], [10, TEN]] },
    },
    summer: {
      far: () => `<path d="${FAR_HILL}" fill="#a9e48a"/>` + rows(FAR_LINE, '#86cb6a', 5, 9) + round(228, 182, 1, '#4cae4e', '#43a047') + round(300, 198, 0.75, '#5cb85c', '#4cae4e') + round(1010, 196, 0.7, '#4cae4e', '#43a047') + barn(1130, 70, 170),
      mid: () => `<path d="${MID_HILL}" fill="#7bd05a"/>` + rows(MID_LINE, '#5fb445', 3, 8),
      field: summerField, fore: summerFore,
      hud: { art: 'basket', hint: 'Try it! Tap the blueberries to pick them, or snip a sunflower.', btn: 'Pick a blueberry',
        msgs: [[1, 'Sweet! Keep going.'], [3, 'Blue fingers mean a great picker!'], [5, 'Bucket’s filling up! Ready for the real thing? {reserve}'], [10, TEN]] },
    },
    fall: {
      far: fallFar, mid: fallMid, field: fallField, fore: fallFore,
      particles: 'leaves',
      hud: { art: 'basket', hint: 'Try it! Tap the pumpkins to pick one, or tap the wagon.', btn: 'Pick a pumpkin',
        msgs: [[1, 'What a pumpkin!'], [3, 'That one’s a big one.'], [5, 'Basket’s getting heavy! Ready for the real patch? {reserve}'], [10, TEN]] },
    },
    winter: {
      far: winterFar, mid: winterMid, field: winterField, fore: winterFore,
      particles: 'snow',
      hud: { art: 'fir', hint: 'Tap the trees to light them up. Tap a fire to stoke it.', btn: 'Light a tree',
        msgs: [[1, 'Ooh, twinkly!'], [3, 'You’re a natural decorator.'], [6, 'The whole farm is glowing! Real trees are at {gh}.'], [12, 'Every tree is lit! Bring the family to {gh}.']] },
    },
  };

  /* ------------------------------------------------------------------ *
   * Particles (falling leaves / snow)
   * ------------------------------------------------------------------ */
  function particles(kind) {
    $$('.particles', crittersEl).forEach((p) => p.remove());
    if (!kind || reduceMotion) return;
    const box = doc.createElement('div');
    box.className = 'particles particles-' + kind;
    box.setAttribute('aria-hidden', 'true');
    const r = rand(kind === 'snow' ? 7 : 9);
    const many = matchMedia('(max-width: 47.5em)').matches ? 0.55 : 1;
    const n = Math.round((kind === 'snow' ? 46 : 16) * many);
    const colors = ['#e8893a', '#d2492a', '#f5c033', '#c8412f', '#f0a030'];
    let html = '';
    for (let i = 0; i < n; i++) {
      const size = kind === 'snow' ? 3 + r() * 6 : 14 + r() * 12;
      html += `<i class="${kind === 'snow' ? 'flake' : 'leaf'}" style="left:${(r() * 100).toFixed(1)}%;--s:${size.toFixed(1)}px;--d:${(kind === 'snow' ? 8 + r() * 9 : 10 + r() * 9).toFixed(1)}s;--dl:${(-r() * 16).toFixed(1)}s;--sw:${(20 + r() * 50).toFixed(0)}px;--c:${colors[Math.floor(r() * colors.length)]};--rot:${Math.floor(r() * 360)}deg"></i>`;
    }
    box.innerHTML = html;
    crittersEl.appendChild(box);
  }

  /* ------------------------------------------------------------------ *
   * Picking / lighting
   * ------------------------------------------------------------------ */
  const countEl = $('#pick-count'), msgEl = $('#pick-msg'), btnEl = $('#pick-btn'), artEl = $('#picker use');
  let season = null, count = 0, lights = 0, token = 0;   // count: everything picked or stoked in this scene; lights: only what the hint line is about (winter: trees, not fires)
  let pickables = [];

  const msgVars = () => ({ reserve: reserveA(t('Reserve a visit')), spot: reserveA(t('Reserve your spot')), gh: '<a href="#greenhouse">' + t('The GreenHouse') + '</a>' });
  const msgFor = (cfg, n) => { const m = cfg.msgs.filter(([k]) => n >= k).pop(); return m ? t(m[1], msgVars()) : t(cfg.hint); };
  const doneText = () => (season === 'winter' ? t('Every tree is glowing!') : t('You picked them all! Give them a moment to grow back.'));
  // 1,000 like the badge says (Spanish like the rest of the page: 1,000, Vietnamese 1.000)
  const fmtN = (n) => { try { const l = W.lang || 'en'; return new Intl.NumberFormat(l === 'es' ? 'es-US' : l).format(n); } catch (e) { return String(n); } };
  // #pick-msg is a live region: write it only when the sentence changes, or a screen reader reads the same line again after every single pick
  let shown = '';
  function setMsg(value, asText) {
    if (!msgEl) return;
    const key = (asText ? 'text:' : 'html:') + value;
    if (key === shown) return;
    shown = key;
    if (asText) msgEl.textContent = value; else msgEl.innerHTML = value;
  }
  function hud(cfg) {
    count = 0; lights = 0;
    if (countEl) countEl.textContent = fmtN(0);
    if (msgEl) { msgEl.dataset.custom = ''; setMsg(t(cfg.hint)); }
    if (btnEl) btnEl.textContent = t(cfg.btn);
    if (artEl) artEl.setAttribute('href', '#' + cfg.art);
  }
  doc.addEventListener('wa:lang', () => {
    $$('.toot-say').forEach((n) => { n.textContent = t('Toot toot!'); });   // the tractor's bubble is drawn once, so it is re-worded here
    if (!season) return;
    const cfg = SCENES[season].hud;
    if (msgEl) { if (msgEl.dataset.custom === '1') setMsg(doneText(), true); else setMsg(msgFor(cfg, lights)); }
    if (countEl) countEl.textContent = fmtN(count);
    if (btnEl) btnEl.textContent = t(cfg.btn);
  });

  function floatPlus(el) {
    const r = el.getBoundingClientRect(), h = hero.getBoundingClientRect();
    const plus = doc.createElement('span');
    plus.className = 'plus-one';
    plus.textContent = '+1';
    plus.style.left = (r.left - h.left + r.width / 2 - 12) + 'px';
    plus.style.top = (r.top - h.top - 6) + 'px';
    hero.appendChild(plus);
    setTimeout(() => plus.remove(), 950);
  }

  // spark: a fire that was stoked. It counts (and shows) like a lit tree, because the winter badge counts both, but it does not move the hint line on.
  function bump(cfg, spark) {
    count += 1;
    if (countEl) {
      countEl.textContent = fmtN(count);
      countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    }
    if (spark) return;
    lights += 1;
    if (msgEl) { msgEl.dataset.custom = ''; setMsg(msgFor(cfg, lights)); }
  }

  /* ------------------------------------------------------------------ *
   * Achievements: 100 of one kind of pick earns that kind's badge, and
   * 1,000 picks in all earns the "lots of time" one. Counted per visit.
   * ------------------------------------------------------------------ */
  const ACH = {
    strawberry: { icon: 'strawberry', at: 100, title: () => t('Berry Boss'), msg: () => t('100 strawberries! Your basket is overflowing. Time to make jam!') },
    blueberry: { icon: 'blueberry', at: 100, title: () => t('Blueberry Bandit'), msg: () => t('100 blueberries! Your fingers must be blue by now.') },
    sunflower: { icon: 'sunflower', at: 100, title: () => t('Sunflower Whisperer'), msg: () => t('100 sunflowers snipped! You could open a flower stand.') },
    pumpkin: { icon: 'pumpkin', at: 100, title: () => t('Pumpkin Champion'), msg: () => t('100 pumpkins! That is a lot of pie.') },
    winter: { icon: 'fir', at: 100, title: () => t('Winter Sparkler'), msg: () => t('100 lights and sparks! You are lighting up the whole farm.') },
    time: { icon: 'trophy', at: 1000, title: () => t('Wow, you’ve got a lot of time on your hands!'), msg: () => t('That’s 1,000 picks! Ready for the real thing? {reserve}', msgVars()) },
  };
  const RAIN = {
    strawberry: ['strawberry'], blueberry: ['blueberry'], sunflower: ['sunflower'], pumpkin: ['pumpkin', 'pumpkin-b'],
    winter: ['fir-snow', 'sparkle'], time: ['strawberry', 'blueberry', 'sunflower', 'pumpkin', 'fir-snow', 'sparkle'],
  };
  const tally = { total: 0 };
  const queue = [];
  let toasting = false, stackEl = null;
  // Made now, empty, so the live region already exists when the first badge is put into it (screen readers can miss text that arrives with its region).
  { const host = $('#picker') || hero; if (host) { stackEl = doc.createElement('div'); stackEl.className = 'ach-stack'; stackEl.setAttribute('aria-live', 'polite'); host.appendChild(stackEl); } }

  const kindOf = (el) => (el.dataset.pick === 'tree' ? 'winter'
    : season === 'spring' ? 'strawberry'
      : season === 'summer' ? (el.classList.contains('flower-cut') ? 'sunflower' : 'blueberry')
        : 'pumpkin');

  function credit(kind) {
    tally[kind] = (tally[kind] || 0) + 1;
    tally.total += 1;
    if (tally[kind] === ACH[kind].at) queue.push(kind);
    if (tally.total === ACH.time.at) queue.push('time');
    if (!toasting) nextToast();
  }

  function rain(kind) {
    if (reduceMotion) return;
    const ids = RAIN[kind], n = kind === 'time' ? 34 : 18;
    const box = doc.createElement('div');
    box.className = 'ach-rain ach-rain-' + kind;
    box.setAttribute('aria-hidden', 'true');
    let html = '';
    for (let i = 0; i < n; i++) {
      html += '<svg class="ach-drop" style="left:' + rnd(2, 96).toFixed(1) + '%;--s:' + Math.round(rnd(26, 52)) + 'px;--d:' + rnd(2.2, 3.6).toFixed(2) + 's;--dl:' + rnd(0, 1.1).toFixed(2) + 's;--sw:' + Math.round(rnd(-70, 70)) + 'px;--r:' + Math.round(rnd(-320, 320)) + 'deg"><use href="#' + ids[i % ids.length] + '" width="100%" height="100%"/></svg>';
    }
    box.innerHTML = html;
    hero.appendChild(box);
    setTimeout(() => box.remove(), 5200);
  }

  // The words of the badge on screen. They are set here (and again if the language is changed while it is showing), not when the page is built.
  let toast = null;
  function paintToast(el, a) {
    $('.ach-kicker', el).textContent = t('Achievement unlocked!');
    $('.ach-title', el).textContent = a.title();
    $('.ach-msg', el).innerHTML = a.msg();
    $('.ach-close', el).setAttribute('aria-label', t('Close'));
  }
  doc.addEventListener('wa:lang', () => { if (toast) paintToast(toast.el, toast.a); });

  function nextToast() {
    const kind = queue.shift();
    if (!kind) { toasting = false; return; }
    toasting = true;
    const a = ACH[kind];
    if (!stackEl) {   // normally made at start-up (above)
      stackEl = doc.createElement('div');
      stackEl.className = 'ach-stack';
      stackEl.setAttribute('aria-live', 'polite');
      ($('#picker') || hero).appendChild(stackEl);
    }
    const el = doc.createElement('div');
    el.className = 'ach ach-' + kind;
    el.innerHTML = '<span class="ach-medal" aria-hidden="true"><svg><use href="#' + a.icon + '" width="100%" height="100%"/></svg></span>' +
      '<span class="ach-text"><span class="ach-kicker"></span><strong class="ach-title"></strong><span class="ach-msg"></span></span>' +
      '<button class="ach-close" type="button">&times;</button>';
    paintToast(el, a);
    toast = { el, a };
    stackEl.appendChild(el);
    rain(kind);
    let done = false;
    const close = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (toast && toast.el === el) toast = null;
      el.classList.add('is-leaving');
      setTimeout(() => { el.remove(); nextToast(); }, reduceMotion ? 0 : 380);
    };
    const timer = setTimeout(close, kind === 'time' ? 11500 : 6000);
    $('.ach-close', el).addEventListener('click', close);
  }

  function pick(el) {
    const cfg = SCENES[season].hud;
    if (el.dataset.pick === 'tree') {
      if (el.classList.contains('lit')) return;
      el.classList.add('lit');
      bump(cfg); floatPlus(el); credit(kindOf(el));
      return;
    }
    if (el.dataset.state === 'picked') return;
    el.dataset.state = 'picked';
    const body = $('.berry', el);
    body.classList.remove('is-regrowing');
    body.classList.add('is-picked');
    bump(cfg); floatPlus(el); credit(kindOf(el));
    const mine = token;
    setTimeout(() => {
      if (mine !== token) return;
      body.classList.remove('is-picked');
      body.classList.add('is-regrowing');
      delete el.dataset.state;
      setTimeout(() => body.classList.remove('is-regrowing'), 900);
    }, 7000 + Math.random() * 4000);
  }

  // A stoked fire is one "spark": it counts in the basket and towards the winter badge, like a lit tree does.
  function stoke(fire) {
    fire.classList.add('flare');
    bump(SCENES.winter.hud, true); floatPlus(fire); credit('winter');
    clearTimeout(fire._t);
    fire._t = setTimeout(() => fire.classList.remove('flare'), 1100);
  }

  function available() {
    return pickables.filter((el) => (el.dataset.pick === 'tree' ? !el.classList.contains('lit') : el.dataset.state !== 'picked'));
  }

  /* ------------------------------------------------------------------ *
   * Farm friends: tap a kid, a wagon rider, the scarecrow or the snowman and they react and say something.
   * ------------------------------------------------------------------ */
  const SAY = {
    kid: [T('Yum! So sweet!'), T('Look at this big one!'), T('My bucket is almost full!'), T('Hi there!'), T('The red ones are the ripest!')],
    berrykid: [T('Plink! One more for the bucket.'), T('Blue fingers, happy me!'), T('Pick the dark blue ones!'), T('Yum! So sweet!'), T('Look at this big one!'), T('Hi there!')],
    cutter: [T('Snip, snip! Fresh sunflowers!'), T('This one is taller than me!'), T('Flowers for someone special!'), T('Hi there!')],
    rider: [T('Wheee!'), T('Hold on tight!'), T('Are we there yet?'), T('I can see the whole farm from here!'), T('Wave back!')],
    barrel: [T('Choo choo!'), T('Toot toot! All aboard!'), T('Faster, tractor!')],
    scarecrow: [T('Boo! … Just kidding.'), T('Hi! I keep the crows away.'), T('Happy fall, friend!'), T('Psst… the crow is my buddy.'), T('I am not scary, I promise.')],
    snowman: [T('Brr! Stay warm out there!'), T('Do you like my hat?'), T('I love the snow!'), T('Have you lit a tree yet?')]
  };

  // A speech bubble that follows the character (the wagon keeps rolling and the layers drift with the page).
  // Screen readers cannot see the speech bubble, so what a friend says is also put in a hidden live region (#npc-live).
  const npcLive = $('#npc-live');
  const announce = (text) => { if (!npcLive) return; npcLive.textContent = ''; requestAnimationFrame(() => { npcLive.textContent = text; }); };
  function say(el, text) {
    announce(text);
    if (el._say) { el._say.remove(); el._sayStop(); }   // the old bubble's loop and timers stop with it (tapping a friend again and again must not pile them up)
    const b = doc.createElement('span');
    b.className = 'npc-say';
    b.setAttribute('aria-hidden', 'true');
    b.textContent = text;
    hero.appendChild(b);
    el._say = b;
    let gone = false, t1 = 0, t2 = 0;
    el._sayStop = () => { gone = true; clearTimeout(t1); clearTimeout(t2); };
    const place = () => {
      if (gone) return;
      const r = el.getBoundingClientRect(), h = hero.getBoundingClientRect();
      b.style.left = Math.min(Math.max(r.left - h.left + r.width / 2, 96), h.width - 96) + 'px';
      b.style.top = (r.top - h.top - 6) + 'px';
      requestAnimationFrame(place);
    };
    place();
    t1 = setTimeout(() => {
      b.classList.add('out');
      t2 = setTimeout(() => { gone = true; b.remove(); if (el._say === b) el._say = null; }, 260);
    }, 2500);
  }

  function npcTalk(el) {
    const kind = el.dataset.npc, lines = SAY[kind];
    if (!lines) return;
    el._i = ((el._i == null ? Math.floor(Math.random() * lines.length) : el._i) + 1) % lines.length;
    say(el, t(lines[el._i]));
    // riders and barrel kids are drawn inside the rig, the others react as a whole
    const body = el.dataset.r != null ? $(`.npc-body[data-r="${el.dataset.r}"]`, el.closest('.rig')) : el;
    if (body) restart(body, 'is-hi', kind === 'scarecrow' ? 2800 : 1700);
  }

  // The friends are drawn in the picture and cannot be reached with Tab, so this one button says hi to the next friend in turn.
  const npcBtn = $('#npc-btn');
  let npcNext = -1;
  if (npcBtn) npcBtn.addEventListener('click', () => {
    const all = $$('[data-npc]', sceneEl);
    if (all.length) { npcNext = (npcNext + 1) % all.length; npcTalk(all[npcNext]); }
  });

  function bindScene() {
    pickables = $$('[data-pick]', sceneEl);
    npcNext = -1;
    if (npcBtn) npcBtn.hidden = !$$('[data-npc]', sceneEl).length;
    pickables.forEach((el) => el.addEventListener('click', () => pick(el)));

    $$('[data-npc]', sceneEl).forEach((el) => {
      el.addEventListener('click', () => npcTalk(el));
      if (el.dataset.r != null) {   // the tap target is separate from the drawing, so mirror the hover
        const body = () => $(`.npc-body[data-r="${el.dataset.r}"]`, el.closest('.rig'));
        el.addEventListener('pointerenter', () => { const b = body(); if (b) b.classList.add('is-over'); });
        el.addEventListener('pointerleave', () => { const b = body(); if (b) b.classList.remove('is-over'); });
      }
    });

    $$('[data-fire]', fieldEl).forEach((fire) => fire.addEventListener('click', () => stoke(fire)));

    const rig = $('[data-rig]', fieldEl);
    if (rig) {
      const rigEl = rig.closest('.rig');
      rig.addEventListener('click', () => {
        rigEl.classList.add('tooting');
        clearTimeout(rigEl._t);
        rigEl._t = setTimeout(() => rigEl.classList.remove('tooting'), 1600);
      });
    }
  }

  if (btnEl) btnEl.addEventListener('click', () => {
    const free = available();
    if (!free.length) {
      if (msgEl) { msgEl.dataset.custom = '1'; setMsg(doneText(), true); }
      // every tree is lit: the button stokes a fire instead, so the winter badge (100 lights and sparks) can be earned without a mouse or a finger
      const fires = $$('[data-fire]', fieldEl);
      if (season === 'winter' && fires.length) stoke(fires[Math.floor(Math.random() * fires.length)]);
      return;
    }
    pick(free[Math.floor(Math.random() * free.length)]);
  });

  /* ------------------------------------------------------------------ *
   * Build a season
   * ------------------------------------------------------------------ */
  // data-only="fall winter": shown only while one of those seasons is on screen. Add data-in-season to show it only
  // while that season is really happening (not in the weeks before or after, when the nearest season is shown).
  // data-out-of-season="spring" is the opposite: hidden while that season is really happening ("Tell me when it opens").
  function applyOnly(id) {
    const now = W.seasons.live().map((s) => s.id), live = now.includes(id);
    $$('[data-only]').forEach((el) => el.toggleAttribute('hidden', !el.dataset.only.split(/\s+/).includes(id) || (el.hasAttribute('data-in-season') && !live)));   // SVG elements have no .hidden property
    $$('[data-out-of-season]').forEach((el) => el.toggleAttribute('hidden', el.dataset.outOfSeason.split(/\s+/).some((s) => now.includes(s))));
  }

  function build(id) {
    const sc = SCENES[id];
    season = id;
    token += 1;
    hud(sc.hud);
    farEl.innerHTML = sc.far();
    midEl.innerHTML = sc.mid();
    fieldEl.innerHTML = sc.field();
    foreEl.innerHTML = sc.fore();
    particles(sc.particles);
    if (footerEl) footerEl.innerHTML = footerArt(id);
    bindScene();
  }

  /* ------------------------------------------------------------------ *
   * Season switcher
   * ------------------------------------------------------------------ */
  const switchEl = $('#season-switch');
  const buttons = switchEl ? $$('button[data-season]', switchEl) : [];

  function markSwitch(id) {
    buttons.forEach((b) => {
      const on = b.dataset.season === id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }

  let swapTimer = 0;
  function setSeason(id, userAction) {
    if (!SCENES[id]) return;
    if (userAction) {
      clearTimeout(swapTimer);   // a quick second choice (or a key held down on the switcher) replaces the one still waiting: the scene is drawn once, for the last one
      if (id === season) {       // already showing it: nothing to redraw, and the basket count and the picked things stay as they are
        sceneEl.classList.remove('is-swapping');
        markSwitch(id);
        doc.dispatchEvent(new CustomEvent('wa:season', { detail: id }));
        return;
      }
      markSwitch(id);
    }
    const run = () => {
      W.seasons.apply(id);
      try { build(id); } catch (e) { setTimeout(() => { throw e; }); }   // a drawing problem must not leave the wrong season's words and buttons
      applyOnly(id);
      // Between seasons the scene shows the nearest one, but its line ("It's strawberry season!") would not be true yet
      // (or any more), so the all-year line is shown instead. A season picked with the switcher still shows its own line.
      if (!userAction && !W.seasons.live().some((s) => s.id === id)) {
        $$('.hero-sub').forEach((p) => { p.hidden = p.dataset.only !== 'no-js'; });
        $$('#hero-h > [data-only]').forEach((s, i) => { s.hidden = i > 0; });   // the first title is the all-year one
      }
      markSwitch(id);
      sceneEl.classList.remove('is-swapping');
      if (userAction) doc.dispatchEvent(new CustomEvent('wa:season', { detail: id }));
    };
    if (userAction && !reduceMotion) { sceneEl.classList.add('is-swapping'); swapTimer = setTimeout(run, 240); } else run();
  }

  if (switchEl && W.seasonPicker !== false) {
    const now = W.seasons.current();
    buttons.forEach((b, i) => {
      if (b.dataset.season === now && W.seasons.live().some((s) => s.id === now)) b.insertAdjacentHTML('beforeend', '<span class="ss-now">' + t('now') + '</span>');
      b.addEventListener('click', () => setSeason(b.dataset.season, true));
      b.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        const jump = e.key === 'Home' ? 0 : e.key === 'End' ? buttons.length - 1 : -1;
        if (!step && jump < 0) return;
        e.preventDefault();
        const next = step ? buttons[(i + step + buttons.length) % buttons.length] : buttons[jump];
        next.focus(); setSeason(next.dataset.season, true);
      });
    });
    doc.addEventListener('wa:lang', () => $$('.ss-now').forEach((n) => { n.textContent = t('now'); }));   // written once above, so it is re-worded when the language changes
    switchEl.hidden = false;
  }

  /* ------------------------------------------------------------------ *
   * Friendly extras: the sun and the "No reservation?" pill answer a
   * hover with CSS (css/extras.css) and a click with a burst from here.
   * ------------------------------------------------------------------ */
  const rnd = (a, b) => a + Math.random() * (b - a);   // visual-only randomness (the scenes use the seeded W.rand)

  function restart(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    clearTimeout(el._fx);
    el._fx = setTimeout(() => el.classList.remove(cls), ms);
  }

  function initSun() {
    const sun = $('.sun', hero);
    if (!sun) return;
    const COLORS = ['#ffd54f', '#ffb300', '#fff4a8', '#ff8a3d', '#ffffff'];
    sun.addEventListener('click', () => {
      restart(sun, 'sun-boom', 1200);
      if (reduceMotion) return;
      const size = sun.offsetWidth || 120;
      const box = doc.createElement('span');
      box.className = 'sun-burst';
      box.style.setProperty('--r0', Math.round(size * 0.34) + 'px');
      let html = '<b class="sun-ring"></b><b class="sun-ring" style="--dl:.18s"></b>';
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = Math.round((360 / n) * i + (i % 2 ? 8 : -8));
        const d = Math.round(size * rnd(0.72, 1.22));
        const s = Math.round(rnd(9, 19));
        html += '<i style="--a:' + a + 'deg;--d:' + d + 'px;--s:' + s + 'px;--c:' + COLORS[i % COLORS.length] + ';--dl:' + ((i % 3) * 0.04).toFixed(2) + 's"></i>';
      }
      box.innerHTML = html;
      if (sun._burst) sun._burst.remove();   // a new burst replaces the one still flying
      sun.appendChild(box);
      sun._burst = box;
      setTimeout(() => { box.remove(); if (sun._burst === box) sun._burst = null; }, 1500);
    });
  }

  function initNote() {
    const note = $('.hero-note', hero);
    const link = note && $('a[href^="#"]', note);
    if (!note || !link) return;
    const go = () => {
      const href = link.getAttribute('href');
      const target = $(href);
      if (!target) return;
      if (location.hash === href) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      else location.hash = href;
    };
    note.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduceMotion) { if (!link.contains(e.target)) go(); return; }
      e.preventDefault();                      // let the pop play first, then glide down to The GreenHouse
      restart(note, 'is-pop', 800);
      const box = doc.createElement('span');
      box.className = 'note-burst';
      const GREENS = ['#43a047', '#7bc67e', '#2e8b57'];
      let html = '';
      for (let i = 0; i < 16; i++) {
        const kind = ['p-leaf', 'p-star', 'p-dot'][i % 3];
        const dir = (i / 16) * Math.PI * 2;
        const dist = rnd(70, 140);
        const x = Math.round(Math.cos(dir) * dist * 1.5), y = Math.round(Math.sin(dir) * dist * 0.7 - 20);
        html += '<i class="' + kind + '" style="--x:' + x + 'px;--y:' + y + 'px;--r:' + Math.round(rnd(-260, 260)) + 'deg;--s:' + Math.round(rnd(11, 19)) + 'px;--c:' + GREENS[i % 3] + ';--dl:' + ((i % 4) * 0.03).toFixed(2) + 's"></i>';
      }
      box.innerHTML = html;
      if (note._burst) note._burst.remove();
      note.appendChild(box);
      note._burst = box;
      setTimeout(() => { box.remove(); if (note._burst === box) note._burst = null; }, 1400);
      setTimeout(go, 520);
    });
  }

  /* ------------------------------------------------------------------ */
  if (hasHero) {
    setSeason(W.seasons.current(), false);
    doc.documentElement.classList.add('scene-ready');
    initSun();
    initNote();
    W.hero = { setSeason: (id) => setSeason(id, true) };
  } else {
    const id = W.seasons.active || W.seasons.current();
    applyOnly(id);
    if (footerEl) footerEl.innerHTML = footerArt(id);
  }
})();
