#!/usr/bin/env python3
"""Translates the date lines of the pizza schedule for you, so a new weekend needs no translator.

  python3 tools/date_phrases.py "Oct 9–11"          show the four translations of one date line
  python3 tools/date_phrases.py --sample            about 14 English lines with their four translations, for a native speaker to read once

tools/i18n.py extract calls this on every run. A text it knows gets its Spanish, Hindi, Chinese and Vietnamese
translation written into lang/src/<code>.json (only where that file has no translation yet: a line a person
wrote is never replaced). Two kinds of text are known:

  1. A date on its own, as in the schedule table:     Oct 6      Oct 9–11      Oct 30–Nov 8      Oct 9 & 10
  2. The line under the table, in this exact shape (the last two sentences are optional):
       <strong>Open now:</strong> pizza reservations for Oct 2 &amp; 3. We haven&rsquo;t opened Sunday, Oct 4. Unless the forecast
       changes a lot, we&rsquo;ll be closed that day for rain.
     where "Oct 2 & 3" can be any date in the shapes above, and the day can be any weekday.

Months are the three letters Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec. The dash in a range is the long dash (&ndash;).
Any other wording is NOT translated here: `python3 tools/i18n.py missing es --list` lists it, as before.
The words for the months, the weekdays and the fixed sentences below were taken from the translations the farm already
has (lang/src/*.json). tests/date-phrases.test.mjs checks that every one of those comes out letter for letter.
"""
import os, re, sys

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

LANGS = ('es', 'hi', 'zh', 'vi')
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

# The month and weekday words are the ones the page itself shows (the countdown uses Intl with the same choices:
# Hindi spells the month out, Spanish and Vietnamese shorten it, Chinese counts months, Chinese weekdays are the short 周 form).
MONTH = {
    'es': ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'],
    'hi': ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
}   # Chinese and Vietnamese count the months: 10月, thg 10
WEEKDAY = {   # Sunday first
    'es': ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
    'hi': ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'],
    'zh': ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    'vi': ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'],
}


def _mon(code, m):
    """The month word as it stands after a day number in the table: 'oct', 'अक्टूबर', 'thg 10'."""
    return ('thg %d' % (m + 1)) if code == 'vi' else MONTH[code][m]


# ---------------------------------------------------------------- 1. dates in the table
def cell(code, kind, a, b):
    """kind: 'one' (Oct 6), 'range' (Oct 9–11, Oct 30–Nov 8), 'pair' (Oct 9 & 10). a, b = (month index, day)."""
    (m1, d1), (m2, d2) = a, (b or a)
    same = m1 == m2
    if code == 'zh':   # no space between number and 月/日 inside the table
        one = lambda m, d: '%d月%d日' % (m + 1, d)
        if kind == 'one':
            return one(m1, d1)
        sep = '–' if kind == 'range' else '和'
        if not same:
            return one(m1, d1) + sep + one(m2, d2)
        return '%d月%d–%d日' % (m1 + 1, d1, d2) if kind == 'range' else '%d月%d日和%d日' % (m1 + 1, d1, d2)
    sep = '–' if kind == 'range' else {'es': ' y ', 'hi': ' और ', 'vi': ' và '}[code]
    word = lambda m: ' ' + _mon(code, m)
    if kind == 'one':
        return '%d%s' % (d1, word(m1))
    return ('%d%s%d%s' % (d1, sep, d2, word(m1))) if same else ('%d%s%s%d%s' % (d1, word(m1), sep, d2, word(m2)))


