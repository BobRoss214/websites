#!/usr/bin/env python3
"""Close the farm for a day, safely: one command for the website part, and a plain list of what the website cannot do.

  python3 tools/close_today.py rain                    close TODAY (farm time) for rain
  python3 tools/close_today.py wind                    ... for strong wind
  python3 tools/close_today.py holiday                 ... for a holiday
  python3 tools/close_today.py late-open 10:30         we open late today (a notice only; nothing is closed)
  python3 tools/close_today.py sold-out                reservations are full today (a notice only)
  python3 tools/close_today.py custom "Closed for a private event."     your own English words in the notice bar
  --date YYYY-MM-DD   another day (default: today in farm time, Eastern)       --until YYYY-MM-DD   closed up to and including this day (a run)
  --dry-run           show exactly what would change, change nothing           --check   say what js/content.js says now, change nothing
  --undo              put js/content.js back as it was before the last closure (the day and the notice come out again)
  --publish           also run the steps that make the upload folder (otherwise the one command to type next is printed)
  --reopen YYYY-MM-DD the day you open again (only used in the ready-to-paste posts)
  --no-notice         only add the day to the closures, leave the notice bar alone     --replace-notice   replace a notice that is already there

What it changes in js/content.js: the day goes into  closures: [...]  (so the badges for the farm, The GreenHouse and Wise Pie say closed), and
notice: / noticeUntil: get the standard sentence in English, Spanish, Hindi, Chinese and Vietnamese (the words are in tools/notice_phrases.json).
Nothing else in the file changes: comments, the byte order mark, line endings, quote marks and trailing commas stay as they are. The new file is
checked with Node (it must still run and say what it should) and read again from the disk. If anything is wrong nothing is written.
A copy of the old file is kept OUTSIDE the website folder (the folder is named in the message); --undo uses it.

What it cannot do, and prints at the end: close the times in Bookeo, post on the Business Profile, Instagram and Facebook.
Ready-to-paste words for those are in docs/NOTICE_KIT.md. Needs Python 3.8 or newer and Node (to check the file). Nothing is sent anywhere.
"""
import argparse, datetime, difflib, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time

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
CONTENT = os.path.join(ROOT, 'js', 'content.js')
PHRASES = os.path.join(HERE, 'notice_phrases.json')
LANGS = ('en', 'es', 'hi', 'zh', 'vi')
SCENARIOS = ('rain', 'wind', 'holiday', 'late-open', 'sold-out', 'custom')
MAX_CUSTOM = 160
MAX_RUN_DAYS = 100          # the same limit as js/live.js
PROPS = ('closures', 'notice', 'noticeUntil')
EN_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
EN_DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
ES_MONTH_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


class Refuse(Exception):
    """Something the tool will not do. The message is for the person typing, in plain words."""


# ------------------------------------------------------------------------------------------------ farm time
def now_utc():
    forced = os.environ.get('CLOSE_TODAY_NOW')     # for the tests: an ISO time in UTC (year-month-day, a T, then hours:minutes:seconds)
    if forced:
        return datetime.datetime.strptime(forced, '%Y-%m-%dT%H:%M:%S')
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)    # (utcnow() is deprecated in newer Pythons and would print a warning)


def nth_sunday(year, month, n):
    d = datetime.date(year, month, 1)
    d += datetime.timedelta(days=(6 - d.weekday()) % 7)
    return d + datetime.timedelta(days=7 * (n - 1))


def farm_now():
    """The farm's clock (Eastern Time, with the summer-time rules of the United States since 2007)."""
    u = now_utc()
    start = datetime.datetime.combine(nth_sunday(u.year, 3, 2), datetime.time(7, 0))      # 2:00 EST = 07:00 UTC
    end = datetime.datetime.combine(nth_sunday(u.year, 11, 1), datetime.time(6, 0))       # 2:00 EDT = 06:00 UTC
    return u - datetime.timedelta(hours=4 if start <= u < end else 5)   # (no time zone database: Python 3.8 has none and Windows has no time zone files)


def parse_day(text, what):
    try:
        return datetime.datetime.strptime(text.strip(), '%Y-%m-%d').date()
    except ValueError:
        raise Refuse('%s %s is not a day. Write it as year-month-day with two digits each, for example %s.' % (what, repr(text[:30]), farm_now().date().isoformat()))


def weekday_index(d):
    """0 = Sunday, as in tools/date_phrases.py."""
    return (d.weekday() + 1) % 7


# ------------------------------------------------------------------------------------------------ the words
def load_phrases():
    try:
        with open(PHRASES, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError) as e:
        raise Refuse('tools/notice_phrases.json cannot be read (%s). Put it back from your backup, or ask Claude. Nothing was changed.' % (e,))


