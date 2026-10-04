#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""What changes or runs out on the Wise Acres website in the next two weeks, in plain English.

    python3 tools/upcoming_dates.py                     the next 14 days, counted from today (farm time, Eastern)
    python3 tools/upcoming_dates.py --today 2026-11-02  pretend it is that day (to try it, and for the tests)
    python3 tools/upcoming_dates.py --days 30           look further ahead
    python3 tools/upcoming_dates.py --markdown          the same list with headings and bullets (for GitHub's job summary)

It reads the dates the site files carry:
  index.html and pages/*.html   data-until="2026-10-04" (a line that hides itself the day after) and data-release="2026-10-13" (a pizza
                                weekend that opens for reservations that Tuesday)
  js/content.js                 closures (closed days), noticeUntil (the yellow bar goes), week.updated (the "This week at the farm" box
                                goes 14 days after it, or after expireDays)
  js/season.js                  the first and last day of spring, summer, fall and winter (the home page changes its look)
  docs/OWNER_YEAR_CALENDAR.md   if the file exists: every line that has a date written like 2026-11-08 (or Nov 8, 2026)
Nothing is changed and nothing is sent anywhere. Needs Python 3.8 or newer and nothing else.

The exit code is 0 when nothing runs out within --fail-within days (default 7), 1 when something does, and 2 for a wrong command.
"Runs out" means what --fail-on says (default: both kinds below):
  expires    a line, bar or ribbon that hides itself after its date (data-until, noticeUntil)
  runs-out   something visitors rely on stops: the "This week" box, the last pizza weekend in the schedule
Things that only change (a season starts, a closed day, a pizza weekend opens, a row drops off the table) are listed but never make it fail.
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import os
import re
import sys
from html.parser import HTMLParser

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
DAY = dt.timedelta(days=1)
MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
MONTH_NUMBER = dict((m[:3].lower(), i + 1) for i, m in enumerate(MONTHS))
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}


# ------------------------------------------------------------------------------------------------ dates
def real_day(text):
    """'2026-10-04' -> a date; anything else (including 2026-11-31, which is not a day) -> None."""
    m = re.match(r'^\s*(\d{4})-(\d{1,2})-(\d{1,2})\s*$', text or '')
    if not m:
        return None
    try:
        return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def nice(d):
    return '%s, %s %d' % (d.strftime('%A'), MONTHS[d.month - 1][:3], d.day)


def nice_year(d):
    return '%s %d, %d' % (MONTHS[d.month - 1][:3], d.day, d.year)


def in_days(n):
    return 'today' if n == 0 else ('tomorrow' if n == 1 else 'in %d days' % n)


def eastern_today(now=None):
    """The farm's calendar day: today in New York, whatever the computer's time zone (daylight saving: second Sunday of March to first Sunday of November)."""
    now = now or dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    def nth_sunday(year, month, n):
        d = dt.date(year, month, 1)
        d += dt.timedelta(days=(6 - d.weekday()) % 7)
        return d + dt.timedelta(days=7 * (n - 1))
    start = dt.datetime.combine(nth_sunday(now.year, 3, 2), dt.time(7, 0))    # 2:00 local = 7:00 UTC
    end = dt.datetime.combine(nth_sunday(now.year, 11, 1), dt.time(6, 0))     # 2:00 local = 6:00 UTC
    return (now - dt.timedelta(hours=4 if start <= now < end else 5)).date()


def thanksgiving_friday(year):
    """The Friday after the 4th Thursday of November (js/season.js, thanksgivingFriday)."""
    d = dt.date(year, 11, 1)
    first_thursday = d + dt.timedelta(days=(3 - d.weekday()) % 7)
    return first_thursday + dt.timedelta(days=22)


# ------------------------------------------------------------------------------------------------ reading the files
def read(path):
    try:
        with open(path, encoding='utf-8') as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return None


def strip_html_comments(text):
    return re.sub(r'<!--.*?-->', lambda m: re.sub(r'[^\n]', ' ', m.group(0)), text, flags=re.S)


class Dated(HTMLParser):
    """Finds the elements that carry data-until or data-release, with the words inside them (and, for a table row, the words of each cell)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.found = [], []

    def handle_starttag(self, tag, attrs):
        if tag in VOID:
            return
        a = dict(attrs)
        rec = None
        if 'data-until' in a or 'data-release' in a:
            rec = {'tag': tag, 'until': a.get('data-until'), 'release': a.get('data-release'), 'text': [], 'cells': [], 'line': self.getpos()[0]}
            self.found.append(rec)
        if tag in ('td', 'th'):
            for _, r in self.stack:
                if r is not None and r['tag'] == 'tr':
                    r['cells'].append([])
        self.stack.append((tag, rec))

    def handle_startendtag(self, tag, attrs):
        pass   # <use ... /> and friends have no words

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        for _, rec in self.stack:
            if rec is not None:
                rec['text'].append(data)
                if rec['cells']:
                    rec['cells'][-1].append(data)


def words_of(rec, limit=90):
    t = ' '.join(''.join(rec['text']).split())
    return (t[:limit - 1].rstrip() + '...') if len(t) > limit else t


def cells_of(rec):
    return [' '.join(''.join(c).split()) for c in rec['cells']]


def find_html_dates(root):
    """[(file, line, tag, until, release, words)] from index.html and the page sources."""
    files = ['index.html']
    pages = os.path.join(root, 'pages')
    if os.path.isdir(pages):
        files += ['pages/' + f for f in sorted(os.listdir(pages)) if f.endswith('.html')]
    out = []
    for rel in files:
        text = read(os.path.join(root, rel))
        if text is None:
            continue
        p = Dated()
        p.feed(strip_html_comments(text))
        p.close()
        for r in p.found:
            out.append((rel, r['line'], r['tag'], r['until'], r['release'], words_of(r), cells_of(r)))
    return out


def strip_js_comments(src):
    """JavaScript without its comments (quote marks are respected, so https:// inside a string stays)."""
    out, i, n, q = [], 0, len(src), None
    while i < n:
        c = src[i]
        if q:
            out.append(c)
            if c == '\\' and i + 1 < n:
                out.append(src[i + 1])
                i += 1
            elif c == q:
                q = None
        elif c in '\'"`':
            q = c
            out.append(c)
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2)
            i = n if j < 0 else j + 1
        elif src.startswith('//', i):
            j = src.find('\n', i)
            i = n if j < 0 else j - 1
        else:
            out.append(c)
        i += 1
    return ''.join(out)


def block_after(src, key):
    """The text of the { ... } or [ ... ] that follows 'key:' (nested brackets and quotes are respected), or None."""
    m = re.search(r'(?<![\w.])' + re.escape(key) + r'\s*:\s*([{\[])', src)
    if not m:
        return None
    open_c = m.group(1)
    close_c = '}' if open_c == '{' else ']'
    depth, i, q = 0, m.end() - 1, None
    start = i
    while i < len(src):
        c = src[i]
        if q:
            if c == '\\':
                i += 1
            elif c == q:
                q = None
        elif c in '\'"`':
            q = c
        elif c == open_c:
            depth += 1
        elif c == close_c:
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    return None


def strings_in(text):
    return [m.group(2) for m in re.finditer(r'([\'"])((?:\\.|(?!\1).)*)\1', text or '')]


def read_content(root):
    """closures, noticeUntil and week from js/content.js: ([closure strings], noticeUntil, notice words, week block or None)."""
    raw = read(os.path.join(root, 'js', 'content.js'))
    if raw is None:
        return None
    code = strip_js_comments(raw)
    start = code.find('window.WISE_ACRES')
    code = code[start:] if start >= 0 else code
    closures = strings_in(block_after(code, 'closures'))
    nu = re.search(r'noticeUntil\s*:\s*([\'"])(.*?)\1', code)
    week = block_after(code, 'week')
    notice = re.search(r'(?<![\w.])notice\s*:\s*([\'"])(.*?)\1', code)
    return {'closures': closures, 'noticeUntil': nu.group(2) if nu else '', 'notice': notice.group(2) if notice else '', 'week': week}


def read_seasons(root):
    """[(season id, crop words, first day function, last day function)] from js/season.js; each function maps a year to a date."""
    src = read(os.path.join(root, 'js', 'season.js'))
    if src is None:
        return []
    out = []
    for m in re.finditer(r"\{\s*id:\s*'(\w+)',\s*crop:\s*'([^']*)',\s*start:\s*(.*?),\s*end:\s*(function[^}]*\}|\w+)\s*,\s*next:", src, re.S):
        sid, crop, start, end = m.groups()

        def make(expr):
            mm = re.search(r'new Date\(y,\s*(\d+),\s*(\d+)\)', expr)
            if mm:
                month, day = int(mm.group(1)) + 1, int(mm.group(2))
                return lambda y: dt.date(y, month, day)
            if 'thanksgivingFriday' in expr:
                return thanksgiving_friday
            return None
        s, e = make(start), make(end)
        if s and e:
            out.append((sid, crop, s, e))
    return out


def read_calendar_doc(root):
    """Lines of docs/OWNER_YEAR_CALENDAR.md that have a date: [(date, words)]. Dates may be 2026-11-08, Nov 8, 2026 or 8 Nov 2026."""
    text = read(os.path.join(root, 'docs', 'OWNER_YEAR_CALENDAR.md'))
    if text is None:
        return None
    out = []
    for line in text.split('\n'):
        days = []
        for m in re.finditer(r'\b(\d{4})-(\d{2})-(\d{2})\b', line):
            d = real_day(m.group(0))
            if d:
                days.append(d)
        for m in re.finditer(r'\b([A-Z][a-z]{2})[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})\b', line):
            mo = MONTH_NUMBER.get(m.group(1).lower())
            try:
                if mo:
                    days.append(dt.date(int(m.group(3)), mo, int(m.group(2))))
            except ValueError:
                pass
        for m in re.finditer(r'\b(\d{1,2}) ([A-Z][a-z]{2})[a-z]* (\d{4})\b', line):
            mo = MONTH_NUMBER.get(m.group(2).lower())
            try:
                if mo:
                    days.append(dt.date(int(m.group(3)), mo, int(m.group(1))))
            except ValueError:
                pass
        if days:
            words = re.sub(r'[|*_`#>]+', ' ', line)
            words = ' '.join(re.sub(r'\b\d{4}-\d{2}-\d{2}\b', '', words).split()).strip(' -:;,')
            for d in sorted(set(days)):
                out.append((d, words))
    return out


# ------------------------------------------------------------------------------------------------ the list
class Item(object):
    def __init__(self, day, kind, what, where, note=''):
        self.day, self.kind, self.what, self.where, self.note = day, kind, what, where, note   # kind: expires, runs-out, changes, noted, past


def collect(root, today, horizon):
    """(items, problems): every dated thing from today to horizon (and the ones already past that are still in the files)."""
    items, problems = [], []

    # --- the pages
    rows = []
    for rel, line, tag, until, release, words, cells in find_html_dates(root):
        where = '%s at data-until="%s"' % (rel, until) if until is not None else '%s at data-release="%s"' % (rel, release)
        d_until, d_release = (real_day(until) if until is not None else None), (real_day(release) if release is not None else None)
        if until is not None and d_until is None:
            problems.append('%s: data-until="%s" is not a real day (write it like 2026-10-04).' % (rel, until))
        if release is not None and d_release is None:
            problems.append('%s: data-release="%s" is not a real day (write it like 2026-10-13).' % (rel, release))
        if tag == 'tr' and d_release is not None:
            rows.append((rel, d_release, d_until, (cells[-1] if cells else words), where))
            continue
        if d_until is not None:
            items.append(Item(d_until, 'expires', 'Last day of the line "%s". It hides itself after this day.' % words, where,
                              'Nothing to do if that is what you want; to keep it longer change the date, to remove it for good delete the line.'))
    if rows:
        newest = max((r[2] or r[1]) for r in rows)
        for rel, d_release, d_until, words, where in rows:
            label = 'the pizza weekend %s' % words
            if d_release is not None:
                items.append(Item(d_release, 'changes', 'Reservations for %s open (5:00 PM).' % label, where))
            if d_until is not None:
                if d_until == newest:
                    items.append(Item(d_until, 'runs-out', 'Last day of %s, the LAST one in the pizza schedule. After it the table has no weekend left.' % label, where,
                                      'Add the next weekends to the schedule (README, "Day-to-day changes") before then.'))
                else:
                    items.append(Item(d_until, 'changes', 'Last day of %s in the schedule table; it drops off the table after this day.' % label, where))

    # --- js/content.js
    c = read_content(root)
    if c:
        for s in c['closures']:
            parts = [p.strip() for p in s.split('..')]
            days = [real_day(p) for p in parts]
            if len(parts) > 2 or any(d is None for d in days):
                problems.append('js/content.js: closures "%s" is not a day (2026-11-09) or a range (2026-11-09..2026-11-15).' % s)
                continue
            a, b = days[0], days[-1]
            if b < a:
                problems.append('js/content.js: closures "%s" ends before it starts.' % s)
                continue
            what = ('The farm, The GreenHouse and Wise Pie show CLOSED on %s.' % nice(a)) if a == b else \
                   ('The farm, The GreenHouse and Wise Pie show CLOSED from %s to %s.' % (nice(a), nice(b)))
            items.append(Item(a, 'changes', what, 'js/content.js at closures: ' + s, 'It does not change Bookeo: close those times there too.'))
        if c['noticeUntil']:
            d = real_day(c['noticeUntil'])
            if d is None:
                problems.append('js/content.js: noticeUntil "%s" is not a real day (write it like 2026-10-05).' % c['noticeUntil'])
            else:
                shown = ('The yellow notice bar ("%s")' % c['notice'][:60]) if c['notice'] else 'The yellow notice bar'
                items.append(Item(d, 'expires', 'Last day of the %s. It goes away by itself after this day.' % shown[4:], 'js/content.js at noticeUntil: ' + c['noticeUntil']))
        if c['week']:
            wk = c['week']
            body = re.sub(r'updated\s*:\s*([\'"]).*?\1', '', wk)
            has_content = bool(re.search(r'note\s*:\s*[\'"{]\s*[^\'"\s}]|crops\s*:\s*\{\s*\w|days\s*:\s*\[\s*\{', body))
            um = re.search(r'updated\s*:\s*([\'"])(.*?)\1', wk)
            if has_content and um:
                d = real_day(um.group(2))
                keep = re.search(r'expireDays\s*:\s*(\d+)', wk)
                keep = int(keep.group(1)) if keep else 14
                if d is None:
                    problems.append('js/content.js: week.updated "%s" is not a real day.' % um.group(2))
                else:
                    last = d + dt.timedelta(days=keep)
                    items.append(Item(last, 'runs-out', 'Last day of the "This week at the farm" box (it was updated %s and stays %d days). It hides itself after this day.' % (nice_year(d), keep),
                                      'js/content.js at updated: ' + um.group(2), 'Check the week, then change updated to today\'s date (README, "Day-to-day changes").'))

    # --- the seasons
    seasons = read_seasons(root)
    if not seasons and os.path.exists(os.path.join(root, 'js', 'season.js')):
        problems.append('js/season.js: the season dates could not be read, so they are not listed (the tool needs updating).')
    for sid, crop, start, end in seasons:
        for y in (today.year - 1, today.year, today.year + 1):
            s, e = start(y), end(y)
            items.append(Item(s, 'changes', 'The %s season starts: the home page changes to its %s look (%s).' % (sid, sid, crop), 'js/season.js'))
            items.append(Item(e, 'changes', 'Last day of the %s season. The day after, the home page shows whichever season is closest.' % sid, 'js/season.js'))

    # --- the owner's calendar document
    doc = read_calendar_doc(root)
    for d, words in (doc or []):
        items.append(Item(d, 'noted', words or '(a date in the calendar document)', 'docs/OWNER_YEAR_CALENDAR.md'))

    window = [i for i in items if today <= i.day <= horizon]
    past = [i for i in items if i.day <= today and i.kind in ('expires', 'runs-out') and i.day < today and i.where.startswith(('index.html', 'pages/'))]
    window.sort(key=lambda i: (i.day, {'runs-out': 0, 'expires': 1, 'changes': 2, 'noted': 3}[i.kind], i.what))
    past.sort(key=lambda i: (i.day, i.what))
    return window, past, problems


def lines_of(window, past, problems, today, days, fail_within, fail_on, markdown):
    """(text, number of things that make the check fail)."""
    red = [i for i in window if i.kind in fail_on and (i.day - today).days <= fail_within]
    rest = [i for i in window if i not in red]
    bold = (lambda t: '**' + t + '**') if markdown else (lambda t: t)
    head = (lambda t: '### ' + t) if markdown else (lambda t: t + '\n' + '-' * len(t))
    bullet = '- ' if markdown else '  '
    when = lambda i: bold('%s (%s)' % (nice(i.day), in_days((i.day - today).days)))
    out = [('## ' if markdown else '') + 'Things that change or expire on the website in the next %d days' % days,
           'Today is %s, %d (farm time, Eastern).' % (nice(today), today.year), '']
    if red:
        out.append(head('Needs you: something runs out within %d days' % fail_within))
        for i in red:
            out.append('%s%s: %s' % (bullet, when(i), i.what))
            out.append('%s  Where: %s.%s' % ('  ' if markdown else '    ', i.where, (' ' + i.note) if i.note else ''))
        out.append('')
    if rest:
        out.append(head('Also coming up'))
        out += ['%s%s: %s' % (bullet, when(i), i.what) for i in rest]
        out.append('')
    if not window:
        out += ['Nothing is dated in the next %d days.' % days, '']
    if past:
        out.append(head('Already past and still in the files (they stay hidden; delete them when you next edit)'))
        out += ['%s%s: %s' % (bullet, nice_year(i.day), i.what) for i in past[:8]]
        if len(past) > 8:
            out.append('%s... and %d more.' % (bullet, len(past) - 8))
        out.append('')
    if problems:
        out.append(head('Dates the check could not read (the site skips them too)'))
        out += [bullet + p for p in problems]
        out.append('')
    n = len(red)
    out.append(bold('Result:') + ' ' + ('%d thing%s run%s out within %d days. This check stays red until it is dealt with.' % (n, '' if n == 1 else 's', 's' if n == 1 else '', fail_within)
                                        if red else 'nothing runs out within %d days.' % fail_within))
    return '\n'.join(out), n


def main(argv=None):
    ap = argparse.ArgumentParser(description='What changes or runs out on the website in the next days, in plain English.')
    ap.add_argument('--today', help='pretend it is this day (YYYY-MM-DD); default: today in New York')
    ap.add_argument('--days', type=int, default=14, help='how many days ahead to list (default 14)')
    ap.add_argument('--fail-within', type=int, default=7, help='exit with code 1 when something runs out within this many days (default 7)')
    ap.add_argument('--fail-on', default='expires,runs-out', help='which kinds make it fail: expires, runs-out (default both)')
    ap.add_argument('--markdown', action='store_true', help='headings and bullets, for GitHub\'s job summary')
    ap.add_argument('--root', default=ROOT, help='the site folder (default: the folder this tool is in)')
    try:
        a = ap.parse_args(argv)
    except SystemExit as e:
        return 2 if e.code else 0
    today = real_day(a.today) if a.today else eastern_today()
    if today is None:
        print('--today must be a real day written like 2026-10-02 (year-month-day).')
        return 2
    if a.days < 1 or a.fail_within < 0:
        print('--days must be 1 or more and --fail-within 0 or more.')
        return 2
    kinds = set(k.strip() for k in a.fail_on.split(',') if k.strip())
    if not kinds <= {'expires', 'runs-out'}:
        print('--fail-on takes expires, runs-out or both (comma separated).')
        return 2
    if not os.path.isfile(os.path.join(a.root, 'index.html')):
        print('%s does not look like the site folder (no index.html).' % a.root)
        return 2
    window, past, problems = collect(a.root, today, today + dt.timedelta(days=max(a.days, a.fail_within)))
    text, nred = lines_of(window, past, problems, today, a.days, a.fail_within, kinds, a.markdown)
    print(text)
    return 1 if nred else 0


if __name__ == '__main__':
    sys.exit(main())
