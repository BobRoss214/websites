#!/usr/bin/env python3
"""Translation helper for the Wise Acres site.

  python3 tools/i18n.py extract      tag every text block in the HTML pages with data-t="<id>"
                                     (and data-ta-<attr> for labels/alt text) and write lang/en.json
  python3 tools/i18n.py missing es   list English strings that have no translation in lang/src/es.json
  python3 tools/i18n.py build        turn lang/src/*.json into lang/*.js (what the pages load)
  python3 tools/i18n.py stats        strings and words per page

Needs:  pip install beautifulsoup4

How it works
  Every block of text (heading, paragraph, list item, button...) gets an id made from its English
  wording. When a visitor picks a language the page swaps each block by id. English stays in the HTML,
  so search engines and visitors without JavaScript still get a complete page. If you edit the
  English wording, its id changes and the block shows up under "missing" until it is translated again.

  Put data-no-i18n on an element to leave it alone (text that JavaScript fills in, names, etc.).
  Text that JavaScript writes goes through WISE_ACRES.t("English text") and lives under "js" in the
  language file.
"""
import hashlib, json, os, re, sys
from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANG_DIR = os.path.join(ROOT, 'lang')
SRC_DIR = os.path.join(LANG_DIR, 'src')
SKIP_TAGS = {'script', 'style', 'svg', 'template', 'noscript', 'head', 'symbol', 'defs', 'canvas', 'title'}
INLINE = {'a', 'strong', 'b', 'em', 'i', 'span', 'br', 'small', 'code', 'abbr', 'sup', 'sub', 'mark', 'u', 'svg', 'time', 'wbr', 'kbd', 'cite'}
ATTRS = ('aria-label', 'alt', 'title', 'placeholder')
WORD = re.compile(r'[A-Za-z]')
STRIP = re.compile(r'\sdata-(?:t|ta-[a-z-]+)="t[0-9a-f]{8}"')


def pages():
    return [p for p in sorted(os.listdir(ROOT)) if p.endswith('.html')]


def canon(el, counter=None):
    """Inner HTML as translators see it: svg icons collapsed to <svg/>, links to <a1>, <a2>..., whitespace tidied."""
    counter = counter if counter is not None else [0]
    parts = []
    for c in el.children:
        if isinstance(c, NavigableString):
            parts.append(str(c).replace('&', '&amp;').replace('<', '&lt;') if type(c).__name__ == 'NavigableString' else '')
        elif isinstance(c, Tag):
            parts.append('<svg/>' if c.name == 'svg' else tag_html(c, counter))
    return re.sub(r'\s+', ' ', ''.join(parts)).strip()


VOID = {'br', 'wbr', 'input', 'img', 'hr'}


def tag_html(t, counter):
    if t.name in VOID:
        return f'<{t.name}>'
    if t.name == 'a':
        counter[0] += 1
        return f'<a{counter[0]}>{canon(t, counter)}</a>'
    attrs = ''.join(f' {k}="{v if isinstance(v, str) else " ".join(v)}"' for k, v in t.attrs.items() if not (k == 'data-t' or k.startswith('data-ta-')))
    return f'<{t.name}{attrs}>{canon(t, counter)}</{t.name}>'


def block_ok(el):
    """A block has its own words (not just children that hold the words) and only inline children."""
    if el.name in SKIP_TAGS or el.has_attr('data-no-i18n'):
        return False
    own = False
    for c in el.children:
        if isinstance(c, Tag) and c.name not in INLINE:
            return False
        if type(c).__name__ == 'NavigableString' and WORD.search(str(c)):
            own = True
    return own


def make_id(text):
    return 't' + hashlib.sha1(text.encode('utf-8')).hexdigest()[:8]


def find_blocks(soup):
    out, stack = [], [soup]
    while stack:
        el = stack.pop(0)
        if isinstance(el, NavigableString) or not isinstance(el, Tag):
            continue
        if el.name in SKIP_TAGS or el.has_attr('data-no-i18n') or el.get('id') == 'sprite':
            continue
        if el.name not in ('[document]', 'html', 'body') and block_ok(el):
            out.append(el)
            continue
        stack = list(el.children) + stack
    return out


