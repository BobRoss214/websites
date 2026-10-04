#!/usr/bin/env python3
"""Translation helper for the Wise Acres site.

  python3 tools/i18n.py extract      tag every text block in the HTML pages with data-t="<id>"
                                     (and data-ta-<attr> for labels/alt text) and write lang/en.json. The date lines of the pizza
                                     schedule (Oct 9–11, and the "Open now" line under the table) are translated by the tool itself:
                                     see tools/date_phrases.py. It never replaces a line that is already in lang/src/<code>.json.
  python3 tools/i18n.py jsstrings    list the text that JavaScript writes (t('...'), titles, descriptions) in lang/js-strings.json
  python3 tools/i18n.py missing es   count the English strings and the JavaScript texts that have no translation in lang/src/es.json
  python3 tools/i18n.py missing es --list    the same, and list them (languages: es, hi, zh, vi)
  python3 tools/i18n.py dump es 0 50 print missing strings 0 to 49 with their ids, ready to translate
  python3 tools/i18n.py build        turn lang/src/*.json into lang/*.js (what the pages load)
  python3 tools/i18n.py orphans      list text that would never be translated (it sits loose next to block-level tags)
  python3 tools/i18n.py stats        strings and words per page
  python3 tools/i18n.py merge es     fold lang/src/parts/es.*.json into lang/src/es.json (left from the first translation round: that
                                     folder was removed, so today it only says there is nothing to merge and changes nothing)

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
try:
    from bs4 import BeautifulSoup, NavigableString, Tag
except ImportError:
    sys.exit('This needs the beautifulsoup4 package. Type this once, then run the command again:\n'
             '    python3 -m pip install beautifulsoup4\n'
             '(On Windows type python instead of python3. See "Commands: one-time setup" in README.md.)')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import date_phrases   # the pizza schedule's dates: translated by the tool, see that file

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANG_DIR = os.path.join(ROOT, 'lang')
SRC_DIR = os.path.join(LANG_DIR, 'src')
SKIP_TAGS = {'script', 'style', 'svg', 'template', 'noscript', 'head', 'symbol', 'defs', 'canvas', 'title'}
INLINE = {'a', 'strong', 'b', 'em', 'i', 'span', 'br', 'small', 'code', 'abbr', 'sup', 'sub', 'mark', 'u', 'svg', 'time', 'wbr', 'kbd', 'cite'}
ATTRS = ('aria-label', 'alt', 'title', 'placeholder')
WORD = re.compile(r'[A-Za-z]')
STRIP = re.compile(r'\sdata-(?:t|ta-[a-z-]+)="t[0-9a-f]{8}"')


def pages():
    return [p for p in sorted(os.listdir(ROOT)) if p.endswith('.html') and p != '404.html']   # 404.html is plain English, no scripts


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
        open(path, 'w', encoding='utf-8', newline='\n').write(inject(src, marks))
        allstr.update(strings)
        print(f'{p}: {len(strings)} strings tagged')
    json.dump(allstr, open(os.path.join(LANG_DIR, 'en.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1, sort_keys=True)
    print('unique strings:', len(allstr), ' words:', sum(words(v) for v in allstr.values()))
    autofill(allstr)


def autofill(strings):
    """Writes the translation of each date line that tools/date_phrases.py knows into lang/src/<code>.json, where the file has none yet.
    A line that is already there (written by a person) is never replaced."""
    for code in languages():
        if code not in date_phrases.LANGS:
            continue
        path = os.path.join(SRC_DIR, code + '.json')
        data = load(code)
        new = {}
        for i, text in strings.items():
            if i not in data['ui']:
                t = date_phrases.translate(code, text)
                if t is not None:
                    new[i] = t
        if not new:
            continue
        bad = unsafe({'ui': new, 'js': {}}, strings)
        if bad:
            sys.exit('tools/date_phrases.py made a translation that is not safe (nothing was written):\n  ' + '\n  '.join(bad))
        data['ui'].update(new)
        raw = json.dumps(data, ensure_ascii=False, indent=1) + '\n'
        open(path, 'w', encoding='utf-8', newline='\n').write(raw)
        shown = ', '.join(re.sub(r'<[^>]+>', '', strings[i]).replace('&amp;', '&')[:36] for i in list(new)[:3])
        print(f'lang/src/{code}.json: {len(new)} date line(s) translated by the tool ({shown}{", ..." if len(new) > 3 else ""})')


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
    found = [f for f in (sorted(os.listdir(parts)) if os.path.isdir(parts) else []) if f.startswith(code + '.') and f.endswith('.json')]
    if not found:   # without this, the file was rewritten (re-sorted) although nothing was added
        print(f'Nothing to merge: there is no lang/src/parts/{code}.*.json. lang/src/{code}.json was not changed.')
        return
    n = 0
    for f in found:
        if f.startswith(code + '.') and f.endswith('.json'):
            d = json.load(open(os.path.join(parts, f), encoding='utf-8'))
            bucket = 'js' if '.js.' in f else 'ui'
            data.setdefault(bucket, {}).update(d)
            n += len(d)
    json.dump(data, open(os.path.join(SRC_DIR, code + '.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1, sort_keys=True)
    print(f'merged {n} strings into lang/src/{code}.json (ui={len(data.get("ui", {}))}, js={len(data.get("js", {}))})')


JS_PATTERNS = [
    r"\bT\(\s*'((?:[^'\\]|\\.)*)'",       # T('text'): marks a text that is translated later, when it is shown
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
        src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)           # comments are not text on the page
        src = re.sub(r'(?<![:\'"\\])//[^\n]*', '', src)
        for pat in JS_PATTERNS:
            for m in re.finditer(pat, src):
                txt = m.group(1).replace("\\'", "'").replace('\\u2014', '\u2014').replace('\\u201C', '\u201C').replace('\\u201D', '\u201D')
                if WORD.search(txt) and len(txt) > 1:
                    found[txt] = f
    # page titles and search/share descriptions (swapped by i18n.js)
    import html as _html
    for f in sorted(os.listdir(ROOT)):
        if not f.endswith('.html') or f == '404.html':
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
    json.dump(found, open(os.path.join(LANG_DIR, 'js-strings.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1, sort_keys=True)
    print(len(found), 'JavaScript strings -> lang/js-strings.json')


def stale_pages():
    """Texts on a page whose English was edited after the last `extract`: the tag on the block (data-t) is not the one its words now give."""
    out = []
    for p in pages():
        raw = open(os.path.join(ROOT, p), encoding='utf-8').read()
        present = set(re.findall(r'data-t(?:a-[a-z-]+)?="(t[0-9a-f]{8})"', raw))
        strings, _ = analyse(STRIP.sub('', raw))
        for i, text in strings.items():
            if i not in present:
                out.append((p, re.sub(r'<[^>]+>|\s+', ' ', text).strip()[:90]))
    return out


def cmd_missing(code):
    en = json.load(open(os.path.join(LANG_DIR, 'en.json'), encoding='utf-8'))
    data = load(code)
    have = data['ui']
    miss = {k: v for k, v in en.items() if k not in have}
    jsmiss = {k: f for k, f in js_strings().items() if k not in data['js']}   # text the JavaScript writes: t('...'), titles, descriptions
    print(f'{code}: {len(have)} translated, {len(miss)} missing, {sum(words(v) for v in miss.values())} words to go; text written by JavaScript: {len(jsmiss)} missing')
    if '--list' in sys.argv:
        for k, v in miss.items():
            print(k, '|', v)
            why = date_phrases.why_not(v)   # a date line the tool did not understand: say why, in plain words
            if why:
                print('    (not translated by the tool: ' + why + ')')
        for k, f in jsmiss.items():
            print('js |', k, f'   (from {f}: add it under "js" in lang/src/{code}.json)')
        if miss or jsmiss:
            print(f'Add each one to lang/src/{code}.json: a line  "id": "your translation",  under "ui" (the first word of the line above is the id), or  "English text": "your translation",  under "js" for the lines that start with js |.')
            print('Every line ends with a comma except the last one before a }. Keep tags such as <strong>, <br>, <a1>...</a> as in the English. Then run: python3 tools/i18n.py build')
    stale = stale_pages()
    if stale:
        print()
        print('WARNING: the English wording below was changed after the last "extract", so the counts above cannot see it. Visitors in the other languages')
        print('still see the OLD translation of it. Run  python3 tools/pages.py  and  python3 tools/i18n.py extract  and then this command again:')
        for page, text in stale[:5]:
            print(f'  {page}: "{text}"')
        if len(stale) > 5:
            print(f'  ... and {len(stale) - 5} more')


TAG = re.compile(r'</?([a-z][a-z0-9]*)')


def tag_difference(english, translation):
    """Say in plain words which tags a translation lost or added: "it has no <a2> and no </a2>"."""
    pat = re.compile(r'<(/?)([a-z][a-z0-9]*)')
    def count(t):
        c = {}
        for slash, name in pat.findall(t):
            c['<' + slash + name + '>'] = c.get('<' + slash + name + '>', 0) + 1
        return c
    a, b = count(english), count(translation)
    lost = [t for t in sorted(a) if a[t] > b.get(t, 0)]
    extra = [t for t in sorted(b) if b[t] > a.get(t, 0)]
    out = []
    if lost:
        out.append('The translation is missing ' + ', '.join(lost) + '.')
    if extra:
        out.append('The translation has too many ' + ', '.join(extra) + '.')
    return ' '.join(out) + ' Copy every tag from the English exactly (a link is <a1>...</a>, a second link is <a2>...</a>).'


def unsafe(data, en):
    """Translations are inserted as HTML (ui) or as plain text (js): they may not add tags, handlers or quotes."""
    bad = []
    for k, v in data.get('ui', {}).items():
        if k in en and sorted(TAG.findall(v)) != sorted(TAG.findall(en[k])):
            bad.append(f'ui {k}: its tags differ from the English text. {tag_difference(en[k], v)}  English: {re.sub(chr(10), " ", en[k])[:100]}')
        if re.search(r'<[^>]*\son[a-z]+\s*=|javascript:', v, re.I):
            bad.append(f'ui {k}: event handler or javascript: link')
    for k, v in data.get('js', {}).items():
        if re.search(r'[<>"]', v) and not re.search(r'[<>"]', k):
            bad.append(f'js {k!r}: contains < > or "')
    return bad


def json_problem(name, path, e):
    """Explain a JSON mistake the way a person fixes it: which lines to look at, and the usual cause."""
    ln = getattr(e, 'lineno', 0) or 0
    msg = getattr(e, 'msg', str(e))
    lines = open(path, encoding='utf-8').read().split('\n')
    show = lambda n: f'    line {n}: ' + (lines[n - 1].strip()[:110] if 0 < n <= len(lines) else '')
    out = [f'{name} is not valid JSON ({msg}; the computer points at line {ln}). Nothing was built.']
    if ln > 1:
        out += [show(ln - 1), show(ln)]
    if 'delimiter' in msg and "','" in msg.replace('"', "'"):
        out.append(f'Most likely a comma is missing at the END of line {ln - 1} (the line above the one the computer points at).')
    elif 'property name' in msg:
        out.append(f'Most likely there is a comma after the last entry (remove the comma at the end of line {ln - 1}), or a quote mark is missing.')
    elif 'control character' in msg or 'Unterminated' in msg or 'Expecting value' in msg or 'delimiter' in msg:
        out.append(f'Most likely a closing quote mark is missing, or it is a curly quote (\u201d) instead of a straight one ("), on line {ln} or the line above.')
    else:
        out.append('Check the commas and quote marks near those lines.')
    return '\n'.join(out)


def cmd_build():
    en = json.load(open(os.path.join(LANG_DIR, 'en.json'), encoding='utf-8'))
    built = []
    for f in sorted(os.listdir(SRC_DIR)):
        if not f.endswith('.json'):
            continue
        try:
            data = json.load(open(os.path.join(SRC_DIR, f), encoding='utf-8'))
        except ValueError as e:
            sys.exit(json_problem(f'lang/src/{f}', os.path.join(SRC_DIR, f), e))
        if not isinstance(data, dict) or not isinstance(data.get('ui', {}), dict) or not isinstance(data.get('js', {}), dict):
            sys.exit(f'lang/src/{f} must look like {{ "ui": {{ ... }}, "js": {{ ... }} }}. Nothing was built.')
        bad = unsafe(data, en)
        if bad:
            sys.exit(f'lang/src/{f}: not built (nothing was built), fix these first:\n  ' + '\n  '.join(bad))
        built.append((f[:-5], data))
    for code, data in built:   # only now: every language passed
        js = 'window.WISE_ACRES=window.WISE_ACRES||{};(WISE_ACRES.dict=WISE_ACRES.dict||{}).%s=%s;\n' % (code, json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        open(os.path.join(LANG_DIR, code + '.js'), 'w', encoding='utf-8', newline='\n').write(js)
        print(f'lang/{code}.js  ui={len(data.get("ui", {}))} js={len(data.get("js", {}))}')


def languages():
    return sorted(f[:-5] for f in os.listdir(SRC_DIR) if f.endswith('.json'))


def need_language(args, extra=0):
    """The language code (and `extra` more words) typed after the command; a plain message when it is missing or unknown."""
    if len(args) < 3 + extra:
        sys.exit('This command needs a language code, for example:  python3 tools/i18n.py ' + args[1] + ' es' + (' 0 50' if extra else '') + '\n(languages: ' + ', '.join(languages()) + ')')
    if args[2] not in languages():
        sys.exit(f"There is no language '{args[2]}'. Languages: {', '.join(languages())}. (To add one, see 'To add a language' in the README.)")
    return args[2]


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'extract':
        cmd_extract()
    elif cmd == 'orphans':
        cmd_orphans()
    elif cmd == 'dump':
        code = need_language(sys.argv, 2)
        try:
            cmd_dump(code, int(sys.argv[3]), int(sys.argv[4]))
        except ValueError:
            sys.exit('dump needs two numbers after the language, for example:  python3 tools/i18n.py dump es 0 50')
    elif cmd == 'merge':
        cmd_merge(need_language(sys.argv))
    elif cmd == 'jsstrings':
        cmd_jsstrings()
    elif cmd == 'missing':
        cmd_missing(need_language(sys.argv))
    elif cmd == 'build':
        cmd_build()
    elif cmd == 'stats':
        for p in pages():
            st, _ = analyse(STRIP.sub('', open(os.path.join(ROOT, p), encoding='utf-8').read()))
            print(p, len(st), 'strings', sum(words(v) for v in st.values()), 'words')
    else:
        print(__doc__)
