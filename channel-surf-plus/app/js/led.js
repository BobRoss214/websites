// Red 7-segment LED digits, like the clock on the front of a cable box.
const SEG = { a: '6,2 34,2 30,7 10,7', b: '35,4 35,33 31,30 31,8', c: '35,37 35,66 31,62 31,40', d: '6,68 34,68 30,63 10,63', e: '5,37 9,40 9,62 5,66', f: '5,4 9,8 9,30 5,33', g: '7,35 11,31 29,31 33,35 29,39 11,39' };
const DIGIT = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', '-': 'g', ' ': '' };
export function ledSVG(str, on = '#ff2b1c', off = 'rgba(255,40,20,.09)') {
  let x = 0, svg = '';
  for (const ch of String(str)) {
    if (ch === ':') { svg += `<circle cx="${x + 6}" cy="22" r="3" fill="${on}"/><circle cx="${x + 6}" cy="48" r="3" fill="${on}"/>`; x += 14; continue; }
    const lit = DIGIT[ch] ?? '';
    for (const s in SEG) svg += `<polygon transform="translate(${x} 0) skewX(-6)" points="${SEG[s]}" fill="${lit.includes(s) ? on : off}"/>`;
    x += 44;
  }
  return `<svg viewBox="-4 0 ${x + 4} 70" style="height:100%;filter:drop-shadow(0 0 4px ${on})" aria-hidden="true">${svg}</svg>`;
}
