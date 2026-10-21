#!/usr/bin/env python3
"""Merge the three artists' symbol files into one block and put it where the builder left <!--SHOP-ART-SYMBOLS-->.

usage: merge_art.py [--inject /path/to/index.html]
Later files override earlier ones by symbol id (A3 replaces three weak pictures from A).
"""
import re, sys, os

ART = os.path.dirname(os.path.abspath(__file__)) + '/art/'
FILES = ['shop-art-A.symbols.html', 'shop-art-B.symbols.html', 'shop-art-A3.symbols.html']
SYM = re.compile(r'<symbol\b[^>]*\bid="([^"]+)"[^>]*>.*?</symbol>', re.S)

order, syms = [], {}
for f in FILES:
    p = ART + f
    if not os.path.exists(p):
        print('skip (missing):', f)
        continue
    txt = open(p, encoding='utf-8').read()
    found = SYM.findall(txt)
    for m in SYM.finditer(txt):
        i = m.group(1)
        if i in syms:
            print('override', i, 'from', f)
        else:
            order.append(i)
        syms[i] = m.group(0).strip()
    print(f, len(found), 'symbols')

block = '\n'.join(syms[i] for i in order)
open(ART + 'shop-art-ALL.symbols.html', 'w', encoding='utf-8').write(block + '\n')
print('total', len(order), 'symbols,', len(block), 'bytes')

if '--inject' in sys.argv:
    target = sys.argv[sys.argv.index('--inject') + 1]
    html = open(target, encoding='utf-8').read()
    existing = set(re.findall(r'<symbol[^>]*\bid="([^"]+)"', html))
    clash = [i for i in order if i in existing]
    if clash:
        sys.exit('ids already in the page: ' + ', '.join(clash))
    mark = '<!--SHOP-ART-SYMBOLS-->'
    if html.count(mark) != 1:
        sys.exit('marker found %d times (need exactly 1)' % html.count(mark))
    open(target, 'w', encoding='utf-8').write(html.replace(mark, block))
    used = set(re.findall(r'href="#(p-[a-z0-9-]+)"', html))
    print('injected into', target, '| used but not drawn:', sorted(u for u in used if u not in syms) or 'none',
          '| drawn but not used:', sorted(i for i in order if ('#' + i) not in html.replace(block, '')) or 'none')
