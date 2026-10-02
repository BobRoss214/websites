#!/usr/bin/env python3
"""Turns the map saved in the Farm Map Marker into js/farm-map-data.js (the "Farm map" section of the website).

  python3 tools/farm_map.py tools/saved-map.json

saved-map.json is the document the Farm Map Marker stores when you press "Save for Claude"
(Claude fetches it for you). The copy that is on the website now is tools/saved-map.json: replace it with
the new one, then run the line above. The website draws its own illustrated map from the points, so the
satellite photo itself is never published (it is Google's picture).

What it does
  - keeps pins, outlines, lines and text labels; drops freehand scribbles (those are notes for Claude)
  - rounds the points, keeps them inside the picture, trims very long text
  - writes js/farm-map-data.js (and refuses to overwrite it when the saved map has no usable points)
  - lists any names or notes that still need translating (Spanish, Hindi, Chinese, Vietnamese)
"""
import json, math, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'js', 'farm-map-data.js')

# kinds the website knows how to draw (keep in step with MK in js/features.js)
KNOWN = {'parking', 'entrance', 'road', 'dropoff', 'checkin', 'restrooms', 'accessible', 'strawberries', 'blueberries', 'pumpkins', 'tomatoes',
         'sunflowers', 'flowers', 'playground', 'animals', 'maze', 'mazesign', 'cornpit', 'wagon', 'wagonroute', 'barrel', 'haunted', 'photo',
         'picnic', 'firepit', 'concessions', 'barn', 'water', 'firstaid', 'staff', 'other'}
MIN_POINTS = {'pin': 1, 'text': 1, 'area': 3, 'path': 2}
LANGS = ('es', 'hi', 'zh', 'vi')


def fail(msg):
    sys.exit('Problem: ' + msg)


