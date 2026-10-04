#!/usr/bin/env python3
"""Where is each important fact written on the site, and do all the places agree?

  python3 tools/check_facts.py            every key fact, every place, then what to do next
  python3 tools/check_facts.py phone      only the facts with "phone" in their name (several words are fine)
  python3 tools/check_facts.py --short    only the one-line answer for each fact (and the places that disagree)
  python3 tools/check_facts.py --brief    print nothing when everything agrees, and one line starting with DIFFERENT for each fact that does not
                                          (tools/make_deploy_folder.py uses this before it makes the upload folder)

Run it after you change a price, an hour, a phone number, an e-mail address, the address, an age or the year, and before you publish. It reads the files you
edit (index.html, pages/*.html, the scripts js/content.js, js/features.js and the other js/*.js, lang/src/*.json), not the pages built from them, and needs only
Python 3.8 or newer: nothing to install. A fact written inside a script counts too: the waitlist button's e-mail address (js/features.js, WAITLIST), the two street
addresses of the drive-time box and the 5 PM fallback of the pizza countdown. An e-mail address that a script holds but no page shows is marked DIFFERENT.
It prints each place as  file:line  and the words around the fact. A fact whose places say different things is marked DIFFERENT, with the odd one out.
"node tests/consistency.test.mjs" does the same job on the built pages in all five languages and knows more facts, but needs Node and a browser kit.
Exit code: 0 = everything agrees, 1 = something disagrees.
"""
import contextlib, glob, html, io, json, os, re, sys

# ---- Windows safety: these lines open every tool in tools/ (tests/windows-reality.test.mjs checks that they are the same in all of them).
try:   # an old Windows console, or output sent to a file (cp1252, cp437), cannot show every letter: show a ? for it instead of stopping
    sys.stdout.reconfigure(errors='replace')
except (AttributeError, ValueError, OSError):
    pass


