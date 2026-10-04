#!/usr/bin/env python3
"""Changes one fact everywhere it is written, translations included, and checks the result. Needs Python 3.8 or newer and beautifulsoup4 (the same as pages.py).

  python3 tools/change_fact.py price '$31' '$32'            a price (single quote marks: a Mac, Linux or PowerShell window changes "$31" into "1")
  python3 tools/change_fact.py email old@x.com new@x.com    an e-mail address
  python3 tools/change_fact.py phone 704-207-6347 704-555-1234
  python3 tools/change_fact.py hours "Fri-Sun, 10 am-8 pm" "Fri-Sun, 10 am-9 pm"     opening hours (the days stay the same)
  python3 tools/change_fact.py text "OLD WORDS" "NEW WORDS"   any exact phrase (numbers and addresses inside it get their translations; new words do not)
  python3 tools/change_fact.py undo                          put back everything the last change touched

Without --yes it only LISTS the places it would change (file, line, the words around it) and changes nothing. With --yes it
  1. saves a copy of every file it may touch in your computer's temporary folder (that is what "undo" restores),
  2. changes the OLD words to the NEW words in index.html, pages/*.html, js/content.js and js/features.js (never in the built pages in the top folder,
     which pages.py rebuilds, and never in README.md or docs/),
  3. runs  pages.py,  i18n.py extract,  i18n.py jsstrings,
  4. for every text whose English changed, copies its old translation in lang/src/es.json, hi.json, zh.json and vi.json and swaps the old price, address,
     number or hour for the new one, in the same form the translation uses (a phone number keeps its dots or brackets; "10 a. m." and "10 giờ sáng" keep their words),
  5. runs  i18n.py build,  i18n.py missing  and  check_facts.py, and says "Ready" or exactly what is left.
It never guesses: a translation that does not hold the old number in a form it recognises is NOT written; its code and English are listed for you (or Claude) to translate.
A phrase is also found where a map link writes it with %20 or +. A file this tool does not change that still holds the old words (tools/qr_links.json: the QR signs carry the
address) is named before and after, and the run then ends with NOT DONE yet, not with Ready.
A change of hours also prints the new lines, to be read once by a native speaker (the words for morning, evening and night may need to change).

Options:  --yes          do it (without it nothing is changed)
          --only WORDS   change only the places whose surrounding words include WORDS (for example --only "per person"): needed when the same price or hours
                         mean two different things on the site; the tool says so and stops
          --help         this text
What it accepts: the old and the new words must be plain text of at most 160 characters: no < or >, no quote marks " or backslash or backtick, no control or invisible
characters, & only as an entity such as &rsquo;. A price looks like $32 or $4.50, an e-mail address like name@farm.com, a phone number has 10 digits, hours look like
"Fri-Sun, 10 am-9 pm" or "4 to 8 pm" (the days must stay the same: change the days by hand, README, section "Change a fact everywhere").
Exit code: 0 done (or listed), 1 something is left or was refused, 2 the command was not understood.
"""
import datetime
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

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

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import check_facts  # noqa: E402  (its table of facts says which places mean what)

MAX_TEXT = 160
MAX_PLACES = 400
KINDS = ('price', 'email', 'phone', 'hours', 'text')
LANGS_DIR = os.path.join('lang', 'src')
BACKUP_ROOT = os.environ.get('WA_BACKUP_DIR') or os.path.join(tempfile.gettempdir(), 'wise-acres-change-fact')   # the tests use their own folder
BAD_CHARS = re.compile('[\x00-\x1f\x7f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]')


class Refuse(Exception):
    """A plain message for the owner; nothing was changed."""


# ---------------------------------------------------------------- reading and writing files (the same bytes back: line ends are kept)
def read(rel):
    try:
        with open(os.path.join(ROOT, rel), encoding='utf-8', newline='') as f:
            return f.read()
    except OSError:
        return None


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8', newline='') as f:
        f.write(text)


def source_names():
    """The files the owner edits: where the old words are looked for."""
    names = ['index.html'] + sorted(os.path.relpath(p, ROOT).replace(os.sep, '/') for p in glob.glob(os.path.join(ROOT, 'pages', '*.html')))
    return names + [n for n in ('js/content.js', 'js/features.js') if os.path.exists(os.path.join(ROOT, n))]


def run(script, *args):
    """Runs one of the site's own tools; returns (exit code, its words)."""
    r = subprocess.run([sys.executable, os.path.join(HERE, script)] + list(args), cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=900)
    return r.returncode, (r.stdout or '') + (r.stderr or '')