def analyse(src):
    """Return ({id: english}, {(line, col, tagname): {attr: id}})."""
    soup = BeautifulSoup(src, 'html.parser')
    strings, marks = {}, {}
    for el in find_blocks(soup):
        c = canon(el)
        i = make_id(c)
        strings[i] = c
        marks.setdefault((el.sourceline, el.sourcepos, el.name), {})['data-t'] = i
    for el in soup.find_all(True):
        if el.name in ('svg', 'script', 'style') or el.find_parent(['svg', 'script', 'style', 'head']) or el.has_attr('data-no-i18n'):
            continue
        for a in ATTRS:
            v = el.get(a)
            if isinstance(v, str) and WORD.search(v) and not v.startswith('#'):
                i = make_id('@' + v)
                strings[i] = v
                marks.setdefault((el.sourceline, el.sourcepos, el.name), {})['data-ta-' + a] = i
    return strings, marks


def inject(src, marks):
    lines = src.splitlines(keepends=True)
    for (line, col, name), attrs in sorted(marks.items(), reverse=True):
        s = lines[line - 1]
        at = col + 1 + len(name)
        lines[line - 1] = s[:at] + ''.join(f' {k}="{v}"' for k, v in sorted(attrs.items())) + s[at:]
    return ''.join(lines)


def cmd_orphans():
    """Text that would never be translated because it sits loose next to block-level tags."""
    for p in pages():
        src = STRIP.sub('', open(os.path.join(ROOT, p), encoding='utf-8').read())
        soup = BeautifulSoup(src, 'html.parser')
        blocks = set(id(b) for b in find_blocks(soup))
        for t in soup.find_all(string=True):
            if type(t).__name__ != 'NavigableString' or not WORD.search(str(t)):
                continue
            par = t.parent
            if par.name in SKIP_TAGS or par.find_parent(list(SKIP_TAGS)) or par.find_parent(attrs={'data-no-i18n': True}) or par.has_attr('data-no-i18n'):
                continue
            a = par
            ok = False
            while a is not None and a.name not in ('[document]',):
                if id(a) in blocks:
                    ok = True
                    break
                a = a.parent
            if not ok:
                print(f'{p}:{par.sourceline}: <{par.name}> {str(t).strip()[:80]!r}')


def words(v):
    return len(re.sub(r'<[^>]+>', ' ', v).split())