def _stop_plainly(kind, err, tb):
    """A file saved in the old Windows format (Notepad's "ANSI"), or one that is read-only or open in another program, ends a tool with a plain message, not a traceback."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if issubclass(kind, UnicodeDecodeError):
        import glob
        for pat in ('*.html', 'pages/*.html', 'js/*.js', 'css/*.css', 'lang/*.json', 'lang/src/*.json', 'tools/*.json'):
            for path in sorted(glob.glob(os.path.join(root, pat))):
                with open(path, 'rb') as f:
                    raw = f.read()
                try:
                    raw.decode('utf-8')
                except UnicodeDecodeError as bad:
                    line = raw.split(b'\n')[raw.count(b'\n', 0, bad.start)]
                    print('%s is not saved as UTF-8: line %d has a character in the old Windows "ANSI" format (a dash, a curly quote or a letter with an accent):\n    %s\n'
                          'Open the file and save it again as UTF-8 (Notepad: File, Save As, then Encoding: UTF-8; VS Code: click the encoding at the bottom right, Save with Encoding, UTF-8). Then run this again.'
                          % (os.path.relpath(path, root).replace(os.sep, '/'), raw.count(b'\n', 0, bad.start) + 1, line.decode('utf-8', 'replace').strip()[:70].encode('ascii', 'replace').decode()), file=sys.stderr)
                    return
    elif issubclass(kind, PermissionError) and getattr(err, 'filename', None):
        print('I could not open or change %s: the file is read-only, or open in another program, or locked while OneDrive syncs it.\n'
              'Right-click it, Properties, and untick Read-only; close the programs that show it; wait a moment. Then run this again.' % err.filename, file=sys.stderr)
        return
    sys.__excepthook__(kind, err, tb)


sys.excepthook = _stop_plainly
# ---- end of the Windows safety lines

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---------------------------------------------------------------- reading the files
BLOCK = re.compile(r'^/?(?:p|li|ul|ol|div|section|article|header|footer|nav|main|aside|h[1-6]|table|thead|tbody|tr|td|th|dt|dd|dl|figure|figcaption|details|summary|caption|address|form|br|hr|button|label|legend)$', re.I)


def read(rel):
    try:
        with open(os.path.join(ROOT, rel), encoding='utf-8-sig') as f:
            return f.read()
    except OSError:
        return None


def plain_text(src):
    """The words of a page as a reader meets them, with every line number kept: a tag becomes a space (inline) or ' | ' (block), entities are decoded."""
    src = re.sub(r'<!--.*?-->', lambda m: '\n' * m.group(0).count('\n'), src, flags=re.S)
    src = re.sub(r'<(script|style)\b(?![^>]*ld\+json)[^>]*>.*?</\1\s*>', lambda m: '\n' * m.group(0).count('\n'), src, flags=re.S | re.I)

    def tag(m):
        name = re.match(r'</?([a-zA-Z][a-zA-Z0-9]*)', m.group(0))
        sep = ' | ' if name and BLOCK.match(name.group(0).lstrip('<')) else ' '
        return sep + '\n' * m.group(0).count('\n')
    src = re.sub(r'<[^>]*>', tag, src)
    return re.sub(r'[ \t]+', ' ', html.unescape(src).replace('\xa0', ' '))


def words(text, start, end):
    return re.sub(r'\s+', ' ', text[max(0, start - 28):end + 28]).strip()


def context(body, start, end):
    """The whole line a place is on (in a page's words: the block between two ' | ' marks), to tell what it is about ("Day-of emergencies")."""
    a = body.rfind('\n', 0, start) + 1
    b = body.find('\n', end)
    seg = body[a:len(body) if b < 0 else b]
    if ' | ' in seg:
        at = start - a
        left, right = seg.rfind(' | ', 0, at), seg.find(' | ', at)
        seg = seg[left + 3 if left >= 0 else 0:right if right >= 0 else len(seg)]
    return re.sub(r'\s+', ' ', seg).strip()


# The drawing scripts hold long lists of numbers (outlines, map points) and no facts: they are not read.
JS_NOT_READ = ('hero.js', 'footer-art.js', 'map-art.js', 'farm-map-data.js')


def js_files():
    """js/content.js first (the settings), then every other script that can hold a fact."""
    names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(ROOT, 'js', '*.js')))
    return ['js/' + n for n in ['content.js'] + [n for n in names if n != 'content.js' and n not in JS_NOT_READ] if n in names]


def js_code(src):
    """A script without its comments (/* ... */ and // ... to the end of a line), with every line kept in place, so a line number is the line in the file.
    A // inside a web address (https://) or at the start of a word is not a comment: a comment's // follows a space, a comma, a semicolon, a bracket or the line start."""
    src = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), src, flags=re.S)
    return re.sub(r'(?m)(^|(?<=[\s,;(){}\[\]]))//.*$', '', src)


def source_files():
    """(file, words of the page, the file as written) for every file where a fact can be written. Same line numbers in both."""
    out = []
    for rel in ['index.html'] + sorted('pages/' + os.path.basename(p) for p in glob.glob(os.path.join(ROOT, 'pages', '*.html'))):   # with /, as on every computer
        s = read(rel)
        if s is not None:
            out.append((rel, plain_text(s), s))
    for rel in js_files():
        s = read(rel)
        if s is not None:
            code = js_code(s)
            out.append((rel, code, code))
    return out