def number(v):
    """A finite number from 12, 12.6 or "12.6"; None for anything else (None, "abc", NaN, Infinity)."""
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    path = sys.argv[1]
    if not os.path.exists(path) and os.path.exists(os.path.join(ROOT, 'tools', path)):
        path = os.path.join(ROOT, 'tools', path)   # "saved-map.json" works from the main folder too
    try:
        with open(path, encoding='utf-8-sig') as f:   # utf-8-sig: Windows editors add an invisible marker at the start
            doc = json.load(f)
    except OSError:
        fail(f'I cannot open {sys.argv[1]}. The map that is on the website now is tools/saved-map.json:  python3 tools/farm_map.py tools/saved-map.json')
    except ValueError as e:
        fail(f'{sys.argv[1]} is not a saved map ({e}). Press "Save for Claude" in the Farm Map Marker again.')
    if not isinstance(doc, dict) or not isinstance(doc.get('items'), list):
        fail(f'{sys.argv[1]} has no list of "items", so it is not a map saved by the Farm Map Marker.')
    size = doc.get('imageSize') if isinstance(doc.get('imageSize'), dict) else {}
    w, h = number(size.get('width')), number(size.get('height'))
    if not w or not h or w <= 0 or h <= 0 or w > 20000 or h > 20000:
        fail('the saved map has no usable picture size. Open the Farm Map Marker, press Save for Claude, and try again.')
    w, h = int(w), int(h)
    items, skipped, seen, moved = [], [], set(), []
    for n, it in enumerate(doc['items'], 1):
        if not isinstance(it, dict):
            skipped.append(f'item {n} (not a map item)')
            continue
        t, rid = it.get('type'), it.get('id')
        if t == 'pen':
            skipped.append(f'scribble {rid}' + (f" named {it.get('label')!r} (freehand drawings are not copied; ask the owner to redraw it as a line or outline)" if it.get('label') else ''))
            continue
        if t not in MIN_POINTS:
            skipped.append(f'{t} {rid} (unknown shape)')
            continue
        pts, raw = [], []
        for p in it.get('pts') if isinstance(it.get('pts'), list) else []:
            if isinstance(p, (list, tuple)) and len(p) == 2 and number(p[0]) is not None and number(p[1]) is not None:
                x, y = int(round(number(p[0]))), int(round(number(p[1])))
                raw.append([x, y])
                pts.append([max(0, min(w, x)), max(0, min(h, y))])
        if pts != raw:
            moved.append(f"{it.get('label') or t}: {sum(a != b for a, b in zip(pts, raw))} point(s) were outside the picture and now sit on its edge")
        if t == 'area' and len(pts) > 3 and abs(pts[0][0] - pts[-1][0]) + abs(pts[0][1] - pts[-1][1]) <= 8:
            pts.pop()   # the owner clicked the first corner again to close the outline
        if len(pts) < MIN_POINTS[t]:
            skipped.append(f'{t} {rid} (too few points)')
            continue
        label_full = re.sub(r'\s+', ' ', str(it.get('label') or '')).strip()
        note_full = re.sub(r'\s+', ' ', str(it.get('note') or '')).strip()
        label, note = label_full[:80], note_full[:400]
        if label != label_full:
            print(f'note: the name was cut to 80 letters: {label}')
        if note != note_full:
            print(f'note: the note for "{label}" was cut to 400 letters')
        if not label and t != 'text':
            skipped.append(f'{t} {rid} (no name)')
            continue
        kind = it.get('kind') if it.get('kind') in KNOWN else 'other'
        if kind != it.get('kind'):
            print(f"note: kind {it.get('kind')!r} is not one the website draws; shown as 'Something else': {label}")
        rid = re.sub(r'[^A-Za-z0-9_-]', '', str(rid) if rid not in (None, '') else '')[:40] or f'item{n}'   # ids end up in page markup: letters, digits, - and _ only
        while rid in seen:   # two points must never share an id (the numbers on the map would mix up)
            rid += '-' + str(n)
        seen.add(rid)
        row = {'id': rid, 'type': t, 'kind': kind, 'label': label}
        if note:
            row['note'] = note
        if t == 'path' and it.get('arrow'):
            row['arrow'] = True
        row['pts'] = pts
        items.append(row)
    if not items:
        for s in skipped:
            print('skipped:', s)
        fail('there are no usable points in this map, so js/farm-map-data.js was NOT changed and the map on the website stays as it is.\n'
             '(To hide the map on purpose, put  window.WISE_ACRES_MAP = null;  in that file.)')
    north = doc.get('topFaces') if doc.get('topFaces') in ('up', 'down', 'left', 'right') else 'up'
    data = {'size': {'width': w, 'height': h}, 'north': north, 'items': items}
    # JSON inside a .js file: escape the two line separators older phones reject, and "</" in case it is ever inlined in a page
    body = json.dumps(data, ensure_ascii=False, indent=1).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029').replace('</', '<\\/')
    js = ('/* Farm map points for the "Farm map" section. Written by tools/farm_map.py from the map saved in the Farm Map Marker.\n'
          ' * Do not edit by hand: change the map in the Farm Map Marker and run the script again. */\n'
          'window.WISE_ACRES_MAP = ' + body + ';\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(js)
    kinds = {}
    for r in items:
        kinds[r['kind']] = kinds.get(r['kind'], 0) + 1
    print(f"wrote js/farm-map-data.js: {len(items)} points ({', '.join(f'{k} x{v}' for k, v in sorted(kinds.items()))})")
    for s in skipped:
        print('skipped:', s)
    for s in moved:
        print('moved:', s)
    # texts that need translating, in every language
    texts = sorted({s for r in items for s in (r['label'], r.get('note', '')) if s})
    for code in LANGS:
        try:
            with open(os.path.join(ROOT, 'lang', 'src', code + '.json'), encoding='utf-8') as f:
                have = json.load(f).get('js', {})
        except (OSError, ValueError):
            have = {}
        need = [s for s in texts if s not in have]
        if need:
            print(f'\n{code}: {len(need)} names/notes have no translation yet (add each under "js" in lang/src/{code}.json, then run python3 tools/i18n.py build):')
            for s in need:
                print('  -', s)


if __name__ == '__main__':
    main()