def clock(code, h, m):
    """A time of day worded like the site (js/i18n.js: clock)."""
    h12 = h % 12 or 12
    mm = ':%02d' % m if m else ''
    if code == 'en':
        return '%d:%02d %s' % (h12, m, 'AM' if h < 12 else 'PM')
    if code == 'es':
        return '%d:%02d %s' % (h12, m, 'a. m.' if h < 12 else 'p. m.')
    if code == 'hi':
        part = 'रात' if h < 4 else 'सुबह' if h < 12 else 'दोपहर' if h < 16 else 'शाम' if h < 20 else 'रात'
        return '%s %d%s बजे' % (part, h12, mm)
    if code == 'zh':
        part = '凌晨' if h < 5 else '早上' if h < 8 else '上午' if h < 12 else '中午' if h < 13 else '下午' if h < 18 else '晚上'
        return '%s %d%s' % (part, h12, mm if m else ' 点')
    part = 'đêm' if h < 4 else 'sáng' if h < 11 else 'trưa' if h < 13 else 'chiều' if h < 18 else 'tối'
    return ('%d%s %s' % (h12, mm, part)) if m else ('%d giờ %s' % (h12, part))


def day_words(code, d):
    """(weekday, date) as the words of that language: Sunday / Oct 4, domingo / 4 de oct, रविवार / 4 अक्टूबर, 周日 / 10 月 4 日, Chủ Nhật / 4 thg 10."""
    import date_phrases as dp
    wd = weekday_index(d)
    if code == 'en':
        return EN_DAY[wd], '%s %d' % (EN_MONTH[d.month - 1], d.day)
    return dp.WEEKDAY[code][wd], dp.tail_date(code, (d.month - 1, d.day))


def sanitize_custom(text):
    """The owner's own words for the notice bar, made safe: one line, no < > or backslash, curly quotes, not too long (the same rules as tools/add_photo.py)."""
    text = re.sub(r'\s+', ' ', text or '')
    text = re.sub('[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]', '', text).strip()
    if re.search(r'[<>\\]', text):
        raise Refuse('The words may not contain < > or a backslash. Write them without those characters. Nothing was changed.')
    if '"' in text or "'" in text:
        text = re.sub(r'"([^"]*)"', '\u201c\\1\u201d', text).replace('"', '\u201d').replace("'", '\u2019')
    if len(text) < 3:
        raise Refuse('The words are too short. Write the sentence the bar should show, for example custom "Closed for a private event.". Nothing was changed.')
    if len(text) > MAX_CUSTOM:
        raise Refuse('The words are %d letters long; the bar takes at most %d. Say it more briefly. Nothing was changed.' % (len(text), MAX_CUSTOM))
    return text


def build_notice(scenario, d, until, time_text, custom, phrases):
    """({code: sentence} or the plain English string for custom, closes?)."""
    if scenario == 'custom':
        return sanitize_custom(custom), False
    sc = phrases['scenarios'][scenario]
    kind = 'range' if until and until != d else 'one'
    if kind == 'range' and 'range' not in sc:
        raise Refuse('"%s" is for one day only: leave out --until. Nothing was changed.' % scenario)
    out = {}
    for code in LANGS:
        s = sc[kind][code]
        wd, dt = day_words(code, d)
        s = s.replace('{weekday}', wd).replace('{date}', dt)
        if kind == 'range':
            wd2, dt2 = day_words(code, until)
            s = s.replace('{weekday2}', wd2).replace('{date2}', dt2)
        if '{time}' in s:
            s = s.replace('{time}', clock(code, *time_text))
        if re.search(r'[{}<>\\"]', s):
            raise Refuse('The sentence for %s in tools/notice_phrases.json still has a { } < > or a straight quote after filling it in. Fix that file. Nothing was changed.' % code)
        out[code] = s
    return out, bool(sc.get('closes'))


# ------------------------------------------------------------------------------------------------ reading js/content.js without a JavaScript engine
def code_mask(text):
    """For each character: 'c' code, 's' inside a string (quotes included), 'm' inside a comment."""
    n = len(text)
    mask = ['c'] * n
    i = 0
    while i < n:
        c = text[i]
        if c == '/' and i + 1 < n and text[i + 1] == '/':
            j = text.find('\n', i)
            j = n if j < 0 else j
            for k in range(i, j):
                mask[k] = 'm'
            i = j
        elif c == '/' and i + 1 < n and text[i + 1] == '*':
            j = text.find('*/', i + 2)
            j = n if j < 0 else j + 2
            for k in range(i, j):
                mask[k] = 'm'
            i = j
        elif c in '\'"`':
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == '\\' else 1
            j = min(n, j + 1)
            for k in range(i, j):
                mask[k] = 's'
            i = j
        else:
            i += 1
    return mask


