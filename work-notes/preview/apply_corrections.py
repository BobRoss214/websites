#!/usr/bin/env python3
"""Apply the reviewers' translation corrections to lang/src/<code>.json (section "ui").
usage: apply_corrections.py <repo> <code> <corrections.json>
Only replaces a line when the current text equals the reviewer's "old" exactly; reports the rest.
Keeps the file's layout (it rewrites just the matching lines by text replacement, not by re-dumping the JSON).
"""
import json, sys, re

repo, code, cfile = sys.argv[1:4]
path = '%s/lang/src/%s.json' % (repo, code)
raw = open(path, encoding='utf-8').read()
data = json.loads(raw)
ui = data.get('ui', data)
rows = json.load(open(cfile, encoding='utf-8'))
done, skipped = 0, []
for r in rows:
    k, old, new = r['key'], r['old'], r['new']
    cur = ui.get(k)
    if cur is None:
        skipped.append((k, 'key missing'))
        continue
    if cur == new:
        continue
    if cur != old:
        skipped.append((k, 'current text differs from reviewer old'))
        continue
    old_line = json.dumps(old, ensure_ascii=False)
    new_line = json.dumps(new, ensure_ascii=False)
    pat = '"%s": %s' % (k, old_line)
    if raw.count(pat) != 1:
        skipped.append((k, 'line not found exactly once (%d)' % raw.count(pat)))
        continue
    raw = raw.replace(pat, '"%s": %s' % (k, new_line))
    done += 1
json.loads(raw)  # must still be valid JSON
open(path, 'w', encoding='utf-8').write(raw)
print(code, 'applied', done, 'of', len(rows), '| skipped', len(skipped))
for s in skipped:
    print('   skip', s)