def translations():
    """[(file, line, id or English key, translated text)] from lang/src/*.json (one entry per line, as tools/i18n.py writes them), with the English of each id."""
    en = {}
    raw = read('lang/en.json')
    if raw:
        try:
            en = json.loads(raw)
        except ValueError:
            en = {}
    out = []
    # A text the scripts write is a "js" key; one that no script holds any more (lang/js-strings.json, made by tools/i18n.py jsstrings, does not list it) shows to nobody.
    try:
        in_use = set(json.loads(read('lang/js-strings.json') or 'null') or [])
    except ValueError:
        in_use = set()
    for path in sorted(glob.glob(os.path.join(ROOT, 'lang', 'src', '*.json'))):
        rel = 'lang/src/' + os.path.basename(path)
        section = None
        with open(path, encoding='utf-8-sig') as f:
            for n, line in enumerate(f, 1):
                s = line.strip()
                if s in ('"js": {', '"ui": {'):
                    section = s[1:3]
                    continue
                if not s.startswith('"') or section is None:
                    continue
                try:
                    k, v = list(json.loads('{' + s.rstrip(',') + '}').items())[0]
                except (ValueError, IndexError):
                    continue
                if section == 'js' and in_use and k not in in_use:
                    continue
                if isinstance(v, str):
                    english = en.get(k) if section == 'ui' else k
                    if english:
                        out.append((rel, n, plain_text(english).strip(), plain_text(v).strip()))
    return out


# ---------------------------------------------------------------- values
def num(s):
    f = float(str(s).replace(',', ''))
    return str(int(f)) if f == int(f) else ('%.2f' % f).rstrip('0')


def money(m, g=1):
    return '$' + num(m.group(g))


def clock(h, mi, ap):
    h = int(h)
    if ap:
        ap = ap.lower().replace('.', '')
        if ap == 'pm' and h < 12:
            h += 12
        if ap == 'am' and h == 12:
            h = 0
    return '%02d:%s' % (h, mi or '00')


def hours(m):
    """'10 am - 8 pm', '4 to 8 pm', '10:00' ... as 10:00-20:00."""
    if re.search(r'At The GreenHouse\s*,?\s*$', m.string[max(0, m.start() - 30):m.start()], re.I):
        return None   # the Wise Pie hours ("At The GreenHouse, Friday-Sunday, 4:00-8:00 PM") are another fact
    a = (m.group(1), m.group(2), m.group(3)); b = (m.group(4), m.group(5), m.group(6))
    own = bool(a[2])   # does the first time say am or pm itself?
    if not own and b[2]:
        a = (a[0], a[1], b[2])
    s, e = clock(*a), clock(*b)
    if not own and s > e:
        s = clock(a[0], a[1], 'am')   # "11-1 pm", "10-8 pm": with the "pm" of the second time the first would start after it ends, so it is the morning one
    if e < s:
        e = clock(int(b[0]) + 12, b[1], None)
    return s + '-' + e


T = r'(\d{1,2})(?::(\d\d))? ?([ap]\.?m\.?)?'
RANGE = T + r' ?(?:–|-|to) ?' + T.replace('([ap]\\.?m\\.?)?', '([ap]\\.?m\\.?)')
MONEY = r'\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)'   # $1,200 and $1200.50 are read whole
PHONE = re.compile(r'\(?\b(\d{3})\)?[-. ] ?(\d{3})[-. ](\d{4})\b')


def phone_digits(s):
    d = re.sub(r'\D', '', s)
    return d[1:] if len(d) == 11 and d[0] == '1' else d


def pretty_phone(d):
    return '%s-%s-%s' % (d[:3], d[3:6], d[6:])


# ---------------------------------------------------------------- the facts
# name, what it is in plain words, where to change it, patterns (regex, value function), and how a translation is checked ('digits': the same numbers, 'money': the same $ amounts)
def one(g=1):
    return lambda m: m.group(g)


# js/content.js: greenhouse: { days: [...], open: '10:00', close: '20:00' }. Single or double quote marks, and 9:00 as well as 09:00, are both fine in that file.
SETTING_HOURS = r"%s:\s*\{[^}]*open:\s*['\"](\d{1,2}):(\d\d)['\"],\s*close:\s*['\"](\d{1,2}):(\d\d)['\"]"


def setting_hours(m):
    a, b, c, d = m.groups()
    return '%02d:%s-%02d:%s' % (int(a), b, int(c), d)