def find_props(text):
    """{name: (start of the name, start of the value, end of the value)} for the settings at the top level of  window.WISE_ACRES = { ... }."""
    code = code_mask(text)
    m = None
    for cand in re.finditer(r'window\.WISE_ACRES\s*=\s*\{', text):
        if code[cand.start()] == 'c':
            m = cand
            break
    if not m:
        raise Refuse('I cannot find  window.WISE_ACRES = {  in js/content.js, so I do not know where the settings are. Nothing was changed.')
    i = m.end()      # just after the {
    n = len(text)
    props = {}
    depth = 0
    key_start = None
    while i < n:
        if code[i] != 'c':
            i += 1      # a comment or a string
            continue
        c = text[i]
        if depth == 0:
            if c == '}':
                break
            if re.match(r'[A-Za-z_$]', c):
                km = re.compile(r'([A-Za-z_$][\w$]*)\s*:').match(text, i)
                if not km:
                    i += 1
                    continue
                name, key_start, vstart = km.group(1), i, km.end()
                while vstart < n and (text[vstart].isspace() or code[vstart] == 'm'):
                    vstart += 1
                j, d2 = vstart, 0
                while j < n:
                    if code[j] == 'c':
                        ch = text[j]
                        if ch in '[{(':
                            d2 += 1
                        elif ch in ']})':
                            if d2 == 0:
                                break
                            d2 -= 1
                        elif ch == ',' and d2 == 0:
                            break
                    j += 1
                vend = j
                while vend > vstart and (text[vend - 1].isspace() or code[vend - 1] == 'm'):
                    vend -= 1
                props[name] = (key_start, vstart, vend)
                i = j
                continue
        i += 1
    return props


def node_read(text):
    """The settings as Node sees them: {closures, notice, noticeUntil, all}. None when Node is not installed."""
    node = shutil.which('node')
    if not node:
        return None
    script = ("const vm=require('vm'),fs=require('fs');const src=fs.readFileSync(process.argv[1],'utf8');const sb={window:{},console:{log(){}}};vm.createContext(sb);"
              "vm.runInContext(src,sb,{timeout:5000});const W=sb.window.WISE_ACRES;if(!W||typeof W!=='object')throw new Error('no settings');"
              "process.stdout.write(JSON.stringify({closures:W.closures,notice:W.notice,noticeUntil:W.noticeUntil,all:W}));")
    fd, tmp = tempfile.mkstemp(suffix='.js')
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(text.encode('utf-8'))
        r = subprocess.run([node, '-e', script, tmp], capture_output=True, timeout=30)
    finally:
        os.remove(tmp)
    if r.returncode != 0:
        why = (r.stderr.decode('utf-8', 'replace').strip().splitlines() or ['the settings do not run'])[-1][:160]
        raise Refuse('The settings in js/content.js do not run (%s), so I will not touch the file. Fix that first: open the page with ?check, or ask Claude. Nothing was changed.' % why)
    return json.loads(r.stdout.decode('utf-8'))


def simple_read(text, props):
    """Without Node: the closures strings and the plain notice, read from the text of the settings."""
    def strings(span):
        return [m.group(2) for m in re.finditer(r'([\'"])((?:\\.|(?!\1).)*)\1', span)]
    cl = strings(text[props['closures'][1]:props['closures'][2]]) if 'closures' in props else []
    nt = text[props['notice'][1]:props['notice'][2]] if 'notice' in props else "''"
    nu = strings(text[props['noticeUntil'][1]:props['noticeUntil'][2]]) if 'noticeUntil' in props else []
    notice = {} if nt.lstrip().startswith('{') else ''.join(strings(nt))
    if isinstance(notice, dict):
        for m in re.finditer(r'\b(en|es|hi|zh|vi)\s*:\s*([\'"])((?:\\.|(?!\2).)*)\2', nt):
            notice[m.group(1)] = m.group(3)
    return {'closures': cl, 'notice': notice, 'noticeUntil': nu[0] if nu else '', 'all': None}


def read_settings(text, props):
    got = node_read(text)
    return (got, True) if got is not None else (simple_read(text, props), False)


def expand(items):
    """The days that a closures list covers, as dates (a day, or two days with two dots between them)."""
    days = set()
    for v in items if isinstance(items, list) else []:
        s = str(v).strip()
        m = re.match(r'^(\d{4}-\d{2}-\d{2})\s*\.\.\s*(\d{4}-\d{2}-\d{2})$', s)
        try:
            if m:
                a, b = parse_day(m.group(1), 'x'), parse_day(m.group(2), 'x')
                for k in range(min(MAX_RUN_DAYS + 1, (b - a).days + 1)):
                    days.add(a + datetime.timedelta(days=k))
            elif re.match(r'^\d{4}-\d{2}-\d{2}$', s):
                days.add(parse_day(s, 'x'))
        except Refuse:
            pass
    return days


# ------------------------------------------------------------------------------------------------ the text edit
def quote_style(text, props):
    """' or ", the one the file already uses in these settings."""
    for name in PROPS:
        if name in props:
            m = re.search(r'([\'"])', text[props[name][1]:props[name][2]])
            if m:
                return m.group(1)
    return "'"


def js_string(s, q):
    s = s.replace('\\', '\\\\').replace(q, '\\' + q).replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    return q + s + q


def line_indent(text, pos):
    start = text.rfind('\n', 0, pos) + 1
    m = re.match(r'[ \t]*', text[start:pos])
    return m.group(0)