# ---------------------------------------------------------------- what the owner typed
def clean(s, what, kind='text'):
    s = s.strip()
    if kind == 'price' and len(s) >= 2 and s[0] == s[-1] == "'":
        s = s[1:-1].strip()   # '$31' in single quotes: the Windows cmd window hands the quote marks over as they are (a Mac, Linux or PowerShell window removes them)
    if not s:
        raise Refuse('The %s words are empty.' % what)
    if len(s) > MAX_TEXT:
        raise Refuse('The %s words are longer than %d characters. Use the shortest words that find the place.' % (what, MAX_TEXT))
    if BAD_CHARS.search(s):
        raise Refuse('The %s words hold a control or invisible character (a line break, a tab, a hidden space). Type them again.' % what)
    if re.search(r'[<>"`\\]', s) or '${' in s:
        raise Refuse('The %s words may not hold < > " ` or a backslash: they are written into the page files as plain text.' % what)
    if '&' in re.sub(r'&(?:[A-Za-z]{2,8}|#\d{1,6});', '', s):
        raise Refuse('The %s words hold a bare "&". Write it as the entity the file uses, for example &amp; or &rsquo;.' % what)
    return s


# ---------------------------------------------------------------- time of day
def parse_time(piece):
    m = re.fullmatch(r'(\d{1,2})(?::(\d\d))?\s*(?:([ap])\.?\s?m\.?)?', piece.strip(), re.I)
    if not m:
        raise Refuse('I do not understand the time "%s". Write it like 10 am, 4:30 pm or 20:00.' % piece)
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), ((m.group(3) or '').lower() + 'm') if m.group(3) else ''
    if ap and not 1 <= h <= 12:
        raise Refuse('"%s" is not a time on the 12-hour clock.' % piece)
    if h > 23 or mi > 59:
        raise Refuse('"%s" is not a time of day.' % piece)
    return h, mi, ap


def parse_hours(s):
    """'Fri-Sun, 10 am-8 pm' -> ('fri-sun', (10, 0), (20, 0)). A time without am or pm takes it from the other end ('4 to 8 pm')."""
    m = re.fullmatch(r'(?:([A-Za-z]+(?:\s*(?:-|–|—|to|through)\s*[A-Za-z]+)?)\s*,\s*)?(\S+(?:\s*[ap]\.?\s?m\.?)?)\s*(?:-|–|—|\bto\b)\s*(\S+(?:\s*[ap]\.?\s?m\.?)?)', s.strip(), re.I)
    if not m:
        raise Refuse('I do not understand the hours "%s". Write them like "Fri-Sun, 10 am-9 pm" or "4 to 8 pm".' % s)
    days = re.sub(r'\s*(?:-|–|—|to|through)\s*', '-', (m.group(1) or '').lower().strip())
    a, b = parse_time(m.group(2)), parse_time(m.group(3))
    if not b[2] and a[2]:
        b = (b[0], b[1], a[2])
    if not a[2] and b[2]:
        a = (a[0], a[1], b[2])

    def h24(t):
        h, mi, ap = t
        if ap == 'pm' and h < 12:
            h += 12
        if ap == 'am' and h == 12:
            h = 0
        return h, mi
    s24, e24 = h24(a), h24(b)
    if not a[2] and not b[2]:
        s24, e24 = (a[0], a[1]), (b[0], b[1])   # 24-hour clock: 10:00-20:00
    elif e24 <= s24 and a[2] == b[2] == 'pm' and not (s.lower().count('pm') > 1):
        s24 = (a[0] % 12, a[1])                 # '10-8 pm' means 10 am to 8 pm
    if s24 >= e24:
        raise Refuse('The hours "%s" end before they start.' % s)
    return days, s24, e24


def bucket(h24):
    """The part of the day, in steps that are finer than any language's own words for it (morning, afternoon, evening, night)."""
    return sum(1 for edge in (5, 12, 16, 18, 20, 22) if h24 >= edge)


TIME_STYLE = re.compile(r'(0?)(\d{1,2})(:\d\d)?(\s?)(?:([ap])(\.?)(\s?)(m)(\.?))?', re.I)


def style_time(like, h24, mi, show_ap, ap_like=None):
    """The time h24:mi written the way `like` was written ('10 am', '10 AM', '10 a.m.', '10:00 pm', '08 pm'); the am or pm is shown when show_ap
    (in the style of ap_like when `like` has none)."""
    m = TIME_STYLE.fullmatch(like.strip())
    h12 = h24 % 12 or 12
    if not m:
        return '%d%s %s' % (h12, ':%02d' % mi if mi else '', 'am' if h24 < 12 else 'pm')
    lead, _, mins, gap, ap, dot1, gap2, mm, dot2 = m.groups()
    if not ap and show_ap and ap_like:
        other = TIME_STYLE.fullmatch(ap_like.strip())
        if other and other.group(5):
            gap, ap, dot1, gap2, mm, dot2 = other.group(4), other.group(5), other.group(6), other.group(7), other.group(8), other.group(9)
    out = ('0' if lead and h12 < 10 else '') + str(h12) + (':%02d' % mi if mi else (mins or ''))
    if show_ap:
        letter, mch = ('a' if h24 < 12 else 'p'), 'm'
        if ap and ap.isupper():
            letter, mch = letter.upper(), 'M'
        out += (gap or ' ') + letter + (dot1 or '') + (gap2 or '') + mch + (dot2 or '')
    return out


