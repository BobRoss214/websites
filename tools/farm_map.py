#!/usr/bin/env python3
"""Turns the map saved in the Farm Map Marker into js/farm-map-data.js (the "Farm map" section of the website).

  python3 tools/farm_map.py saved-map.json

saved-map.json is the document the Farm Map Marker stores when you press "Save for Claude"
(Claude fetches it for you). The website draws its own illustrated map from the points, so the
satellite photo itself is never published (it is Google's picture).

What it does
  - keeps pins, outlines, lines and notes; drops freehand scribbles (those are notes for Claude)
  - rounds the points, keeps them inside the picture, trims very long text
  - writes js/farm-map-data.js
  - lists any names or notes that still need translating (Spanish, Hindi, Chinese, Vietnamese)
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'farm-map-data.js')

# kinds the website knows how to draw (keep in step with MK in js/features.js)
KNOWN = {'parking', 'entrance', 'road', 'dropoff', 'checkin', 'restrooms', 'accessible', 'strawberries', 'blueberries', 'pumpkins', 'tomatoes',
         'sunflowers', 'flowers', 'playground', 'animals', 'maze', 'mazesign', 'cornpit', 'wagon', 'wagonroute', 'barrel', 'haunted', 'photo',
         'picnic', 'firepit', 'concessions', 'barn', 'water', 'firstaid', 'staff', 'other'}
MIN_POINTS = {'pin': 1, 'text': 1, 'area': 3, 'path': 2}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    doc = json.load(open(sys.argv[1], encoding='utf-8'))
    size = doc.get('imageSize') or {}
    w, h = int(size.get('width') or 0), int(size.get('height') or 0)
    if not w or not h:
        sys.exit('The saved map has no picture size. Open the Farm Map Marker, press Save for Claude, and try again.')
    items, skipped, notes_needed = [], [], []
    for it in doc.get('items', []):
        t = it.get('type')
        if t == 'pen':
            skipped.append(f"scribble {it.get('id')}")
            continue
        if t not in MIN_POINTS:
            skipped.append(f"{t} {it.get('id')} (unknown shape)")
            continue
        pts = [[max(0, min(w, int(round(p[0])))), max(0, min(h, int(round(p[1]))))] for p in it.get('pts', []) if len(p) == 2]
        if len(pts) < MIN_POINTS[t]:
            skipped.append(f"{t} {it.get('id')} (too few points)")
            continue
        label = re.sub(r'\s+', ' ', str(it.get('label') or '')).strip()[:80]
        note = re.sub(r'\s+', ' ', str(it.get('note') or '')).strip()[:400]
        if not label and t != 'text':
            skipped.append(f"{t} {it.get('id')} (no name)")
            continue
        kind = it.get('kind') if it.get('kind') in KNOWN else 'other'
        if kind != it.get('kind'):
            print(f"note: kind {it.get('kind')!r} is not one the website draws; shown as 'Something else': {label}")
        row = {'id': str(it['id']), 'type': t, 'kind': kind, 'label': label}
        if note:
            row['note'] = note
        if t == 'path' and it.get('arrow'):
            row['arrow'] = True
        row['pts'] = pts
        items.append(row)
    data = {'size': {'width': w, 'height': h}, 'north': doc.get('topFaces') or 'up', 'items': items}
    body = json.dumps(data, ensure_ascii=False, indent=1)
    js = ('/* Farm map points for the "Farm map" section. Written by tools/farm_map.py from the map saved in the Farm Map Marker.\n'
          ' * Do not edit by hand: change the map in the Farm Map Marker and run the script again. */\n'
          'window.WISE_ACRES_MAP = ' + body + ';\n')
    open(OUT, 'w', encoding='utf-8').write(js)
    kinds = {}
    for r in items:
        kinds[r['kind']] = kinds.get(r['kind'], 0) + 1
    print(f"wrote js/farm-map-data.js: {len(items)} points ({', '.join(f'{k} x{v}' for k, v in sorted(kinds.items()))})")
    for s in skipped:
        print('skipped:', s)
    # texts that need translating
    try:
        have = json.load(open(os.path.join(ROOT, 'lang', 'src', 'es.json'), encoding='utf-8')).get('js', {})
    except OSError:
        have = {}
    need = sorted({s for r in items for s in (r['label'], r.get('note', '')) if s and s not in have})
    if need:
        print(f'\n{len(need)} names/notes have no translation yet (labels of the standard kinds are already translated):')
        for s in need:
            print('  -', s)


if __name__ == '__main__':
    main()