def new_closures_span(text, props, item, q, nl):
    ks, vs, ve = props['closures']
    old = text[vs:ve]
    if not (old.startswith('[') and old.endswith(']')):
        raise Refuse('closures in js/content.js is not a list in square brackets (it is: %s). Nothing was changed.' % old[:40])
    inner = old[1:-1]
    lit = js_string(item, q)
    if not inner.strip():
        return '[' + lit + ']'
    m = re.match(r'(?s)^(.*?)(,?)(\s*)$', inner)
    body, comma, tail = m.group(1), m.group(2), m.group(3)
    if '\n' in inner:
        last = body.rstrip()
        indent = line_indent(text, vs + 1 + len(last) - len(last.split('\n')[-1])) if '\n' in last else line_indent(text, vs) + '  '
        item_indent = re.match(r'[ \t]*', last.split('\n')[-1]).group(0) or indent
        return '[' + body + ',' + nl + item_indent + lit + comma + tail + ']'
    return '[' + body + ', ' + lit + comma + tail + ']'


def new_notice_span(text, props, notice, q, nl):
    if isinstance(notice, str):
        return js_string(notice, q)
    indent = line_indent(text, props['notice'][0])
    lines = [nl + indent + '  %s: %s,' % (c, js_string(notice[c], q)) for c in LANGS]
    return '{' + ''.join(lines) + nl + indent + '}'


def apply_edits(text, edits):
    """edits: {name: new value text}; the spans are replaced from the end of the file towards the start."""
    props = find_props(text)
    for name, _ in edits.items():
        if name not in props:
            raise Refuse('I cannot find the setting  %s:  in js/content.js. Nothing was changed.' % name)
    out = text
    for name in sorted(edits, key=lambda k: -props[k][1]):
        a, b = props[name][1], props[name][2]
        out = out[:a] + edits[name] + out[b:]
    return out


def outside_spans(text, props, names):
    """The file with the values of these settings cut out: it must be the same before and after."""
    cuts = sorted((props[n][1], props[n][2]) for n in names if n in props)
    out, pos = [], 0
    for a, b in cuts:
        out.append(text[pos:a])
        pos = b
    out.append(text[pos:])
    return '\x00'.join(out)


# ------------------------------------------------------------------------------------------------ files, backups, records
def backup_dir():
    return os.environ.get('CLOSE_TODAY_BACKUP_DIR') or os.path.join(tempfile.gettempdir(), 'wise-acres-close-today')


def read_file(path):
    try:
        with open(path, 'rb') as f:
            raw = f.read()
    except OSError:
        raise Refuse('I cannot find js/content.js (looked for %s). Run this from the website folder:  python3 tools/close_today.py rain . Nothing was changed.' % path)
    bom = raw.startswith(b'\xef\xbb\xbf')
    try:
        text = (raw[3:] if bom else raw).decode('utf-8')
    except UnicodeDecodeError:
        raise Refuse('js/content.js is not saved as UTF-8, so I will not touch it. Nothing was changed.')
    nl = '\r\n' if text.count('\r\n') > text.count('\n') / 2 else '\n'
    return raw, text, bom, nl


def write_file(path, text, bom):
    data = (b'\xef\xbb\xbf' if bom else b'') + text.encode('utf-8')
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix='.tmp')
    with os.fdopen(fd, 'wb') as f:
        f.write(data)
    try:
        os.chmod(tmp, os.stat(path).st_mode & 0o777)
    except OSError:
        pass
    os.replace(tmp, path)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_state():
    p = os.path.join(backup_dir(), 'records.json')
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {'records': []}


def save_state(state):
    d = backup_dir()
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'records.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(state, f, ensure_ascii=False, indent=1)


# ------------------------------------------------------------------------------------------------ doing it
def state_words(settings):
    n = settings['notice']
    if isinstance(n, dict):
        n = n.get('en') or next((v for v in n.values() if v), '')
    return 'closures: %s;  notice: %s;  noticeUntil: %s' % (json.dumps(settings['closures'], ensure_ascii=False), json.dumps(n or '', ensure_ascii=False), json.dumps(settings['noticeUntil'] or ''))