# ---------------------------------------------------------------- 2. the line under the table
# The date phrase inside the sentence: "for Oct 2 & 3" is "para el 2 y 3 de oct", "2 और 3 अक्टूबर के लिए", "10 月 2 日和 3 日的", "cho ngày 2 và 3 thg 10".
def phrase(code, kind, a, b):
    (m1, d1), (m2, d2) = a, (b or a)
    same = m1 == m2
    if code == 'es':
        de = lambda m: 'de ' + MONTH['es'][m]
        if kind == 'one':
            return 'el %d %s' % (d1, de(m1))
        if kind == 'pair':
            return ('el %d y %d %s' % (d1, d2, de(m1))) if same else 'el %d %s y el %d %s' % (d1, de(m1), d2, de(m2))
        return ('el %d–%d %s' % (d1, d2, de(m1))) if same else 'el %d %s–%d %s' % (d1, de(m1), d2, de(m2))
    if code == 'hi':
        mon = lambda m: MONTH['hi'][m]
        sep = ' और ' if kind == 'pair' else '–'
        if kind == 'one':
            return '%d %s' % (d1, mon(m1))
        return ('%d%s%d %s' % (d1, sep, d2, mon(m1))) if same else '%d %s%s%d %s' % (d1, mon(m1), sep, d2, mon(m2))
    if code == 'zh':
        if kind == 'one':
            return '%d 月 %d 日' % (m1 + 1, d1)
        sep = '和 ' if kind == 'pair' else '–'   # the farm's sentence has a space after 和: "10 月 2 日和 3 日"
        if not same:
            return '%d 月 %d 日%s%d 月 %d 日' % (m1 + 1, d1, sep, m2 + 1, d2)
        return '%d 月 %d 日%s%d 日' % (m1 + 1, d1, sep, d2) if kind == 'pair' else '%d 月 %d–%d 日' % (m1 + 1, d1, d2)
    thg = lambda m: 'thg %d' % (m + 1)   # vi
    if kind == 'one':
        return 'ngày %d %s' % (d1, thg(m1))
    sep = ' và ' if kind == 'pair' else '–'
    return ('ngày %d%s%d %s' % (d1, sep, d2, thg(m1))) if same else 'ngày %d %s%s%d %s' % (d1, thg(m1), sep, d2, thg(m2))


HEAD = {   # "<strong>Open now:</strong> pizza reservations for {dates}."
    'es': '<strong>Abierto ahora:</strong> reservas con pizza para %s.',
    'hi': '<strong>अभी खुला:</strong> %s के लिए पिज़्ज़ा रिज़र्वेशन।',
    'zh': '<strong>现已开放：</strong>%s的披萨预约。',
    'vi': '<strong>Đang mở:</strong> đặt chỗ có pizza cho %s.',
}
TAIL = {   # " We haven't opened {weekday}, {date}. Unless the forecast changes a lot, we'll be closed that day for rain."   (weekday, date)
    'es': ' No hemos abierto el %s %s. A menos que el pronóstico cambie mucho, ese día estaremos cerrados por lluvia.',
    'hi': ' %s, %s के रिज़र्वेशन हमने अभी नहीं खोले हैं। जब तक पूर्वानुमान बहुत न बदले, उस दिन हम बारिश के कारण बंद रहेंगे।',
    'zh': '%s（%s）尚未开放。除非天气预报大幅变化，否则我们那天会因下雨休息。',
    'vi': ' Chúng tôi chưa mở %s, %s. Trừ khi dự báo thay đổi nhiều, chúng tôi sẽ đóng cửa ngày đó vì mưa.',
}


def tail_date(code, a):
    m, d = a
    return {'es': '%d de %s' % (d, MONTH['es'][m]), 'hi': '%d %s' % (d, MONTH['hi'][m]), 'zh': '%d 月 %d 日' % (m + 1, d), 'vi': '%d thg %d' % (d, m + 1)}[code]


# ---------------------------------------------------------------- reading the English
_MON = '(' + '|'.join(MONTHS) + ')'
_WD = '(' + '|'.join(WEEKDAYS) + ')'
DATES = re.compile(r'^%s (\d{1,2})(?:( (?:&amp;|&) |–)(?:%s )?(\d{1,2}))?$' % (_MON, _MON))
SENTENCE = re.compile(r"^<strong>Open now:</strong> pizza reservations for (.+?)\.(?: We haven['’]t opened %s, (%s \d{1,2})\. Unless the forecast changes a lot, we['’]ll be closed that day for rain\.)?$" % (_WD, _MON))


def _fail(why):
    raise ValueError(why)