def cmd_extract():
    os.makedirs(SRC_DIR, exist_ok=True)
    allstr = {}
    for p in pages():
        path = os.path.join(ROOT, p)
        src = STRIP.sub('', open(path, encoding='utf-8').read())
        strings, marks = analyse(src)
        open(path, 'w', encoding='utf-8').write(inject(src, marks))
        allstr.update(strings)
        print(f'{p}: {len(strings)} strings tagged')
    json.dump(allstr, open(os.path.join(LANG_DIR, 'en.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print('unique strings:', len(allstr), ' words:', sum(words(v) for v in allstr.values()))


def load(code):
    path = os.path.join(SRC_DIR, code + '.json')
    return json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {'ui': {}, 'js': {}}


def cmd_dump(code, start, count):
    en = json.load(open(os.path.join(LANG_DIR, 'en.json'), encoding='utf-8'))
    have = load(code)['ui']
    miss = [(k, v) for k, v in sorted(en.items()) if k not in have]
    for k, v in miss[start:start + count]:
        print(f'{k}\t{v}')
    print(f'# {len(miss)} missing in total', file=sys.stderr)


def cmd_merge(code):
    """Fold lang/src/parts/<code>.*.json (each {id: translation}) into lang/src/<code>.json."""
    data = load(code)
    parts = os.path.join(SRC_DIR, 'parts')
    n = 0
    for f in sorted(os.listdir(parts)) if os.path.isdir(parts) else []:
        if f.startswith(code + '.') and f.endswith('.json'):
            d = json.load(open(os.path.join(parts, f), encoding='utf-8'))
            bucket = 'js' if '.js.' in f else 'ui'
            data.setdefault(bucket, {}).update(d)
            n += len(d)
    json.dump(data, open(os.path.join(SRC_DIR, code + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print(f'merged {n} strings into lang/src/{code}.json (ui={len(data.get("ui", {}))}, js={len(data.get("js", {}))})')


JS_PATTERNS = [
    r"\bt\(\s*'((?:[^'\\]|\\.)*)'",
    r'\bt\(\s*"((?:[^"\\]|\\.)*)"',
    r"(?:hint|btn):\s*'((?:[^'\\]|\\.)*)'",
    r"\[\d+,\s*'((?:[^'\\]|\\.)*)'\]",
    r"(?:label|crop|next|caption|alt):\s*['\"]((?:[^'\"\\]|\\.)*)['\"]",
    r"const TEN = '((?:[^'\\]|\\.)*)'",
]


def js_strings():
    found = {}
    jsdir = os.path.join(ROOT, 'js')
    for f in sorted(os.listdir(jsdir)):
        if not f.endswith('.js') or f in ('i18n.js',):
            continue
        src = open(os.path.join(jsdir, f), encoding='utf-8').read()
        for pat in JS_PATTERNS:
            for m in re.finditer(pat, src):
                txt = m.group(1).replace("\\'", "'").replace('\\u2014', '\u2014').replace('\\u201C', '\u201C').replace('\\u201D', '\u201D')
                if WORD.search(txt) and len(txt) > 1:
                    found[txt] = f
    # page titles and search/share descriptions (swapped by i18n.js)
    import html as _html
    for f in sorted(os.listdir(ROOT)):
        if not f.endswith('.html'):
            continue
        page = open(os.path.join(ROOT, f), encoding='utf-8').read()
        for pat in (r'<title>(.*?)</title>', r'<meta name="description" content="([^"]*)"', r'<meta property="og:(?:title|description)" content="([^"]*)"'):
            for m in re.finditer(pat, page, re.S):
                found[_html.unescape(m.group(1)).strip()] = f
    # lines of the goat and similar arrays live in quotes inside a list
    main = open(os.path.join(jsdir, 'main.js'), encoding='utf-8').read()
    m = re.search(r'const lines = \[(.*?)\];', main, re.S)
    if m:
        for x in re.findall(r"'((?:[^'\\]|\\.)*)'", m.group(1)):
            found[x.replace("\\'", "'")] = 'main.js'
    return found


def cmd_jsstrings():
    found = js_strings()
    json.dump(found, open(os.path.join(LANG_DIR, 'js-strings.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print(len(found), 'JavaScript strings -> lang/js-strings.json')


def cmd_missing(code):
    en = json.load(open(os.path.join(LANG_DIR, 'en.json'), encoding='utf-8'))
    have = load(code)['ui']
    miss = {k: v for k, v in en.items() if k not in have}
    print(f'{code}: {len(have)} translated, {len(miss)} missing, {sum(words(v) for v in miss.values())} words to go')
    if '--list' in sys.argv:
        for k, v in miss.items():
            print(k, '|', v)


def cmd_build():
    for f in sorted(os.listdir(SRC_DIR)):
        if not f.endswith('.json'):
            continue
        code = f[:-5]
        data = json.load(open(os.path.join(SRC_DIR, f), encoding='utf-8'))
        js = 'window.WISE_ACRES=window.WISE_ACRES||{};(WISE_ACRES.dict=WISE_ACRES.dict||{}).%s=%s;\n' % (code, json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        open(os.path.join(LANG_DIR, code + '.js'), 'w', encoding='utf-8').write(js)
        print(f'lang/{code}.js  ui={len(data.get("ui", {}))} js={len(data.get("js", {}))}')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'stats'
    if cmd == 'extract':
        cmd_extract()
    elif cmd == 'orphans':
        cmd_orphans()
    elif cmd == 'dump':
        cmd_dump(sys.argv[2], int(sys.argv[3]), int(sys.argv[4]))
    elif cmd == 'merge':
        cmd_merge(sys.argv[2])
    elif cmd == 'jsstrings':
        cmd_jsstrings()
    elif cmd == 'missing':
        cmd_missing(sys.argv[2])
    elif cmd == 'build':
        cmd_build()
    elif cmd == 'stats':
        for p in pages():
            st, _ = analyse(STRIP.sub('', open(os.path.join(ROOT, p), encoding='utf-8').read()))
            print(p, len(st), 'strings', sum(words(v) for v in st.values()), 'words')
    else:
        print(__doc__)
