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
    `<rect x="-4" y="-28" width="8" height="28" fill="${trunk}"/>` +
    `<circle cx="0" cy="-46" r="26" fill="${c1}"/><circle cx="-15" cy="-32" r="15" fill="${c2}"/><circle cx="15" cy="-34" r="14" fill="${c2}"/></g>`;

  const snowFir = (x, base, s) =>
    `<g transform="translate(${x} ${base}) scale(${s})" stroke="${INK}" stroke-width="${f1(2.8 / s)}" stroke-linejoin="round">` +
    `<rect x="-4" y="-12" width="8" height="14" fill="#8a5a35"/>` +
    `<path d="M0-96-30-16H30Z" fill="#2b7a3a"/>` +
    `<path d="M0-96-13-62Q-5-54 0-62Q6-54 13-62Z" fill="#fff"/>` +
    `<path d="M-13-62-22-38Q-13-30-9-38Q0-28 9-38Q13-30 22-38L13-62Q5-52 0-62Q-5-52-13-62Z" fill="#fff"/>` +
    `<path d="M-22-38-30-16Q-20-8-13-16Q0-6 13-16Q20-8 30-16L22-38Q12-28 0-38Q-12-28-22-38Z" fill="#fff"/></g>`;

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
    return `<g transform="translate(${f1(cx)} ${f1(cy - 20 * sc)}) scale(${f1(sc * f * 100) / 100} ${f1(sc * 100) / 100})"><g class="kid-pick" style="animation-delay:${f1((cx % 7) * -0.4)}s">` +
      person(0, 0, shirt, hat, false) +
      `<g transform="translate(11 6) scale(.55)"><use href="#basket" width="64" height="52"/></g></g></g>`;
  }

  function springField() {
    const rnd = rand(11);
    let out = `<path d="${groundPath()}" fill="#69b84c"/>`;
    // a farm lane along the top of the field with a tractor hauling full crates of berries
    out += `<path d="M-20 ${VPY - 4}C300 ${VPY - 12} 700 ${VPY} 1000 ${VPY - 6}S1340 ${VPY - 8} 1470 ${VPY - 4}V${VPY + 12}C1200 ${VPY + 16} 900 ${VPY + 8} 640 ${VPY + 14}S120 ${VPY + 14} -20 ${VPY + 12}Z" fill="#c9a06a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
    out += buildRig({ y: VPY + 4, scale: 0.62, cargo: 'crates', body: '#f08a24', cab: '#c2581a', cls: 'rig-small' });
    out += rowPolys(range(-5, 5), { fill: '#8a5a35', stroke: INK, inner: '#a4714a' });
    const KIDS = { 2: [[-1.5, '#e5334b', HAT.straw, 0], [1.5, '#4b5bb8', HAT.cap, 1]], 4: [[0.5, '#ffc928', HAT.beanie, 0]] };
    [0.11, 0.15, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62].forEach((t, ti) => {
      (KIDS[ti] || []).forEach(([k, shirt, hat, flip]) => { out += kid(rowX(k, t), rowY(t) - 2, 22 + 130 * t, shirt, hat, flip); });
      for (let k = -4; k <= 4; k++) {
        const cx = rowX(k, t), cy = rowY(t);
        const w = 22 + 130 * t, h = w * 0.75;
        out += use('sb-plant', cx - w / 2, cy - h * 0.94, w, h);
        const r = rnd();
        const count = t >= 0.25 ? (r < 0.3 ? 0 : r < 0.72 ? 1 : 2) : (r < 0.5 ? 1 : 0);
        const bw = w * 0.27, bh = bw * 72 / 64;
        const spots = [[cx - w * 0.3 - bw / 2, cy - h * 0.56], [cx + w * 0.13, cy - h * 0.5]];
        for (let i = 0; i < count; i++) {
          const [bx, by] = spots[i];
          const berry = use('strawberry', 0, 0, bw, bh);
          if (t >= 0.25) {
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
      `<g transform="translate(-30 -12) scale(1.35)">` +
      `<path d="M-7 18l-3 14M7 18l3 14" stroke="${INK}" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M-7 18l-3 14M7 18l3 14" stroke="#4b5bb8" stroke-width="2.6" stroke-linecap="round" fill="none"/>` +
      person(0, 0, '#e5334b', HAT.straw, true) +
      `<g transform="translate(18 -14)"><g class="snip"><path d="M0 0l9-5M0 0l9 4" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><circle cx="-2" cy="-1" r="1.6" fill="none" stroke="${INK}" stroke-width="1.6"/></g></g></g></g>`;
  }

  const summerFore = () =>
    blades(520, 10, 30, 26, '#5cb85c', 4) +
    snippable(24, 205, 128, '') + snippable(170, 300, 88, 's2') + snippable(1236, 250, 112, 's3') + snippable(1330, 178, 138, 's2') + snippable(1160, 340, 78, '') +
    flowerCutter(1010, 474) +
    blades(538, 12, 34, 22, '#2e8b3a', 9);


  /* ------------------------------------------------------------------ *
   * SUMMER — blueberry bushes
   * ------------------------------------------------------------------ */
  const blueBerry = (r, ripe = true) =>
    `<circle r="${f1(r)}" fill="${ripe ? '#4d5fc9' : '#a8b4ea'}" stroke="${INK}" stroke-width="2"/>` +
    `<circle cx="${f1(r * 0.12)}" cy="${f1(-r * 0.1)}" r="${f1(r * 0.34)}" fill="${ripe ? '#33418f' : '#8a97d6'}"/>` +
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

  function summerField() {
    const rnd = rand(23);
    let out = `<path d="${groundPath()}" fill="#63b34a"/>`;
    out += rowPolys(range(-5, 5), { fill: '#c9a06a', stroke: '#6b4a28', inner: '#dcb884', hw: 60, innerHw: 30 });
    [0.11, 0.15, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62].forEach((t) => {
      for (let k = -4; k <= 4; k++) {
        const w = 36 + 150 * t;
        const n = t >= 0.3 ? 4 + Math.floor(rnd() * 3) : 0;
        out += bush(rowX(k, t), rowY(t) + 2, w, n);
      }
    });
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
      `<circle cx="0" cy="-9" r="9" fill="${skin}"/>` + hat +
      `<circle cx="-3.2" cy="-9.4" r="1.2" fill="${INK}" stroke="none"/><circle cx="3.2" cy="-9.4" r="1.2" fill="${INK}" stroke="none"/>` +
      `<path d="M-3 -5.4q3 2.6 6 0" fill="none" stroke-width="1.6"/></g>`;
  }
  const HAT = {
    beanie: '<path d="M-9.4 -12a9.4 9.4 0 0 1 18.8 0Z" fill="#e5334b"/><circle cx="0" cy="-22" r="2.8" fill="#fff"/>',
    straw:  '<path d="M-13.5 -13h27" stroke-width="3"/><path d="M-8 -13a8 8 0 0 1 16 0Z" fill="#e9c46a"/>',
    cap:    '<path d="M-9 -13a9 9 0 0 1 18 0Z" fill="#4b5bb8"/><path d="M-1 -13h13" stroke-width="3"/>',
    hair:   '<path d="M-9.4 -11a9.4 9.4 0 0 1 18.8 0c-4-4.5-14-4.5-18.8 0Z" fill="#8a5a35"/>',
  };

  const wheelDark = (cx, cy, r, cls) => {
    let sp = '';
    for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; sp += `M${cx} ${cy}L${f1(cx + Math.cos(a) * r * 0.6)} ${f1(cy + Math.sin(a) * r * 0.6)}`; }
    return `<g class="wheel ${cls}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2d2d2d" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r + 2.5)}" fill="none" stroke="#2d2d2d" stroke-width="5" stroke-dasharray="6 6.4"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.58)}" fill="#ffc928" stroke="${INK}" stroke-width="3"/>` +
      `<path d="${sp}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="${cx}" cy="${cy}" r="${f1(r * 0.16)}" fill="${INK}"/></g>`;
  };
  const wheelWood = (cx, cy, r, cls) => {
    let sp = '';
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; sp += `M${cx} ${cy}L${f1(cx + Math.cos(a) * r * 0.86)} ${f1(cy + Math.sin(a) * r * 0.86)}`; }
    return `<g class="wheel ${cls}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#c98a4b" stroke="${INK}" stroke-width="3"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${f1(r * 0.78)}" fill="#e3b070" stroke="${INK}" stroke-width="2"/>` +
      `<path d="${sp}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" fill="none"/><circle cx="${cx}" cy="${cy}" r="${f1(r * 0.2)}" fill="#7a4b2a" stroke="${INK}" stroke-width="2.4"/></g>`;
  };

  // A tractor towing a trailer. `cargo` picks what rides in the trailer; origin = ground level.
  function crateStack() {
    const crate = (x, y) => `<rect x="${x}" y="${y}" width="56" height="32" rx="4" fill="#c98a4b"/>` +
      `<path d="M${x + 4} ${y + 11}h48M${x + 4} ${y + 21}h48" stroke="#7a4b2a" stroke-width="2.2" fill="none"/>` +
      `<path d="M${x + 14} ${y}v32M${x + 42} ${y}v32" stroke="#7a4b2a" stroke-width="2.6" fill="none"/>`;
    const berries = (x, y, n) => Array.from({ length: n }, (_, i) => use('strawberry', x + 6 + i * 13, y - 15 + (i % 2) * 3, 17, 19)).join('');
    let out = '';
    [-112, -54, 4, 62].forEach((x) => { out += crate(x, -80) + berries(x, -80, 4); });
    [-82, -24, 34].forEach((x) => { out += crate(x, -112) + berries(x, -112, 4); });
    return out;
  }

  function buildRig(cfg = {}) {
    const c = Object.assign({ y: VPY + 52, scale: 1, cargo: 'hay', body: '#43a047', cab: '#2b7a3a', cls: '', dur: '' }, cfg);
    const hay = c.cargo === 'hay';
    const trailer =
      `<ellipse cx="0" cy="3" rx="152" ry="6" fill="rgba(58,36,22,.25)"/>` +
      `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">` +
        (hay
          ? [-118, -58, 2, 62].map((x) => `<rect x="${x}" y="-82" width="54" height="36" rx="6" fill="#f0c95a"/><path d="M${x + 8} -66h38M${x + 8} -56h38" stroke="#c19a2c" stroke-width="2" fill="none"/><path d="M${x + 16} -82v36M${x + 38} -82v36" stroke="#9c7a1c" stroke-width="2.6" fill="none"/>`).join('')
          : '') +
        `<rect x="-138" y="-48" width="276" height="26" rx="4" fill="#a5673f"/>` +
        `<path d="M-130 -38h260M-130 -30h260" stroke="#7a4b2a" stroke-width="2" fill="none"/>` +
        (hay
          ? `<path d="M-138 -48v-34M-92 -48v-30M-46 -48v-30M0 -48v-30M46 -48v-30M92 -48v-30M138 -48v-34" fill="none" stroke-width="4"/><path d="M-138 -80h276" fill="none" stroke-width="5"/>` +
            `<rect x="-50" y="-44" width="100" height="17" rx="4" fill="#fff3d6" stroke-width="2.6"/>`
          : crateStack()) +
      `</g>` +
      (hay
        ? `<text x="0" y="-31.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="11.5" fill="${INK}" letter-spacing=".8">WAGON RIDES</text>` +
          person(-92, -110, '#e5334b', HAT.beanie, true) + person(-32, -106, '#4b5bb8', HAT.cap, false) +
          person(28, -108, '#43a047', HAT.straw, true) + person(88, -104, '#ffc928', HAT.hair, false) +
          use('pumpkin', -132, -102, 30, 25) + use('pumpkin-w', 108, -98, 26, 22)
        : '') +
      wheelWood(-88, -22, 24, 'wg1') + wheelWood(88, -22, 24, 'wg2') +
      `<path d="M138 -34L206 -30" stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none"/>`;

    const tractor =
      `<g transform="translate(196 -111) scale(1.1)">` +
        `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">` +
          `<rect x="100" y="14" width="7" height="30" rx="2" fill="#607d8b"/>` +
          `<path d="M62 78V50c0-6 4-10 10-10h30c6 0 10 3 12 8l8 20v10Z" fill="${c.body}"/>` +
          `<path d="M62 66h58" fill="none" stroke-width="2.5" opacity=".4"/>` +
          `<path d="M28 54V26c0-6 4-10 10-10h22c6 0 8 4 8 10v28Z" fill="${c.cab}"/>` +
          `<rect x="36" y="24" width="24" height="22" rx="2" fill="#cfe9f7"/>` +
          `<circle cx="48" cy="36" r="6.4" fill="#f7c9a0" stroke-width="2.2"/><path d="M41 32h14" stroke-width="3.4"/><path d="M44 32a4 4 0 0 1 8 0Z" fill="#e9c46a" stroke-width="2"/>` +
          `<path d="M48 24v22" fill="none" stroke-width="2" opacity=".6"/>` +
          `<path d="M112 44h16" fill="none" stroke-width="5"/>` +
        `</g>` +
        wheelDark(40, 70, 28, 'wt1') + wheelDark(120, 84, 15, 'wt2') +
        `<path d="M70 48h28" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".4"/>` +
      `</g>` +
      `<g class="rig-smoke" transform="translate(${f1(196 + 103.5 * 1.1)} ${f1(-111 + 12 * 1.1)})" fill="#fff" stroke="#cfcfcf" stroke-width="1.5">` +
        `<circle class="puff p1" r="7"/><circle class="puff p2" r="5.5"/><circle class="puff p3" r="6.5"/></g>` +
      `<g class="toot" transform="translate(300 -150)"><rect x="-42" y="-17" width="84" height="28" rx="14" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
      `<path d="M-6 10l6 11 6-11" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-7 8.5h14" stroke="#fff" stroke-width="5"/>` +
      `<text x="0" y="3" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="14" fill="${INK}">Toot toot!</text></g>`;

    // wheels turn at a speed that matches how far the tractor travels per second at this size
    const sc = c.scale, vars = `--wt1:${f1(3.7 * sc)}s;--wt2:${f1(2.1 * sc)}s;--wg1:${f1(2.9 * sc)}s;--wg2:${f1(2.9 * sc)}s;` + (c.dur ? `--rig-dur:${c.dur};` : '');
    return `<g transform="translate(0 ${c.y})"><g class="rig ${c.cls}" style="${vars}"><g transform="scale(${sc})"><g class="rig-bounce">${trailer}${tractor}</g>` +
      `<rect class="scene-hit" data-rig x="-150" y="-190" width="520" height="200" fill="transparent"/></g></g></g>`;
  }
  const wagonRig = () => buildRig();

  function fallField() {
    const rnd = rand(31);
    let out = `<path d="${groundPath()}" fill="#a9bd45"/>`;
    // the road the wagon rides on
    out += `<path d="M-20 ${VPY + 16}C260 ${VPY + 6} 560 ${VPY + 22} 860 ${VPY + 12}S1300 ${VPY + 8} 1470 ${VPY + 16}V${VPY + 62}C1240 ${VPY + 70} 980 ${VPY + 58} 700 ${VPY + 66}S180 ${VPY + 62} -20 ${VPY + 68}Z" fill="#c69a63" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M-10 ${VPY + 34}C260 ${VPY + 28} 560 ${VPY + 42} 860 ${VPY + 34}S1300 ${VPY + 30} 1460 ${VPY + 36}" fill="none" stroke="#a9794a" stroke-width="3" stroke-dasharray="14 12" stroke-linecap="round"/>` +
      `<path d="M-10 ${VPY + 50}C260 ${VPY + 46} 560 ${VPY + 58} 860 ${VPY + 50}S1300 ${VPY + 46} 1460 ${VPY + 52}" fill="none" stroke="#dcb57c" stroke-width="3" stroke-dasharray="10 14" stroke-linecap="round"/>`;
    out += wagonRig();
    out += rowPolys(range(-5, 5), { fill: '#8a5a35', stroke: INK, inner: '#a4714a', t0: 0.24 });

    const variants = ['pumpkin', 'pumpkin', 'pumpkin-b', 'pumpkin-b', 'pumpkin-w'];
    [0.3, 0.36, 0.43, 0.51, 0.6, 0.7].forEach((t) => {
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
      `<path d="M14 -120C22 -126 30 -118 22 -104Z" fill="#ffcf3d"/>` +
      `<path d="M0 -300l-8-26M0 -300l4-30M0 -300l14-24" stroke="#d9b45a" stroke-width="4" stroke-linecap="round" fill="none"/></g></g>`;
  }

  function scarecrow(x, y) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    return `<g transform="translate(${x} ${y})"><g class="sway s2">` +
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
      `<path d="M-34 -166H34" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-32 -166H32" stroke="#7a4b2a" stroke-width="2.6" stroke-linecap="round"/>` +
      `<path d="M-20 -166C-22 -198 22 -198 20 -166Z" fill="#7a4b2a" ${sk}/><rect x="-20" y="-176" width="40" height="8" fill="#e5334b" stroke="${INK}" stroke-width="2.4"/>` +
      `<g class="crow" transform="translate(-66 -130)"><ellipse cx="0" cy="0" rx="12" ry="8" fill="#2b2b33" ${sk}/><circle cx="-10" cy="-7" r="6.4" fill="#2b2b33" ${sk}/>` +
      `<path d="M-15 -8l-9 3 9 3Z" fill="#f5a300" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/><circle cx="-11" cy="-8" r="1.4" fill="#fff"/><path d="M11 -2l15 4-13 3Z" fill="#2b2b33" ${sk}/></g>` +
      `</g></g>`;
  }

  const fallFore = () =>
    blades(524, 10, 28, 26, '#dcb85c', 6) +
    corn(28, 540, 300) + corn(96, 546, 240) + corn(1338, 546, 250) + corn(1408, 540, 310) +
    bale(430, 468, 116, 60) + bale(550, 468, 116, 60) + bale(490, 410, 116, 60) +
    use('pumpkin', 500, 366, 58, 49) + use('pumpkin-w', 566, 428, 44, 37) +
    scarecrow(1196, 526) +
    blades(540, 12, 32, 22, '#93a533', 12);

  const fallFar = () =>
    `<path d="${FAR_HILL}" fill="#f1c27b"/>` +
    round(150, 176, 0.8, '#e8893a', '#f5c033') + round(228, 182, 1, '#d2492a', '#e8893a') + round(300, 198, 0.75, '#f5c033', '#e8893a') +
    round(1010, 196, 0.7, '#e8893a', '#d2492a') + round(1290, 178, 0.9, '#f5c033', '#e8893a') + round(1385, 166, 0.8, '#d2492a', '#f5c033') +
    barn(1130, 70, 170);

  function fallMid() {
    let fence = '';
    for (let x = 600; x <= 900; x += 38) fence += `<rect x="${x}" y="${232 + Math.sin(x / 90) * 5}" width="6" height="28" fill="#8a5a35" stroke="${INK}" stroke-width="2"/>`;
    return `<path d="${MID_HILL}" fill="#c6d05e"/>` + fence +
      `<path d="M598 242H906M598 252H906" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M598 242H906M598 252H906" stroke="#a5673f" stroke-width="1.5" fill="none"/>` +
      roundBale(230, 246, 15) + roundBale(272, 250, 15) + roundBale(251, 232, 15);
  }

  /* ------------------------------------------------------------------ *
   * WINTER — Christmas-tree farm, campfires, snowman
   * ------------------------------------------------------------------ */
  const BULBS = [[26, 80, '#ff4d6d'], [54, 84, '#ffd54f'], [40, 66, '#7cf0ff'], [22, 60, '#ffd54f'], [58, 60, '#ff4d6d'], [40, 42, '#7cf0ff'], [30, 48, '#ff4d6d'], [52, 46, '#ffd54f'], [40, 24, '#ffd54f']];

  function tree(x, y, w, h, pickableTree) {
    let inner = `<ellipse cx="0" cy="0" rx="${f1(w * 0.44)}" ry="${f1(w * 0.09)}" fill="#e3edf7"/>` + use('fir', -w / 2, -h, w, h) + use('fir-snow', -w / 2, -h, w, h);
    if (!pickableTree) return `<g transform="translate(${f1(x)} ${f1(y)})">${inner}</g>`;
    const s = w / 80;
    inner += `<g transform="translate(${f1(-w / 2)} ${f1(-h)}) scale(${f1(s * 1000) / 1000})"><circle class="tree-glow" cx="40" cy="62" r="54" fill="url(#fireGlow)"/>` +
      BULBS.map(([bx, by, c], i) => `<circle class="bulb" cx="${bx}" cy="${by}" r="3.4" fill="${c}" style="--d:${(i * 0.17).toFixed(2)}s"/>`).join('') + '</g>';
    const pad = w * 0.1;
    return `<g class="berry-hit tree-pick" transform="translate(${f1(x)} ${f1(y)})" data-pick="tree">${inner}<rect x="${f1(-w / 2 - pad)}" y="${f1(-h - pad)}" width="${f1(w + pad * 2)}" height="${f1(h + pad * 2)}" fill="transparent"/></g>`;
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
      `<path class="flame f1" d="M-28 -10C-38 -36 -16 -54 -14 -84C-2 -70 6 -60 3 -46C12 -58 16 -70 14 -84C34 -62 40 -32 28 -10Z" fill="#ff7a1a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path class="flame f2" d="M-17 -10C-22 -30 -8 -42 -6 -62C4 -50 9 -42 7 -32C14 -41 16 -50 12 -58C25 -44 27 -24 17 -10Z" fill="#ffb300"/>` +
      `<path class="flame f3" d="M-8 -10C-11 -21 -4 -30 0 -40C6 -30 10 -21 8 -10Z" fill="#ffe066"/>` +
      `</g>`;
    const sparks = [[-10, 0.0], [8, 0.7], [-2, 1.3], [14, 1.9], [-16, 2.4]].map(([dx, dl], i) => `<circle class="spark sp${i % 3}" cx="${dx}" cy="-60" r="2.4" fill="#ffd54f" style="animation-delay:${dl}s"/>`).join('');
    return `<g class="campfire" transform="translate(${x} ${y}) scale(${s})" data-fire>` +
      `<circle class="fire-glow" cx="0" cy="-34" r="128" fill="url(#fireGlow)"/>` +
      `<ellipse cx="0" cy="6" rx="64" ry="15" fill="#fff" stroke="#c9dcef" stroke-width="3"/><ellipse cx="0" cy="3" rx="44" ry="10" fill="#5a3d30"/>` +
      back + log(-16, -4) + log(16, 4) + flames + sparks + front +
      `<rect class="scene-hit" x="-72" y="-116" width="144" height="140" fill="transparent"/></g>`;
  }

  const FIRES = [{ x: 560, y: 458, s: 1 }, { x: 890, y: 452, s: 0.94 }];   // kept clear of the picking card (bottom left) and the snowman (right)

  function winterField() {
    const rnd = rand(41);
    let out = `<path d="${groundPath()}" fill="#f5f9fd" stroke="#c9dcef" stroke-width="3"/>`;
    out += rowPolys(range(-5, 5), { fill: '#e6f0f9', inner: '#ffffff', hw: 60, innerHw: 28, innerOpacity: 0.7 });
    [0.11, 0.15, 0.19, 0.25, 0.32, 0.4, 0.5, 0.62].forEach((t) => {
      for (let k = -4; k <= 4; k++) {
        const x = rowX(k, t) + (rnd() - 0.5) * 8, y = rowY(t);
        if (FIRES.some((f) => Math.abs(x - f.x) < 100 && Math.abs(y - f.y) < 72)) continue;
        const h = (34 + 190 * t) * (0.9 + rnd() * 0.2), w = h * 0.727;
        out += tree(x, y, w, h, t >= 0.25);
      }
    });
    FIRES.forEach((f) => { out += campfire(f.x, f.y, f.s); });
    return out;
  }

  function snowman(x, y) {
    const sk = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
    return `<g transform="translate(${x} ${y}) scale(.95)"><g class="sway s3">` +
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
      `<rect x="-27" y="-186" width="54" height="10" rx="3" fill="#2b2b33" ${sk}/><rect x="-17" y="-214" width="34" height="30" rx="3" fill="#2b2b33" ${sk}/><rect x="-17" y="-192" width="34" height="8" fill="#43a047" stroke="${INK}" stroke-width="2.4"/>` +
      `</g></g>`;
  }

  const winterFore = () =>
    `<path d="M-40 700V532C60 508 180 512 300 524S540 506 700 520 980 506 1120 520 1360 506 1480 516V700Z" fill="#dce9f5" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    use('fir', -34, 232, 170, 234) + use('fir', 1318, 262, 150, 206) +
    snowman(1236, 512) +
    `<path d="M-40 700V548C80 522 220 530 340 542S580 524 720 538 1000 524 1140 538 1380 526 1480 536V700Z" fill="#ffffff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<path d="M0 588c80-12 160-12 240 0M700 592c90-12 180-10 270 2M1180 590c60-10 130-10 200 0" fill="none" stroke="#cfe0f0" stroke-width="4" stroke-linecap="round"/>`;

  const winterFar = () =>
    `<path d="${FAR_HILL}" fill="#f7fbff" stroke="#c5d8ea" stroke-width="3"/>` +
    [[150, 186, 0.9], [226, 190, 1.15], [302, 204, 0.85], [362, 212, 0.7], [1010, 202, 0.85], [1222, 194, 0.7], [1292, 184, 1.05], [1388, 176, 0.95]].map(([x, b, s]) => snowFir(x, b, s)).join('') +
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
      far: () => `<path d="${FAR_HILL}" fill="#b5e59a"/>` + round(228, 182, 1, '#6cbf5b', '#5cb85c') + round(300, 198, 0.75, '#7ccf62', '#6cbf5b') + barn(1130, 70, 170),
      mid: () => `<path d="${MID_HILL}" fill="#8ed46b"/>`,
      field: springField, fore: springFore,
      hud: { art: 'basket', hint: 'Try it! Tap the strawberries to pick them.', btn: 'Pick a strawberry',
        msgs: [[1, 'Yum! Keep going.'], [3, 'You’re a natural picker!'], [5, 'Basket’s filling up! Ready for the real thing? {reserve}'], [10, TEN]] },
    },
    summer: {
      far: () => `<path d="${FAR_HILL}" fill="#a9e48a"/>` + round(228, 182, 1, '#4cae4e', '#43a047') + round(300, 198, 0.75, '#5cb85c', '#4cae4e') + round(1010, 196, 0.7, '#4cae4e', '#43a047') + barn(1130, 70, 170),
      mid: () => `<path d="${MID_HILL}" fill="#7bd05a"/>`,
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
    const many = matchMedia('(max-width: 760px)').matches ? 0.55 : 1;
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
  let season = null, count = 0, token = 0;
  let pickables = [];

  const msgVars = () => ({ reserve: reserveA(t('Reserve a visit')), spot: reserveA(t('Reserve your spot')), gh: '<a href="#greenhouse">' + t('The GreenHouse') + '</a>' });
  const msgFor = (cfg, n) => { const m = cfg.msgs.filter(([k]) => n >= k).pop(); return m ? t(m[1], msgVars()) : t(cfg.hint); };
  function hud(cfg) {
    count = 0;
    if (countEl) countEl.textContent = '0';
    if (msgEl) msgEl.innerHTML = t(cfg.hint);
    if (btnEl) btnEl.textContent = t(cfg.btn);
    if (artEl) artEl.setAttribute('href', '#' + cfg.art);
  }
  doc.addEventListener('wa:lang', () => {
    if (!season) return;
    const cfg = SCENES[season].hud;
    if (msgEl && msgEl.dataset.custom !== '1') msgEl.innerHTML = msgFor(cfg, count);
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

  function bump(cfg) {
    count += 1;
    if (countEl) {
      countEl.textContent = String(count);
      countEl.classList.remove('bump'); void countEl.offsetWidth; countEl.classList.add('bump');
    }
    if (msgEl) { msgEl.dataset.custom = ''; msgEl.innerHTML = msgFor(cfg, count); }
  }

  function pick(el) {
    const cfg = SCENES[season].hud;
    if (el.dataset.pick === 'tree') {
      if (el.classList.contains('lit')) return;
      el.classList.add('lit');
      bump(cfg); floatPlus(el);
      return;
    }
    if (el.dataset.state === 'picked') return;
    el.dataset.state = 'picked';
    const body = $('.berry', el);
    body.classList.remove('is-regrowing');
    body.classList.add('is-picked');
    bump(cfg); floatPlus(el);
    const mine = token;
    setTimeout(() => {
      if (mine !== token) return;
      body.classList.remove('is-picked');
      body.classList.add('is-regrowing');
      delete el.dataset.state;
      setTimeout(() => body.classList.remove('is-regrowing'), 900);
    }, 7000 + Math.random() * 4000);
  }

  function available() {
    return pickables.filter((el) => (el.dataset.pick === 'tree' ? !el.classList.contains('lit') : el.dataset.state !== 'picked'));
  }

  function bindScene() {
    pickables = $$('[data-pick]', sceneEl);
    pickables.forEach((el) => el.addEventListener('click', () => pick(el)));

    $$('[data-fire]', fieldEl).forEach((fire) => fire.addEventListener('click', () => {
      fire.classList.add('flare');
      clearTimeout(fire._t);
      fire._t = setTimeout(() => fire.classList.remove('flare'), 1100);
    }));

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
      if (msgEl) { msgEl.dataset.custom = '1'; msgEl.textContent = season === 'winter' ? t('Every tree is glowing!') : t('You picked them all! Give them a moment to grow back.'); }
      return;
    }
    pick(free[Math.floor(Math.random() * free.length)]);
  });

  /* ------------------------------------------------------------------ *
   * Build a season
   * ------------------------------------------------------------------ */
  function applyOnly(id) {
    $$('[data-only]').forEach((el) => el.toggleAttribute('hidden', !el.dataset.only.split(/\s+/).includes(id)));   // SVG elements have no .hidden property
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

  function setSeason(id, userAction) {
    if (!SCENES[id]) return;
    const run = () => {
      W.seasons.apply(id);
      build(id);
      applyOnly(id);
      markSwitch(id);
      sceneEl.classList.remove('is-swapping');
      if (userAction) doc.dispatchEvent(new CustomEvent('wa:season', { detail: id }));
    };
    if (userAction && !reduceMotion) { sceneEl.classList.add('is-swapping'); setTimeout(run, 240); } else run();
  }

  if (switchEl && W.seasonPicker !== false) {
    const now = W.seasons.current();
    buttons.forEach((b, i) => {
      if (b.dataset.season === now) b.insertAdjacentHTML('beforeend', '<span class="ss-now">' + t('now') + '</span>');
      b.addEventListener('click', () => setSeason(b.dataset.season, true));
      b.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = buttons[(i + step + buttons.length) % buttons.length];
        next.focus(); setSeason(next.dataset.season, true);
      });
    });
    switchEl.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  if (hasHero) {
    setSeason(W.seasons.current(), false);
    doc.documentElement.classList.add('scene-ready');
    W.hero = { setSeason: (id) => setSeason(id, true) };
  } else {
    const id = W.seasons.active || W.seasons.current();
    applyOnly(id);
    if (footerEl) footerEl.innerHTML = footerArt(id);
  }
})();