def plan(args, path=CONTENT):
    """Works out the change and checks everything. Returns a dict; raises Refuse. Writes nothing."""
    today = farm_now().date()
    d = parse_day(args.date, '--date') if args.date else today
    until = parse_day(args.until, '--until') if args.until else None
    if d < today - datetime.timedelta(days=1):
        raise Refuse('%s is in the past (today is %s on the farm clock). I only close today, tomorrow or later, and yesterday if it is still being fixed. Nothing was changed.' % (d, today))
    if d > today + datetime.timedelta(days=400):
        raise Refuse('%s is more than a year away. Check the date. Nothing was changed.' % d)
    if until is not None:
        if until <= d:
            raise Refuse('--until %s is not after %s. Leave it out for one day. Nothing was changed.' % (until, d))
        if (until - d).days + 1 > MAX_RUN_DAYS:
            raise Refuse('A run of more than %d days is not possible (the page ignores it). Nothing was changed.' % MAX_RUN_DAYS)
    phrases = load_phrases()
    scenario = args.scenario
    if scenario not in SCENARIOS:
        raise Refuse('I do not know "%s". Use one of: %s.' % (scenario, ', '.join(SCENARIOS)))
    time_text = None
    if scenario == 'late-open':
        m = re.match(r'^([01]?\d|2[0-3]):([0-5]\d)$', (args.extra or '').strip())
        if not m:
            raise Refuse('late-open needs the time we open, on the 24-hour clock, for example  late-open 10:30  (10:30 am) or  late-open 13:00  (1 pm). Nothing was changed.')
        time_text = (int(m.group(1)), int(m.group(2)))
    if scenario == 'custom' and not (args.extra or '').strip():
        raise Refuse('custom needs the words for the bar, for example  custom "Closed for a private event." . Nothing was changed.')
    if scenario not in ('late-open', 'custom') and args.extra:
        raise Refuse('"%s" takes no extra words (you wrote: %s). Use custom "..." for your own sentence. Nothing was changed.' % (scenario, args.extra[:40]))
    notice, closes = build_notice(scenario, d, until, time_text, args.extra if scenario == 'custom' else None, phrases)
    if scenario == 'custom':
        closes = bool(args.close)    # your own words: the day is not closed unless you say so with --close
    if args.notice_only:
        closes = False
    if until and scenario == 'custom' and not args.close:
        raise Refuse('--until with custom needs --close, because the run is only a closure if you say so. Nothing was changed.')
    raw, text, bom, nl = read_file(path)
    props = find_props(text)
    missing = [p for p in PROPS if p not in props]
    if missing:
        raise Refuse('I cannot find %s in the settings of js/content.js. Nothing was changed.' % ', '.join(missing))
    settings, with_node = read_settings(text, props)
    settings.setdefault('notice', '')
    settings.setdefault('noticeUntil', '')
    if not isinstance(settings.get('closures'), list):
        raise Refuse('closures in js/content.js is not a list, so I will not touch it. Nothing was changed.')
    last = until or d
    new_days = {d + datetime.timedelta(days=k) for k in range((last - d).days + 1)}
    already = sorted(new_days & expand(settings['closures']))
    if closes and already:
        raise Refuse('%s is already in closures%s. Nothing to do. (To change only the words of the notice, add --notice-only --replace-notice.) Nothing was changed.' % (already[0], '' if len(already) == 1 else ' (and %d more days)' % (len(already) - 1)))
    q = quote_style(text, props)
    edits, before = {}, {}
    if closes:
        item = str(d) if not until else '%s..%s' % (d, until)
        edits['closures'] = new_closures_span(text, props, item, q, nl)
    if not args.no_notice:
        old_notice = settings['notice']
        has_old = bool(old_notice and (old_notice.strip() if isinstance(old_notice, str) else any(old_notice.values())))
        old_until = (settings['noticeUntil'] or '').strip()
        dead = bool(has_old and re.match(r'^\d{4}-\d{2}-\d{2}$', old_until) and old_until < str(today))
        if has_old and not dead and not args.replace_notice:
            shown = old_notice if isinstance(old_notice, str) else (old_notice.get('en') or next(v for v in old_notice.values() if v))
            raise Refuse('There is already a notice on the site: "%s" (until %s). There is only one bar. Add --replace-notice to replace it (--undo puts it back), or --no-notice to only close the day. Nothing was changed.' % (shown[:80], old_until or 'no last day'))
        edits['notice'] = new_notice_span(text, props, notice, q, nl)
        edits['noticeUntil'] = js_string(str(last), q)
    if not edits:
        raise Refuse('Nothing to change: %s' % ('the notice is switched off with --no-notice and this scenario closes nothing.' if args.no_notice else 'no closure and no notice.'))
    new_text = apply_edits(text, edits)
    return dict(path=path, raw=raw, text=text, new_text=new_text, bom=bom, nl=nl, props=props, edits=edits, settings=settings, with_node=with_node,
                date=d, until=until, scenario=scenario, notice=notice, closes=closes, today=today)


def verify(p, new_text):
    """The new text must run, say what it should, and differ from the old only in the three settings."""
    new_props = find_props(new_text)
    if outside_spans(new_text, new_props, p['edits']) != outside_spans(p['text'], p['props'], p['edits']):
        raise Refuse('Internal check failed: the edit would change more than the settings. Nothing was written.')
    got, with_node = read_settings(new_text, new_props)
    want_closures = list(p['settings']['closures']) + ([str(p['date']) if not p['until'] else '%s..%s' % (p['date'], p['until'])] if p['closes'] else [])
    if got['closures'] != (want_closures if 'closures' in p['edits'] else p['settings']['closures']):
        raise Refuse('Internal check failed: closures would read %s. Nothing was written.' % json.dumps(got['closures']))
    if 'notice' in p['edits']:
        if got['notice'] != p['notice'] or got['noticeUntil'] != str(p['until'] or p['date']):
            raise Refuse('Internal check failed: the notice would not read as planned. Nothing was written.')
    elif got['notice'] != p['settings']['notice'] or got['noticeUntil'] != p['settings']['noticeUntil']:
        raise Refuse('Internal check failed: the notice would change. Nothing was written.')
    if with_node and p['settings'].get('all') is not None:
        a, b = dict(p['settings']['all']), dict(got['all'])
        for k in PROPS:
            a.pop(k, None)
            b.pop(k, None)
        if a != b:
            raise Refuse('Internal check failed: another setting would change. Nothing was written.')
    return with_node