# ---------------------------------------------------------------- one kind of change = one spec
class Spec:
    """kind, what it is called, how to change an English text, how to carry a translation across."""

    def __init__(self, kind, old, new):
        self.kind, self.old, self.new = kind, old, new
        self.review = False   # True: print the new translated lines for a native reader
        self.names = None     # facts of tools/check_facts.py that tell what a place means
        getattr(self, 'setup_' + kind)()

    # -- price
    def setup_price(self):
        for s, what in ((self.old, 'old'), (self.new, 'new')):
            if not re.fullmatch(r'\$\d+(?:\.\d\d)?', s):
                raise Refuse('The %s price "%s" does not look like a price. Write it like $32 or $4.50 with single quote marks around it: \'$32\'. (A Mac, Linux or PowerShell window removes the $ and the digits after it from "$32" in double quote marks.)' % (what, s))
        self.rx = re.compile(re.escape(self.old) + r'(?!\d)(?!\.\d)')
        self.fact_prefix, self.expected = 'price:', self.old

    # -- email
    def setup_email(self):
        for s, what in ((self.old, 'old'), (self.new, 'new')):
            if not re.fullmatch(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+', s):
                raise Refuse('The %s e-mail address "%s" does not look like an address. Write it like name@wiseacresorganic.com.' % (what, s))
        self.rx = re.compile(r'(?<![\w.+-])' + re.escape(self.old) + r'(?![\w-])(?!\.\w)', re.I)
        self.fact_prefix, self.expected = 'e-mail', None

    # -- phone
    def setup_phone(self):
        def digits(s, what):
            d = re.sub(r'\D', '', s)
            if len(d) == 11 and d[0] == '1':
                d = d[1:]
            if len(d) != 10 or d[0] in '01':
                raise Refuse('The %s phone number "%s" must have 10 digits (area code first), like 704-207-6347.' % (what, s))
            return d
        self.od, self.nd = digits(self.old, 'old'), digits(self.new, 'new')
        self.rx = re.compile(r'(?<![\d])((?:\+?1[-. ]?)?)(\(?)(\d{3})(\)?)([-. ]?)(\d{3})([-. ]?)(\d{4})(?!\d)')
        self.fact_prefix, self.expected = 'phone', None

    # -- hours
    def setup_hours(self):
        d1, self.os, self.oe = parse_hours(self.old)
        d2, self.ns, self.ne = parse_hours(self.new)
        if d1 != d2:
            raise Refuse('The days differ ("%s" and "%s"). This tool changes the hours only; to change the days see README.md, section "Change a fact everywhere".' % (d1, d2))
        if (self.os, self.oe) == (self.ns, self.ne):
            raise Refuse('The old and the new hours are the same.')
        def t_rx(h, m):
            h12 = h % 12 or 12
            return (r'0?%d(?::%02d)' % (h12, m)) if m else (r'0?%d(?::00)?' % h12)
        ap_rx = lambda h: r'\s?%s\.?\s?m\.?' % ('a' if h < 12 else 'p')
        same = (self.os[0] < 12) == (self.oe[0] < 12)   # '4 to 8 pm': the first time may leave out its pm
        sep = r'(\s*(?:&ndash;|&mdash;|–|—|-)\s*|\s+to\s+)'
        self.rx = re.compile(r'(?<![\d:])(' + t_rx(*self.os) + (r'(?:' + ap_rx(self.os[0]) + r')?' if same else ap_rx(self.os[0])) + r')' + sep + r'(' + t_rx(*self.oe) + ap_rx(self.oe[0]) + r')(?![\d:\w])', re.I)
        self.rx24 = re.compile(r"(open:\s*['\"])%02d:%02d(['\"],\s*close:\s*['\"])%02d:%02d(['\"])" % (self.os + self.oe))
        self.fact_prefix, self.expected = 'hours', '%02d:%02d-%02d:%02d' % (self.os + self.oe)
        self.review = True

    # -- text
    TOKEN = re.compile(r'\$\d+(?:\.\d\d)?|[\w.+-]+@[\w-]+(?:\.[\w-]+)+|\d+(?::\d\d)?')

    def setup_text(self):
        if self.old == self.new:
            raise Refuse('The old and the new words are the same.')
        self.skeleton_same = self.TOKEN.sub('\x00', self.old) == self.TOKEN.sub('\x00', self.new)
        self.pairs = [(a, b) for a, b in zip(self.TOKEN.findall(self.old), self.TOKEN.findall(self.new)) if a != b] if self.skeleton_same else []
        self.fact_prefix, self.expected = None, None

    # -- the English side: returns (new text, [(start, end, old piece, new piece)]) so a list of places can be shown
    def apply(self, text):
        hits = []
        if self.kind in ('price', 'email'):
            hits = [(m.start(), m.end(), m.group(0), self.new) for m in self.rx.finditer(text)]
        elif self.kind == 'phone':
            for m in self.rx.finditer(text):
                if m.group(3) + m.group(6) + m.group(8) == self.od:
                    new = m.group(1) + m.group(2) + self.nd[:3] + m.group(4) + m.group(5) + self.nd[3:6] + m.group(7) + self.nd[6:]
                    hits.append((m.start(), m.end(), m.group(0), new))
        elif self.kind == 'hours':
            for m in self.rx.finditer(text):
                a, sep, b = m.group(1), m.group(2), m.group(3)
                a_ap = bool(re.search(r'[ap]\.?\s?m', a, re.I))
                show_a = a_ap or (self.ns[0] < 12) != (self.ne[0] < 12)
                hits.append((m.start(), m.end(), m.group(0), style_time(a, self.ns[0], self.ns[1], show_a, b) + sep + style_time(b, self.ne[0], self.ne[1], True)))
            for m in self.rx24.finditer(text):
                hits.append((m.start(), m.end(), m.group(0), m.group(1) + '%02d:%02d' % self.ns + m.group(2) + '%02d:%02d' % self.ne + m.group(3)))
            hits.sort(key=lambda h: h[0])
        else:   # any text: also where it is written inside a web address (a map link: spaces as %20 or +)
            variants = [(self.old, self.new)]
            for a, b in ((urllib.parse.quote(self.old, safe=''), urllib.parse.quote(self.new, safe='')), (self.old.replace(' ', '+'), self.new.replace(' ', '+'))):
                if a != self.old and (a, b) not in variants:
                    variants.append((a, b))
            for a, b in variants:
                i = text.find(a)
                while i >= 0:
                    if not any(s < i + len(a) and i < e for s, e, _, _ in hits):
                        hits.append((i, i + len(a), a, b))
                    i = text.find(a, i + len(a))
            hits.sort(key=lambda h: h[0])
        out, last = [], 0
        for s, e, _, new in hits:
            out.append(text[last:s])
            out.append(new)
            last = e
        out.append(text[last:])
        return ''.join(out), hits

    # -- the translation side: the same text with the old words swapped for the new, or None (and why)
    def swap(self, tr, old_en):
        if re.search('[\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\uff10-\uff19]', tr):
            return None, 'it writes numbers in another script'
        if self.kind in ('price', 'email'):
            if not self.rx.search(tr):
                return None, 'it does not hold %s' % self.old
            return self.rx.sub(lambda m: self.new, tr), ''
        if self.kind == 'phone':
            done = []
            for m in self.rx.finditer(tr):
                if m.group(3) + m.group(6) + m.group(8) == self.od:
                    done.append((m.start(), m.end(), m.group(1) + m.group(2) + self.nd[:3] + m.group(4) + m.group(5) + self.nd[3:6] + m.group(7) + self.nd[6:]))
            if not done:
                return None, 'it does not hold the number %s in a form I know' % self.old
            for s, e, new in reversed(done):
                tr = tr[:s] + new + tr[e:]
            return tr, ''
        if self.kind == 'text':
            if not self.skeleton_same:
                return None, 'the words changed, not only a number or an address'
            out = tr
            for a, b in self.pairs:
                if a not in out:
                    return None, 'it does not hold %s' % a
                out = out.replace(a, b)
            return out, ''
        return self.swap_hours(tr, old_en)

    def swap_hours(self, tr, old_en):
        """The numbers of the translation must be the numbers of the English, in the same order: the times are swapped, any other number must be the same as in the English."""
        _, hits = self.apply(old_en)
        if not hits:
            return None, 'the English has no hours I know'
        tok = r'(?<![\d$.,])\d{1,2}(?::\d\d)?(?![\d])'
        masked = re.sub(r'<[^>]*>', lambda m: ' ' * len(m.group(0)), old_en)   # digits inside a tag are not numbers of the text
        en_toks = list(re.finditer(tok, masked))
        in_time = [any(h[0] <= m.start() and m.end() <= h[1] for h in hits) for m in en_toks]
        times_old, times_new = iter([self.os, self.oe] * len(hits)), iter([self.ns, self.ne] * len(hits))
        toks = list(re.finditer(tok, tr))
        if len(toks) != len(en_toks) or sum(in_time) != 2 * len(hits):
            return None, 'it holds a different number of numbers than the English (%d and %d)' % (len(toks), len(en_toks))
        out, last = [], 0
        for m, e, is_time in zip(toks, en_toks, in_time):
            t = m.group(0)
            if not is_time:
                same = lambda x: (int(x.split(':')[0]) % 12, int(x.split(':')[1]) if ':' in x else 0)   # '4' and '4:00' and '16:00' are one time
                if same(t) != same(e.group(0)):
                    return None, 'the number %s is not the English %s' % (t, e.group(0))
                continue
            o, n = next(times_old), next(times_new)
            hh, mm = int(t.split(':')[0]), int(t.split(':')[1]) if ':' in t else 0
            if (hh, mm) == o:
                form24 = o[0] > 12 or o[0] == 0
            elif (hh, mm) == (o[0] % 12 or 12, o[1]):
                form24 = False
            else:
                return None, 'the time %s is not the old time %02d:%02d' % (t, o[0], o[1])
            if o != n and bucket(o[0]) != bucket(n[0]):
                return None, 'the word for the time of day may change'
            if o == n:
                continue
            if form24:
                new_t = ('%02d:%02d' % n) if (':' in t or n[1]) else ('%02d' % n[0] if t.startswith('0') else str(n[0]))
            else:
                new_t = str(n[0] % 12 or 12) + (':%02d' % n[1] if (':' in t or n[1]) else '')
            out.append(tr[last:m.start()])
            out.append(new_t)
            last = m.end()
        out.append(tr[last:])
        return ''.join(out), ''


def parse_piece(x):
    try:
        h, mi, ap = parse_time(x)
    except Refuse:
        return (0, 0)
    if ap == 'pm' and h < 12:
        h += 12
    if ap == 'am' and h == 12:
        h = 0
    return h, mi


# ---------------------------------------------------------------- the places
def context(raw, line, old):
    """The words of that line as a reader meets them, around the old words."""
    text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', raw.split('\n')[line - 1]))).strip()
    i = text.find(html.unescape(old).strip())
    if i < 0:   # the words are inside a tag (a link address): show the line as it is written
        row = re.sub(r'\s+', ' ', raw.split('\n')[line - 1]).strip()
        j = row.find(old)
        return row[max(0, j - 40):j + len(old) + 30] if j >= 0 else row[:100]
    return text[max(0, i - 40):i + len(old) + 40].strip()


def find_places(spec, names):
    """[(file, line, old piece, new piece, words around it)] in the files the owner edits, plus a fact name for each when the table of facts knows it."""
    places, texts = [], {}
    for rel in names:
        raw = read(rel)
        if raw is None:
            continue
        texts[rel] = raw
        _, hits = spec.apply(raw)
        for s, e, old, new in hits:
            line = raw.count('\n', 0, s) + 1
            places.append(dict(file=rel, line=line, old=old, new=new, words=context(raw, line, old)))
    return places, texts


def name_places(spec, places):
    """Which fact of tools/check_facts.py each place belongs to (a name, or '')."""
    if not spec.fact_prefix or spec.expected is None:
        return
    files = check_facts.source_files()
    trans = []
    for fact in check_facts.FACTS:
        if not fact['name'].startswith(spec.fact_prefix):
            continue
        for p in check_facts.find_places(fact, files, trans):
            if p['value'] != spec.expected:   # a fact that reads another value on that line (the line holds $31 and $3) is not about these words
                continue
            for q in places:
                if q['file'] == p['file'] and q['line'] == p['line'] and not q.get('fact'):
                    q['fact'] = fact['name']


OTHER_FILES = ['404.html', 'tools/qr_links.json']


def other_files(spec):
    """Files that are not changed by this tool but still hold the old words (tools/qr_links.json: the QR signs carry the address, and python3 tools/make_qr.py makes the print sheets from it)."""
    return [rel for rel in OTHER_FILES if read(rel) and spec.apply(read(rel))[1]]


def translation_texts(spec):
    """English texts that hold the old words: {id: English} for the pages, and the English texts of the scripts."""
    en = json.load(open(os.path.join(ROOT, 'lang', 'en.json'), encoding='utf-8'))
    try:
        js = json.load(open(os.path.join(ROOT, 'lang', 'js-strings.json'), encoding='utf-8'))
    except (OSError, ValueError):
        js = {}
    return {i: t for i, t in en.items() if spec.apply(t)[1]}, {t: f for t, f in js.items() if spec.apply(t)[1]}


# ---------------------------------------------------------------- backup and undo
def backup_names():
    names = set(source_names())
    names |= {os.path.relpath(p, ROOT).replace(os.sep, '/') for p in glob.glob(os.path.join(ROOT, '*.html'))}
    names |= {os.path.relpath(p, ROOT).replace(os.sep, '/') for p in glob.glob(os.path.join(ROOT, 'lang', '**', '*'), recursive=True) if os.path.isfile(p)}
    names |= {n for n in ('sitemap.xml', 'robots.txt', 'js/footer-art.js') if os.path.exists(os.path.join(ROOT, n))}
    return sorted(names)


def make_backup():
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S') + '-%d' % os.getpid()
    folder = os.path.join(BACKUP_ROOT, stamp)
    files = backup_names()
    for rel in files:
        dest = os.path.join(folder, *rel.split('/'))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dest)
    with open(os.path.join(folder, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'root': ROOT, 'files': files}, f)
    old = sorted(d for d in os.listdir(BACKUP_ROOT) if os.path.isdir(os.path.join(BACKUP_ROOT, d)))
    for d in old[:-10]:   # keep the last ten
        shutil.rmtree(os.path.join(BACKUP_ROOT, d), ignore_errors=True)
    return folder