def parse_dates(s):
    """'Oct 9–11' -> ('range', (9, 9), (9, 11)); raises ValueError with a plain reason when it is not a date in a known shape."""
    m = DATES.match(s)
    if not m:
        _fail('it is not one of: Oct 6   Oct 9–11   Oct 30–Nov 8   Oct 9 & 10   Oct 31 & Nov 1 (three-letter month, a space, the day; the long dash – for a range)')
    m1, d1, sep, m2, d2 = m.group(1), int(m.group(2)), m.group(3), m.group(4), m.group(5)
    i1 = MONTHS.index(m1)
    a = (i1, d1)
    if not 1 <= d1 <= DAYS_IN[i1]:
        _fail('there is no %s %d' % (m1, d1))
    if sep is None:
        return ('one', a, None)
    i2 = MONTHS.index(m2) if m2 else i1
    d2 = int(d2)
    if not 1 <= d2 <= DAYS_IN[i2]:
        _fail('there is no %s %d' % (MONTHS[i2], d2))
    if i2 != i1 and i2 != (i1 + 1) % 12:
        _fail('the second month must be the month after the first')
    if i2 == i1 and d2 <= d1:
        _fail('the second day must come after the first')
    return ('range' if sep == '–' else 'pair', a, (i2, d2))


def translate(code, text):
    """The translation of a date line the tool knows, or None (then a person translates it, as before)."""
    if code not in LANGS:
        return None
    try:
        kind, a, b = parse_dates(text)
        return cell(code, kind, a, b)
    except ValueError:
        pass
    m = SENTENCE.match(text)
    if not m:
        return None
    try:
        kind, a, b = parse_dates(m.group(1))
        out = HEAD[code] % phrase(code, kind, a, b)
        if m.group(2):
            wd, d = WEEKDAY[code][WEEKDAYS.index(m.group(2))], tail_date(code, parse_dates(m.group(3))[1])
            out += TAIL[code] % ((d, wd) if code == 'zh' else (wd, d))
        return out
    except ValueError:
        return None


def why_not(text):
    """Plain words for a text that looks like one of these but is not understood (None when it does not look like one)."""
    t = text.strip()
    if t.startswith('<strong>Open now:</strong> pizza reservations for'):
        m = SENTENCE.match(t)
        if m:
            for part in (m.group(1), m.group(3)):
                if part:
                    try:
                        parse_dates(part)
                    except ValueError as e:
                        return 'The dates "%s" are not understood: %s.' % (part, e)
            return None
        return ('The "Open now" line is not in the shape the tool knows: "<strong>Open now:</strong> pizza reservations for Oct 9–11." '
                'and, if you want it, " We haven’t opened Sunday, Oct 11. Unless the forecast changes a lot, we’ll be closed that day for rain." Any other word needs a translation.')
    if re.match(r'^(?:%s|[A-Z][a-z]{2,8}\.?) \d{1,2}(?:\D|$)' % _MON, t) and len(t) < 30:
        try:
            parse_dates(t)
        except ValueError as e:
            return 'It looks like a date but is not understood: %s.' % e
    return None


SAMPLE = [
    'Oct 6', 'Oct 9–11', 'Oct 30–Nov 8', 'Oct 9 & 10', 'Oct 31 & Nov 1', 'Sep 12', 'Dec 18–20',
    '<strong>Open now:</strong> pizza reservations for Oct 9.',
    '<strong>Open now:</strong> pizza reservations for Oct 9 &amp; 10.',
    '<strong>Open now:</strong> pizza reservations for Oct 9–11.',
    '<strong>Open now:</strong> pizza reservations for Oct 30–Nov 8.',
    '<strong>Open now:</strong> pizza reservations for Oct 31 &amp; Nov 1.',
    '<strong>Open now:</strong> pizza reservations for Oct 2 &amp; 3. We haven’t opened Sunday, Oct 4. Unless the forecast changes a lot, we’ll be closed that day for rain.',
    '<strong>Open now:</strong> pizza reservations for Oct 9 &amp; 10. We haven’t opened Sunday, Oct 11. Unless the forecast changes a lot, we’ll be closed that day for rain.',
]


if __name__ == '__main__':
    args = sys.argv[1:]
    if args == ['--sample']:   # for a native speaker: the English line and what the tool writes
        for ex in SAMPLE:
            print(re.sub(r'<[^>]+>', '', ex).replace('&amp;', '&'))
            for c in LANGS:
                print('   %s  %s' % (c, re.sub(r'<[^>]+>', '', translate(c, ex))))
        sys.exit(0)
    if not args:
        print(__doc__)
        sys.exit(0)
    text = ' '.join(args)
    got = {c: translate(c, text) for c in LANGS}
    if not all(got.values()):
        print('Not understood: ' + (why_not(text) or 'this is not a date line or the "Open now" line.'))
        sys.exit(1)
    for c in LANGS:
        print('%s  %s' % (c, got[c]))