def show_diff(p):
    a = p['text'].splitlines(keepends=False)
    b = p['new_text'].splitlines(keepends=False)
    return '\n'.join(difflib.unified_diff(a, b, 'js/content.js (now)', 'js/content.js (after)', lineterm='', n=1))


def do_close(args):
    p = plan(args)
    verify(p, p['new_text'])
    say('What I will change in js/content.js:' if not args.dry_run else 'Dry run. This is exactly what would change in js/content.js:')
    say(show_diff(p))
    say('')
    if args.dry_run:
        say('Nothing was written (--dry-run). Run the same command without --dry-run to do it.')
        return 0, p
    d = backup_dir()
    os.makedirs(d, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S')
    bk = os.path.join(d, '%s-content.js' % stamp)
    n = 1
    while os.path.exists(bk):
        n += 1
        bk = os.path.join(d, '%s-%d-content.js' % (stamp, n))
    with open(bk, 'wb') as f:
        f.write(p['raw'])
    write_file(p['path'], p['new_text'], p['bom'])
    try:       # read it again from the disk, as the page will
        raw2, text2, bom2, _ = read_file(p['path'])
        if text2 != p['new_text'] or bom2 != p['bom']:
            raise Refuse('x')
        verify(p, text2)
    except Refuse:
        with open(bk, 'rb') as f:
            old = f.read()
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p['path']), suffix='.tmp')
        with os.fdopen(fd, 'wb') as f:
            f.write(old)
        os.replace(tmp, p['path'])
        raise Refuse('The file I wrote did not read back right, so js/content.js was put back exactly as it was. Nothing is changed. Please tell Claude.')
    state = load_state()
    new_props = find_props(p['new_text'])
    state['records'].append({'id': stamp, 'content': os.path.abspath(p['path']), 'date': str(p['date']), 'scenario': p['scenario'], 'backup': bk,
                             'sha_before': sha(p['raw']), 'sha_after': sha(read_file(p['path'])[0]),
                             'old': {k: p['text'][p['props'][k][1]:p['props'][k][2]] for k in p['edits']},
                             'new': {k: p['new_text'][new_props[k][1]:new_props[k][2]] for k in p['edits']}, 'undone': False})
    save_state(state)
    say('Done. js/content.js now says:')
    if p['closes']:
        say('  - %s is in closures: the badges for the farm, The GreenHouse and Wise Pie say closed that day (and nothing else about the day is hidden).' % p['date'])
    if 'notice' in p['edits']:
        say('  - the notice bar says (until %s):' % (p['until'] or p['date']))
        if isinstance(p['notice'], dict):
            for c in LANGS:
                say('      %s  %s' % (c, p['notice'][c]))
        else:
            say('      %s   (other languages show this English sentence)' % p['notice'])
    say('A copy of the old file is kept outside the website folder: %s' % bk)
    say('To put everything back:  python3 tools/close_today.py --undo')
    return 0, p


# ------------------------------------------------------------------------------------------------ undo
def do_undo(args):
    state = load_state()
    path = os.path.abspath(CONTENT)
    cands = [r for r in state['records'] if r['content'] == path and not r.get('undone') and (not args.date or r['date'] == args.date)]
    if not cands:
        raise Refuse('I have no record of a closure made with this tool for this website folder%s (records are kept in %s). To undo by hand: take the day out of closures in js/content.js and write notice: \'\', noticeUntil: \'\'. Nothing was changed.' % (' on ' + args.date if args.date else '', backup_dir()))
    r = cands[-1]
    raw, text, bom, nl = read_file(path)
    props = find_props(text)
    now = {k: text[props[k][1]:props[k][2]] for k in r['new']}
    if now != r['new']:
        raise Refuse('js/content.js has been changed by hand since the closure of %s (%s no longer reads as the tool wrote it), so I will not guess. The file as it was before the closure is here: %s . Nothing was changed.' % (r['date'], ', '.join(k for k in now if now[k] != r['new'][k]), r['backup']))
    new_text = apply_edits(text, r['old'])
    p = {'text': text, 'props': props, 'edits': r['old']}
    if outside_spans(new_text, find_props(new_text), r['old']) != outside_spans(text, props, r['old']):
        raise Refuse('Internal check failed: the undo would change more than the settings. Nothing was written.')
    got, _ = read_settings(new_text, find_props(new_text))        # must still run
    say('Dry run. This is what the undo would change:' if args.dry_run else 'Putting js/content.js back as before the closure of %s:' % r['date'])
    q = {'text': text, 'new_text': new_text}
    say(show_diff(q))
    if args.dry_run:
        say('Nothing was written (--dry-run).')
        return 0, None
    write_file(path, new_text, bom)
    exact = sha(read_file(path)[0]) == r['sha_before']
    r['undone'] = True
    save_state(state)
    say('')
    say('Done. %s' % ('The file is byte for byte what it was before the closure.' if exact else 'The closure is out again. (The file also has other changes you made since, which were kept.)'))
    say('Publish again so visitors see it:  python3 tools/make_deploy_folder.py  and upload what is inside deploy/.')
    return 0, None