def undo():
    if not os.path.isdir(BACKUP_ROOT):
        raise Refuse('There is no saved copy to go back to.')
    for d in sorted(os.listdir(BACKUP_ROOT), reverse=True):
        mf = os.path.join(BACKUP_ROOT, d, 'manifest.json')
        try:
            with open(mf, encoding='utf-8') as f:
                m = json.load(f)
        except (OSError, ValueError):
            continue
        if os.path.normcase(m.get('root', '')) != os.path.normcase(ROOT):
            continue
        for rel in m['files']:
            shutil.copy2(os.path.join(BACKUP_ROOT, d, *rel.split('/')), os.path.join(ROOT, *rel.split('/')))
        # a lang file or built page that appeared since the copy was made is left alone: it was not touched by this tool
        shutil.rmtree(os.path.join(BACKUP_ROOT, d), ignore_errors=True)
        print('Put back %d files from the copy made on %s. The site is as it was before that change.' % (len(m['files']), re.sub(r'^(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d).*$', r'\1-\2-\3 at \4:\5', d)))
        return 0
    raise Refuse('There is no saved copy for this folder to go back to.')


# ---------------------------------------------------------------- translations
def read_lang(code):
    with open(os.path.join(ROOT, LANGS_DIR, code + '.json'), encoding='utf-8') as f:
        return json.load(f)


