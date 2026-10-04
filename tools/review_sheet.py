#!/usr/bin/env python3
"""Language review kit: a round trip so a friend who speaks the language can correct the site, without editing any JSON.
The owner's page, with the four steps: docs/CHECK_A_LANGUAGE.md.

  python3 tools/review_sheet.py export es          make review/es.xlsx, es.csv, es.html, es-instructions.html and es-message.txt (also hi, zh, vi, or  all)
  python3 tools/review_sheet.py import es FILE     read the corrections your friend wrote and put the good ones into lang/src/es.json
  python3 tools/review_sheet.py import es FILE --dry-run   say what would change, write nothing
  python3 tools/review_sheet.py import es FILE --strict    write nothing at all if any row has to be rejected
  (export does not overwrite a sheet that already has corrections in it, unless you add --force)

Needs Python 3.8 or newer. Nothing to install (it does not use beautifulsoup4, unlike pages.py and i18n.py).

How it works
  export   One row for every text of the site in that language. Columns: id, priority, where, English, current translation, question for you,
           correction (blank), note (blank). A text that appears on several pages is listed once, and `where` names the pages.
           The rows come in three groups, so a friend with 20 minutes does the first group: priority 1 (150 texts: every QR sign line, every text with a price,
           the lines about refunds, rain, pets, allergies and safety that tools/review_notes.json names, and the texts a visitor meets first, from the top of the
           home page down), priority 2 (the next 450) and priority 3 (the rest). Inside a group the order is reading order: the home page first, then the other
           pages, then the texts the page's code writes, then the QR sign wording. "question for you" says what we doubt about a line, what we changed after a
           check, and what differs from the English on purpose (tools/review_notes.json, and tools/i18n_facts_allow.json when it is there).
           Five files, the same bytes every time (no dates, nothing random): review/es.xlsx is the file to send (a "Texts" sheet and a "Read me first" sheet with the
           instructions in the friend's language and in English; the correction and note columns are formatted as text, so Excel cannot turn 9/29 into a date);
           review/es.csv is the same table for programs that cannot open .xlsx (UTF-8 with a byte order mark); review/es.html is the same table for reading or
           printing, with the one-page instructions first; review/es-instructions.html is the one page of instructions alone (to print or attach);
           review/es-message.txt is the e-mail to send with it. The instructions are in tools/review_instructions.json.
           Ids: a page text keeps the site's own id (t and eight letters or digits, the id in lang/en.json); a text the code writes gets j and the same
           kind of fingerprint of its English words; a QR sign line is qr-<sign>-title, qr-<sign>-text, qr-how or qr-also. A text with & shows an ordinary & in the sheet.
  import   Reads a file saved from Excel or Google Sheets (a plain .xlsx, or CSV with commas or semicolons, UTF-8 or UTF-8 with BOM, quoted
           fields, Windows line ends; LibreOffice .ods is refused with the way to save it as .xlsx). Every row with a correction is checked with the same rules the
           tests use: the {placeholders}, <tags>, numbers, prices, times, weekdays, months, names and e-mail addresses of the
           English must still be there. Good corrections are written into lang/src/<code>.json (only the changed lines; one
           atomic write; the order and layout of the file stay). English is never touched. A row that cannot be used is
           reported in plain words (row number, id, what is wrong) and the rest is still applied (unless --strict). Words typed in a column that is not read
           (over the English, over the current translation, in "question for you") on a row with no correction are listed by row, never lost silently.
           QR sign wording goes into tools/qr_links.json. Exit code: 0 all fine, 1 some row was rejected or had words in a column that is not read, 2 the file could not be used.
  Neither command runs the rebuild. At the end import prints the commands to run next.

Drift: the facts check below is a port of differences() in tests/consistency.test.mjs. tests/review-sheet.test.mjs runs both on the
same pairs and fails when they disagree, so the two cannot drift apart unnoticed. NAMES (the names that stay in English) is compared too.
"""
import collections
import csv
import difflib
import hashlib
import html
import io
import json
import os
import re
import stat
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree

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
LANG_DIR = os.path.join(ROOT, 'lang')
SRC_DIR = os.path.join(LANG_DIR, 'src')
QR_FILE = os.path.join(ROOT, 'tools', 'qr_links.json')
OUT_DIR = os.path.join(ROOT, 'review')

LANG_NAMES = {'es': ('Spanish', 'Español', 'es'), 'hi': ('Hindi', 'हिन्दी', 'hi'), 'zh': ('Chinese (Simplified)', '中文', 'zh-Hans'), 'vi': ('Vietnamese', 'Tiếng Việt', 'vi')}
FONTS = {   # the language's own font stack (system fonts only: the review folder has no web fonts)
    'es': 'system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
    'hi': '"Noto Sans Devanagari","Kohinoor Devanagari","Nirmala UI",Mangal,Mukta,system-ui,sans-serif',
    'zh': '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Noto Sans CJK SC",system-ui,sans-serif',
    'vi': 'system-ui,"Segoe UI",Roboto,"Helvetica Neue","Trebuchet MS",Arial,sans-serif',
}
PAGE_NAMES = [('index.html', 'Home page'), ('first-visit.html', 'First visit page'), ('strawberry-picking.html', 'Strawberry picking page'),
              ('pumpkin-patch.html', 'Pumpkin patch page'), ('wise-pie.html', 'Wise Pie page'), ('school-field-trips.html', 'School trips page')]
HEADER = ['id', 'priority', 'where', 'English', 'current translation', 'question for you', 'correction', 'note']   # lowercase "id": a file that starts with capital ID is opened by Excel as a SYLK file
SHEET_NAME, README_NAME = 'Texts', 'Read me first'
PRIORITY_1, PRIORITY_2 = 150, 450   # the number of texts with priority 1 (about 20 minutes) and priority 2 (about an hour); all the others are 3
NOTES_FILE = os.path.join(ROOT, 'tools', 'review_notes.json')
TEXTS_FILE = os.path.join(ROOT, 'tools', 'review_instructions.json')
ALLOW_FILE = os.path.join(ROOT, 'tools', 'i18n_facts_allow.json')
ATTR_WORDS = {'alt': 'photo description', 'aria-label': 'screen-reader label', 'title': 'tooltip', 'placeholder': 'form hint'}
JS_WHERE = {
    'features.js': 'boxes, buttons and messages (this-week box, drive time, signup, farm map, photo viewer, e-mail drafts)',
    'hero.js': 'counters and fun lines in the top scene of the home page',
    'main.js': 'home page extras (goat, flower cup, photo viewer)',
    'season.js': 'season names',
    'live.js': 'open now / closed labels and countdowns',
    'content.js': 'photo descriptions and notices',
    'analytics.js': 'analytics',
}
QR_HOW_EN = 'Point your phone camera at the square.'
QR_ALSO_EN = 'This page is also in:'

# A sheet comes from another person's computer. These limits are far above a real sheet (about 1,400 rows, a few hundred KB) and stop a file that
# would fill the memory: a huge file, or a small .xlsx that unpacks to gigabytes (a "zip bomb").
MAX_FILE_BYTES = 30 * 1024 * 1024
MAX_XLSX_PART_BYTES = 40 * 1024 * 1024
MAX_XLSX_COLUMN, MAX_XLSX_ROW = 16384, 1048576   # the largest cell Excel itself has: XFD1048576
SCREEN_CONTROL = re.compile('[\x00-\x08\x0b-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]')


def on_screen(text):
    """Text from the sheet, made safe to print: control characters (they can change the window title or hide words in a terminal) become ?."""
    return SCREEN_CONTROL.sub('?', str(text))


NOTES_WORDS = ('ok', 'okay', 'good', 'fine', 'correct', 'yes', 'no', 'si', 'sí', 'ok.', 'n/a', 'na', 'none', 'same', 'x', '-', '--', '—', '✓', '✔', '👍')


# ---------------------------------------------------------------------------------------------- small helpers
class Problem(Exception):
    """Something that stops the whole command; the message is for the person typing it."""


NAMED = {'amp': '&', 'lt': '<', 'gt': '>', 'quot': '"', 'apos': "'", 'nbsp': ' ', 'ndash': '\u2013', 'mdash': '\u2014', 'rsquo': '\u2019', 'lsquo': '\u2018', 'ldquo': '\u201c',
         'rdquo': '\u201d', 'hellip': '\u2026', 'middot': '\u00b7', 'copy': '\u00a9', 'times': '\u00d7', 'ntilde': '\u00f1'}


def decode(s):
    """Character references the way the test reads them (tests/consistency.test.mjs: decode)."""
    def one(m):
        e = m.group(1)
        if e[0] == '#':
            try:
                return chr(int(e[2:], 16) if e[1] in 'xX' else int(e[1:]))
            except (ValueError, OverflowError):
                return m.group(0)
        return NAMED.get(e.lower(), m.group(0))
    return re.sub(r'&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);', one, s)


def plain(s):
    """Text without tags, with character references decoded (the test's plain())."""
    return decode(re.sub(r'<[^>]+>', ' ', str(s)))


def words_only(s):
    """For the people-facing messages: plain text on one line."""
    return re.sub(r'\s+', ' ', plain(s)).strip()


def squash(s):
    """Spaces tidied, the curly quotes and long dashes written as plain ones, upper case folded: to ask 'is this the same text?'."""
    s = words_only(s).replace('\u00a0', ' ').replace('\u202f', ' ')
    s = s.replace('\u2019', "'").replace('\u2018', "'").replace('\u201c', '"').replace('\u201d', '"').replace('\u2013', '-').replace('\u2014', '-')
    return s.casefold()


def short(s, n=90):
    s = re.sub(r'\s+', ' ', str(s)).strip()
    return s if len(s) <= n else s[:n - 1].rstrip() + '\u2026'


def js_float(x):
    """String(parseFloat(x)) as JavaScript writes it."""
    m = re.match(r'\s*[+-]?\d+(?:\.\d+)?', x)
    if not m:
        return 'NaN'
    f = float(m.group(0))
    return str(int(f)) if f == int(f) else repr(f)


def sha8(s):
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:8]


def js_id(english):
    return 'j' + sha8(english)


def read_text(path):
    with open(path, 'rb') as f:
        return f.read().decode('utf-8')


def languages():
    return sorted(f[:-5] for f in os.listdir(SRC_DIR) if f.endswith('.json')) if os.path.isdir(SRC_DIR) else []


def need_language(code):
    langs = languages()
    if code not in langs:
        raise Problem("There is no language '%s'. Languages: %s. (To add one, see 'To add a language' in the README.)" % (code, ', '.join(langs)))
    return code


def atomic_write(path, text):
    """Write the whole file or nothing: a temporary file in the same folder, then one rename."""
    folder = os.path.dirname(path) or '.'
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=os.path.basename(path) + '.', suffix='.tmp')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(text.encode('utf-8'))
            f.flush()
            os.fsync(f.fileno())
        if os.path.exists(path):
            os.chmod(tmp, stat.S_IMODE(os.stat(path).st_mode))
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


# ---------------------------------------------------------------------------------------------- the site's texts
class Item(object):
    """One text a translator can correct."""
    __slots__ = ('id', 'kind', 'key', 'english', 'current', 'where', 'group', 'path', 'quiet', 'priority', 'ask')

    def __init__(self, id, kind, key, english, current, where, group, path=None, quiet=False):
        self.id, self.kind, self.key, self.english, self.current, self.where, self.group, self.path = id, kind, key, english, current, where, group, path
        self.quiet = quiet      # a text nobody reads on the screen (screen-reader label, photo description, tooltip, page title)
        self.priority = 3       # 1, 2 or 3: which texts a friend with little time should do first (set by rank_items)
        self.ask = ''           # our own question about this text, shown to the friend (set by rank_items)


