/*
 * Illustrated farm map: the drawing half.
 *
 * js/features.js owns the map's behaviour (legend, tapping, detail card, translations). This file only turns the
 * points marked in the Farm Map Marker (window.WISE_ACRES_MAP, made by tools/farm_map.py) into SVG artwork:
 * forest and clearing, dirt lanes, a parking lot with cars, crop fields with rows of plants, a corn maze,
 * trails with little characters, and an icon for every pin. It returns strings of SVG markup.
 *
 * Nothing here is random per visit: a seeded generator makes the trees, plants and maze come out the same every time.
 */
(function () {
  'use strict';

  const W = (window.WISE_ACRES = window.WISE_ACRES || {});
  const INK = '#3a2416';
  const f1 = (n) => Math.round(n * 10) / 10;
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ------------------------------------------------------------------ *
   * Geometry
   * ------------------------------------------------------------------ */
  const pip = (p, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  const dseg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const dedge = (p, poly) => { let m = 1e9; for (let i = 0; i < poly.length; i++) m = Math.min(m, dseg(p, poly[i], poly[(i + 1) % poly.length])); return m; };
  const dpath = (p, pts) => { let m = 1e9; for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, dseg(p, pts[i], pts[i + 1])); return pts.length === 1 ? Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) : m; };
  const centroid = (pts) => { let x = 0, y = 0; pts.forEach((p) => { x += p[0]; y += p[1]; }); return [x / pts.length, y / pts.length]; };
  const polyArea = (pts) => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); };
  const bbox = (pts) => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pts.forEach((p) => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  };
  // direction (radians) of the long side of an outline: crop rows and parking stalls follow it
  function mainAxis(pts) {
    const c = centroid(pts); let sxx = 0, syy = 0, sxy = 0;
    pts.forEach((p) => { const x = p[0] - c[0], y = p[1] - c[1]; sxx += x * x; syy += y * y; sxy += x * y; });
    return 0.5 * Math.atan2(2 * sxy, sxx - syy);
  }
  const pathD = (pts, close) => pts.map((p, i) => (i ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('') + (close ? 'Z' : '');
  const pathLen = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
  // point + direction at a fraction of the way along a polyline
  function along(pts, frac) {
    const L = pathLen(pts); let want = L * frac;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (want <= d || i === pts.length - 1) { const t = d ? Math.min(1, want / d) : 0; return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx: b[0] - a[0], dy: b[1] - a[1] }; }
      want -= d;
    }
    return { x: pts[0][0], y: pts[0][1], dx: 1, dy: 0 };
  }

  /* ------------------------------------------------------------------ *
   * The land around the farm, traced from the aerial photo (roads, neighbours, mown lawn, dirt lanes).
   * Used only for the farm the aerial belongs to; a map without it just gets forest and clearing.
   * ------------------------------------------------------------------ */
  const SCENERY = {
    roads: [{ pts: [[-12, 24], [110, 30], [200, 42], [250, 66], [300, 102], [394, 130]], w: 15 }, { pts: [[254, 68], [284, 22], [304, -12]], w: 12 }],
    plowed: [[[258, 96], [338, 104], [346, 168], [266, 170]]],
    lawns: [[[270, 172], [394, 168], [394, 262], [304, 270], [262, 238]], [[16, 372], [68, 360], [94, 372], [96, 455], [50, 471], [18, 441]]],
    houses: [[318, 152, '#c8553d'], [356, 166, '#4b7fc9'], [296, 208, '#d9a441'], [342, 214, '#8a5a9a'], [372, 132, '#4aa07a']],
    dirt: [[[247, 109], [248, 90], [252, 72]], [[100, 238], [104, 290], [98, 345], [103, 400]], [[222, 330], [226, 380], [232, 440], [240, 490]], [[240, 490], [214, 505], [190, 500]], [[110, 300], [168, 315], [215, 318], [243, 333]]]
  };
  const sceneryFor = (data) => (data && data.scenery !== undefined ? data.scenery : (data && data.size && data.size.width === 380 && data.size.height === 587 ? SCENERY : null));

  // Icons, trees and name ribbons have a fixed size that suits the 380 x 587 aerial the owner marked. A map marked on a
  // bigger or smaller picture is scaled to that size first, and every point is kept on the picture (as tools/farm_map.py does),
  // so a new screenshot does not make the map unreadable and a stray point cannot blow the map up.
  const REF = 587;
  function normalize(data) {
    const w = +(data.size && data.size.width) || 0, h = +(data.size && data.size.height) || 0;
    if (!(w > 0 && h > 0)) return data;
    const k = Math.abs(Math.max(w, h) - REF) < 1 ? 1 : REF / Math.max(w, h), w2 = w * k, h2 = h * k;
    const fit = (p) => [Math.max(0, Math.min(w2, (+p[0] || 0) * k)), Math.max(0, Math.min(h2, (+p[1] || 0) * k))];
    return Object.assign({}, data, { scenery: sceneryFor(data), size: { width: w2, height: h2 }, items: (data.items || []).map((it) => (it && Array.isArray(it.pts) ? Object.assign({}, it, { pts: it.pts.map(fit) }) : it)) });
  }
  // Name ribbons should read at about 9.5 px on screen. 6.6 map units does that on a laptop; on a phone the map is shown
  // smaller, so the ribbons are drawn bigger (features.js draws the map again when its width changes a lot).
  const labelFont = (px, vb) => (px > 0 ? Math.max(6.6, Math.min(12, 9.5 * vb.w / px)) : 6.6);

  /* ------------------------------------------------------------------ *
   * Little drawings (symbols). Colours that change per use come from `color` on the <use>.
   * ------------------------------------------------------------------ */
  const S = (id, vb, body) => `<symbol id="${id}" viewBox="${vb}">${body}</symbol>`;
  const SYMS =
    S('mp-pumpkin', '0 0 20 20', `<g stroke="${INK}" stroke-width="1" stroke-linejoin="round"><path d="M3 12q-3-4 1-6 2 3-1 6z" fill="#4aa04a"/><path d="M17 12q3-4-1-6-2 3 1 6z" fill="#4aa04a"/><ellipse cx="10" cy="13" rx="7" ry="5.4" fill="#f58a1f"/><path d="M6.6 8q-1.2 5 0 10M10 7.6v10.8M13.4 8q1.2 5 0 10" fill="none" stroke="#c9650d" stroke-width=".9"/><path d="M10 7.8q.4-3 2.2-3.6" fill="none" stroke="#4a7a2a" stroke-width="1.7"/></g>`) +
    S('mp-bush', '0 0 20 20', `<g stroke="${INK}" stroke-width=".9"><ellipse cx="10" cy="18.2" rx="7.5" ry="1.6" fill="rgba(58,36,22,.25)" stroke="none"/><circle cx="10" cy="11" r="7.6" fill="#3f8f4b"/><circle cx="6.4" cy="9.4" r="4.6" fill="#4aa05a" stroke="none"/><circle cx="13.6" cy="9.6" r="4.6" fill="#4aa05a" stroke="none"/><g fill="#4b5bb8" stroke-width=".7"><circle cx="6.6" cy="12" r="1.7"/><circle cx="12.6" cy="12.8" r="1.7"/><circle cx="10" cy="8.6" r="1.7"/><circle cx="14.2" cy="8.6" r="1.5"/><circle cx="5.6" cy="8" r="1.5"/></g></g>`) +
    S('mp-tomato', '0 0 20 20', `<g stroke="${INK}" stroke-width=".9"><path d="M10 2.5V19" stroke="#8a5a35" stroke-width="1.3"/><ellipse cx="10" cy="11" rx="6" ry="7" fill="#4aa04a"/><g fill="#e5334b" stroke-width=".7"><circle cx="7" cy="12.4" r="2.3"/><circle cx="13.2" cy="9" r="2.3"/><circle cx="11" cy="15" r="2.2"/><circle cx="7.6" cy="7.6" r="1.8"/></g></g>`) +
    S('mp-sunf', '0 0 20 20', `<g stroke="${INK}" stroke-width=".9" stroke-linejoin="round"><path d="M10 9.5V19" stroke="#3f8f4b" stroke-width="1.9" fill="none"/><path d="M10 15q-5-.4-5.6-4 4 0 5.6 4zM10 16q4-.4 5-3.4-3.6 0-5 3.4z" fill="#4aa04a" stroke-width=".6"/><circle cx="10" cy="7" r="6.4" fill="#ffc928"/><circle cx="10" cy="7" r="6.4" fill="none" stroke="#e09e1a" stroke-width="1.3" stroke-dasharray="2.3 1.6"/><circle cx="10" cy="7" r="3.1" fill="#7a4b2a"/></g>`) +
    S('mp-bloom', '0 0 20 20', `<g stroke="${INK}" stroke-width=".8"><path d="M10 10v9" stroke="#3f8f4b" stroke-width="1.6" fill="none"/><path d="M10 16q-4-.4-4.6-3.4 3.4 0 4.6 3.4z" fill="#4aa04a" stroke-width=".5"/><g fill="currentColor"><circle cx="10" cy="4.6" r="3.2"/><circle cx="14.6" cy="8" r="3.2"/><circle cx="12.8" cy="12.6" r="3.2"/><circle cx="7.2" cy="12.6" r="3.2"/><circle cx="5.4" cy="8" r="3.2"/></g><circle cx="10" cy="9.4" r="2.2" fill="#ffd54f"/></g>`) +
    S('mp-berry', '0 0 20 20', `<g stroke="${INK}" stroke-width=".8" stroke-linejoin="round"><path d="M10 17q-8-1-8-7 4 0 8 3 4-3 8-3 0 6-8 7z" fill="#4aa04a"/><path d="M6 10.6c-2 .8-2.2 4 .6 5 1.6.4 3-1.2 2.4-3.6-.4-1.4-1.8-1.6-3-1.4z" fill="#e5334b"/><path d="M13.6 8.8c-2.2.4-3 3.4-.8 4.8 1.6.8 3.4-.4 3.2-2.8-.2-1.6-1.2-2.2-2.4-2z" fill="#e5334b"/></g>`) +
    S('mp-car', '0 0 10 18', `<g stroke="${INK}" stroke-width=".8"><rect x="1" y="1" width="8" height="16" rx="2.6" fill="currentColor"/><rect x="2.2" y="4" width="5.6" height="3.6" rx="1" fill="#cfe8f7" stroke-width=".5"/><rect x="2.2" y="11" width="5.6" height="3" rx="1" fill="#cfe8f7" stroke-width=".5"/></g>`) +
    S('mp-ghost', '0 0 14 18', `<g stroke="${INK}" stroke-width="1" stroke-linejoin="round"><path d="M1.5 17V7.5a5.5 5.5 0 0 1 11 0V17l-1.9-1.8-1.8 1.8-1.8-1.8-1.8 1.8-1.8-1.8z" fill="#fff"/><circle cx="5" cy="8" r="1.1" fill="${INK}" stroke="none"/><circle cx="9" cy="8" r="1.1" fill="${INK}" stroke="none"/><ellipse cx="7" cy="11.2" rx="1.2" ry="1.5" fill="${INK}" stroke="none"/></g>`) +
    S('mp-bat', '0 0 20 12', `<path d="M10 3c-1 0-1.4 1-1.4 1.8C7 3.6 4.6 3 1 5.6c1.6.2 2.6 1 3 2.2C5 7 6.4 7 7.4 7.8 8 9 9 10.4 10 11c1-.6 2-2 2.6-3.2 1-.8 2.4-.8 3.4 0 .4-1.2 1.4-2 3-2.2-3.6-2.6-6-2-7.6-.8C11.4 4 11 3 10 3z" fill="#2b2b33" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>`) +
    S('mp-deadtree', '0 0 24 30', `<g stroke="#2b1a10" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M12 29V12M12 20l-6-6M12 16l6-7M6 14l-3-1M18 9l3-3M12 12V5"/></g>`) +
    S('mp-t1', '0 0 24 28', `<g stroke="#1f4d24" stroke-width=".9" stroke-linejoin="round"><rect x="10.4" y="19" width="3.2" height="8.4" rx="1" fill="#6b4a2a" stroke="none"/><circle cx="12" cy="11" r="8.6" fill="#347a38"/><circle cx="7" cy="14.5" r="5.6" fill="#3f8a43"/><circle cx="17.2" cy="14.8" r="5.4" fill="#3f8a43"/><circle cx="10" cy="7.4" r="3.6" fill="#4da053" stroke="none" opacity=".75"/></g>`) +
    S('mp-t2', '0 0 24 28', `<g stroke="#1b4020" stroke-width=".9" stroke-linejoin="round"><rect x="10.4" y="19" width="3.2" height="8.4" rx="1" fill="#5c3f24" stroke="none"/><circle cx="12" cy="11" r="8.6" fill="#2a6a31"/><circle cx="6.6" cy="14.6" r="5.6" fill="#337437"/><circle cx="17.4" cy="14.4" r="5.6" fill="#337437"/><circle cx="12" cy="6.6" r="3.4" fill="#3d8a45" stroke="none" opacity=".7"/></g>`) +
    S('mp-t3', '0 0 24 30', `<g stroke="#17381d" stroke-width=".9" stroke-linejoin="round"><rect x="10.6" y="23" width="2.8" height="6.4" fill="#5c3f24" stroke="none"/><path d="M12 1.5l7 11H5z" fill="#2c7236"/><path d="M12 8l9 12H3z" fill="#245f2e"/><path d="M12 15l10 10H2z" fill="#2c7236"/></g>`) +
    S('mp-t1l', '0 0 24 28', `<g stroke="#2a6a2e" stroke-width=".9" stroke-linejoin="round"><rect x="10.4" y="19" width="3.2" height="8.4" rx="1" fill="#7a5632" stroke="none"/><circle cx="12" cy="11" r="8.6" fill="#4b9b4c"/><circle cx="7" cy="14.5" r="5.6" fill="#5aab55"/><circle cx="17.2" cy="14.8" r="5.4" fill="#5aab55"/><circle cx="9.6" cy="7.4" r="3.8" fill="#7cc46a" stroke="none" opacity=".8"/></g>`) +
    S('mp-house', '0 0 30 26', `<g stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"><rect x="3.5" y="11" width="23" height="13.5" fill="#fff3d6"/><path d="M1 12.4L15 1.5l14 10.9z" fill="currentColor"/><rect x="12.4" y="16.6" width="5.2" height="7.9" fill="#8a5a35"/><rect x="6" y="14.4" width="4.2" height="4.2" fill="#cfe8f7"/><rect x="19.8" y="14.4" width="4.2" height="4.2" fill="#cfe8f7"/></g>`) +
    S('mp-tuft', '0 0 8 6', `<path d="M4 6Q3 3 1 1.5M4 6Q4 3 4 .5M4 6Q5 3 7 1.5" fill="none" stroke="#6ba14a" stroke-width="1" stroke-linecap="round"/>`);

  /* ------------------------------------------------------------------ *
   * Pin icons. Drawn 40 wide x 40 tall with the foot at (0,0); features.js scales them.
   * ------------------------------------------------------------------ */
  const sk = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const shadow = (rx = 15) => `<ellipse cx="0" cy="0" rx="${rx}" ry="4" fill="rgba(40,60,20,.3)"/>`;
  const awning = (x, y, w, h, c1, c2, n = 5) => {
    let s = '';
    const sw = w / n;
    for (let i = 0; i < n; i++) s += `<path d="M${f1(x + i * sw)} ${y}h${f1(sw)}l${i < n / 2 ? -2 : 2} ${h}h${f1(-sw)}z" fill="${i % 2 ? c2 : c1}"/>`;
    return `<g ${sk} stroke-width="1.6">${s}</g>`;
  };
  const sign = (label, fill = '#fff8e6', w = 26) => `<g ${sk} stroke-width="1.8"><rect x="${-w / 2}" y="-14" width="${w}" height="12" rx="3" fill="${fill}"/></g>`;
  const ICON = {
    checkin: () => shadow(17) + `<g ${sk}><rect x="-13" y="-17" width="26" height="17" fill="#fff1d0"/><rect x="-9" y="-12" width="18" height="5" fill="#cfe8f7" stroke-width="1.4"/><path d="M0 -26V-37" stroke-width="2"/></g><path d="M0 -37h11l-3 3.6 3 3.6H0z" fill="#e5334b" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` + awning(-17, -27, 34, 10, '#e5334b', '#fff'),
    entrance: () => shadow(19) + `<g ${sk}><rect x="-19" y="-30" width="6" height="30" rx="1.5" fill="#a5673f"/><rect x="13" y="-30" width="6" height="30" rx="1.5" fill="#a5673f"/><rect x="-17" y="-37" width="34" height="11" rx="3" fill="#c98a4b"/></g><path d="M-9 -31.5h14M1 -35l5 3.5-5 3.5" fill="none" stroke="#fff8e6" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M-13 -4l11-12" stroke="#7a4b2a" stroke-width="2.4" stroke-linecap="round" fill="none"/>`,
    restrooms: () => shadow(16) + `<g ${sk}><rect x="-13" y="-22" width="26" height="22" fill="#e8efe9"/><path d="M-16 -21L0 -34l16 13z" fill="#7d9a91"/><rect x="-3.4" y="-14" width="6.8" height="14" fill="#6aa8b0" stroke-width="1.6"/></g><g stroke="${INK}" stroke-width="1.2"><circle cx="-8" cy="-14.5" r="2" fill="#4b8fd8"/><path d="M-8 -12.4v5" stroke-width="2.4" stroke="#4b8fd8"/><circle cx="8" cy="-14.5" r="2" fill="#e5649a"/><path d="M5.6 -6.6L8 -12.4l2.4 5.8z" fill="#e5649a"/></g>`,
    dropoff: () => shadow(12) + `<g ${sk}><rect x="-2" y="-26" width="4" height="26" fill="#8a5a35"/><rect x="-13" y="-39" width="26" height="17" rx="3.5" fill="#3b6fd8"/></g><path d="M-4.5 -25v-10h5a3.4 3.4 0 0 1 0 6.8h-5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    animals: () => shadow(19) + `<use href="#goat" x="-21" y="-39" width="42" height="39"/><g ${sk} stroke-width="1.6"><path d="M-20 -6h40M-20 -2h40" fill="none"/><path d="M-19 -9v9M-9 -9v9M1 -9v9M11 -9v9M19 -9v9" fill="none"/></g>`,
    playground: () => shadow(22) + `<use href="#playground" x="-26" y="-34" width="52" height="34"/>`,
    firepit: () => shadow(16) + `<g ${sk} stroke-width="1.6"><ellipse cx="0" cy="-4" rx="15" ry="6.4" fill="#6b5a4a"/><ellipse cx="0" cy="-5" rx="10" ry="4" fill="#3a2a22" stroke="none"/><path d="M-9 -4l18-4M9 -4l-18-4" stroke="#7a4b2a" stroke-width="4"/>` +
      [[-14, -3], [-8, 1], [0, 2.5], [8, 1], [14, -3], [-12, -9], [12, -9], [0, -10]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.6" fill="${i % 2 ? '#b9bdc7' : '#9aa0ac'}"/>`).join('') +
      `</g><g class="mp-flame"><path d="M-7 -6C-9 -14 -3 -20 -2 -30C3 -23 7 -17 6 -11C8 -16 9 -20 8 -25C14 -17 11 -9 7 -6z" fill="#ff7a1a" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M-3 -6C-4 -12 0 -16 0 -22C4 -16 5 -11 4 -6z" fill="#ffd54f"/></g>`,
    concessions: () => shadow(19) + `<g ${sk}><rect x="-15" y="-13" width="30" height="13" fill="#c98a4b"/><path d="M-12 -13v13M0 -13v13M12 -13v13" stroke-width="1.2" fill="none" stroke="#7a4b2a"/><path d="M-16 -13h32" stroke-width="2.6"/></g><g stroke="${INK}" stroke-width="1.2"><circle cx="-8" cy="-16.6" r="3.4" fill="#e5334b"/><circle cx="-1" cy="-17" r="3.4" fill="#f58a1f"/><circle cx="6" cy="-16.6" r="3.4" fill="#ffc928"/><circle cx="12" cy="-16.2" r="2.8" fill="#8dd05a"/></g><g ${sk} stroke-width="1.4"><path d="M-14 -22v22M14 -22v22" stroke="#8a5a35" stroke-width="2.4"/></g>` + awning(-19, -34, 38, 11, '#f58a1f', '#fff', 6),
    barn: () => shadow(24) + `<use href="#barn" x="-27" y="-40" width="54" height="44"/>`,
    cornpit: () => shadow(17) + `<g ${sk}><path d="M-16 -9l32 0 0 9 -32 0z" fill="#c98a4b"/><path d="M-16 -9l5-6h22l5 6z" fill="#7a4b2a"/><path d="M-11 -15h22l4 6h-30z" fill="#f2c12e" stroke-width="1.4"/></g><g fill="#c98a05">${[[-7, -12], [-2, -11], [4, -12.4], [9, -11], [-9, -9.6], [1, -9.6]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.1"/>`).join('')}</g><g ${sk} stroke-width="1.6"><path d="M8 -9l7-14" stroke="#8a5a35" stroke-width="2.6"/><ellipse cx="16" cy="-25" rx="4.2" ry="2.4" fill="#f2c12e" transform="rotate(-22 16 -25)"/></g>`,
    wagon: () => shadow(14) + `<g ${sk}><rect x="-2" y="-28" width="4" height="28" fill="#8a5a35"/><rect x="-18" y="-40" width="36" height="17" rx="3" fill="#fff8e6"/></g><use href="#wagon" x="-15.5" y="-37" width="31" height="9.6"/><path d="M-13 -26h26" stroke="#2b7a3a" stroke-width="2" stroke-linecap="round"/>`,
    mazesign: () => shadow(12) + `<g ${sk}><rect x="-2" y="-26" width="4" height="26" fill="#8a5a35"/><path d="M-17 -38h26l7 7-7 7h-26z" fill="#e8d28a"/></g><g stroke="#6b5a10" stroke-width="1.8" fill="none" stroke-linecap="round"><path d="M-11 -34h12v4h-8v4h10"/></g>`,
    picnic: () => shadow(19) + `<use href="#tree" x="-13" y="-39" width="26" height="31"/><g ${sk} stroke-width="1.6"><path d="M-14 -7h28v4h-28z" fill="#c98a4b"/><path d="M-11 -3l-3 3M11 -3l3 3M-5 -3v3M5 -3v3" fill="none"/></g>`,
    photo: () => shadow(14) + `<g ${sk}><path d="M0 -14L-8 0M0 -14L8 0M0 -14V0" fill="none" stroke-width="2.2"/><rect x="-13" y="-31" width="26" height="17" rx="3.5" fill="#444a56"/><circle cx="0" cy="-22.5" r="5.6" fill="#cfe8f7"/><circle cx="0" cy="-22.5" r="2.4" fill="#2b3a55"/><rect x="5" y="-34" width="7" height="3.6" rx="1.2" fill="#e5649a" stroke-width="1.4"/></g>`,
    water: () => shadow(11) + `<g ${sk}><rect x="-3" y="-20" width="6" height="20" fill="#9aa7b0"/><path d="M-3 -20h14v5h-5" fill="#9aa7b0"/></g><path d="M8 -12c-3 4-4 6-4 8a4 4 0 0 0 8 0c0-2-1-4-4-8z" fill="#4aa8e8" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
    firstaid: () => shadow(13) + `<g ${sk}><rect x="-14" y="-28" width="28" height="22" rx="4" fill="#fff"/><path d="M-6 -17h12M0 -23v12" stroke="#d72a43" stroke-width="5.6" stroke-linecap="butt"/><rect x="-14" y="-28" width="28" height="22" rx="4" fill="none"/><path d="M-6 -28v-4h12v4" fill="none"/></g>`,
    staff: () => shadow(12) + `<g ${sk}><rect x="-2" y="-24" width="4" height="24" fill="#8a5a35"/><circle cx="0" cy="-30" r="10.5" fill="#fff"/></g><g stroke="#d72a43" stroke-width="3" stroke-linecap="round"><circle cx="0" cy="-30" r="7" fill="none"/><path d="M-5 -35l10 10"/></g>`,
    accessible: () => shadow(12) + `<g ${sk}><rect x="-2" y="-22" width="4" height="22" fill="#8a5a35"/><rect x="-12" y="-38" width="24" height="18" rx="4" fill="#2b6fd8"/></g><g stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="-1" cy="-35" r="1.2" fill="#fff"/><path d="M-1 -32v5h6M-1 -29h4"/><path d="M-4 -29a4.6 4.6 0 1 0 5 5" /></g>`,
    other: () => shadow(11) + `<g ${sk}><rect x="-1.6" y="-30" width="3.2" height="30" fill="#8a5a35"/></g><path d="M1.6 -30h15l-4 5 4 5h-15z" fill="#ffc928" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`,
    // crops used as a pin (rarely) fall back to a pick sign
    pumpkins: () => shadow(14) + `<use href="#pumpkin" x="-16" y="-27" width="32" height="27"/>`,
    blueberries: () => shadow(14) + `<use href="#blueberry" x="-14" y="-29" width="28" height="29"/>`,
    strawberries: () => shadow(14) + `<use href="#strawberry" x="-12" y="-27" width="24" height="27"/>`,
    tomatoes: () => shadow(14) + `<use href="#tomato" x="-14" y="-28" width="28" height="28"/>`,
    sunflowers: () => shadow(14) + `<use href="#sunflower" x="-14" y="-30" width="28" height="30"/>`,
    flowers: () => shadow(14) + `<use href="#bloom" x="-14" y="-28" width="28" height="28"/>`
  };
  // how much room a pin's icon takes on the map (radius, in map units) so neighbours are spread apart
  const ICON_R = { barn: 17, playground: 15, concessions: 14, animals: 13, checkin: 12, entrance: 13, picnic: 13, firepit: 11 };
  const iconR = (kind) => ICON_R[kind] || 10;
  const pinIcon = (kind) => (ICON[kind] || ICON.other)();

  /* ------------------------------------------------------------------ *
   * Crop fields
   * ------------------------------------------------------------------ */
  const CROP = {
    pumpkins:     { soil: '#8a5a35', bed: '#a4714a', plant: 'mp-pumpkin', size: 11.5, ps: 10, sp: 11.5 },
    blueberries:  { soil: '#6f8a52', bed: '#e9ecef', plant: 'mp-bush', size: 12.5, ps: 12, sp: 12.5 },
    tomatoes:     { soil: '#8a5a35', bed: '#a4714a', plant: 'mp-tomato', size: 10, ps: 8, sp: 9.5 },
    sunflowers:   { soil: '#8a5a35', bed: '#a4714a', plant: 'mp-sunf', size: 12, ps: 9, sp: 10 },
    flowers:      { soil: '#8a5a35', bed: '#a4714a', plant: 'mp-bloom', size: 9.5, ps: 7.5, sp: 8.5, colors: ['#e5649a', '#ff8fb1', '#8a52c9', '#fff', '#ffa94d', '#5ec7ff'] },
    strawberries: { soil: '#8a5a35', bed: '#a4714a', plant: 'mp-berry', size: 9, ps: 8, sp: 9 }
  };

  function cropField(it, cfg, idx, rnd) {
    const pts = it.pts, c = centroid(pts), ang = mainAxis(pts), ca = Math.cos(ang), sa = Math.sin(ang);
    const to = (p) => [(p[0] - c[0]) * ca + (p[1] - c[1]) * sa, -(p[0] - c[0]) * sa + (p[1] - c[1]) * ca];
    const from = (u, v) => [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca];
    const q = pts.map(to), b = bbox(q);
    const nrows = Math.max(1, Math.round(b.h / cfg.sp)), sp = b.h / nrows;
    let beds = '', plants = [];
    for (let k = 0; k < nrows; k++) {
      const v = b.y0 + sp * (k + 0.5), a = from(b.x0 - 2, v), z = from(b.x1 + 2, v);
      beds += `M${f1(a[0])} ${f1(a[1])}L${f1(z[0])} ${f1(z[1])}`;
      for (let u = b.x0 + cfg.ps * 0.5; u < b.x1; u += cfg.ps) {
        const p = from(u + (rnd() - 0.5) * 1.6, v + (rnd() - 0.5) * 1.2);
        if (pip(p, pts) && dedge(p, pts) > cfg.size * 0.28) plants.push(p);
      }
    }
    plants.sort((m, n) => m[1] - n[1]);
    const col = (i) => (cfg.colors ? cfg.colors[Math.floor(rnd() * cfg.colors.length)] : '');
    const sz = cfg.size;
    const uses = plants.map((p, i) => `<use href="#${cfg.plant}" x="${f1(p[0] - sz / 2)}" y="${f1(p[1] - sz * 0.88)}" width="${sz}" height="${sz}"${cfg.colors ? ` color="${col(i)}"` : ''}/>`).join('');
    return `<clipPath id="mpc${idx}"><path d="${pathD(pts, true)}"/></clipPath>` +
      `<path class="shape" d="${pathD(pts, true)}" fill="${cfg.soil}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<g clip-path="url(#mpc${idx})"><path d="${beds}" fill="none" stroke="${cfg.bed}" stroke-width="${f1(sp * 0.62)}" stroke-linecap="butt"/>` +
      `<path d="${beds}" fill="none" stroke="rgba(58,36,22,.35)" stroke-width=".7" stroke-dasharray="3 3"/></g>` + uses;
  }

  /* ------------------------------------------------------------------ *
   * Parking lot with painted stalls and cars
   * ------------------------------------------------------------------ */
  function parkingLot(it, idx, rnd) {
    const pts = it.pts, c = centroid(pts);
    let ang = mainAxis(pts); const ca = Math.cos(ang), sa = Math.sin(ang);
    const to = (p) => [(p[0] - c[0]) * ca + (p[1] - c[1]) * sa, -(p[0] - c[0]) * sa + (p[1] - c[1]) * ca];
    const from = (u, v) => [c[0] + u * ca - v * sa, c[1] + u * sa + v * ca];
    const q = pts.map(to), b = bbox(q), pitch = 8.4, depth = 15;
    const cols = b.h >= 52 ? 2 : 1, colors = ['#d72a43', '#2b6fd8', '#f4f4f4', '#2b2b33', '#ffc928', '#43a047', '#8a8f9a', '#f58a1f', '#7a4b2a'];
    const sx = [], lines = []; let cars = '';
    const vs = cols === 2 ? [b.y0 + b.h * 0.27, b.y0 + b.h * 0.73] : [b.y0 + b.h * 0.5];
    vs.forEach((v, ci) => {
      for (let u = b.x0 + pitch * 0.6; u < b.x1 - pitch * 0.2; u += pitch) {
        const p = from(u, v);
        if (!pip(p, pts) || dedge(p, pts) < 5) continue;
        const a = from(u - pitch / 2, v - depth / 2), z = from(u - pitch / 2, v + depth / 2);
        lines.push(`M${f1(a[0])} ${f1(a[1])}L${f1(z[0])} ${f1(z[1])}`);
        if (rnd() < 0.72) {
          const deg = ang * 180 / Math.PI + 90 + (rnd() - 0.5) * 6;
          cars += `<use href="#mp-car" x="${f1(p[0] - 3.1)}" y="${f1(p[1] - 5.5)}" width="6.2" height="11" color="${colors[Math.floor(rnd() * colors.length)]}" transform="rotate(${f1(deg)} ${f1(p[0])} ${f1(p[1])})"/>`;
        }
      }
    });
    const ctr = from(b.x0, (b.y0 + b.y1) / 2), ctr2 = from(b.x1, (b.y0 + b.y1) / 2);
    return `<clipPath id="mpc${idx}"><path d="${pathD(pts, true)}"/></clipPath>` +
      `<path class="shape" d="${pathD(pts, true)}" fill="#cdd0d8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<g clip-path="url(#mpc${idx})"><rect x="${f1(c[0] - 200)}" y="${f1(c[1] - 300)}" width="400" height="600" fill="url(#mp-gravel)"/>` +
      `<path d="M${f1(ctr[0])} ${f1(ctr[1])}L${f1(ctr2[0])} ${f1(ctr2[1])}" stroke="#f5f0d0" stroke-width=".8" stroke-dasharray="4 4" fill="none" opacity=".8"/>` +
      `<path d="${lines.join('')}" stroke="#fff" stroke-width=".9" fill="none" opacity=".9"/></g>` + cars;
  }

  /* ------------------------------------------------------------------ *
   * Corn maze (a seeded perfect maze, so it is the same every time)
   * ------------------------------------------------------------------ */
  function cornMaze(it, idx, rnd) {
    const pts = it.pts, b = bbox(pts), cell = 8.5;
    const cols = Math.max(3, Math.floor(b.w / cell)), rows = Math.max(3, Math.floor(b.h / cell)), cw = b.w / cols, ch = b.h / rows;
    const vw = Array.from({ length: rows }, () => Array(cols + 1).fill(true)), hw = Array.from({ length: rows + 1 }, () => Array(cols).fill(true));
    const seen = Array.from({ length: rows }, () => Array(cols).fill(false)), stack = [[Math.floor(rows / 2), Math.floor(cols / 2)]];
    seen[stack[0][0]][stack[0][1]] = true;
    while (stack.length) {
      const [r, c] = stack[stack.length - 1], opts = [];
      if (r > 0 && !seen[r - 1][c]) opts.push([r - 1, c, 'u']);
      if (r < rows - 1 && !seen[r + 1][c]) opts.push([r + 1, c, 'd']);
      if (c > 0 && !seen[r][c - 1]) opts.push([r, c - 1, 'l']);
      if (c < cols - 1 && !seen[r][c + 1]) opts.push([r, c + 1, 'r']);
      if (!opts.length) { stack.pop(); continue; }
      const [nr, nc, d] = opts[Math.floor(rnd() * opts.length)];
      if (d === 'u') hw[r][c] = false; else if (d === 'd') hw[r + 1][c] = false; else if (d === 'l') vw[r][c] = false; else vw[r][c + 1] = false;
      seen[nr][nc] = true; stack.push([nr, nc]);
    }
    hw[rows][Math.floor(cols / 2)] = false; hw[0][Math.floor(cols / 2)] = false;   // the way in and the way out
    let walls = '', tassels = '';
    for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) if (hw[r][c]) walls += `M${f1(b.x0 + c * cw)} ${f1(b.y0 + r * ch)}h${f1(cw)}`;
    for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) if (vw[r][c]) walls += `M${f1(b.x0 + c * cw)} ${f1(b.y0 + r * ch)}v${f1(ch)}`;
    for (let r = 0; r <= rows; r += 1) for (let c = 0; c <= cols; c += 1) if ((r + c) % 2 === 0) tassels += `<circle cx="${f1(b.x0 + c * cw)}" cy="${f1(b.y0 + r * ch)}" r="1.1"/>`;
    return `<clipPath id="mpc${idx}"><path d="${pathD(pts, true)}"/></clipPath>` +
      `<path class="shape" d="${pathD(pts, true)}" fill="#ead9a4" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>` +
      `<g clip-path="url(#mpc${idx})"><path d="${walls}" fill="none" stroke="#4d7a22" stroke-width="5" stroke-linecap="round"/><path d="${walls}" fill="none" stroke="#86b43a" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="${walls}" fill="none" stroke="#b9d86a" stroke-width=".9" stroke-dasharray="1 2.6" stroke-linecap="round"/><g fill="#e3c24a" stroke="none">${tassels}</g></g>`;
  }

  const AREA_FILL = { staff: '#d3d3d3', picnic: '#bfe08a', accessible: '#cdeed5' };
  function plainArea(it, kind) {
    return `<path class="shape" d="${pathD(it.pts, true)}" fill="${AREA_FILL[kind] || '#e4e9c8'}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="${kind === 'staff' ? '4 3' : ''}"/>`;
  }

  function area(it, idx) {
    const rnd = mulberry(1000 + idx * 97 + Math.round(it.pts[0][0] * 3 + it.pts[0][1]));
    if (CROP[it.kind]) return cropField(it, CROP[it.kind], idx, rnd);
    if (it.kind === 'parking') return parkingLot(it, idx, rnd);
    if (it.kind === 'maze') return cornMaze(it, idx, rnd);
    return plainArea(it, it.kind);
  }

  /* ------------------------------------------------------------------ *
   * Paths
   * ------------------------------------------------------------------ */
  function pathArt(it) {
    const d = pathD(it.pts), pts = it.pts, round = 'stroke-linecap="round" stroke-linejoin="round" fill="none"';
    let out = '';
    if (it.kind === 'road') {
      out = `<path d="${d}" stroke="${INK}" stroke-width="11" ${round}/><path d="${d}" stroke="#d9b980" stroke-width="8.4" ${round} class="shape"/><path d="${d}" stroke="#efd9a6" stroke-width="2.2" stroke-dasharray="6 5" ${round}/>`;
    } else if (it.kind === 'wagonroute') {
      out = `<path d="${d}" stroke="#5a3d20" stroke-width="10.4" ${round}/><path d="${d}" stroke="#c99d63" stroke-width="7.6" ${round} class="shape"/><path d="${d}" stroke="#a7783e" stroke-width="1" stroke-dasharray="4 3" ${round} transform="translate(0 -1.8)"/><path d="${d}" stroke="#a7783e" stroke-width="1" stroke-dasharray="4 3" ${round} transform="translate(0 1.8)"/>`;
      const P = along(pts, 0.34), flip = P.dx < 0 ? -1 : 1;
      out += `<g transform="translate(${f1(P.x)} ${f1(P.y)}) scale(${flip} 1)"><ellipse cx="0" cy="1" rx="22" ry="2.4" fill="rgba(40,30,10,.3)"/><use href="#wagon" x="-24" y="-12" width="30" height="9.3"/><use href="#tractor" x="2" y="-17" width="22" height="14.7"/></g>`;
    } else if (it.kind === 'barrel') {
      out = `<path d="${d}" stroke="#cfe3f6" stroke-width="6.4" ${round} opacity=".9"/><path d="${d}" stroke="#2f7fd0" stroke-width="3" stroke-dasharray="1 4.2" ${round} class="shape"/>`;
      const P = along(pts, 0.5), flip = P.dx < 0 ? -1 : 1;
      out += `<g transform="translate(${f1(P.x)} ${f1(P.y)}) scale(${flip} 1)"><ellipse cx="0" cy="1" rx="20" ry="2.2" fill="rgba(20,40,70,.3)"/><use href="#barrel-train" x="-21" y="-17" width="42" height="14.8"/></g>`;
    } else if (it.kind === 'haunted') {
      out = `<path d="${d}" stroke="#2a1b3d" stroke-width="7.6" ${round}/><path d="${d}" stroke="#6b4a9a" stroke-width="5" ${round} class="shape"/><path d="${d}" stroke="#b79ae0" stroke-width="1.2" stroke-dasharray="5 4" ${round}/>`;
      const L = pathLen(pts), n = Math.max(2, Math.round(L / 46));
      for (let i = 0; i < n; i++) {
        const P = along(pts, (i + 0.5) / n), nx = -P.dy, ny = P.dx, nl = Math.hypot(nx, ny) || 1, side = i % 2 ? 1 : -1, ox = nx / nl * 9 * side, oy = ny / nl * 9 * side;
        if (i % 3 === 1) out += `<use href="#mp-deadtree" x="${f1(P.x + ox - 7)}" y="${f1(P.y + oy - 18)}" width="14" height="18"/>`;
        else out += `<use href="#mp-ghost" x="${f1(P.x + ox - 5)}" y="${f1(P.y + oy - 14)}" width="10" height="13" class="mp-ghost"/>`;
      }
      const e = along(pts, 0.08);
      out += `<use href="#mp-bat" x="${f1(e.x - 8)}" y="${f1(e.y - 26)}" width="16" height="9.6" class="mp-bat"/>`;
    } else if (it.kind === 'accessible') {
      out = `<path d="${d}" stroke="${INK}" stroke-width="7" ${round}/><path d="${d}" stroke="#6fc08a" stroke-width="4.6" ${round} class="shape"/><path d="${d}" stroke="#fff" stroke-width="1.2" stroke-dasharray="4 4" ${round}/>`;
    } else {
      out = `<path d="${d}" stroke="${INK}" stroke-width="6" ${round}/><path d="${d}" stroke="#d6d6d6" stroke-width="3.6" stroke-dasharray="5 4" ${round} class="shape"/>`;
    }
    if (it.arrow && pts.length > 1) {
      const a = pts[pts.length - 2], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), L = 9;
      out += `<path d="M${f1(b[0])} ${f1(b[1])}L${f1(b[0] - L * Math.cos(ang - 0.5))} ${f1(b[1] - L * Math.sin(ang - 0.5))}L${f1(b[0] - L * Math.cos(ang + 0.5))} ${f1(b[1] - L * Math.sin(ang + 0.5))}Z" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Background: forest, clearing, the neighbourhood, trees and grass
   * ------------------------------------------------------------------ */
  function viewBox(data, items) {
    const Wd = data.size.width, Ht = data.size.height;
    let x0 = 0, y0 = 0, x1 = Wd, y1 = Ht;
    items.forEach((it) => it.pts.forEach((p) => { x0 = Math.min(x0, p[0] - 12); y0 = Math.min(y0, p[1] - (it.type === 'pin' ? 44 : 12)); x1 = Math.max(x1, p[0] + 12); y1 = Math.max(y1, p[1] + 12); }));
    return { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1 - x0), h: Math.ceil(y1 - y0) };
  }

  function defs() {
    return SYMS +
      `<pattern id="mp-gravel" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#cdd0d8"/><circle cx="2" cy="2" r=".8" fill="#a9adb8"/><circle cx="6.4" cy="4.6" r=".7" fill="#e6e8ee"/><circle cx="3.4" cy="7.4" r=".7" fill="#a9adb8"/><circle cx="7.6" cy="1" r=".6" fill="#e6e8ee"/></pattern>` +
      `<pattern id="mp-forest" width="26" height="26" patternUnits="userSpaceOnUse"><rect width="26" height="26" fill="#2b6a33"/><circle cx="6" cy="7" r="5" fill="#2f7237"/><circle cx="19" cy="17" r="6" fill="#286230"/><circle cx="20" cy="5" r="3" fill="#33793a"/><circle cx="5" cy="21" r="3.4" fill="#33793a"/></pattern>` +
      `<filter id="mp-wob" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G"/></filter>` +
      `<filter id="mp-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter>`;
  }

  function background(data, items, vb) {
    const sc = sceneryFor(data), rnd = mulberry(77);
    const R = { area: 17, path: 14, pin: 22 };
    const geo = items.map((it) => ({ it, r: R[it.type] || 14 }));
    // distance from p to the nearest marked thing, minus how far that thing clears the woods around itself
    const slack = (p) => {
      let m = 1e9;
      for (const g of geo) {
        const d = g.it.type === 'area' ? dedge2(p, g.it.pts) : g.it.type === 'path' ? dpath(p, g.it.pts) : Math.hypot(p[0] - g.it.pts[0][0], p[1] - g.it.pts[0][1]);
        m = Math.min(m, d - g.r);
      }
      if (sc) {
        (sc.lawns || []).forEach((poly) => { m = Math.min(m, dedge2(p, poly) - 6); });
        (sc.plowed || []).forEach((poly) => { m = Math.min(m, dedge2(p, poly) - 6); });
        (sc.dirt || []).forEach((l) => { m = Math.min(m, dpath(p, l) - 9); });
        (sc.roads || []).forEach((rd) => { m = Math.min(m, dpath(p, rd.pts) - rd.w / 2 - 8); });
        (sc.houses || []).forEach((h) => { m = Math.min(m, Math.hypot(p[0] - h[0], p[1] - h[1]) - 18); });
      }
      return m;
    };
    function dedge2(p, poly) { return pip(p, poly) ? 0 : dedge(p, poly); }
    const clearing = (extra, fill) => {
      let s = '';
      geo.forEach((g) => {
        const r = g.r + extra;
        if (g.it.type === 'area') s += `<path d="${pathD(g.it.pts, true)}" fill="${fill}" stroke="${fill}" stroke-width="${r * 2}" stroke-linejoin="round"/>`;
        else if (g.it.type === 'path') s += `<path d="${pathD(g.it.pts)}" fill="none" stroke="${fill}" stroke-width="${r * 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
        else s += `<circle cx="${g.it.pts[0][0]}" cy="${g.it.pts[0][1]}" r="${r}" fill="${fill}"/>`;
      });
      if (sc) {
        (sc.lawns || []).concat(sc.plowed || []).forEach((poly) => { s += `<path d="${pathD(poly, true)}" fill="${fill}" stroke="${fill}" stroke-width="${(6 + extra) * 2}" stroke-linejoin="round"/>`; });
        (sc.dirt || []).forEach((l) => { s += `<path d="${pathD(l)}" fill="none" stroke="${fill}" stroke-width="${(9 + extra) * 2}" stroke-linecap="round" stroke-linejoin="round"/>`; });
      }
      return s;
    };
    let out = `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="url(#mp-forest)"/>`;
    // grass clearing: a darker rim, then the light grass, both wobbled the same way so they follow each other
    out += `<g filter="url(#mp-wob)">${clearing(9, '#4a8f45')}${clearing(2, '#b4da7e')}</g>`;
    if (sc) {
      (sc.plowed || []).forEach((poly) => { out += `<path d="${pathD(poly, true)}" fill="#c8a272" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="${pathD(poly, true)}" fill="none" stroke="#a9825a" stroke-width="1" stroke-dasharray="1 5"/>`; });
      (sc.lawns || []).forEach((poly) => { out += `<path d="${pathD(poly, true)}" fill="#a9de6b" stroke="#6aa84a" stroke-width="1.6" stroke-linejoin="round"/>`; });
      (sc.dirt || []).forEach((l) => { out += `<path d="${pathD(l)}" fill="none" stroke="#9a6b3c" stroke-width="7.4" stroke-linecap="round" stroke-linejoin="round"/><path d="${pathD(l)}" fill="none" stroke="#d9b480" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/>`; });
      (sc.roads || []).forEach((rd) => { const d = pathD(rd.pts); out += `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${rd.w + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#7d828c" stroke-width="${rd.w}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#f1d36b" stroke-width="1.3" stroke-dasharray="7 6" stroke-linecap="round" stroke-linejoin="round"/>`; });
    }
    // grass tufts and wildflowers on open ground
    let decor = '';
    for (let y = vb.y + 6; y < vb.y + vb.h; y += 9) for (let x = vb.x + 6; x < vb.x + vb.w; x += 9) {
      const p = [x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8];
      if (rnd() > 0.34 || slack(p) > -3) continue;
      if (items.some((it) => (it.type === 'area' && pip(p, it.pts)) || (it.type === 'path' && dpath(p, it.pts) < 7))) continue;
      if (sc && ((sc.dirt || []).some((l) => dpath(p, l) < 8) || (sc.roads || []).some((rd) => dpath(p, rd.pts) < rd.w / 2 + 3) || (sc.lawns || []).concat(sc.plowed || []).some((poly) => pip(p, poly)))) continue;
      if (rnd() < 0.18) decor += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="1.1" fill="${['#fff', '#ffd54f', '#ff8fb1', '#b79ae0'][Math.floor(rnd() * 4)]}"/>`;
      else decor += `<use href="#mp-tuft" x="${f1(p[0] - 4)}" y="${f1(p[1] - 5)}" width="8" height="6"/>`;
    }
    out += decor;
    // neighbours
    if (sc) (sc.houses || []).forEach(([x, y, c]) => { out += `<ellipse cx="${x}" cy="${y + 1}" rx="14" ry="3" fill="rgba(40,60,20,.28)"/><use href="#mp-house" x="${x - 14}" y="${y - 23}" width="28" height="24" color="${c}"/>`; });
    // the woods: bigger, lighter trees at the edge of the clearing, small dark ones deeper in
    const trees = [];
    for (let y = vb.y - 4; y < vb.y + vb.h + 10; y += 13) for (let x = vb.x - 4; x < vb.x + vb.w + 10; x += 13) {
      const p = [x + (rnd() - 0.5) * 11, y + (rnd() - 0.5) * 11], s = slack(p);
      if (s < 3) continue;
      trees.push({ p, s, k: rnd() });
    }
    trees.sort((a, b) => a.p[1] - b.p[1]);
    out += trees.map(({ p, s, k }) => {
      const edge = s < 14, size = edge ? 21 + k * 6 : 17 + k * 5, id = edge ? (k < 0.55 ? 'mp-t1l' : 'mp-t3') : (k < 0.5 ? 'mp-t1' : k < 0.8 ? 'mp-t2' : 'mp-t3');
      return `<use href="#${id}" x="${f1(p[0] - size / 2)}" y="${f1(p[1] - size * 1.12)}" width="${f1(size)}" height="${f1(size * 1.17)}"/>`;
    }).join('');
    return out;
  }

  function backgroundImage(data, items, vb) {
    const src = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}"><defs>${defs()}</defs>${background(data, items, vb)}</svg>`;
    return `<image href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}" x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" preserveAspectRatio="none"/>`;
  }

  /* ------------------------------------------------------------------ *
   * Name ribbons
   * ------------------------------------------------------------------ */
  const charW = (ch) => (ch.charCodeAt(0) > 0x2e7f ? 1.02 : /[A-Z0-9]/.test(ch) ? 0.64 : /[ilIj.,'’ ]/.test(ch) ? 0.3 : 0.52);
  const clip = (s) => { const a = Array.from(String(s)); return a.length > 30 ? a.slice(0, 29).join('').trimEnd() + '…' : a.join(''); };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function ribbonSize(text, fs) { let w = 0; for (const ch of clip(text)) w += charW(ch) * fs; return { w: Math.max(26, w + 12), h: fs + 7 }; }
  function ribbon(text, fs, color) {
    const { w, h } = ribbonSize(text, fs), x = -w / 2, y = -h / 2;
    return `<g class="mp-rib"><path d="M${f1(x - 4)} ${f1(y + 2)}l4 -.4v${h}l-4 -.4l2.4 -${h / 2 - 1}z" fill="${color}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" opacity=".92"/>` +
      `<path d="M${f1(-x + 4)} ${f1(y + 2)}l-4 -.4v${h}l4 -.4l-2.4 -${h / 2 - 1}z" fill="${color}" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" opacity=".92"/>` +
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${h}" rx="2.4" fill="#fffaf0" stroke="${INK}" stroke-width="1.3"/>` +
      `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="2.6" rx="1.2" fill="${color}"/>` +
      `<text x="0" y="${f1(fs * 0.36 + 1.2)}" text-anchor="middle" font-size="${fs}" font-weight="700" font-family="Fredoka, Nunito, sans-serif" fill="${INK}">${esc(clip(text))}</text></g>`;
  }
  // a note the owner wrote on the photo ("Hay bales here"): a small paper tag, readable on the woods too
  function noteTag(text, fs) {
    const { w, h } = ribbonSize(text, fs);
    return `<rect x="${f1(-w / 2)}" y="${f1(-h / 2)}" width="${f1(w)}" height="${h}" rx="2" fill="#fff3b0" stroke="${INK}" stroke-width="1.1"/>` +
      `<text x="0" y="${f1(fs * 0.36)}" text-anchor="middle" font-size="${fs}" font-weight="700" font-family="Nunito, sans-serif" fill="${INK}">${esc(clip(text))}</text>`;
  }

  // Greedy label placement: try the spot nearest each anchor that does not overlap an icon or an earlier label.
  function layoutLabels(list, avoid, bounds) {
    const placed = avoid.slice();
    const hit = (r) => placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    const inside = (r) => r.x >= bounds.x + 2 && r.y >= bounds.y + 2 && r.x + r.w <= bounds.x + bounds.w - 2 && r.y + r.h <= bounds.y + bounds.h - 2;
    return list.map((l) => {
      const { w, h } = ribbonSize(l.text, l.fs), cands = [];
      for (let ring = 0; ring <= (l.rings == null ? 6 : l.rings); ring++) {
        const dx = l.dx || 0, dy = l.dy || 0, off = ring * (h + 1.5);
        cands.push([0, -off + dy], [0, off + dy]);
        if (ring) cands.push([-(w / 2 + 4 + off * 0.4), dy], [w / 2 + 4 + off * 0.4, dy], [-(w / 3 + off * 0.4), off + dy], [w / 3 + off * 0.4, -off + dy]);
        if (!ring) cands.unshift([dx, dy]);
      }
      for (const [ox, oy] of cands) {
        const cx = l.x + ox, cy = l.y + oy, r = { x: cx - w / 2 - 4, y: cy - h / 2 - 1, w: w + 8, h: h + 3 };   // the ribbon's tails hang below it
        if (inside(r) && !hit(r)) { placed.push(r); return { key: l.key, x: cx, y: cy, shown: true }; }
      }
      return { key: l.key, x: l.x, y: l.y + (l.dy || 0), shown: false };
    });
  }

  // a small picture for the list next to the map
  function legendIcon(kind, type) {
    if (type === 'pin') return `<svg viewBox="-24 -42 48 46" aria-hidden="true" focusable="false">${pinIcon(kind)}</svg>`;
    const cfg = CROP[kind];
    if (cfg) return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#${cfg.plant}" x="2" y="2" width="20" height="20"${cfg.colors ? ' color="#e5649a"' : ''}/></svg>`;
    if (kind === 'parking') return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="1" y="3" width="22" height="18" rx="3" fill="#cdd0d8" stroke="${INK}" stroke-width="1.6"/><use href="#mp-car" x="8" y="5" width="8" height="14" color="#d72a43"/></svg>`;
    if (kind === 'maze') return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="2" y="2" width="20" height="20" rx="3" fill="#ead9a4" stroke="${INK}" stroke-width="1.6"/><path d="M7 20V7h10v10h-5V11" fill="none" stroke="#6fa02e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (type === 'area') return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 7l9-4 9 3-1.6 13.6L4.4 21z" fill="${AREA_FILL[kind] || '#e4e9c8'}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"${kind === 'staff' ? ' stroke-dasharray="3 2"' : ''}/></svg>`;
    const line = { road: ['#d9b980', ''], wagonroute: ['#c99d63', ''], barrel: ['#2f7fd0', '1 4'], haunted: ['#6b4a9a', ''], accessible: ['#6fc08a', ''] }[kind] || ['#bbb', '4 3'];
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 18Q9 4 14 12T21 6" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M3 18Q9 4 14 12T21 6" fill="none" stroke="${line[0]}" stroke-width="4.2" stroke-linecap="round"${line[1] ? ` stroke-dasharray="${line[1]}"` : ''}/></svg>`;
  }

  W.mapArt = { normalize, labelFont, noteTag, backgroundImage, defs, viewBox, background, area, pathArt, pinIcon, iconR, legendIcon, layoutLabels, ribbon, ribbonSize, sceneryFor, centroid, polyArea, along, dpath, pip, bbox };
})();