def write_lang(code, data):
    write(LANGS_DIR.replace(os.sep, '/') + '/' + code + '.json', json.dumps(data, ensure_ascii=False, indent=1) + '\n')


def insert_after(d, after_key, key, value):
    out = {}
    for k, v in d.items():
        out[k] = v
        if k == after_key:
            out[key] = value
    if key not in out:
        out[key] = value
    return out


def carry_translations(spec, old_ui, old_js, new_en, new_js):
    """For each language: copy the old translation of every changed text, swapped. Returns (written, left) where left = [(code, id or 'js', English, why)]."""
    predicted_ui = {spec.apply(t)[0]: i for i, t in old_ui.items()}
    predicted_js = {spec.apply(t)[0]: t for t in old_js}
    written, left, reviewed = {}, [], []
    codes = sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(ROOT, LANGS_DIR, '*.json')))
    for code in codes:
        data = read_lang(code)
        ui, js = dict(data.get('ui', {})), dict(data.get('js', {}))
        n = 0
        for i, english in new_en.items():
            if i in ui:
                continue
            old_id = predicted_ui.get(english)
            if not old_id:
                continue
            if old_id not in ui:
                left.append((code, i, english, 'the old text had no translation to copy'))
                continue
            tr, why = spec.swap(ui[old_id], old_ui[old_id])
            if tr is None:
                left.append((code, i, english, why))
                continue
            ui = insert_after(ui, old_id, i, tr)
            n += 1
            reviewed.append((code, i, tr))
        for key in new_js:
            if key in js:
                continue
            old_key = next((o for o, nk in ((o, spec.apply(o)[0]) for o in old_js) if nk == key), None)
            if not old_key:
                continue
            if old_key not in js:
                left.append((code, 'js', key, 'the old text had no translation to copy'))
                continue
            tr, why = spec.swap(js[old_key], old_key)
            if tr is None:
                left.append((code, 'js', key, why))
                continue
            js = insert_after(js, old_key, key, tr)
            n += 1
            reviewed.append((code, 'js', tr))
        if n:
            data['ui'], data['js'] = ui, js
            write_lang(code, data)
        written[code] = n
    return written, left, reviewed