class PageScan(HTMLParser):
    """Walks one built page and notes, in reading order, every id (data-t, data-ta-<attribute>) with the heading it sits under."""
    VOID = {'br', 'wbr', 'img', 'hr', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'param', 'use', 'path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'stop'}
    HEADINGS = {'h1', 'h2', 'h3', 'h4'}

    def __init__(self, en):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.en, self.entries, self.stack, self.heading = en, [], [], ''

    def region(self):
        if 'nav' in self.stack:
            return 'menu'
        if 'footer' in self.stack:
            return 'footer'
        return ''

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        tid = a.get('data-t')
        if tid and re.match(r't[0-9a-f]{8}$', tid):
            own = tag in self.HEADINGS
            if own:
                self.heading = words_only(self.en.get(tid, ''))
            label = self.region() or ('a heading' if own else self.heading or 'top of the page')
            self.entries.append((tid, None, label))
        for k, v in attrs:
            if k.startswith('data-ta-') and v and re.match(r't[0-9a-f]{8}$', v):
                self.entries.append((v, k[8:], self.region() or self.heading or 'top of the page'))
        if tag not in self.VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass


class Site(object):
    """Everything the sheet is made from, read from the files of the site folder."""

    def __init__(self, root=ROOT):
        self.root = root
        self.en = json.loads(read_text(os.path.join(LANG_DIR, 'en.json')))
        try:
            self.js_files = json.loads(read_text(os.path.join(LANG_DIR, 'js-strings.json')))
        except (OSError, ValueError):
            self.js_files = {}
        try:
            self.qr = json.loads(read_text(QR_FILE))
        except (OSError, ValueError):
            self.qr = None
        try:
            self.content_js = read_text(os.path.join(ROOT, 'js', 'content.js'))
        except OSError:
            self.content_js = ''
        self._js_text = {}

    # ---- the languages
    def src_path(self, code):
        return os.path.join(SRC_DIR, code + '.json')

    def src(self, code):
        try:
            data = json.loads(read_text(self.src_path(code)))
        except ValueError as e:
            raise Problem('lang/src/%s.json is not valid JSON (%s). Fix that first (python3 tools/i18n.py build says where).' % (code, e))
        data.setdefault('ui', {})
        data.setdefault('js', {})
        return data

    # ---- pages in reading order
    def pages(self):
        names = dict(PAGE_NAMES)
        found = [p for p in sorted(os.listdir(ROOT)) if p.endswith('.html') and p != '404.html']
        order = [p for p, _ in PAGE_NAMES if p in found] + [p for p in found if p not in names]
        return [(p, names.get(p, p[:-5].replace('-', ' ').capitalize() + ' page')) for p in order]

    def scan_pages(self):
        """{id: [(page name, label, attribute or None), ...]} and the ids in order of first appearance."""
        seen, order = collections.OrderedDict(), []
        for fname, pname in self.pages():
            scan = PageScan(self.en)
            scan.feed(read_text(os.path.join(ROOT, fname)))
            for tid, attr, label in scan.entries:
                if tid not in seen:
                    seen[tid] = []
                    order.append(tid)
                occ = (pname, label, attr)
                if occ not in seen[tid]:
                    seen[tid].append(occ)
        return seen, order

    # ---- the texts the code writes
    def js_text(self, fname):
        if fname not in self._js_text:
            try:
                raw = read_text(os.path.join(ROOT, 'js', fname))
            except OSError:
                raw = ''
            self._js_text[fname] = raw.replace('\\u2019', '\u2019').replace('\\u2014', '\u2014').replace('\\u201C', '\u201c').replace('\\u201D', '\u201d').replace("\\'", "'")
        return self._js_text[fname]

    def js_position(self, key, fname):
        text = self.js_text(fname)
        i = text.find(key[:40])
        return i if i >= 0 else 10 ** 9

    def is_photo_description(self, key):
        i = self.content_js.find(key[:40])
        if i < 0:
            i = self.content_js.replace("\\'", "'").find(key[:40])
            text = self.content_js.replace("\\'", "'")
        else:
            text = self.content_js
        return i >= 0 and bool(re.search(r'\balt\s*:\s*["\']?$', text[max(0, i - 40):i]))


def where_text(occ, total_pages):
    """The places of a text in words: 'Home page: Plan your visit; also First visit page: menu'. A marker says what kind of text it is."""
    kinds = []
    for _, _, attr in occ:
        w = ATTR_WORDS.get(attr, attr) if attr else None
        if w and w not in kinds:
            kinds.append(w)
    marker = ''.join('[%s] ' % k for k in kinds)
    pages = []
    for pname, label, _ in occ:
        if pname not in pages:
            pages.append(pname)
    label_of = lambda pname: next(l for p, l, _ in occ if p == pname)
    if len(pages) >= total_pages and total_pages > 1:
        first = 'Every page' + (': ' + label_of(pages[0]) if label_of(pages[0]) else '')
        return marker + first
    first = pages[0] + (': ' + short(label_of(pages[0]), 70) if label_of(pages[0]) else '')
    more = [p + (' (' + short(label_of(p), 40) + ')' if label_of(p) else '') for p in pages[1:]]
    # a text used twice on the same page, in other sections
    same = [short(l, 50) for p, l, _ in occ if p == pages[0] and l and l != label_of(pages[0])]
    out = first + ('; also under: ' + ', '.join(same[:2]) if same else '')
    if more:
        out += '; also on: ' + ', '.join(more[:4]) + (' and %d more' % (len(more) - 4) if len(more) > 4 else '')
    out = marker + out
    return out if len(out) <= 220 else out[:219].rstrip() + '\u2026'


def build_items(site, code):
    """Every text of one language in reading order: [Item]."""
    src = site.src(code)
    items, used = [], set()
    seen, order = site.scan_pages()
    total = len(site.pages())
    js_keys = list(collections.OrderedDict.fromkeys(list(site.js_files.keys()) + list(src['js'].keys())))
    page_of_file = dict(site.pages())

    def js_item(key, where, group, quiet=False):
        return Item(js_id(key), 'js', key, key, src['js'].get(key, ''), where, group, quiet=quiet)

    # page titles and search descriptions come with their page
    titles = collections.defaultdict(list)
    for key in js_keys:
        f = site.js_files.get(key, '')
        if f.endswith('.html'):
            titles[f].append(key)
    n_pages = 0
    for fname, pname in site.pages():
        for key in titles.get(fname, []):
            items.append(js_item(key, '[page title or search description] ' + pname, pname, quiet=True))
            used.add(key)
        for tid in order:
            occ = seen[tid]
            if occ[0][0] != pname or tid in used:
                continue
            used.add(tid)
            if tid not in site.en:
                continue
            seen_on_screen = any(attr is None or attr == 'placeholder' for _, _, attr in occ)
            items.append(Item(tid, 'ui', tid, site.en[tid], src['ui'].get(tid, ''), where_text(occ, total), pname, quiet=not seen_on_screen))
        n_pages += 1
    # ids that no page uses (kept in en.json): at the end of the page texts
    for tid in site.en:
        if tid not in used:
            items.append(Item(tid, 'ui', tid, site.en[tid], src['ui'].get(tid, ''), 'Not found on a page (kept in lang/en.json)', 'Other texts', quiet=True))
    # the texts the code writes, by file, in the order they appear in the file
    rest = [k for k in js_keys if k not in used]
    by_file = collections.defaultdict(list)
    for key in rest:
        by_file[site.js_files.get(key, '')].append(key)
    file_order = ['content.js', 'main.js', 'hero.js', 'season.js', 'live.js', 'features.js']
    for fname in file_order + sorted(f for f in by_file if f not in file_order):
        keys = by_file.get(fname, [])
        keys.sort(key=lambda k: (site.js_position(k, fname) if fname else 10 ** 9, k))
        for key in keys:
            if fname == 'content.js':
                photo = site.is_photo_description(key)
                where = '[photo description] gallery photo' if photo else 'caption or notice in the farm settings (js/content.js)'
            else:
                photo = False
                where = 'page code: ' + JS_WHERE.get(fname, 'other messages')
            items.append(js_item(key, where, 'Text the page\'s code writes', quiet=photo))
    # QR signs
    items.extend(qr_items(site, code))
    seen = collections.Counter(i.id for i in items)
    clash = [k for k, n in seen.items() if n > 1]
    if clash:
        raise Problem('Two texts got the same id (%s), so a correction could not tell them apart. Nothing was made. Tell the developer.' % ', '.join(clash[:3]))
    return items


def qr_items(site, code):
    qr = site.qr
    if not qr:
        return []
    out = []
    group = 'QR signs (printed)'
    if code == 'es':
        for sign in qr.get('signs', []):
            for part in ('title', 'text'):
                out.append(Item('qr-%s-%s' % (sign['id'], part), 'qr', ('signs', sign['id'], part + '_es'), sign.get(part + '_en', ''), sign.get(part + '_es', ''),
                                '[QR sign] "%s": %s' % (sign.get('title_en', ''), 'title on the sign' if part == 'title' else 'line under the title'), group, QR_FILE))
        return out
    block = (qr.get('languages') or {}).get(code)
    if not isinstance(block, dict):
        return out
    out.append(Item('qr-how', 'qr', ('how',), QR_HOW_EN, block.get('how', ''), '[QR sign] the line above the square, on every sign', group, QR_FILE))
    out.append(Item('qr-also', 'qr', ('also',), QR_ALSO_EN, block.get('also', ''), '[QR sign] the line that lists the other languages (on the signs that open the website)', group, QR_FILE))
    for sign in qr.get('signs', []):
        w = (block.get('signs') or {}).get(sign['id'], {})
        for part in ('title', 'text'):
            out.append(Item('qr-%s-%s' % (sign['id'], part), 'qr', ('signs', sign['id'], part), sign.get(part + '_en', ''), w.get(part, ''),
                            '[QR sign] "%s": %s' % (sign.get('title_en', ''), 'title on the sign' if part == 'title' else 'line under the title'), group, QR_FILE))
    return out


# ---------------------------------------------------------------------------------------------- what the friend sees first
def load_json(path, default):
    """A data file of the kit (notes, instructions, the facts allow list). A missing or damaged file is not an error: the sheet is just made without it."""
    try:
        data = json.loads(read_text(path))
    except (OSError, ValueError):
        return default
    return data if isinstance(data, type(default)) else default


def rows_named(items, by_id, raw):
    """The rows a data file means by an id: a page text keeps its id; 'js:English words' is a text the code writes, and may be only the first words of it
    (the facts allow list names it so): every text of the code that starts with those words."""
    raw = str(raw)
    if raw.startswith('js:'):
        return [it for it in items if it.kind == 'js' and it.english.startswith(raw[3:])]
    return [by_id[raw]] if raw in by_id else []


def questions_for(code, items, notes, allow):
    """{id: the text of the 'question for you' cell}: what we changed after a check, what we doubt, what differs from the English on purpose."""
    by_id = {it.id: it for it in items}
    found = collections.OrderedDict()

    def add(i, text):
        if text not in found.setdefault(i, []):
            found[i].append(text)

    def still_there(it, when):
        return not when or squash(when) in squash(it.current)

    for e in notes.get('changed', []):
        it = by_id.get(e.get('id'))
        if e.get('lang') == code and it is not None and still_there(it, e.get('when')):
            add(it.id, 'We changed this line after a check. %s Before it said: “%s” Please tell us if the new line is right.' % (str(e.get('why', '')).strip(), words_only(e.get('before', ''))))
    for e in notes.get('ask', []):
        if e.get('lang') != code:
            continue
        for i in e.get('ids', []):
            it = by_id.get(i)
            if it is not None and still_there(it, e.get('when')):
                add(it.id, str(e.get('ask', '')).strip() + (' We suggest: %s.' % str(e['suggest']).strip().rstrip('.') if e.get('suggest') else ''))
    for e in allow:
        if isinstance(e, dict) and e.get('lang') == code:
            for it in rows_named(items, by_id, e.get('id', '')):
                add(it.id, 'On purpose: %s Tell us if you disagree.' % str(e.get('reason', '')).strip())
    return {i: '\n'.join(v) for i, v in found.items()}


def assign_priority(items, first_ids):
    """1 = do these first (150 texts), 2 = next (450), 3 = the rest. Priority 1 is: every QR sign line (printed, so costly to fix later), every text with a price,
    the hand-picked lines in tools/review_notes.json (refunds, rain, pets, allergies, safety), and then the texts a visitor meets first (the top of the home page
    down), as many as are needed to make 150. Then the rest in reading order."""
    chosen = set()
    for it in items:
        if len(chosen) < PRIORITY_1 and (it.kind == 'qr' or it.id in first_ids or (it.kind == 'ui' and not it.quiet and '$' in it.english)):
            chosen.add(it.id)
    for it in items:
        if len(chosen) >= PRIORITY_1:
            break
        if not it.quiet:
            chosen.add(it.id)
    second = 0
    for it in items:
        if it.id in chosen:
            it.priority = 1
        elif second < PRIORITY_2:
            it.priority = 2
            second += 1
        else:
            it.priority = 3


def rank_items(site, code, items=None):
    """The items of a language in the order the friend gets them: priority 1 first, then 2, then 3, each in reading order; with priority and question filled in."""
    items = build_items(site, code) if items is None else items
    notes = load_json(NOTES_FILE, {})
    assign_priority(items, set(str(i) for i in notes.get('first', [])))
    asks = questions_for(code, items, notes, load_json(ALLOW_FILE, []))
    for it in items:
        it.ask = asks.get(it.id, '')
    return sorted(items, key=lambda it: it.priority)   # a stable sort: reading order inside each priority


def counts_of(items):
    c = collections.Counter(it.priority for it in items)
    return {'N1': c[1], 'N2': c[2], 'N3': c[3]}


def blocks_for(code, counts):
    """[(html lang, {field: text})]: the instructions in the friend's language, then in English, with @LANG@ and the counts filled in."""
    texts = load_json(TEXTS_FILE, {})
    out = []
    for lang_code, html_lang in ((code, LANG_NAMES.get(code, (code, code, code))[2]), ('en', 'en')):
        block = texts.get(lang_code) or texts.get('en') or {}
        fill = lambda v: re.sub(r'@(LANG|N1|N2|N3)@', lambda m: LANG_NAMES.get(code, (code,))[0].split(' (')[0] if m.group(1) == 'LANG' else str(counts.get(m.group(1), '')), v) if isinstance(v, str) else v

        def walk(v):
            if isinstance(v, list):
                return [walk(x) for x in v]
            return fill(v)
        out.append((html_lang, {k: walk(v) for k, v in block.items()}))
    return out


def message_text(code, blocks):
    """The e-mail to paste: subject, then the short message in the friend's language and in English."""
    (_, own), (_, en) = blocks
    subject = own.get('subject', en.get('subject', ''))
    if en.get('subject') and subject != en['subject']:
        subject += '  /  ' + en['subject']
    bodies = []
    for b in (own, en):
        send = (b.get('send') or []) + ['', '']
        bodies.append('\n\n'.join(p for p in (b.get('intro', ''), b.get('time', ''), b.get('open_line', ''), send[0], send[1], b.get('thanks', '')) if p))
    return 'Subject: %s\n\n%s\n\n%s\n\n%s\n' % (subject, bodies[0], '-' * 40, bodies[1])


# ---------------------------------------------------------------------------------------------- writing the sheet
def show(kind, s):
    """A text as a person reads it in the sheet: the page text writes "&" as &amp; in its HTML, the sheet shows an ordinary &."""
    return s.replace('&amp;', '&') if kind == 'ui' else s


def encode_amp(kind, s):
    """The other way, for a correction of a page text (it is HTML): a lone & becomes &amp; (an entity such as &amp; or &#8217; stays)."""
    return re.sub(r'&(?![A-Za-z][A-Za-z0-9]*;|#[0-9]+;|#[xX][0-9a-fA-F]+;)', '&amp;', s) if kind == 'ui' else s


def safe_cell(s):
    """Excel reads a cell that starts with = + - or @ as a formula: a space in front keeps it text (import strips it)."""
    s = str(s).replace('\r\n', '\n').replace('\r', '\n')
    return (' ' + s) if s[:1] in ('=', '+', '-', '@', '\t') else s


def row_cells(it):
    """The cells of one row, in the order of HEADER (priority is a number)."""
    return [it.id, it.priority, it.where, show(it.kind, it.english), show(it.kind, it.current), it.ask, '', '']


def csv_text(items):
    out = io.StringIO(newline='')
    w = csv.writer(out, lineterminator='\r\n', quoting=csv.QUOTE_MINIMAL)
    w.writerow(HEADER)
    for it in items:
        w.writerow([c if isinstance(c, int) else safe_cell(c) for c in row_cells(it)])
    return out.getvalue()


def chips(s):
    """HTML for a cell: the tags of the text (<a1>, <strong>, <svg/>) shown as small labels, the words escaped."""
    parts = re.split(r'(<[^>]+>)', str(s))
    return ''.join('<span class="tag">%s</span>' % html.escape(p) if p.startswith('<') and p.endswith('>') and len(p) > 2 else html.escape(p) for p in parts)


HOW_CSS = '''.how{display:grid;grid-template-columns:repeat(auto-fit,minmax(24em,1fr));gap:18px;max-width:100em;margin:10px 0 22px}
.how section{background:#f6f1e7;border:1px solid #d8cdb5;border-radius:10px;padding:6px 18px 12px}
.how h2{font-size:22px;margin:.6em 0 .3em}
.how h3{font-size:18px;margin:.9em 0 .2em}
.how p,.how li{margin:.25em 0}
.how ol,.how ul{margin:.2em 0;padding-left:1.4em}
table.legend{border-collapse:collapse;font-size:15px}
table.legend th,table.legend td{border:1px solid #cdbf9f;padding:2px 8px;background:#fff;font-weight:normal}
table.legend th{font-weight:bold;white-space:nowrap}
.tag{display:inline-block;font:13px/1.2 ui-monospace,Consolas,monospace;background:#e6eefb;border:1px solid #9ab;border-radius:4px;padding:0 4px;margin:0 1px}'''
HOW_PRINT = ('@page{size:landscape;margin:9mm}body{padding:0;font-size:10px;line-height:1.35}h1{font-size:15px;margin:0 0 4px}.tag{font-size:9px}.how{grid-template-columns:1fr 1fr;gap:8px;margin:4px 0 0}'
             '.how section{padding:0 10px 4px;border-radius:6px}.how h2{font-size:13px;margin:.4em 0 .15em}.how h3{font-size:11px;margin:.45em 0 .1em}.how p,.how li{margin:.1em 0}'
             '.how ol,.how ul{padding-left:1.2em}table.legend{font-size:9px}table.legend th,table.legend td{padding:0 5px}')


def instructions_html(blocks):
    """The one page of instructions: the friend's language and English side by side."""
    cols = []
    for html_lang, b in blocks:
        li = lambda xs: ''.join('<li>%s</li>' % chips(x) for x in xs)
        legend = ''.join('<tr><th scope="row">%s</th><td>%s</td></tr>' % (html.escape(n), html.escape(d)) for n, d in b.get('columns', []))
        cols.append('<section lang="%s"><h2>%s</h2><p>%s</p><h3>%s</h3><p>%s</p><p>%s</p><h3>%s</h3><ol>%s</ol><h3>%s</h3><ul>%s</ul><h3>%s</h3><ul>%s</ul><p><b>%s</b></p>'
                    '<h3>%s</h3><table class="legend">%s</table></section>' % (
                        html_lang, html.escape(b.get('title', '')), html.escape(b.get('intro', '')), html.escape(b.get('time_title', '')), html.escape(b.get('time', '')),
                        html.escape(b.get('open_line', '')), html.escape(b.get('do_title', '')), li(b.get('do', [])), html.escape(b.get('keep_title', '')), li(b.get('keep', [])),
                        html.escape(b.get('send_title', '')), li(b.get('send', [])), html.escape(b.get('thanks', '')), html.escape(b.get('columns_title', '')), legend))
    return '<div class="how">%s</div>' % ''.join(cols)


def html_text(code, items, blocks=None, counts=None):
    name, own, html_lang = LANG_NAMES.get(code, (code, code, code))
    counts = counts or counts_of(items)
    blocks = blocks or blocks_for(code, counts)
    tiers = blocks[0][1].get('tiers', []), blocks[1][1].get('tiers', [])
    tier_name = lambda p: ' / '.join(t[p - 1] for t in tiers if len(t) >= p) or 'Priority %d' % p
    rows, group, n = [], None, 1
    for it in items:
        n += 1
        if (it.priority, it.group) != group:
            group = (it.priority, it.group)
            rows.append('<tr class="group p%d"><th colspan="9"><span class="tier">%s</span> %s</th></tr>' % (it.priority, html.escape(tier_name(it.priority)), html.escape(it.group)))
        rows.append('<tr class="p%d"><td class="n">%d</td><td class="n">%d</td><td class="id">%s</td><td class="where">%s</td><td lang="en">%s</td><td lang="%s">%s</td><td class="ask">%s</td><td class="write"></td><td class="write"></td></tr>'
                    % (it.priority, n, it.priority, html.escape(it.id), html.escape(it.where), chips(show(it.kind, it.english)), html_lang, chips(show(it.kind, it.current)),
                       '<br>'.join(html.escape(x) for x in it.ask.split('\n')) if it.ask else ''))
    font = FONTS.get(code, FONTS['es'])
    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Wise Acres: check the %(name)s text</title>
<style>
body{margin:0;padding:18px 22px;font:18px/1.5 system-ui,"Segoe UI",Roboto,Arial,sans-serif;color:#222;background:#fff}
h1{font-size:28px;margin:0 0 6px}
%(how_css)s
table.main{border-collapse:collapse;width:100%%;table-layout:fixed;font-size:18px}
table.main th,table.main td{border:1px solid #999;padding:8px 10px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
thead th{background:#eee;font-size:16px}
tr.group th{background:#f1e7cf;font-size:21px;padding:12px 10px}
tr.group.p1 th{background:#f7dd9a}
tr.group.p3 th{background:#e9e4d8}
.tier{display:inline-block;margin-right:10px;padding:0 8px;border-radius:5px;background:#fff8}
td.n,td.id{font:14px/1.3 ui-monospace,Consolas,monospace;color:#555}
td.where{font-size:15px;color:#444}
td[lang="%(html_lang)s"]{font-family:%(font)s;font-size:20px;line-height:1.6}
td.ask{background:#fff6dc;font-size:15px}
td.write{height:3.6em}
@media print{%(how_print)s.how{break-after:page}.how+p{display:none}table.main{font-size:12px}td[lang="%(html_lang)s"]{font-size:14px}thead{display:table-header-group}tr{break-inside:avoid}}
</style>
</head>
<body>
<h1>Wise Acres website: please check the %(name)s text (%(own)s)</h1>
%(how)s
<p>This table is the same content as the Excel sheet, for reading or printing. Type your corrections in the Excel sheet (or write them on a printout and send a photo): the %(code)s.xlsx file is the one to send back.</p>
<table class="main">
<colgroup><col style="width:3%%"><col style="width:3%%"><col style="width:7%%"><col style="width:10%%"><col style="width:16%%"><col style="width:20%%"><col style="width:15%%"><col style="width:16%%"><col style="width:10%%"></colgroup>
<thead><tr><th scope="col">row</th><th scope="col">priority</th><th scope="col">id</th><th scope="col">where</th><th scope="col">English</th><th scope="col">current %(name)s</th><th scope="col">question for you</th><th scope="col">correction</th><th scope="col">note</th></tr></thead>
<tbody>
%(rows)s
</tbody>
</table>
</body>
</html>
''' % {'name': name, 'own': own, 'html_lang': html_lang, 'font': font, 'rows': '\n'.join(rows), 'code': code, 'how': instructions_html(blocks), 'how_css': HOW_CSS, 'how_print': HOW_PRINT}


def instructions_page(code, blocks):
    """The one page of instructions alone (to attach, to print): the same words as the top of the table page and the "Read me first" sheet."""
    name, own, _ = LANG_NAMES.get(code, (code, code, code))
    return '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Wise Acres: how to check the %(name)s text</title>
<style>
body{margin:0;padding:18px 22px;font:18px/1.5 system-ui,"Segoe UI",Roboto,Arial,sans-serif;color:#222;background:#fff}
h1{font-size:28px;margin:0 0 6px}
%(how_css)s
@media print{%(how_print)s}
</style>
</head>
<body>
<h1>Wise Acres website: please check the %(name)s text (%(own)s)</h1>
%(how)s
</body>
</html>
''' % {'name': name, 'own': own, 'how': instructions_html(blocks), 'how_css': HOW_CSS, 'how_print': HOW_PRINT}


# ---- the Excel file, written with the standard library (a zip of XML files), the same bytes every time
XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
WIDTHS = [11, 9, 30, 46, 46, 42, 50, 30]   # the width of each column of HEADER, in characters
# cell styles (indexes into cellXfs in STYLES): 0 plain, 1 header, 2 text, 3 grey small (id), 4 correction (text format, yellow), 5 question with words in it (orange), 6 note (text format),
# 7 title, 8 paragraph, 9 heading, 10 / 11 / 12 priority 1 (bold, green) / 2 (blue) / 3 (grey), centred
STYLES = XML_HEAD + (
    '<styleSheet xmlns="%s">'
    '<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>'
    '<font><b/><sz val="16"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font></fonts>'
    '<fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF9DB"/><bgColor indexed="64"/></patternFill></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFE9B3"/><bgColor indexed="64"/></patternFill></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFC6E0B4"/><bgColor indexed="64"/></patternFill></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill></fills>'
    '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>'
    '<border><left style="thin"><color rgb="FFBBBBBB"/></left><right style="thin"><color rgb="FFBBBBBB"/></right><top style="thin"><color rgb="FFBBBBBB"/></top><bottom style="thin"><color rgb="FFBBBBBB"/></bottom><diagonal/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="13">'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
    '<xf numFmtId="0" fontId="1" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'
    '<xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'
    '<xf numFmtId="0" fontId="2" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>'
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>') % NS_MAIN


def xml_text(s):
    return html.escape(re.sub('[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]', '', str(s)), quote=False)


class SharedStrings(object):
    def __init__(self):
        self.index, self.items, self.refs = {}, [], 0

    def cell(self, ref, style, value):
        if isinstance(value, int):
            return '<c r="%s" s="%d"><v>%d</v></c>' % (ref, style, value)
        self.refs += 1
        if value not in self.index:
            self.index[value] = len(self.items)
            self.items.append(value)
        return '<c r="%s" s="%d" t="s"><v>%d</v></c>' % (ref, style, self.index[value])

    def xml(self):
        return XML_HEAD + '<sst xmlns="%s" count="%d" uniqueCount="%d">%s</sst>' % (
            NS_MAIN, self.refs, len(self.items), ''.join('<si><t xml:space="preserve">%s</t></si>' % xml_text(s) for s in self.items))


def xlsx_bytes(code, items, blocks=None):
    """The sheet as an .xlsx file: 'Texts' (the table, first, so a file saved again still imports) and 'Read me first' (the instructions; the file opens on it)."""
    counts = counts_of(items)
    blocks = blocks or blocks_for(code, counts)
    ss = SharedStrings()
    letters = 'ABCDEFGH'
    last = len(items) + 1
    rows = ['<row r="1" ht="32" customHeight="1">%s</row>' % ''.join(ss.cell('%s1' % letters[i], 1, h) for i, h in enumerate(HEADER))]
    for n, it in enumerate(items, start=2):
        v = [c if isinstance(c, int) else c.replace('\r\n', '\n').replace('\r', '\n') for c in row_cells(it)]
        cells = [ss.cell('A%d' % n, 3, v[0]), ss.cell('B%d' % n, 9 + int(v[1]), v[1]), ss.cell('C%d' % n, 2, v[2]), ss.cell('D%d' % n, 2, v[3]), ss.cell('E%d' % n, 2, v[4])]
        if v[5]:
            cells.append(ss.cell('F%d' % n, 5, v[5]))
        rows.append('<row r="%d">%s</row>' % (n, ''.join(cells)))
    cols = ''.join('<col min="%d" max="%d" width="%d" customWidth="1"%s/>' % (i + 1, i + 1, w, {5: ' style="6"', 6: ' style="4"', 7: ' style="6"'}.get(i, '')) for i, w in enumerate(WIDTHS))
    texts_sheet = (XML_HEAD + '<worksheet xmlns="%s"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:H%d"/>'
                   '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="G2" sqref="G2"/></sheetView></sheetViews>'
                   '<sheetFormatPr defaultRowHeight="15"/><cols>%s</cols><sheetData>%s</sheetData><autoFilter ref="A1:H%d"/>'
                   '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>'
                   % (NS_MAIN, last, cols, ''.join(rows), last))
    # the instructions: the friend's language, then English, one paragraph per row
    lines = []
    for k, (_, b) in enumerate(blocks):
        if k:
            lines.append((8, ''))
        lines.append((7, b.get('title', '')))
        lines.append((8, b.get('intro', '')))
        lines.append((9, b.get('time_title', '')))
        lines.append((8, b.get('time', '')))
        lines.append((8, b.get('open_line', '')))
        lines.append((9, b.get('do_title', '')))
        lines.extend((8, '%d. %s' % (i, x)) for i, x in enumerate(b.get('do', []), start=1))
        lines.append((9, b.get('keep_title', '')))
        lines.extend((8, '• ' + x) for x in b.get('keep', []))
        lines.append((9, b.get('send_title', '')))
        lines.extend((8, '• ' + x) for x in b.get('send', []))
        lines.append((9, b.get('thanks', '')))
        lines.append((9, b.get('columns_title', '')))
        lines.extend((8, '%s: %s' % (n, d)) for n, d in b.get('columns', []))
    body = ''.join('<row r="%d">%s</row>' % (i, ss.cell('A%d' % i, st, t)) if t else '<row r="%d"/>' % i for i, (st, t) in enumerate(lines, start=1))
    readme_sheet = (XML_HEAD + '<worksheet xmlns="%s"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:A%d"/><sheetViews><sheetView tabSelected="1" workbookViewId="0" showGridLines="0"/></sheetViews>'
                    '<sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="100" customWidth="1"/></cols><sheetData>%s</sheetData>'
                    '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup orientation="portrait" fitToWidth="1" fitToHeight="0"/></worksheet>'
                    % (NS_MAIN, len(lines), body))
    files = [
        ('[Content_Types].xml', XML_HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
         '<Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
         '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
         '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
         '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
         '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>'),
        ('_rels/.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" '
         'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        ('xl/workbook.xml', XML_HEAD + '<workbook xmlns="%s" xmlns:r="%s"><bookViews><workbookView activeTab="1"/></bookViews><sheets><sheet name="%s" sheetId="1" r:id="rId1"/>'
         '<sheet name="%s" sheetId="2" r:id="rId2"/></sheets></workbook>' % (NS_MAIN, NS_REL, SHEET_NAME, README_NAME)),
        ('xl/_rels/workbook.xml.rels', XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
         '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
         '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
         '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
         '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>'),
        ('xl/styles.xml', STYLES),
        ('xl/worksheets/sheet1.xml', texts_sheet),
        ('xl/worksheets/sheet2.xml', readme_sheet),
        ('xl/sharedStrings.xml', ss.xml()),
    ]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_STORED) as z:   # stored, not compressed, with a fixed date: the same bytes on every computer
        for name, text in files:
            info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 3
            info.external_attr = 0o644 << 16
            z.writestr(info, text.encode('utf-8'))
    return buf.getvalue()


def has_work(path, code):
    """True when a sheet that is already there has corrections or notes written in it (a new export would wipe them out)."""
    if not os.path.exists(path):
        return False
    try:
        rows, _ = read_sheet(path, code)
    except Problem:
        return False
    return any(rec['correction'].strip() or rec['note'].strip() for _, rec, _ in rows)


def write_file(path, data):
    with open(path, 'wb') as f:
        f.write(data)


def cmd_export(site, which, out_dir, force=False):
    codes = languages() if which == 'all' else [need_language(which)]
    os.makedirs(out_dir, exist_ok=True)
    result, made = 0, []
    rel = lambda p: os.path.relpath(p, ROOT)
    for code in codes:
        target = os.path.join(out_dir, code + '.csv')
        busy = [t for t in (os.path.join(out_dir, code + '.xlsx'), target) if not force and has_work(t, code)]
        if busy:
            print('%s: NOT made. %s already has corrections or notes in it, and a new sheet would wipe them out. Import it first (python3 tools/review_sheet.py import %s %s --dry-run),'
                  ' or move it somewhere else, or add --force.' % (code, rel(busy[0]), code, rel(busy[0])))
            result = 1
            continue
        items = rank_items(site, code)
        counts = counts_of(items)
        blocks = blocks_for(code, counts)
        write_file(os.path.join(out_dir, code + '.xlsx'), xlsx_bytes(code, items, blocks))
        write_file(target, b'\xef\xbb\xbf' + csv_text(items).encode('utf-8'))
        write_file(os.path.join(out_dir, code + '.html'), html_text(code, items, blocks, counts).encode('utf-8'))
        write_file(os.path.join(out_dir, code + '-message.txt'), message_text(code, blocks).encode('utf-8'))
        write_file(os.path.join(out_dir, code + '-instructions.html'), instructions_page(code, blocks).encode('utf-8'))
        kinds = collections.Counter(i.kind for i in items)
        made.append(code)
        print('%s: %d rows (%d page texts, %d texts the code writes, %d QR sign lines; priority 1: %d, 2: %d, 3: %d; %d questions) -> %s, %s, %s, %s, %s' % (
            code, len(items), kinds['ui'], kinds['js'], kinds['qr'], counts['N1'], counts['N2'], counts['N3'], sum(1 for i in items if i.ask),
            rel(os.path.join(out_dir, code + '.xlsx')), rel(target), rel(os.path.join(out_dir, code + '.html')), rel(os.path.join(out_dir, code + '-message.txt')),
            rel(os.path.join(out_dir, code + '-instructions.html'))))
    if made:
        c = made[0]
        print()
        print('Send the .xlsx file to your friend, with the text in the -message.txt file as the e-mail (it opens in Excel, Numbers, Google Sheets and LibreOffice;'
              ' the -instructions.html page is the one page of instructions alone, to print or attach; the .csv is the same table for programs that cannot open .xlsx;'
              ' the .html is the same table, with the instructions, for reading or printing).')
        print('Ask your friend to write corrections in the "correction" column only and to send the saved file back. When it comes back, put it in the review folder and run:')
        print('    python3 tools/review_sheet.py import %s review/FILE-YOUR-FRIEND-SENT --dry-run' % c)
    return result


# ---------------------------------------------------------------------------------------------- reading the sheet
def decode_file(raw, code):
    """The text of a file saved by Excel, Google Sheets, Numbers or LibreOffice, and a warning when it had to be guessed."""
    warn = []
    if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
        return raw.decode('utf-16'), warn
    if raw[:3] == b'\xef\xbb\xbf':
        raw = raw[3:]
    try:
        return raw.decode('utf-8'), warn
    except UnicodeDecodeError:
        pass
    if code == 'es':
        warn.append('The file was not saved as UTF-8 (it looks like the older Windows format). Accents and \u00f1 are read correctly, but next time choose "CSV UTF-8" in Excel.')
        return raw.decode('cp1252', 'replace'), warn
    raise Problem('This file was not saved as UTF-8, so the %s letters are lost. Nothing was changed.\n'
                  '  In Excel: File > Save As > "CSV UTF-8 (Comma delimited)", then send the new file. (Plain "CSV" and "CSV (Macintosh)" lose these letters.)' % LANG_NAMES.get(code, (code,))[0])


def split_records(text, delim):
    return [r for r in csv.reader(io.StringIO(text, newline=''), delimiter=delim, quotechar='"', doublequote=True, skipinitialspace=False)]


def find_header(row):
    names = [re.sub(r'\s+', ' ', c.replace('\ufeff', '').strip()).casefold() for c in row]
    idx = {}
    for i, n in enumerate(names):
        for want, aliases in (('id', ('id',)), ('where', ('where',)), ('english', ('english',)), ('current', ('current translation', 'current', 'translation')),
                              ('ask', ('question for you', 'question', 'questions')), ('correction', ('correction', 'corrections')), ('note', ('note', 'notes', 'comment'))):
            if n in aliases and want not in idx:
                idx[want] = i
    return idx


def read_csv_rows(raw, code):
    """[(row number as Excel counts it, {column: text})], warnings."""
    text, warn = decode_file(raw, code)
    text = text.lstrip('\ufeff')
    if text.startswith('\u00ef\u00bb\u00bf'):   # a byte order mark that a program turned into three letters
        text = text[3:]
    best = None
    too_big = False
    for delim in (',', ';', '\t'):
        try:
            recs = split_records(text, delim)
        except csv.Error as e:
            too_big = too_big or 'field larger than field limit' in str(e)
            continue
        if not recs:
            continue
        idx = find_header(recs[0])
        if 'id' in idx and 'correction' in idx:
            best = (delim, recs, idx)
            break
    if best is None and too_big:
        raise Problem('A cell in this file is longer than %d letters, so it is not a sheet made by `export`. Nothing was changed.' % csv.field_size_limit())
    if best is None:
        raise Problem('This file has no header row with the columns "id" and "correction", so it is not a sheet made by `export` (or the first row was deleted). Nothing was changed.')
    delim, recs, idx = best
    rows = []
    for n, rec in enumerate(recs[1:], start=2):
        if not any(c.strip() for c in rec):
            continue
        get = lambda k: (rec[idx[k]] if k in idx and idx[k] < len(rec) else '')
        cells = {k: get(k) for k in ('id', 'where', 'english', 'current', 'correction', 'note')}
        cells['ask'] = get('ask') if 'ask' in idx else None   # None: this sheet has no such column (a sheet made before it existed)
        rows.append((n, cells, {}))
    return rows, warn


def read_xlsx_rows(raw, code):
    """The first sheet of an .xlsx file, read with the standard library. Numbers and dates are marked, because a correction is always text.
    A file that is not a real Excel file (broken, or made to use up the memory) gives a plain message, never a Python error."""
    try:
        return read_xlsx_unsafe(raw, code)
    except Problem:
        raise
    except (zipfile.BadZipFile, zipfile.LargeZipFile, ElementTree.ParseError, ValueError, KeyError, IndexError, OverflowError, RuntimeError, NotImplementedError, EOFError, OSError, MemoryError):
        raise Problem('This file could not be read as an Excel file (it is damaged, or it is not a sheet made by `export`). Save it again as "CSV UTF-8 (Comma delimited)" and send that. Nothing was changed.')


def xlsx_part(z, name):
    """One file inside the .xlsx, refused when it unpacks to more than MAX_XLSX_PART_BYTES or holds a DOCTYPE (an Excel file never does; it is how
    an "entity bomb" is made)."""
    if z.getinfo(name).file_size > MAX_XLSX_PART_BYTES:
        raise Problem('This Excel file unpacks to more than %d MB, which no real sheet does. Nothing was changed. Save the sheet as "CSV UTF-8 (Comma delimited)" and send that.' % (MAX_XLSX_PART_BYTES // 1048576))
    data = z.read(name)
    if b'<!DOCTYPE' in data[:4096].upper() or b'<!ENTITY' in data[:65536].upper():
        raise Problem('This Excel file has a part that no Excel file has (a DOCTYPE), so it was not read. Nothing was changed. Save the sheet as "CSV UTF-8 (Comma delimited)" and send that.')
    return data


def read_xlsx_unsafe(raw, code):
    ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    try:
        z = zipfile.ZipFile(io.BytesIO(raw))
    except zipfile.BadZipFile:
        raise Problem('This file could not be read as an Excel file. Save it again as "CSV UTF-8 (Comma delimited)" and send that. Nothing was changed.')
    names = z.namelist()
    shared = []
    if 'xl/sharedStrings.xml' in names:
        root = ElementTree.fromstring(xlsx_part(z, 'xl/sharedStrings.xml'))
        for si in root.findall('m:si', ns):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % ns['m'])))
    sheets = sorted(n for n in names if re.match(r'xl/worksheets/sheet\d+\.xml$', n))
    if not sheets:
        raise Problem('This Excel file has no sheet. Nothing was changed.')
    sheet = ElementTree.fromstring(xlsx_part(z, sheets[0]))
    grid = {}
    kinds = {}
    for row in sheet.iter('{%s}row' % ns['m']):
        for c in row.findall('m:c', ns):
            ref = c.get('r', '')
            m = re.match(r'([A-Z]+)(\d+)$', ref)
            if not m:
                continue
            col = 0
            for ch in m.group(1):
                col = col * 26 + (ord(ch) - 64)
            r = int(m.group(2))
            if col > MAX_XLSX_COLUMN or r > MAX_XLSX_ROW:   # a cell farther out than Excel has: the sheet would be padded to billions of cells
                raise Problem('This Excel file has a cell (%s) outside the sheet Excel can make, so it was not read. Nothing was changed.' % on_screen(ref[:12]))
            t = c.get('t', 'n')
            v = c.find('m:v', ns)
            if t == 's' and v is not None:
                val = shared[int(v.text)] if 0 <= int(v.text) < len(shared) else ''
            elif t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter('{%s}t' % ns['m']))
            elif v is not None:
                val = v.text or ''
            else:
                val = ''
            grid[(r, col - 1)] = val
            kinds[(r, col - 1)] = t
    if not grid:
        raise Problem('This Excel file is empty. Nothing was changed.')
    maxcol = max(c for _, c in grid) + 1
    first = [grid.get((1, c), '') for c in range(maxcol)]
    idx = find_header(first)
    if 'id' not in idx or 'correction' not in idx:
        raise Problem('This file has no header row with the columns "id" and "correction", so it is not a sheet made by `export`. Nothing was changed.')
    rows = []
    for r in sorted({r for r, _ in grid if r > 1}):
        rec = {k: grid.get((r, idx[k]), '') for k in ('id', 'where', 'english', 'current', 'correction', 'note', 'ask') if k in idx}
        for k in ('id', 'where', 'english', 'current', 'correction', 'note'):
            rec.setdefault(k, '')
        rec.setdefault('ask', None)   # None: this sheet has no such column
        if not any(str(v or '').strip() for v in rec.values()):
            continue
        flags = {}
        # a number, a date: only when the cell holds a value (an empty cell that has a colour or a format is not a number: Excel and LibreOffice write those)
        if 'correction' in idx and kinds.get((r, idx['correction']), 's') in ('n', 'd', 'b', 'e') and str(grid.get((r, idx['correction']), '')).strip() != '':
            flags['number_cell'] = True
        rows.append((r, rec, flags))
    return rows, []


def read_sheet(path, code):
    try:
        if os.path.exists(path) and not os.path.isfile(path):   # a folder, or something like /dev/zero that never ends (a file that is not there gets the message below)
            raise Problem('%s is not a file, so there is nothing to read. Give the sheet your friend sent back (a .csv or .xlsx file). Nothing was changed.' % on_screen(path))
        if os.path.isfile(path) and os.path.getsize(path) > MAX_FILE_BYTES:
            raise Problem('%s is %d MB. A sheet is well under 1 MB, so this is not a sheet made by `export`. Nothing was changed.' % (on_screen(path), os.path.getsize(path) // 1048576))
        with open(path, 'rb') as f:
            raw = f.read(MAX_FILE_BYTES + 1)
    except OSError as e:
        raise Problem('Cannot read %s: %s' % (on_screen(path), e.strerror or e))
    if raw[:4] == b'PK\x03\x04':
        if b'application/vnd.oasis.opendocument.spreadsheet' in raw[:300]:
            raise Problem('This is a LibreOffice / OpenDocument (.ods) file, which this tool does not read. Open it and use File > Save As > Excel (.xlsx) or "CSV UTF-8 (Comma delimited)", and use that file. Nothing was changed.')
        return read_xlsx_rows(raw, code)
    if raw[:8] == b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1':
        raise Problem('This is an old Excel (.xls) file. Please save it as "CSV UTF-8 (Comma delimited)" and send that. Nothing was changed.')
    if not raw.strip():
        raise Problem('The file is empty. Nothing was changed.')
    return read_csv_rows(raw, code)


# ---------------------------------------------------------------------------------------------- the rules (the site's own)
NAMES = ['Wise Acres', 'Wise Pie', 'The GreenHouse', 'Hartis', 'Poplin', 'Waxhaw Creamery', 'Uno Alla Volta', 'Follow Your Heart', 'Wholly Wholesome', 'Foster Village', 'Cathy', 'Pranee', 'Vanessa', 'Ava', 'Bailey', 'Morgan', 'Mac']
MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MONTH = {
    'es': ['enero|ene', 'febrero|feb', 'marzo|mar', 'abril|abr', 'mayo|may', 'junio|jun', 'julio|jul', 'agosto|ago', 'septiembre|setiembre|sep|sept', 'octubre|oct', 'noviembre|nov', 'diciembre|dic'],
    'hi': ['\u091c\u0928|Jan', '\u092b\u093c\u0930|\u092b\u0930|Feb', '\u092e\u093e\u0930\u094d\u091a|Mar', '\u0905\u092a\u094d\u0930\u0948|Apr', '\u092e\u0908|May', '\u091c\u0942\u0928|Jun', '\u091c\u0941\u0932|Jul', '\u0905\u0917|Aug', '\u0938\u093f\u0924|Sep',
           '\u0905\u0915\u094d\u091f\u0942|\u0905\u0915\u094d\u0924\u0942|Oct', '\u0928\u0935|Nov', '\u0926\u093f\u0938|Dec'],
}
WEEKDAY = {
    'es': ['domingo|dom', 'lunes|lun', 'martes', 'mi[e\u00e9]rcoles|mi[e\u00e9]', 'jueves|jue', 'viernes|vie', 's[a\u00e1]bado|s[a\u00e1]b'],
    'hi': ['\u0930\u0935\u093f', '\u0938\u094b\u092e', '\u092e\u0902\u0917\u0932', '\u092c\u0941\u0927', '\u0917\u0941\u0930\u0941', '\u0936\u0941\u0915\u094d\u0930', '\u0936\u0928\u093f'],
    'vi': ['ch\u1ee7 nh\u1eadt', 'th\u1ee9 hai', 'th\u1ee9 ba', 'th\u1ee9 t\u01b0', 'th\u1ee9 n\u0103m', 'th\u1ee9 s\u00e1u', 'th\u1ee9 b\u1ea3y'],
}
LETTER = '[^\\W\\d_]'
WEDGE = {'es': ('(?<!' + LETTER + ')', '\\.?(?!' + LETTER + ')'), 'vi': ('(?<!' + LETTER + ')(?<!b\u00ean )', '(?!' + LETTER + ')'), 'hi': ('', '')}
ZHDAY = '\u65e5\u4e00\u4e8c\u4e09\u56db\u4e94\u516d'
DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
DEV = dict(zip('\u0966\u0967\u0968\u0969\u096a\u096b\u096c\u096d\u096e\u096f', '0123456789'))
ALLOWED_EXTRA = [(re.compile(r'700-degree'), '370')]   # 700 \u00b0F, and the translator adds the Celsius figure
SAME_HOURS = re.compile(r'\b[ap]\.?m\b|\d:\d\d| to \d|\d ?[\u2013-] ?\d', re.I | re.A)
A = re.A


def weekdays(s, lang):
    out = []
    if lang == 'en':
        for m in re.finditer(r'(?<![A-Za-z])(Sun|Mon|Tue|Wed|Thu|Fri|Sat)(?:[a-z]*day)?s?(?![a-z])', s):
            out.append(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].index(m.group(1)))
        return sorted(out)
    if lang == 'zh':
        for m in re.finditer('(?:\u5468|\u661f\u671f)([\u65e5\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u5929])', s):
            out.append(0 if m.group(1) == '\u5929' else ZHDAY.index(m.group(1)))
        return sorted(out)
    pre, post = WEDGE[lang]
    for d, names in enumerate(WEEKDAY[lang]):
        for _ in re.finditer(pre + '(?:' + names + ')' + post, s, re.I):
            out.append(d)
    return sorted(out)


def months(s, lang):
    out = []
    if lang == 'en':
        for m in re.finditer(r'(?<![A-Za-z])(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b', s, A):
            out.append([i for i, x in enumerate(MONTH_EN) if x.startswith(m.group(1)[:3])][0] + 1)
        return sorted(out)
    if lang in ('zh', 'vi'):
        return out
    for i, names in enumerate(MONTH[lang]):
        rx = re.compile('(?<![A-Za-z\u00c0-\u00ff])(?:' + names + ')\\.?(?![A-Za-z\u00c0-\u00ff])', re.I) if lang == 'es' else re.compile(names)
        out.extend([i + 1] * len(rx.findall(s)))
    return sorted(out)


def numbers(s):
    s = re.sub('[\u0966-\u096f]', lambda m: DEV[m.group(0)], s)
    s = re.sub(r':00\b', '', s, flags=A)
    s = re.sub(r'(?<=[0-9])[,\u202f.](?=[0-9]{3}\b)', '', s, flags=A)
    s = re.sub(r'(?<=[0-9]),(?=[0-9]{1,2}\b)', '.', s, flags=A)
    return [js_float(x) for x in re.findall(r'[0-9]+(?:\.[0-9]+)?', s)]


def money_of(s):
    return sorted(js_float(re.sub(r'[$,\s]', '', x)) for x in re.findall(r'\$\s?[0-9][0-9,]*(?:\.[0-9]+)?', s))


def percent_of(s):
    return sorted(js_float(x.replace(',', '.')) for x in re.findall(r'[0-9]+(?:[.,][0-9]+)?\s?%', s))


def differences(en, tr, lang):
    """What differs between an English text and its translation (an empty list = the same). A port of differences() in tests/consistency.test.mjs."""
    e, t, out = plain(en), plain(tr), []
    e_money, t_money = money_of(e), money_of(t)
    if ' '.join(e_money) != ' '.join(t_money):
        out.append('prices %s vs %s' % (' '.join(e_money) or '-', ' '.join(t_money) or '-'))
    e_pct, t_pct = percent_of(e), percent_of(t)
    if ' '.join(e_pct) != ' '.join(t_pct):
        out.append('percent %s vs %s' % (' '.join(e_pct) or '-', ' '.join(t_pct) or '-'))
    e_months, t_months = months(e, 'en'), months(t, lang)
    want, have = numbers(e), numbers(t)
    if lang in ('zh', 'vi'):
        for mo in e_months:
            want.append(str(mo))
    if lang in ('es', 'hi'):
        for m in re.finditer(r'(?<![0-9/])([0-9]{1,2})/([0-9]{1,2})(?![0-9/])', e):
            k = str(int(m.group(1)))
            if k in want and int(m.group(1)) in t_months:
                want.remove(k)
    missing = []
    for x in want:
        if x in have:
            have.remove(x)
            continue
        alt = str(int(x) + 12) if SAME_HOURS.search(e) and x.isdigit() and 1 <= int(x) <= 12 else None
        if alt is not None and alt in have:
            have.remove(alt)
            continue
        missing.append(x)
    extra = [x for x in have if x not in want and not any(rx.search(e) and v == x for rx, v in ALLOWED_EXTRA)]
    if missing:
        out.append('number ' + ', '.join(missing) + ' is not in the translation')
    if extra:
        out.append('number ' + ', '.join(extra) + ' is not in the English')
    if lang in ('es', 'hi'):
        miss = [mo for mo in e_months if mo not in t_months]
        if miss:
            out.append('month ' + ', '.join(MONTH_EN[x - 1] for x in miss) + ' is not in the translation')
    e_days, t_days = weekdays(e, 'en'), weekdays(t, lang)
    if e_days != t_days:
        names = lambda a: ' '.join(DAYS[d][:3] for d in a) or '-'
        out.append('weekdays %s vs %s' % (names(e_days), names(t_days)))
    for n in NAMES:
        if re.search('(?<![A-Za-z])' + re.escape(n) + '(?![A-Za-z])', e) and n not in t:
            out.append('name "%s" is not in the translation' % n)
    for a in re.findall(r'[\w.+-]+@[\w-]+\.[\w.]+', e, A):
        if a not in t:
            out.append('e-mail %s is not in the translation' % a)
    for a in re.findall(r'\b[0-9]{3}-[0-9]{3}-[0-9]{4}\b', e, A):
        if a not in t:
            out.append('phone %s is not in the translation' % a)
    return out


def counted(values):
    """['11', '11', '3'] -> ['11 (2 times)', '3']: a value that repeats is said once."""
    seen = collections.OrderedDict()
    for v in values:
        seen[v] = seen.get(v, 0) + 1
    return [v if n == 1 else '%s (%d times)' % (v, n) for v, n in seen.items()]


def plain_difference(d):
    """One line of differences() in words a friend of the farm understands."""
    m = re.match(r'prices (.*) vs (.*)$', d)
    if m:
        f = lambda x: 'no price' if x == '-' else ', '.join(counted('$' + p for p in x.split()))
        return 'The prices are different: the English has %s, the correction has %s. A price must be exactly the same as in the English.' % (f(m.group(1)), f(m.group(2)))
    m = re.match(r'percent (.*) vs (.*)$', d)
    if m:
        f = lambda x: 'no percent figure' if x == '-' else ', '.join(counted(p + '%' for p in x.split()))
        return 'The percent figure is different: the English has %s, the correction has %s.' % (f(m.group(1)), f(m.group(2)))
    m = re.match(r'number (.*) is not in the translation$', d)
    if m:
        return 'The number %s of the English is missing in the correction (ages, counts, hours and dates must stay the same).' % ', '.join(counted(m.group(1).split(', ')))
    m = re.match(r'number (.*) is not in the English$', d)
    if m:
        return 'The correction has the number %s, which is not in the English.' % ', '.join(counted(m.group(1).split(', ')))
    m = re.match(r'month (.*) is not in the translation$', d)
    if m:
        return 'The month (%s) of the English is not in the correction.' % m.group(1)
    m = re.match(r'weekdays (.*) vs (.*)$', d)
    if m:
        return 'The days of the week are different: the English has %s, the correction has %s.' % (m.group(1), m.group(2))
    m = re.match(r'name "(.*)" is not in the translation$', d)
    if m:
        return 'The name "%s" must stay in the correction exactly as written in the English (names are not translated).' % m.group(1)
    m = re.match(r'e-mail (.*) is not in the translation$', d)
    if m:
        return 'The e-mail address %s must stay in the correction exactly as in the English.' % m.group(1)
    m = re.match(r'phone (.*) is not in the translation$', d)
    if m:
        return 'The phone number %s must stay in the correction exactly as in the English.' % m.group(1)
    return d


def plain_reasons(diffs):
    """differences() in words; when a price or percent already says it, the numbers inside it are not said again."""
    in_price = set()
    for d in diffs:
        m = re.match(r'(?:prices|percent) (.*) vs (.*)$', d)
        if m:
            in_price.update(x for x in (m.group(1) + ' ' + m.group(2)).split() if x != '-')
    out = []
    for d in diffs:
        m = re.match(r'number (.*) is not in the (translation|English)$', d)
        if m and in_price:
            left = [x for x in m.group(1).split(', ') if x not in in_price]
            if not left:
                continue
            d = 'number %s is not in the %s' % (', '.join(left), m.group(2))
        out.append(plain_difference(d))
    return out


TAG_TOKEN = re.compile(r'<[^<>]*>')
VOID_TAGS = {'br', 'wbr', 'img', 'hr', 'input', 'svg'}


def tag_name(tok):
    m = re.match(r'</?\s*([A-Za-z][A-Za-z0-9-]*)', tok)
    if not m:
        return ''
    n = m.group(1).lower()
    return 'a' if re.match(r'a\d+$', n) else n


def balanced(tokens):
    stack = []
    for tok in tokens:
        n = tag_name(tok)
        if not n or tok.endswith('/>') or n in VOID_TAGS:
            continue
        if tok.startswith('</'):
            if not stack or stack[-1] != n:
                return False
            stack.pop()
        else:
            stack.append(n)
    return not stack


def structure_problems(item, text):
    """Placeholders, tags and the characters the page cannot take: [plain-language reason]."""
    out = []
    en = item.english
    e_ph, t_ph = collections.Counter(re.findall(r'\{\w+\}', en)), collections.Counter(re.findall(r'\{\w+\}', text))
    lost = sorted((e_ph - t_ph).elements())
    added = sorted((t_ph - e_ph).elements())
    if lost:
        out.append('The correction is missing %s. Words in curly brackets, such as {n} or {time}, are filled in by the page (a number, a time, a name): copy them exactly where they belong.' % ', '.join(lost))
    if added:
        out.append('The correction has %s, which is not in the English. Only the curly-bracket words of the English can be used.' % ', '.join(added))
    for tok in re.findall(r'(?<![\w@#])[@#][A-Za-z0-9_][A-Za-z0-9_.]*[A-Za-z0-9_]|https?://[^\s<>")\']+', plain(en)):
        if tok not in plain(text):
            out.append('The handle or web address %s must stay in the correction exactly as in the English.' % tok)
    if item.kind == 'ui':
        e_tags, t_tags = collections.Counter(TAG_TOKEN.findall(en)), collections.Counter(TAG_TOKEN.findall(text))
        lost_t = sorted((e_tags - t_tags).elements())
        added_t = sorted((t_tags - e_tags).elements())
        if lost_t or added_t:
            bits = []
            if lost_t:
                bits.append('it is missing ' + ', '.join(lost_t))
            if added_t:
                bits.append('it has ' + ', '.join(added_t) + ' which the English does not have')
            out.append('The marks in < > (they make links, bold words or icons) must be the same as in the English: ' + ' and '.join(bits) + '. Copy every mark exactly; a link is <a1>words</a>, a second link <a2>words</a>.')
        elif not balanced(TAG_TOKEN.findall(text)) and balanced(TAG_TOKEN.findall(en)):
            out.append('The marks in < > are in the wrong order: each opening mark (such as <strong>) needs its closing mark (</strong>) around the right words.')
        rest = TAG_TOKEN.sub('', text)
        if '<' in rest or '>' in rest:
            out.append('The correction has a loose < or > character. Marks in < > must be whole (like <strong>); to show a "less than" sign write &lt;.')
        if re.search(r'<[^>]*\son[a-z]+\s*=|javascript:', text, re.I):
            out.append('The correction contains something that would run as a program. That is not allowed.')
        if re.search(r'<\s*/?\s*wa-(?:en|run)\b', text, re.I) and not re.search(r'<\s*/?\s*wa-(?:en|run)\b', en, re.I):
            out.append('Do not add <wa-en> or <wa-run>: the page puts these marks around English names by itself.')
    elif item.kind == 'js':
        if re.search(r'[<>"]', text) and not re.search(r'[<>"]', en):
            out.append('This line is written by the page as plain text: it cannot contain < > or a straight double quote ("). Use curly quotes \u201c \u201d instead.')
        if en.rstrip().endswith(':'):
            if not re.search(r'[:\uff1a]\s*$', text):
                out.append('This is a label: the page shows it with a colon at the end (and the farm\'s e-mail draft uses it). End the correction with a colon (: or \uff1a).')
            if re.search(r'[()\uff08\uff09]', text):
                out.append('This is a label that the page puts in brackets next to the English in the e-mail to the farm. Do not use brackets inside it.')
    else:   # a QR sign
        if re.search(r'[<>]', text) and not re.search(r'[<>]', en):
            out.append('A sign cannot contain < or >.')
    return out


EXCEL_DATE = [
    re.compile(r'^\d{1,2}[-/.]\d{1,2}([-/.]\d{2,4})?$'),
    re.compile(r'^\d{1,2}-[A-Za-z\u00c0-\u00ff]{3,9}\.?(-\d{2,4})?$'),
    re.compile(r'^[A-Za-z\u00c0-\u00ff]{3,9}\.?-\d{2,4}$'),
    re.compile(r'^\d{4}-\d{2}-\d{2}([ T]\d{1,2}:\d{2}(:\d{2})?)?$'),
    re.compile(r'^\d{1,2}:\d{2}:\d{2}( ?[AaPp]\.?[Mm]\.?)?$'),
    re.compile(r'^\d{1,2}(:\d{2})? ?[AaPp][Mm]$'),
]
EXCEL_ERRORS = ('#NAME?', '#VALUE!', '#REF!', '#DIV/0!', '#N/A', '#NUM!', '#NULL!', '####')


def excel_damage(correction, current, english, flags):
    """A plain reason when the correction looks like something Excel did to the cell (a date, a number, a formula error), else ''. """
    c = correction.strip()
    cur, eng = current.strip(), english.strip()
    if flags.get('number_cell'):
        return 'looks like Excel changed this: the cell holds a number or a date (%s), not text. Excel turns things like 9/29 or 5:00 into dates and times. Format the column as Text before typing, or type a letter or a space in front.' % short(c, 30)
    if c.upper().startswith(EXCEL_ERRORS) or c.startswith('#') and re.match(r'^#[A-Z/0!?]+$', c):
        return 'looks like Excel changed this: it shows an error code (%s) because the line begins with = + - or @ and Excel read it as a formula. Put a space or a letter in front of it.' % c
    for rx in EXCEL_DATE:
        if rx.match(c) and c != cur:
            return 'looks like Excel changed this: "%s" is how Excel writes a date or a time, but the line is "%s". Excel turns things like 9/29, 6 oct or 5:00 into dates. Format the column as Text before typing (or put a space in front), then send it again.' % (c, short(cur or eng, 40))
    if re.match(r'^\d+(\.\d+)?[Ee][+-]?\d+$', c):
        return 'looks like Excel changed this: "%s" is how Excel writes a very large or very small number.' % c
    if re.match(r'^[\d.,]+$', c) and c != cur:
        def squeeze(x):
            return re.sub(r'(?<![\d.,])0+(?=\d)', '', re.sub(r'(\.\d*?)0+$', r'\1', x)).rstrip('.')
        if cur and squeeze(re.sub(r'[^\d.,]', '', cur)) == squeeze(c):
            return 'looks like Excel changed this: Excel dropped zeros of the number (the line is "%s", the cell has "%s"). Format the column as Text before typing.' % (short(cur, 30), c)
    return ''


def encoding_damage(correction):
    if '\ufffd' in correction or re.search(r'\?{3,}', correction):
        return 'the letters look lost (%s): the file was probably saved as plain CSV, which cannot keep these letters. In Excel choose Save As > "CSV UTF-8 (Comma delimited)" and send it again.' % short(correction, 30)
    if re.search(r'\u00c3[\u0080-\u00bf]|\u00e2\u20ac|\u00e0\u00a4|\u00e4\u00b8|\u00e1\u00bb|\u00c2[\u0080-\u00bf]', correction):
        return 'the letters look scrambled (%s): the file was opened with the wrong character set and saved again. Open the original review file, type the corrections there, and save as "CSV UTF-8".' % short(correction, 30)
    return ''


def check_row(item, correction, code, flags):
    """(accepted text or None, [plain reasons it was rejected], [warnings])."""
    text = re.sub(r'\s+', ' ', correction.replace('\u00a0', ' ')).strip()
    why, warn = [], []
    if not text:
        return None, ['The correction is only spaces or an empty line, so there is nothing to put on the page. Leave the cell completely empty if the line is fine.'], warn
    bad = encoding_damage(text)
    if bad:
        return None, ['The correction ' + bad], warn
    if len(text) <= 6 and len(item.english) > 12 and (text.casefold() in NOTES_WORDS):
        return None, ['This looks like a remark ("%s"), not a translation. Remarks go in the note column. Nothing was changed for this row.' % text], warn
    damage = excel_damage(correction, item.current, item.english, flags)
    if damage:
        return None, ['The correction ' + damage], warn
    why.extend(structure_problems(item, text))
    why.extend(plain_reasons(differences(item.english, text, code)))
    if why:
        return None, why, warn
    if len(item.english) <= 40 and len(text) > 2.5 * max(len(item.english), 12) and code != 'zh':
        warn.append('much longer than the English (%d letters against %d): if this is a button or a small label it may not fit.' % (len(text), len(item.english)))
    if code in ('hi', 'zh') and len(re.findall(r'[A-Za-z]', item.english)) > 8 and not re.search('[\u0900-\u097f\u3400-\u9fff]', text):
        warn.append('it has no %s letters at all. Is it still in English?' % LANG_NAMES[code][0])
    return text, [], warn


# ---------------------------------------------------------------------------------------------- showing a change
def plain_diff(old, new, code):
    """A change in words: removed / added / changed pieces, short."""
    a = list(old) if code == 'zh' else old.split()
    b = list(new) if code == 'zh' else new.split()
    join = (lambda x: ''.join(x)) if code == 'zh' else (lambda x: ' '.join(x))
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    parts = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            continue
        before, after = join(a[i1:i2]), join(b[j1:j2])
        if tag == 'replace':
            parts.append('changed "%s" to "%s"' % (short(before, 60), short(after, 60)))
        elif tag == 'delete':
            parts.append('removed "%s"' % short(before, 60))
        else:
            parts.append('added "%s"' % short(after, 60))
    if len(parts) > 6:
        parts = parts[:6] + ['and %d more changes' % (len(parts) - 6)]
    return '; '.join(parts) or 'only spaces or punctuation changed'


# ---------------------------------------------------------------------------------------------- writing the language files
def line_pattern(key):
    return re.compile(r'^([ \t]*)(' + re.escape(json.dumps(key, ensure_ascii=False)) + r')(\s*:\s*)("(?:[^"\\]|\\.)*")(,?)([ \t]*)$', re.M)


def replace_in_src(text, changes):
    """Change only the lines of the given keys. changes: {(kind, key): new text}. Returns (new text, {(kind, key): reason it could not be done})."""
    failed = {}
    for (kind, key), new in changes.items():
        pat = line_pattern(key)
        found = list(pat.finditer(text))
        if len(found) != 1:
            failed[(kind, key)] = 'the line for this text was not found exactly once in the language file (found %d)' % len(found)
            continue
        m = found[0]
        text = text[:m.start()] + m.group(1) + m.group(2) + m.group(3) + json.dumps(new, ensure_ascii=False) + m.group(5) + m.group(6) + text[m.end():]
    return text, failed


def object_end(text, pos):
    """Index of the first '}' after pos that closes the object pos is inside (strings are skipped, so a { or } inside a web address does not count)."""
    depth, i, n = 0, pos, len(text)
    while i < n:
        c = text[i]
        if c == '"':
            i += 1
            while i < n and text[i] != '"':
                i += 2 if text[i] == '\\' else 1
        elif c == '{':
            depth += 1
        elif c == '}':
            if depth == 0:
                return i
            depth -= 1
        i += 1
    return n


def replace_in_qr(text, code, changes):
    """changes: {key tuple: new text}. A path in the file is found by walking: "languages" > code > "signs" > id > field (or, for Spanish, the entry of the "signs" list with that "id")."""
    failed = {}
    string = r'"(?:[^"\\]|\\.)*"'
    for key, new in changes.items():
        try:
            if code == 'es':
                _, sid, field = key
                m = re.search(r'"id"\s*:\s*' + re.escape(json.dumps(sid)), text)
                if not m:
                    raise ValueError('sign "%s" not found' % sid)
                m2 = re.compile(r'("%s"\s*:\s*)(%s)' % (re.escape(field), string)).search(text, m.end())
                if not m2 or m2.start() > object_end(text, m.end()):
                    raise ValueError('field %s not found' % field)
            else:
                lm = re.search(r'"languages"\s*:\s*\{', text)
                cm = re.compile(r'"%s"\s*:\s*\{' % re.escape(code)).search(text, lm.end()) if lm else None
                if not cm:
                    raise ValueError('the "%s" part of "languages" not found' % code)
                if key[0] in ('how', 'also'):
                    m2 = re.compile(r'("%s"\s*:\s*)(%s)' % (key[0], string)).search(text, cm.end())
                    if m2 and m2.start() > object_end(text, cm.end()):
                        m2 = None
                else:
                    _, sid, field = key
                    sm = re.compile(r'"signs"\s*:\s*\{').search(text, cm.end())
                    im = re.compile(r'"%s"\s*:\s*\{' % re.escape(sid)).search(text, sm.end()) if sm else None
                    if not im:
                        raise ValueError('sign "%s" not found' % sid)
                    m2 = re.compile(r'("%s"\s*:\s*)(%s)' % (re.escape(field), string)).search(text, im.end())
                    if m2 and m2.start() > object_end(text, im.end()):
                        m2 = None
                if not m2:
                    raise ValueError('field not found')
        except ValueError as e:
            failed[key] = 'the place for this text in tools/qr_links.json was not found (%s)' % e
            continue
        text = text[:m2.start(2)] + json.dumps(new, ensure_ascii=False) + text[m2.end(2):]
    return text, failed


# ---------------------------------------------------------------------------------------------- import
def cmd_import(site, code, path, dry_run=False, strict=False, out=None):
    out = out or sys.stdout
    say = lambda s='': print(on_screen(s), file=out)   # the sheet is another person's text: no control characters reach the window
    need_language(code)
    rows, file_warn = read_sheet(path, code)
    items = build_items(site, code)
    rank_items(site, code, items)   # fills in the question of each row, to know what the sheet showed in that column
    by_id = {it.id: it for it in items}
    for w in file_warn:
        say('Note: ' + w)
    # is this the sheet of this language and of this version of the site?
    seen_cmp = mismatch = 0
    for n, rec, flags in rows:
        it = by_id.get(rec['id'].strip())
        if it and rec['current'].strip() and it.current.strip():
            seen_cmp += 1
            if squash(rec['current']) != squash(it.current):
                mismatch += 1
    if seen_cmp >= 5 and mismatch * 2 >= seen_cmp:
        raise Problem('This sheet does not belong to the %s file as it is now: in %d of %d rows the "current translation" is not what lang/src/%s.json says. '
                      'Either it is the sheet of another language, or the translations changed after it was made. Make a fresh sheet with `export %s` and ask for the corrections again. Nothing was changed.'
                      % (LANG_NAMES[code][0], mismatch, seen_cmp, code, code))
    accepted, rejected, unchanged, warnings, notes = [], [], [], [], []
    ids_used = {}
    n_with = 0
    for n, rec, flags in rows:
        rid = rec['id'].strip().lstrip('\ufeff')
        corr = rec['correction']
        if rec['note'].strip():
            notes.append((n, rid, rec['note'].strip()))
        if corr == '' and not flags.get('number_cell'):
            continue   # nothing written: the line is fine as it is
        n_with += 1
        it = by_id.get(rid)
        if it is None:
            rejected.append((n, rid, ['The id "%s" is not a text of this site (or of this language). The id column must stay exactly as it was exported: a cell may have been changed, or the rows mixed up. Nothing was changed for this row.' % short(rid, 30)], rec))
            continue
        # the English in the row must be the English of the id
        eng_cell = rec['english']
        eng_shaky = any(rx.match(eng_cell.strip()) for rx in EXCEL_DATE) or bool(re.match(r'^[\d.,]+$', eng_cell.strip()))
        if eng_cell.strip() and not eng_shaky and squash(eng_cell) != squash(it.english):
            rejected.append((n, rid, ['The English in this row is not the English of this id: the id (or the English) was changed, or rows were mixed up. To be safe nothing was changed for this row. English of the id: "%s".' % short(words_only(it.english), 80)], rec))
            continue
        if rid in ids_used:
            if squash(corr) == squash(ids_used[rid][1]):
                continue
            rejected.append((n, rid, ['This id is already corrected on row %d with different words. The first one was used.' % ids_used[rid][0]], rec))
            continue
        text, why, warn = check_row(it, corr, code, flags)
        ids_used[rid] = (n, corr)
        if why:
            rejected.append((n, rid, why, rec))
            continue
        text = encode_amp(it.kind, text)
        if text == re.sub(r'\s+', ' ', it.current).strip():
            unchanged.append((n, rid))
            continue
        cur_cell = rec['current'].strip()
        shaky = any(rx.match(cur_cell) for rx in EXCEL_DATE) or bool(re.match(r'^[\d.,]+$', cur_cell))
        if cur_cell and it.current.strip() and not shaky and squash(cur_cell) != squash(it.current):
            warn.append('the line on the site is not what the sheet showed: it was changed after the sheet was made (or Excel changed the cell). The correction replaces the newer text.')
        accepted.append((n, rid, it, text, warn))
    # a cell of a column that is not read (the English, the current translation, the question) with other words in it, on a row with no correction:
    # a friend who typed the better text over the old one. Only "correction" and "note" are read, so say it, row by row.
    edited = []
    for n, rec, flags in rows:
        it = by_id.get(rec['id'].strip())
        if it is None or rec['correction'].strip() or flags.get('number_cell'):
            continue
        for label, key, shown in (('current translation', 'current', show(it.kind, it.current)), ('English', 'english', show(it.kind, it.english)), ('question for you', 'ask', it.ask)):
            cell = rec.get(key)
            if cell is None or not cell.strip():
                continue
            if any(rx.match(cell.strip()) for rx in EXCEL_DATE) or re.match(r'^[\d.,]+$', cell.strip()):
                continue   # Excel turns such a cell into a date or a number by itself
            if squash(cell) != squash(shown):
                edited.append((n, it.id, label, cell))
                break
    # ---- report
    say('Sheet: %s   Language: %s (lang/src/%s.json)' % (os.path.relpath(path), LANG_NAMES[code][0], code))
    say('%d rows read, %d with a correction: %d accepted, %d not used, %d the same as now.' % (len(rows), n_with, len(accepted), len(rejected), len(unchanged)))
    say()
    for n, rid, it, text, warn in accepted:
        say('Row %d (%s): ACCEPTED' % (n, rid))
        say('    English : ' + short(words_only(it.english), 100))
        say('    before  : ' + short(show(it.kind, it.current), 160))
        say('    after   : ' + short(show(it.kind, text), 160))
        say('    change  : ' + plain_diff(show(it.kind, it.current), show(it.kind, text), code))
        for w in warn:
            say('    Careful : ' + w)
        say()
    for n, rid, why, rec in rejected:
        say('Row %d (%s): NOT USED' % (n, short(rid, 30)))
        for w in why:
            say('    ' + w)
        if rec.get('correction', '').strip():
            say('    Your correction was: ' + short(rec['correction'], 120))
        say()
    if unchanged:
        say('%d rows had a correction that is the same as the text already on the site (nothing to change).' % len(unchanged))
        say()
    if edited:
        say('%d row(s) have other words in a column that is not read. Only the "correction" and "note" columns are read, so nothing was used from these rows:' % len(edited))
        for n, rid, label, cell in edited[:12]:
            say('    Row %d (%s): the "%s" cell says: %s' % (n, short(rid, 30), label, short(cell, 100)))
        if len(edited) > 12:
            say('    ... and %d more rows.' % (len(edited) - 12))
        say('    If your friend typed corrections there, ask them to type them in the "correction" column (or copy them there yourself) and import again.'
            ' If the translations on the site were changed after this sheet was made, nothing is wrong.')
        say()
    if notes:
        say('Notes your friend wrote (not applied; for you to read):')
        for n, rid, note in notes:
            say('    Row %d (%s): %s' % (n, short(rid, 30), short(note, 200)))
        say()
    # ---- write
    apply_now = accepted and not (strict and rejected)
    result = 0
    if rejected or edited:
        result = 1
    changes_src, changes_qr = {}, {}
    for n, rid, it, text, warn in accepted:
        if it.kind == 'qr':
            changes_qr[it.key] = text
        else:
            changes_src[(it.kind, it.key)] = text
    if not accepted:
        say('Nothing to change.' if not rejected else 'No row could be used, so nothing was changed.')
    elif strict and rejected:
        say('--strict: %d row(s) were rejected, so NOTHING was written (the %d good correction(s) were not applied). Fix the rows above and run the command again.' % (len(rejected), len(accepted)))
    elif dry_run:
        say('Dry run: %d correction(s) would be written to %s. Nothing was written.' % (len(accepted), 'lang/src/%s.json%s' % (code, ' and tools/qr_links.json' if changes_qr else '')))
    else:
        failed_all = {}
        if changes_src:
            p = site.src_path(code)
            text = read_text(p)
            new_text, failed = replace_in_src(text, changes_src)
            failed_all.update(failed)
            if new_text != text:
                check_src_result(text, new_text, {k: v for k, v in changes_src.items() if k not in failed})
                atomic_write(p, new_text)
        if changes_qr:
            text = read_text(QR_FILE)
            new_text, failed = replace_in_qr(text, code, changes_qr)
            failed_all.update(failed)
            if new_text != text:
                json.loads(new_text)
                atomic_write(QR_FILE, new_text)
        done = len(accepted) - len(failed_all)
        for k, why in failed_all.items():
            say('Could not write one correction (%s): %s.' % ('/'.join(str(x) for x in (k if isinstance(k, tuple) and k and k[0] in ('how', 'also', 'signs') else (k[1],))), why))
            result = 1
        say('Written: %d correction(s) in %s.' % (done, 'lang/src/%s.json%s' % (code, ' and tools/qr_links.json' if changes_qr else '')))
        say('English was not touched.')
    if accepted and not dry_run and not (strict and rejected):
        say()
        say('Next, rebuild and check (this tool does not run them):')
        say('    python3 tools/i18n.py build')
        if changes_qr:
            say('    python3 tools/make_qr.py')
        say('    python3 tools/i18n.py missing %s' % code)
        say('    node tests/run-all.mjs consistency        (and, if the browser tests are installed: node tests/run-all.mjs i18n languages)')
        say('Then look at index.html?lang=%s in a browser.' % code)
    elif accepted and dry_run:
        say('To apply them, run the same command without --dry-run.')
    if rejected and not (strict and rejected):
        say()
        say('%d row(s) were not used (listed above). Ask your friend to fix them in the sheet and send it again; the rows already accepted are not harmed by a second import.' % len(rejected))
    return result


def check_src_result(old_text, new_text, changes):
    """Safety net: the new file is still JSON, and only the changed texts differ."""
    try:
        old, new = json.loads(old_text), json.loads(new_text)
    except ValueError as e:
        raise Problem('Internal check failed (the new file would not be valid JSON: %s). Nothing was written.' % e)
    expect = json.loads(old_text)
    for (kind, key), v in changes.items():
        expect[kind][key] = v
    if new != expect or list(new.get('ui', {})) != list(old.get('ui', {})) or list(new.get('js', {})) != list(old.get('js', {})):
        raise Problem('Internal check failed (more than the corrected texts would change). Nothing was written.')


# ---------------------------------------------------------------------------------------------- command line
def main(argv):
    args = list(argv)
    if not args or args[0] in ('-h', '--help', 'help'):
        print(__doc__)
        return 0
    cmd = args.pop(0)
    flags = [a for a in args if a.startswith('--')]
    pos = [a for a in args if not a.startswith('--')]
    out_dir = OUT_DIR
    for f in list(flags):
        if f.startswith('--out='):
            out_dir = os.path.abspath(f[6:])
            flags.remove(f)
    unknown = [f for f in flags if f not in ('--dry-run', '--strict', '--force')]
    if unknown:
        print('Unknown option %s. See: python3 tools/review_sheet.py --help' % unknown[0])
        return 2
    try:
        site = Site()
        if cmd == 'export':
            if len(pos) != 1:
                raise Problem('Say which language: python3 tools/review_sheet.py export es   (languages: %s, or all)' % ', '.join(languages()))
            return cmd_export(site, pos[0], out_dir, force='--force' in flags)
        if cmd == 'import':
            if len(pos) != 2:
                raise Problem('Say the language and the file: python3 tools/review_sheet.py import es review/es.corrected.csv   (add --dry-run to only look)')
            return cmd_import(site, pos[0], pos[1], dry_run='--dry-run' in flags, strict='--strict' in flags)
        raise Problem('Unknown command "%s". Use export or import. See: python3 tools/review_sheet.py --help' % cmd)
    except Problem as e:
        print(on_screen(e), file=sys.stderr)
        return 2


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    sys.exit(main(sys.argv[1:]))