FACTS = [
    dict(name='price: farm fee per person', what='the field fee per person (ages 3 and up), also the extra per person in the pizza package', see='README: "Change a fact everywhere", row "$3 per person"', check='money',
         pats=[(r'plus ' + MONEY + r' per person', money), (r'\+ ' + MONEY + r' per person farm fee', money), (r'(?:Farm fun, no pizza|No pizza)[ |]{1,8}(?:[^$|]+[ |]{1,8})?' + MONEY + ' per person', money),
               (r'farm fun without pizza is ' + MONEY, money), (MONEY + r' per person[ |]{1,8}(?:Field fee|Ages 3 and up)', money)]),
    dict(name='price: pizza package base', what='the base price of a farm visit with pizza', see='README: "Change a fact everywhere", row "The $31 package"', check='money', pats=[(MONEY + r' base', money)]),
    dict(name='price: wagon ride', what='a wagon ride, per person', see='index.html and the other pages: search for "Wagon ride"', check='money', pats=[(r'[Ww]agon rides?[^$|.]{0,30}' + MONEY, money)]),
    dict(name='price: corn pit', what='the corn pit, per person', see='index.html and the other pages: search for "Corn pit"', check='money', pats=[(r'[Cc]orn pit[^$|.]{0,30}' + MONEY, money)]),
    dict(name='price: barrel train', what='the barrel train, per child', see='index.html and the other pages: search for "Barrel train"', check='money', pats=[(r'[Bb]arrel train[^$|.]{0,30}' + MONEY, money)]),
    dict(name='price: tomatoes per pound', what='tomatoes, per pound', see='index.html: search for "per pound"', check='money', pats=[(MONEY + r' per pound', money)]),
    dict(name='price: refund fee', what='the card fee kept when a reservation is cancelled (%)', see='search for "credit card processing fee"', check='digits', pats=[(r'(\d+)% credit card', one())]),
    dict(name='hours: The GreenHouse', what='the GreenHouse opening hours (js/content.js hours.greenhouse and the words on the pages)', see='README: "Change a fact everywhere", row "The GreenHouse hours"', check='digits',
         pats=[(r'(?<!At The GreenHouse )(?:Fri–Sun|Friday–Sunday|Fri through Sun|Friday through Sunday),? ' + RANGE, hours),
               (SETTING_HOURS % 'greenhouse', setting_hours)]),
    dict(name='hours: Wise Pie', what='the Wise Pie (pizza) hours at The GreenHouse', see='README: "Change a fact everywhere", row "The Wise Pie hours"', check='digits',
         pats=[(r'\| ' + RANGE + r' \| At The GreenHouse', hours), (r'first come, first served from ' + T + ' to ' + T.replace('([ap]\\.?m\\.?)?', '([ap]\\.?m\\.?)'), hours),
               (SETTING_HOURS % 'pizza', setting_hours)]),
    dict(name='hours: pizza reservations open', what='the time on Tuesdays when pizza reservations open', see='search for "Tuesday" in index.html (and data-release-time)', check='digits',
         pats=[(r'Tuesdays? at ' + T, lambda m: clock(m.group(1), m.group(2), m.group(3))), (r'data-release-time="(\d{1,2}):(\d\d)"', lambda m: clock(m.group(1), m.group(2), None), 'raw'),
               (r"releaseTime : '(\d{1,2}):(\d\d)'", lambda m: clock(m.group(1), m.group(2), None), 'raw')]),
    dict(name='phone numbers', what='every phone number (the main one, if shown, and the day-of emergency number)', see='README: "Change a fact everywhere", row "The main phone number"', check='digits', kind='phone',
         pats=[(PHONE.pattern, lambda m: m.group(1) + m.group(2) + m.group(3)), (r'tel:\+?1?(\d{10})', one(), 'raw'), (r'"telephone": "([^"]+)"', lambda m: phone_digits(m.group(1)))]),
    dict(name='e-mail addresses', what='every e-mail address', see='README: "Change a fact everywhere", row "An email address" (and js/features.js, WAITLIST)', check='text', kind='email',
         pats=[(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', lambda m: m.group(0).lower()), (r'mailto:([\w.+-]+@[\w-]+(?:\.[\w-]+)+)', lambda m: m.group(1).lower(), 'raw')]),
    dict(name='address: Hartis Rd', what='the street number of the farm (Hartis Rd)', see='search for "Hartis" in index.html and pages/', check='digits', pats=[(r'(\d{4}) Hartis', one())]),
    dict(name='address: Poplin Rd', what='the street number of The GreenHouse (Poplin Rd)', see='search for "Poplin" in index.html and pages/', check='digits', pats=[(r'(\d{4}) Poplin', one())]),
    dict(name='address: ZIP code', what='the ZIP code', see='search for "NC 28" in index.html and pages/', check='digits', pats=[(r'NC (\d{5})', one())]),
    dict(name='age: free', what='the age up to which children are free', see='search for "are free" and "ride free"', check='digits',
         pats=[(r'[Ii]nfants (\d+) and under are free', one()), (r'[Aa]ges (\d+) and younger ride free', one()), (r'[Cc]hildren (\d+) and under are free', one()), (r'[Cc]hildren age (\d+) and younger are free', one())]),
    dict(name='age: field fee starts', what='the age from which people pay the field fee', see='search for "ages 3 and up"', check='digits', pats=[(r'[Aa]ges (\d+) and up', one()), (r'\(ages (\d+)\+\)', one())]),
    dict(name='size: guests at a party', what='the most guests at a private party', see='search for "Up to"', check='digits', pats=[(r'Up to (\d+) guests', one())]),
    dict(name='size: school group minimum', what='the smallest school group', see='search for "Minimum" in pages/school-field-trips.html', check='digits', pats=[(r'Minimum (?:group size: )?(\d+) students', one())]),
    dict(name='year: fall prices', what='the year of the fall prices, menu and schedule', see='README: "A new year, a new season"', check='digits', pats=[(r'(?:Fall|fall|Menu) (20\d\d)', one())]),
    dict(name='year: farm began', what='the year the farm began', see='search for "since 20" in index.html', check='digits', pats=[(r'since (20\d\d)', one()), (r'"foundingDate": "(20\d\d)', one())]),
]


def edit_distance(a, b):
    row = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        nxt = [i]
        for j in range(1, len(b) + 1):
            nxt.append(min(row[j] + 1, nxt[j - 1] + 1, row[j - 1] + (a[i - 1] != b[j - 1])))
        row = nxt
    return row[-1]


def numbers_in(text):
    """The numbers written in a text ("1,500" is 1500; the ':00' of a clock time is left out)."""
    return [num(x) for x in re.findall(r'\d+(?:\.\d+)?', text.replace(',', '').replace(':00', ''))]


def find_places(fact, files, trans):
    """Every place: dict(file, line, value, words)."""
    places = []
    for rel, text, raw in files:
        for pat in fact['pats']:
            rx, valf = pat[0], pat[1]
            body = raw if len(pat) > 2 else text
            for m in re.finditer(rx, body, re.I):
                try:
                    value = valf(m)
                except (ValueError, IndexError):
                    continue
                if value is None:
                    continue
                line = body.count('\n', 0, m.start()) + 1
                if not any(p['file'] == rel and p['line'] == line and p['value'] == value for p in places):
                    places.append(dict(file=rel, line=line, value=value, words=words(body, m.start(), m.end()), ctx=context(body, m.start(), m.end())))
    # translations: the translation of a sentence that holds this fact must hold the same numbers
    if fact['check'] in ('money', 'digits') and not fact.get('kind'):
        for rel, line, english, tr in trans:
            for pat in fact['pats']:
                if len(pat) > 2:
                    continue
                m = re.search(pat[0], english, re.I)
                if not m:
                    continue
                try:
                    value = pat[1](m)
                except (ValueError, IndexError):
                    continue
                if value is None:
                    continue
                if fact['check'] == 'money':
                    have = [num(x) for x in re.findall(r'\$\s?(\d+(?:\.\d+)?)', tr.replace(',', ''))]
                    want = [num(x) for x in re.findall(r'\$(\d+(?:\.\d+)?)', value)]
                else:
                    have = numbers_in(tr)
                    want = numbers_in(m.group(0))   # a 12-hour time in English may be on the 24-hour clock in the translation
                same = all(w in have or (w.isdigit() and 1 <= int(w) <= 12 and str(int(w) + 12) in have) for w in want)
                shown = value if same else 'the translation says ' + (', '.join(re.findall(r'\$\s?\d+(?:\.\d+)?|\d+(?::\d\d)?', tr)[:6]) or 'no number')
                places.append(dict(file=rel, line=line, value=shown, words=re.sub(r'\s+', ' ', tr)[:70], ctx=''))
                break
    return places


def report(fact, places, short):
    """Prints one fact; returns a list of problems (strings)."""
    problems = []
    kind = fact.get('kind')
    print('\n' + fact['name'].upper() + '   (' + fact['what'] + ')')
    if not places:
        print('  not found in any file: the wording may have changed, or the fact is not on the site (yet).')
        return problems
    if kind == 'phone':
        shown = {}
        for p in places:
            shown.setdefault(p['value'], []).append(p)
        day = [d for d, ps in shown.items() if any(re.search(r'Day-of|emergenc', p.get('ctx', '') + ' ' + p['words'], re.I) for p in ps)]
        others = [d for d in shown if d not in day]
        if len(day) > 1:
            problems.append('two different day-of emergency numbers: ' + ', '.join(pretty_phone(d) for d in day))
        if len(others) > 1:
            problems.append('more than one main phone number: ' + ', '.join(pretty_phone(d) for d in others))
        for d, ps in sorted(shown.items(), key=lambda kv: -len(kv[1])):
            label = pretty_phone(d) + ('  (day-of emergencies)' if d in day else '  (main number)')
            print('  %s: %d place(s)' % (label, len(ps)))
            if not short:
                for p in ps:
                    print('      %s:%s  %s' % (p['file'], p['line'] or '', p['words']))
        print('  ' + ('DIFFERENT: ' + '; '.join(problems) if problems else 'OK: one day-of number and at most one main number, written the same everywhere.'))
        return problems
    if kind == 'email':
        shown = {}
        for p in places:
            shown.setdefault(p['value'], []).append(p)
        names = sorted(shown)
        close = [(a, b) for i, a in enumerate(names) for b in names[i + 1:] if a.split('@')[1] == b.split('@')[1] and edit_distance(a.split('@')[0], b.split('@')[0]) <= 2]
        for d, ps in sorted(shown.items()):
            print('  %s: %d place(s)' % (d, len(ps)))
            if not short:
                for p in ps:
                    print('      %s:%s  %s' % (p['file'], p['line'], p['words']))
        for a, b in close:
            problems.append('%s and %s look like two spellings of one address (a typo?)' % (a, b))
        on_pages = {p['value'] for p in places if not p['file'].startswith('js/')}
        for d, ps in sorted(shown.items()):
            held = [p for p in ps if p['file'].startswith('js/')]
            if held and d not in on_pages:
                where = ', '.join('%s:%s' % (p['file'], p['line']) for p in held[:3])
                problems.append('%s is held by a script (%s: the waitlist button uses it) but is written on no page. The pages say: %s' % (d, where, ', '.join(sorted(on_pages)[:4]) or 'no address'))
        print('  ' + ('DIFFERENT: ' + '; '.join(problems) if problems else 'OK: no address looks like a misspelling of another.'))
        return problems
    groups = {}
    for p in places:
        groups.setdefault(p['value'], []).append(p)
    ordered = sorted(groups.items(), key=lambda kv: -len(kv[1]))
    if len(ordered) == 1:
        v, ps = ordered[0]
        print('  OK: all %d places say %s' % (len(ps), v))
        if not short:
            for p in ps:
                print('      %s:%s  %s' % (p['file'], p['line'], p['words']))
        return problems
    tie = len(ordered[0][1]) == len(ordered[1][1])
    print('  DIFFERENT: %d answers.' % len(ordered) + (' About as many places say each: ask the farm which is right.' if tie else ' Most places (%d) say %s.' % (len(ordered[0][1]), ordered[0][0])))
    for i, (v, ps) in enumerate(ordered):
        print('    %s  (%d place(s))%s' % (v, len(ps), '' if tie or i else '   <- most places'))
        for p in ps[:6] if short else ps:
            print('        %s:%s  %s' % (p['file'], p['line'], p['words']))
    where = lambda ps: ' (' + ', '.join('%s:%s' % (p['file'], p['line']) for p in ps[:3]) + (', ...' if len(ps) > 3 else '') + ')'
    problems.append('%s: %s' % (fact['name'], ', '.join('%s in %d place%s%s' % (v, len(ps), '' if len(ps) == 1 else 's', where(ps) if (tie or i) else '') for i, (v, ps) in enumerate(ordered))))
    return problems


def main(argv):
    short = '--short' in argv
    brief = '--brief' in argv
    pick = [a.lower() for a in argv if not a.startswith('--')]
    if '-h' in argv or '--help' in argv:
        print(__doc__)
        return 0
    files = source_files()
    if not files or not any(f[0] == 'index.html' for f in files):
        print('I cannot find index.html. Run this from the website folder:  python3 tools/check_facts.py')
        return 2
    trans = translations()
    chosen = [f for f in FACTS if not pick or any(w in f['name'].lower() or w in f['what'].lower() for w in pick)]
    if not chosen:
        print('No fact matches ' + ', '.join(pick) + '. The facts: ' + '; '.join(f['name'] for f in FACTS))
        return 2
    if brief:   # one line for each fact that disagrees, nothing else
        lines = []
        for fact in chosen:
            places = find_places(fact, files, trans)
            if places:
                with contextlib.redirect_stdout(io.StringIO()):
                    lines += report(fact, places, True)
        for line in lines:
            print('DIFFERENT ' + line)
        return 1 if lines else 0
    print('Checking %d facts in %d files (index.html, pages/*.html, js/*.js) and %d translated texts (lang/src/*.json).' % (len(chosen), len(files), len(trans)))
    if not trans:
        print('(lang/src/*.json or lang/en.json was not found: the translations are not checked.)')
    problems, agree = [], 0
    for fact in chosen:
        probs = report(fact, find_places(fact, files, trans), short)
        problems += probs
        agree += 0 if probs else 1
    print('\n' + '=' * 70)
    print('%d of %d facts agree everywhere; %d disagree.' % (agree, len(chosen), len(chosen) - agree))
    print('\nWHAT TO DO NEXT')
    if problems:
        for p in problems:
            print('  - ' + p)
        print('  1. Look at the lines marked DIFFERENT above. The odd one out (fewest places) is usually the mistake; if the numbers are about equal, ask the farm which is right.')
        print('  2. Open the file named at the start of that line (pages/ files, index.html, js/content.js or lang/src/xx.json), go to the line number, and make it say the same as the others.')
        print('     The five pages in the top folder (first-visit.html, ...) are built: change pages/first-visit.html, never the built copy.')
        print('  3. Rebuild:  python3 tools/pages.py   then   python3 tools/i18n.py extract   and   python3 tools/i18n.py build   (README: "Change a fact everywhere").')
        print('  4. Run this again until it says every fact agrees. Then look at the site with ?check on the end of the address.')
        print('  Or let a tool do the whole change, translations included:  python3 tools/change_fact.py --help')
        return 1
    print('  Nothing disagrees. If you changed a file, rebuild (python3 tools/pages.py, then python3 tools/i18n.py extract and python3 tools/i18n.py build) and look at the site with ?check on the end of the address.')
    print('  A developer can run  node tests/consistency.test.mjs  for the same check on the built pages in all five languages.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