# ---------------------------------------------------------------- the whole change
def plan(kind, old, new, only=None):
    old, new = clean(old, 'old', kind), clean(new, 'new', kind)
    if old == new:
        raise Refuse('The old and the new words are the same.')
    spec = Spec(kind, old, new)
    names = source_names()
    places, texts = find_places(spec, names)
    if not places:
        raise Refuse('I found no place that holds "%s" in index.html, pages/*.html, js/content.js or js/features.js. Look at the words in the file (a dash is written &ndash; there) and try again; or ask Claude.' % old)
    name_places(spec, places)
    if only:
        only = clean(only, '--only')
        places = [p for p in places if only.lower() in p['words'].lower() or only.lower() in p['file'].lower()]
        if not places:
            raise Refuse('No place holding "%s" has "%s" next to it.' % (old, only))
    elif spec.fact_prefix in ('price:', 'hours'):
        facts = {p.get('fact', '') for p in places}
        if spec.kind == 'hours':   # a time range of the same hours written in a way the table of facts does not know is the same thing
            facts.discard('')
        if len(facts) > 1:
            raise Refuse('"%s" means more than one thing on the site (%s). Change one at a time with --only WORDS, where WORDS are words next to the place, for example --only "per person". The places are listed below.\n%s'
                         % (old, '; '.join(sorted(f or 'other places' for f in facts)), format_places(places)))
    if len(places) > MAX_PLACES:
        raise Refuse('That is %d places: too many to change in one go. Use longer words that find fewer places, or --only.' % len(places))
    if "'" in new and any(p['file'].startswith('js/') for p in places):
        raise Refuse('The new words hold an apostrophe and one place is in a script (js/), where it would break the file. Use a different spelling, or ask Claude.')
    return spec, places, texts