def do_check(args):
    raw, text, bom, nl = read_file(CONTENT)
    props = find_props(text)
    missing = [p for p in PROPS if p not in props]
    if missing:
        raise Refuse('I cannot find %s in the settings of js/content.js.' % ', '.join(missing))
    settings, with_node = read_settings(text, props)
    today = farm_now().date()
    say('js/content.js (%d bytes, %s line ends%s) reads fine%s.' % (len(raw), 'Windows' if nl == '\r\n' else 'Unix', ', with a byte order mark' if bom else '', '' if with_node else ' (Node is not installed, so only my own reader checked it)'))
    say('Today on the farm clock: %s %s.' % (EN_DAY[weekday_index(today)], today))
    say('  ' + state_words(settings))
    days = expand(settings['closures'])
    say('  Closed today: %s.   Closed tomorrow: %s.' % ('YES' if today in days else 'no', 'YES' if today + datetime.timedelta(days=1) in days else 'no'))
    n = settings['notice']
    live = bool(n and (n.strip() if isinstance(n, str) else any(n.values()))) and (not settings['noticeUntil'] or str(today) <= settings['noticeUntil'])
    say('  The notice bar shows today: %s.' % ('YES' if live else 'no'))
    recs = [r for r in load_state()['records'] if r['content'] == os.path.abspath(CONTENT) and not r.get('undone')]
    say('  Closures made with this tool that can still be undone: %s.' % (', '.join(r['date'] + ' (' + r['scenario'] + ')' for r in recs) or 'none'))
    return 0, None


# ------------------------------------------------------------------------------------------------ publish and the checklist
def run(label, argv):
    r = subprocess.run([sys.executable] + argv, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=600)
    out = (r.stdout + r.stderr).strip().splitlines()
    if r.returncode != 0:
        say('  FAILED: ' + label)
        for line in out[-12:]:
            say('    ' + line)
        raise Refuse('The step "%s" stopped (see above). js/content.js is already changed and fine; fix what that step says, then run  python3 tools/make_deploy_folder.py  yourself. Nothing was uploaded.' % label)
    say('  ok: %s%s' % (label, ('  (' + out[-1][:90] + ')') if out else ''))


def do_publish():
    say('')
    say('Publishing (making the upload folder):')
    run('tools/pages.py', ['tools/pages.py'])
    run('tools/i18n.py extract', ['tools/i18n.py', 'extract'])
    run('tools/i18n.py build', ['tools/i18n.py', 'build'])
    run('tools/check_facts.py', ['tools/check_facts.py', '--short'])
    run('tools/make_deploy_folder.py', ['tools/make_deploy_folder.py'])
    say('Now upload what is INSIDE the folder deploy/ (docs/LAUNCH_CHECKLIST.md, step 3.2). Visitors\' browsers may keep the old file for up to an hour.')


def site_line(code):
    """The farm's own sentence about refunds when severe weather closes it, in English or Spanish, if the site has it (never invented)."""
    try:
        en = json.load(open(os.path.join(ROOT, 'lang', 'en.json'), encoding='utf-8'))
        hit = [k for k, v in en.items() if 'severe weather forces us to close' in v and 'full refund' in v and len(v) < 140]
        if not hit:
            return ''
        if code == 'en':
            return re.sub(r'<[^>]+>', '', en[hit[0]]).strip().rstrip('.') + '.'
        es = json.load(open(os.path.join(ROOT, 'lang', 'src', 'es.json'), encoding='utf-8'))['ui'].get(hit[0], '')
        return re.sub(r'<[^>]+>', '', es).strip().rstrip('.') + '.' if es else ''
    except (OSError, ValueError):
        return ''