def format_places(places):
    lines = []
    for p in places:
        lines.append('  %-28s %s%s' % ('%s:%d' % (p['file'], p['line']), p['words'][:90], '   (%s)' % p['fact'] if p.get('fact') else ''))
    return '\n'.join(lines)


def change(kind, old, new, only, yes):
    spec, places, texts = plan(kind, old, new, only)
    files = sorted({p['file'] for p in places})
    print('%s: "%s" -> "%s"' % (kind, spec.old, spec.new))
    print('%d place%s in %d file%s:' % (len(places), '' if len(places) == 1 else 's', len(files), '' if len(files) == 1 else 's'))
    print(format_places(places))
    elsewhere = other_files(spec)
    if elsewhere:
        print('Also holding these words, and NOT changed by this tool: ' + ', '.join(elsewhere) + (' (the QR signs: ask Claude, then python3 tools/make_qr.py, which makes the print sheets again)' if any('qr' in x for x in elsewhere) else ''))
    old_ui, old_js = translation_texts(spec)
    print('Translations to copy and change: %d page text%s and %d script text%s (in es, hi, vi, zh).' % (len(old_ui), '' if len(old_ui) == 1 else 's', len(old_js), '' if len(old_js) == 1 else 's'))
    if not yes:
        print('\nNothing was changed. To do it, run the same command with --yes on the end.')
        return 0
    try:
        import bs4  # noqa: F401  (pages.py needs it; find out now, before any file is changed)
    except ImportError:
        print('\nNothing was changed. This needs the beautifulsoup4 package. Type this once, then run the same command again:\n'
              '    %s -m pip install beautifulsoup4\n'
              '(On Windows type python or py -3 instead of python3. See "Commands on Windows, Mac and Linux" in README.md.)' % ('python3' if os.name != 'nt' else 'python'))
        return 1
    folder = make_backup()
    print('\nA copy of the files is saved in %s (python3 tools/change_fact.py undo puts it back).' % folder)
    chosen = {(p['file'], p['line'], p['old']) for p in places}
    for rel in files:
        raw = texts[rel]
        out, last = [], 0
        _, hits = spec.apply(raw)
        for s, e, o, n in hits:
            if (rel, raw.count('\n', 0, s) + 1, o) in chosen:
                out.append(raw[last:s])
                out.append(n)
                last = e
        out.append(raw[last:])
        write(rel, ''.join(out))
    problems = []
    for script, args in (('pages.py', []), ('i18n.py', ['extract']), ('i18n.py', ['jsstrings'])):
        code, text = run(script, *args)
        if code:
            problems.append('%s %s stopped:\n%s' % (script, ' '.join(args), text.strip()[-600:]))
    if problems:
        print('\n'.join(problems))
        print('\nThe English is changed but the rebuild stopped. Fix what is said above, or put everything back:  python3 tools/change_fact.py undo')
        return 1
    new_en = json.load(open(os.path.join(ROOT, 'lang', 'en.json'), encoding='utf-8'))
    new_js = json.load(open(os.path.join(ROOT, 'lang', 'js-strings.json'), encoding='utf-8'))
    written, left, reviewed = carry_translations(spec, old_ui, old_js, new_en, new_js)
    print('Translations written: ' + ', '.join('%s %d' % (c, n) for c, n in sorted(written.items())) + '.')
    code, text = run('i18n.py', 'build')
    if code:
        print('i18n.py build stopped:\n' + text.strip()[-800:])
        print('\nA translation line it wrote was refused. Put everything back with  python3 tools/change_fact.py undo  and ask Claude.')
        return 1
    for c in sorted(written):
        _, text = run('i18n.py', 'missing', c)
        m = re.search(r'(\d+) missing.*JavaScript: (\d+) missing', text)
        if m and (m.group(1) != '0' or m.group(2) != '0'):
            _, lst = run('i18n.py', 'missing', c, '--list')
            for line in lst.splitlines():
                ui = re.match(r'^(t[0-9a-f]{8}) \| (.*)$', line)
                js = re.match(r'^js \| (.*?)   \(from ', line)
                if ui and not any(x[0] == c and x[1] == ui.group(1) for x in left):
                    left.append((c, ui.group(1), ui.group(2), 'it has no translation'))
                elif js and not any(x[0] == c and x[1] == 'js' and x[2] == js.group(1) for x in left):
                    left.append((c, 'js', js.group(1), 'it has no translation'))
    fcode, ftext = run('check_facts.py', '--brief')
    print()
    if spec.review and reviewed:
        print('Hours changed: have a native speaker read these new lines once (the words for morning, evening and night may need to change):')
        for c, i, tr in reviewed[:40]:
            print('  %s  %s' % (c, re.sub(r'<[^>]+>', '', tr)))
        print()
    elsewhere = other_files(spec)
    if left or fcode or elsewhere:
        print('NOT DONE yet. What is left:')
        for rel in elsewhere:
            print('  %s still holds the old words. This tool does not change it%s' % (rel, ': ask Claude to change it, then run python3 tools/make_qr.py' if 'qr' in rel else ': ask Claude.'))
        for c, i, english, why in left:
            print('  %s  %s | %s   (%s)' % (c, i, re.sub(r'\s+', ' ', english)[:100], why))
        if left:
            print('  Translate each line above: add  "code": "your translation",  to lang/src/<language>.json (under "ui"; a line marked js goes under "js", with the English words as the key),')
            print('  then run  python3 tools/i18n.py build.  README.md, section "Change one sentence and its translations, step by step", has the steps. Claude can do it: send these lines.')
        if fcode:
            print('  check_facts.py still says:')
            print('\n'.join('    ' + x for x in ftext.strip().splitlines()))
        print('  Or put everything back:  python3 tools/change_fact.py undo')
        return 1
    print('Ready. %d place%s changed, translations written, every fact agrees and no text is missing.' % (len(places), '' if len(places) == 1 else 's'))
    print('Next: look at the site (python3 tools/serve.py), then publish (python3 tools/make_deploy_folder.py). To go back:  python3 tools/change_fact.py undo')
    return 0


def main(argv):
    if not argv or any(a in ('-h', '--help') for a in argv):
        print(__doc__)
        return 0 if argv else 2
    yes = '--yes' in argv
    only = None
    rest = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == '--yes':
            pass
        elif a == '--only':
            if i + 1 >= len(argv):
                print('--only needs words after it, for example  --only "per person"')
                return 2
            only = argv[i + 1]
            i += 1
        elif a.startswith('--'):
            print('Not understood: %s. The options are --yes, --only WORDS and --help.' % a)
            return 2
        else:
            rest.append(a)
        i += 1
    try:
        if rest == ['undo']:
            return undo()
        if len(rest) != 3 or rest[0] not in KINDS:
            print('Say what to change, the old words and the new words, for example:  python3 tools/change_fact.py price \'$31\' \'$32\'')
            print('The kinds: ' + ', '.join(KINDS) + ', and  undo.  python3 tools/change_fact.py --help  says more.')
            return 2
        if not os.path.exists(os.path.join(ROOT, 'index.html')):
            print('I cannot find index.html. Run this from the website folder.')
            return 2
        return change(rest[0], rest[1], rest[2], only, yes)
    except Refuse as e:
        print(str(e))
        return 1


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except BrokenPipeError:   # the reader of the output (head, a closed window) went away: stop quietly
        try:
            sys.stdout.close()
        except OSError:
            pass
        sys.exit(1)