def posts(p, args):
    """Ready-to-paste text for the places this tool cannot reach: (English, Spanish)."""
    d, until = p['date'], p['until']
    sc = p['scenario']
    why_en = {'rain': 'for rain', 'wind': 'for strong wind', 'holiday': 'for the holiday'}.get(sc)
    why_es = {'rain': 'por lluvia', 'wind': 'por el viento fuerte', 'holiday': 'por el día festivo'}.get(sc)
    wd_en, dt_en = day_words('en', d)
    wd_es = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][weekday_index(d)]
    dt_es = '%d de %s' % (d.day, ES_MONTH_LONG[d.month - 1])
    reopen_en = reopen_es = ''
    if args.reopen:
        r = parse_day(args.reopen, '--reopen')
        rw, rd = day_words('en', r)
        reopen_en = ' We plan to open again %s, %s, weather permitting.' % (rw, rd)
        reopen_es = ' Planeamos abrir de nuevo el %s %d de %s, si el clima lo permite.' % (['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][weekday_index(r)], r.day, ES_MONTH_LONG[r.month - 1])
    if sc in ('rain', 'wind', 'holiday'):
        if until:
            wd2, dt2 = day_words('en', until)
            en = 'We are closed %s, %s, to %s, %s, %s.' % (wd_en, dt_en, wd2, dt2, why_en)
            es = 'Estamos cerrados del %s %s al %s %d de %s %s.' % (wd_es, dt_es, ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][weekday_index(until)], until.day, ES_MONTH_LONG[until.month - 1], why_es)
        else:
            en = 'We are closed %s, %s, %s.' % (wd_en, dt_en, why_en)
            es = 'Estamos cerrados el %s %s %s.' % (wd_es, dt_es, why_es)
        en += reopen_en + ' Thank you for understanding.'
        es += reopen_es + ' Gracias por tu comprensión.'
        if sc in ('rain', 'wind'):
            if site_line('en'):
                en += ' ' + site_line('en')
            if site_line('es'):
                es += ' ' + site_line('es')
    elif sc == 'late-open':
        en = 'We open late %s, %s: at %s. Thank you for your patience.' % (wd_en, dt_en, clock('en', *p_time(args)))
        es = 'El %s %s abrimos tarde: a las %s. Gracias por tu paciencia.' % (wd_es, dt_es, clock('es', *p_time(args)))
    elif sc == 'sold-out':
        en = 'Reservations are full for %s, %s. Please choose another day.' % (wd_en, dt_en)
        es = 'Las reservas están completas para el %s %s. Elige otro día.' % (wd_es, dt_es)
    else:
        en = p['notice'] if isinstance(p['notice'], str) else ''
        es = '(write the Spanish yourself or ask Claude)'
    return en, es


def p_time(args):
    m = re.match(r'^(\d+):(\d+)$', args.extra.strip())
    return int(m.group(1)), int(m.group(2))


def print_checklist(p, args):
    en, es = posts(p, args)
    say('')
    say('WHAT THIS TOOL CANNOT DO (the website part is done once you publish):')
    if p['closes']:
        say('  1. BOOKEO: close that day\'s times, as you always do, and press Reserve on the site to see no times for it. The website cannot stop people booking.')
    else:
        say('  1. BOOKEO: this notice does not close anything. If the day should change in Bookeo (later times, no more places), change it there.')
    say('  2. GOOGLE BUSINESS PROFILE: post (or change the hours for the day). Paste:')
    say('       EN  ' + en)
    say('       ES  ' + es)
    say('  3. INSTAGRAM and FACEBOOK: the same words work. The site tells visitors to check Instagram, so do this one before anything else.')
    say('  4. LOOK at the live site on your phone after you upload (hard refresh). Ready-to-paste words for every kind of day: docs/NOTICE_KIT.md')
    if any(not v for k, v in load_phrases().get('native_read', {}).items() if k != 'en') and isinstance(p['notice'], dict):
        say('  Note: the Spanish, Hindi, Chinese and Vietnamese sentences of the bar were written by an AI and no native speaker has read them yet (tools/notice_phrases.json).')


def say(text=''):
    print(text, flush=True)


def parse(argv):
    ap = argparse.ArgumentParser(prog='close_today.py', add_help=True, description='Close the farm for a day, safely (see the top of this file, or docs/NOTICE_KIT.md).')
    ap.add_argument('scenario', nargs='?', help='rain, wind, holiday, late-open, sold-out or custom')
    ap.add_argument('extra', nargs='?', help='late-open: the time (10:30). custom: the words for the bar, in quote marks')
    ap.add_argument('--date', help='the day, YYYY-MM-DD (default: today on the farm clock)')
    ap.add_argument('--until', help='the last closed day of a run, YYYY-MM-DD')
    ap.add_argument('--reopen', help='the day you open again, YYYY-MM-DD (only for the ready-to-paste posts)')
    ap.add_argument('--dry-run', action='store_true', help='show exactly what would change; change nothing')
    ap.add_argument('--check', action='store_true', help='say what js/content.js says now; change nothing')
    ap.add_argument('--undo', action='store_true', help='put js/content.js back as it was before the last closure')
    ap.add_argument('--publish', action='store_true', help='also make the upload folder (pages, translations, facts check, deploy/)')
    ap.add_argument('--no-notice', action='store_true', help='only add the day to the closures; leave the bar alone')
    ap.add_argument('--replace-notice', action='store_true', help='replace a notice that is already on the site')
    ap.add_argument('--close', action='store_true', help='with custom: also close the day in closures')
    ap.add_argument('--notice-only', action='store_true', help='change only the notice bar, close nothing')
    return ap.parse_args(argv)


def main(argv=None):
    if sys.version_info < (3, 8):
        print('This needs Python 3.8 or newer (this is %d.%d).' % sys.version_info[:2])
        return 2
    args = parse(argv)
    try:
        if args.check:
            return do_check(args)[0]
        if args.undo:
            return do_undo(args)[0]
        if not args.scenario:
            raise Refuse('Say what happened: rain, wind, holiday, late-open HH:MM, sold-out or custom "words". Example:  python3 tools/close_today.py rain   (add --dry-run to only look)')
        code, p = do_close(args)
        if args.dry_run:
            print_checklist(p, args)
            return code
        print_checklist(p, args)
        if args.publish:
            do_publish()
        else:
            say('')
            say('NEXT, to put it on the live site, one command:  python3 tools/make_deploy_folder.py   (or run this again with --publish), then upload what is inside deploy/.')
        return code
    except Refuse as e:
        say(str(e))
        return 1


if __name__ == '__main__':
    sys.exit(main())
