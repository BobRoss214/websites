#!/usr/bin/env python3
"""Checks tools/change_fact.py on throw-away copies of the site (your files are never touched; no browser).

  python3 tools/test_change_fact.py

On a scratch copy it makes a price change, an e-mail change (the waitlist address in js/features.js too), a phone change written in another layout, an hours change, a change of
a street number that lives in the pages, in a script and in the translations, and a change of words it cannot translate. After each change tools/check_facts.py must agree
everywhere and i18n.py must say 0 missing in all four languages (except for the change of words: that one must say exactly what is left). "undo" must put back every file
byte for byte. A change that was not asked for with --yes must change nothing. Hostile words (HTML, quote marks, a line break, an invisible character, a very long text) must be
refused with a plain message and no file touched. Line ends of a Windows file (CRLF) must stay as they were. Needs Python 3.8 and beautifulsoup4 (as pages.py does).
"""
import concurrent.futures, hashlib, os, re, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)
CODES = ('es', 'hi', 'vi', 'zh')
PRISTINE = None


def tree_hash(root):
    out = {}
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in ('.git', 'node_modules', 'deploy', '__pycache__')]
        for f in files:
            if f.endswith('.pyc'):
                continue
            p = os.path.join(base, f)
            with open(p, 'rb') as fh:
                out[os.path.relpath(p, root)] = hashlib.sha256(fh.read()).hexdigest()
    return out


class Site:
    """A scratch copy of the site, and the tools run on it."""

    def __init__(self):
        self.tmp = tempfile.mkdtemp(prefix='change-fact-')
        self.root = os.path.join(self.tmp, 'site')
        shutil.copytree(PRISTINE, self.root)
        self.backups = os.path.join(self.tmp, 'backups')
        self.before = tree_hash(self.root)

    def tool(self, script, *args):
        env = dict(os.environ, WA_BACKUP_DIR=self.backups)
        r = subprocess.run([sys.executable, os.path.join(self.root, 'tools', script)] + list(args), cwd=self.root, capture_output=True, text=True, encoding='utf-8', timeout=600, env=env)
        return r.returncode, r.stdout + r.stderr

    def change(self, *args):
        return self.tool('change_fact.py', *args)

    def read(self, rel):
        with open(os.path.join(self.root, rel), encoding='utf-8', newline='') as f:
            return f.read()

    def langs(self):
        return {c: self.read('lang/src/%s.json' % c) for c in CODES}

    def clean(self, missing=None):
        """What the tool says it checked, checked again from outside: check_facts agrees, and two languages have nothing missing."""
        out = {'facts': self.tool('check_facts.py', '--brief')}
        if missing:
            out['missing ' + missing] = self.tool('i18n.py', 'missing', missing)
        return out

    def undo(self):
        code, out = self.change('undo')
        return code, out, tree_hash(self.root) == self.before


HOSTILE = [('text', 'Cash is preferred.', '<script>alert(1)</script>'), ('text', 'Cash is preferred.', 'a "quote" b'), ('text', 'Cash is preferred.', 'line\nbreak'),
           ('text', 'Cash is preferred.', 'tab\there'), ('text', 'Cash is preferred.', 'hidden\u200bspace'), ('text', 'Cash is preferred.', 'x' * 161), ('text', 'Cash is preferred.', 'AT&T'),
           ('text', 'Cash is preferred.', 'back`tick'), ('text', 'Cash is preferred.', 'path\\x'), ('text', 'Cash is preferred.', '${x}'), ('text', 'Cash is preferred.', ''),
           ('text', '', 'x'), ('text', '<b>', 'x'), ('price', '$31', '$32; rm'), ('price', '$31', 'free'), ('email', 'cathy@wiseacresorganic.com', 'not an address'),
           ('email', 'cathy@wiseacresorganic.com', 'a@b.com"><x'), ('phone', '704-207-6347', '12345'), ('phone', '704-207-6347', '000-000-0000'), ('hours', '10 am-8 pm', '9 am-<b>')]


def sc_price(s):
    r = {}
    r['dry'] = s.change('price', '$31', '$32')
    r['dry_untouched'] = tree_hash(s.root) == s.before
    r['yes'] = s.change('price', '$31', '$32', '--yes')
    r['index'], r['langs'], r['clean'] = s.read('index.html'), s.langs(), s.clean('es')
    r['undo'] = s.undo()
    return r


def sc_email_crlf(s):
    for rel in ('index.html', 'pages/first-visit.html', 'js/content.js', 'js/features.js'):   # a Windows file: tools/i18n.py extract writes the pages with plain line ends, but a script must stay as it was
        p = os.path.join(s.root, rel)
        with open(p, 'rb') as f:
            raw = f.read()
        with open(p, 'wb') as f:
            f.write(raw.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n'))
    s.before = tree_hash(s.root)
    r = {}
    r['yes'] = s.change('email', 'cathy@wiseacresorganic.com', 'office@wiseacresorganic.com', '--yes')
    with open(os.path.join(s.root, 'js', 'features.js'), 'rb') as f:
        r['features_bytes'] = f.read()
    r['index'], r['clean'] = s.read('index.html'), s.clean()
    r['undo'] = s.undo()
    return r


def sc_phone(s):
    r = {}
    r['yes'] = s.change('phone', '704-207-6347', '(704) 555-1234', '--yes')
    r['index'], r['es'], r['clean'] = s.read('index.html'), s.read('lang/src/es.json'), s.clean()
    r['undo'] = s.undo()
    return r


def sc_hours(s):
    r = {}
    r['yes'] = s.change('hours', 'Fri-Sun, 10 am-8 pm', 'Fri-Sun, 10 am-9 pm', '--yes')
    r['content'], r['index'], r['langs'], r['clean'] = s.read('js/content.js'), s.read('index.html'), s.langs(), s.clean('hi')
    r['undo'] = s.undo()
    return r


def sc_hours_cross(s):
    r = {}
    r['cross'] = s.change('hours', 'Fri-Sun, 10 am-8 pm', 'Fri-Sun, 10 am-11 pm', '--yes')   # 11 pm: the words for the time of day may change in hi, zh and vi
    r['undo2'] = s.undo()
    r['wise'] = s.change('hours', '4 to 8 pm', '4 to 9 pm', '--yes')   # Wise Pie: sentences with other numbers in them ("5 days before", "4:00 PM") are carried too
    r['wise_clean'] = s.clean()
    r['wise_pages'] = s.read('pages/wise-pie.html')
    r['undo3'] = s.undo()
    return r


def sc_text_number(s):
    r = {}
    r['yes'] = s.change('text', '4701 Hartis', '4702 Hartis', '--yes')   # the pages write both "Hartis Rd" and "Hartis Road"; a script holds it too; the map links write it as 4701%20Hartis
    r['features'], r['langs'], r['clean'], r['index'] = s.read('js/features.js'), s.langs(), s.clean(), s.read('index.html')
    r['undo'] = s.undo()
    r['apostrophe'] = s.change('text', '4701 Hartis', "4701 Hartis's", '--yes')
    r['apostrophe_untouched'] = tree_hash(s.root) == s.before
    return r


def sc_words_and_refusals(s):
    r = {}
    r['words'] = s.change('text', 'Cash is preferred.', 'Cash is welcome.', '--yes')
    r['langs'] = s.langs()
    r['undo'] = s.undo()
    r['hostile'] = [(case, s.change(case[0], case[1], case[2], '--yes')) for case in HOSTILE]
    r['only_hostile'] = s.change('text', 'Cash is preferred.', 'ok', '--only', '<b>', '--yes')
    r['unknown_kind'] = s.change('colour', 'a', 'b')
    r['bad_hours'] = [s.change('hours', a, b, '--yes') for a, b in (('Fri-Sun, 10 am-8 pm', 'Thu-Sun, 10 am-8 pm'), ('Fri-Sun, 10 am-8 pm', 'Fri-Sun, 10 am-8 pm'), ('10 am-8 pm', '9 pm-8 pm'), ('10 am-8 pm', 'soon'))]
    r['ambiguous'] = s.change('price', '$3', '$4', '--yes')
    r['barrel'] = s.change('price', '$3', '$4', '--only', 'barrel train')
    r['nothing'] = s.change('price', '$99', '$100')
    r['untouched'] = tree_hash(s.root) == s.before
    return r


SCENARIOS = {}


def setUpModule():
    global PRISTINE
    PRISTINE = tempfile.mkdtemp(prefix='change-fact-base-')
    for e in os.listdir(REAL):
        if e in ('.git', 'node_modules', 'deploy', 'tests', 'review', 'patches', 'docs', 'print', 'README.md'):
            continue
        src = os.path.join(REAL, e)
        (shutil.copytree if os.path.isdir(src) else shutil.copy2)(src, os.path.join(PRISTINE, e))
    sites = []
    SCENARIOS.clear()

    def go(fn):
        s = Site()
        sites.append(s)
        try:
            return fn.__name__[3:], fn(s)
        except Exception as e:   # shown by the test that needs it
            return fn.__name__[3:], e
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:   # seven copies of the site, four at a time
        for name, res in pool.map(go, [sc_words_and_refusals, sc_hours, sc_text_number, sc_price, sc_email_crlf, sc_phone, sc_hours_cross]):
            SCENARIOS[name] = res
    for s in sites:
        shutil.rmtree(s.tmp, ignore_errors=True)


def tearDownModule():
    shutil.rmtree(PRISTINE, ignore_errors=True)


def got(name):
    r = SCENARIOS[name]
    if isinstance(r, Exception):
        raise r
    return r


def ready(testcase, label, run):
    """The change command said Ready, check_facts agrees and nothing is missing in the languages looked at again."""
    code, out = run['yes']
    testcase.assertEqual(code, 0, label + ': ' + out[-800:])
    testcase.assertIn('Ready.', out)
    c = run['clean']
    testcase.assertEqual(c['facts'][0], 0, label + ' check_facts: ' + c['facts'][1][-500:])
    for k in c:
        if k.startswith('missing'):
            testcase.assertRegex(c[k][1], r' 0 missing, .*JavaScript: 0 missing', label + ' ' + k)


def put_back(testcase, label, undo):
    code, out, same = undo
    testcase.assertEqual(code, 0, out)
    testcase.assertTrue(same, label + ': undo must put back every file, byte for byte')


class ChangeFact(unittest.TestCase):
    def test_price_lists_first_then_changes_then_undoes(self):
        r = got('price')
        self.assertEqual(r['dry'][0], 0, r['dry'][1])
        self.assertIn('3 places in 2 files', r['dry'][1])
        self.assertIn('Nothing was changed', r['dry'][1])
        self.assertTrue(r['dry_untouched'], 'without --yes nothing may change')
        ready(self, 'price', r)
        self.assertNotIn('$31', r['index'])
        for c in CODES:
            self.assertIn('$32', r['langs'][c])
        put_back(self, 'price', r['undo'])

    def test_email_including_the_waitlist_address_in_a_script_and_windows_line_ends(self):
        r = got('email_crlf')
        ready(self, 'email', r)
        f = r['features_bytes']
        self.assertIn(b"const WAITLIST = 'office@wiseacresorganic.com';\r\n", f, 'a script that was CRLF is still CRLF')
        self.assertEqual(f.count(b'\n'), f.count(b'\r\n'), 'no bare LF in a script that was CRLF')
        self.assertNotIn('cathy@', r['index'])
        put_back(self, 'email', r['undo'])

    def test_phone_keeps_the_layout_of_each_place(self):
        r = got('phone')
        ready(self, 'phone', r)
        self.assertIn('tel:+17045551234">704-555-1234</a>', r['index'])
        self.assertNotIn('207-6347', r['index'])
        self.assertIn('704-555-1234', r['es'])
        put_back(self, 'phone', r['undo'])

    def test_hours(self):
        r = got('hours')
        ready(self, 'hours', r)
        self.assertIn('native speaker', r['yes'][1])
        self.assertIn("open: '10:00', close: '21:00' },   // Fri-Sun, 10 am-9 pm", r['content'])
        self.assertEqual(r['index'].count('10 am&ndash;9 pm'), 4)
        self.assertIn('10 a. m.–9 p. m.', r['langs']['es'])
        self.assertIn('晚上 9 点', r['langs']['zh'])
        self.assertIn('9 giờ tối', r['langs']['vi'])
        put_back(self, 'hours', r['undo'])

    def test_hours_that_cross_into_another_part_of_the_day_are_left_for_a_person(self):
        code, out = got('hours_cross')['cross']
        self.assertEqual(code, 1, out)
        self.assertIn('NOT DONE', out)
        self.assertIn('the word for the time of day may change', out)
        for c in CODES:
            self.assertRegex(out, r'\n  %s  t[0-9a-f]{8} \|' % c)
        put_back(self, 'cross', got('hours_cross')['undo2'])

    def test_wise_pie_hours_are_found_in_every_wording_and_carried_with_their_other_numbers(self):
        r = got('hours_cross')
        ready(self, 'wise pie', {'yes': r['wise'], 'clean': r['wise_clean']})
        self.assertIn('from 4 to 9 pm', r['wise_pages'])
        put_back(self, 'wise pie', r['undo3'])

    def test_text_with_a_number_reaches_the_pages_the_script_and_every_translation(self):
        r = got('text_number')
        code, out = r['yes']   # not "Ready": the QR signs hold the address too, and the tool says so instead of leaving it quietly
        self.assertEqual(code, 1, out)
        self.assertIn('tools/qr_links.json still holds the old words', out)
        self.assertNotIn('check_facts.py still says', out, 'the pages, the script and every translation agree')
        self.assertEqual(r['clean']['facts'][0], 0, r['clean']['facts'][1][-500:])
        self.assertNotIn('4701%20Hartis', r['index'], 'a map link writes the address with %20')
        self.assertIn('4702%20Hartis', r['index'])
        self.assertIn("addr: '4702 Hartis Rd, Indian Trail", r['features'])
        for c in CODES:
            self.assertIn('To the farm at 4702 Hartis Rd.', r['langs'][c], 'the script text is a key of the "js" part')
        put_back(self, 'street number', r['undo'])
        code, out = r['apostrophe']
        self.assertEqual(code, 1, out)
        self.assertIn('apostrophe', out)
        self.assertTrue(r['apostrophe_untouched'])

    def test_words_it_cannot_translate_are_listed_not_guessed(self):
        r = got('words_and_refusals')
        code, out = r['words']
        self.assertEqual(code, 1, out)
        self.assertIn('NOT DONE yet', out)
        self.assertIn('the words changed, not only a number or an address', out)
        for c in CODES:
            self.assertRegex(out, r'\n  %s  t[0-9a-f]{8} \| Cash is welcome' % c)
            self.assertNotIn('Cash is welcome', r['langs'][c], 'nothing was invented')
        put_back(self, 'words', r['undo'])

    def test_price_in_single_quote_marks_and_a_price_the_terminal_ate(self):
        """The sheet says price '$31' '$32'. A Mac, Linux or PowerShell window turns "$31" in double quote marks into "1" before the tool sees it: that is refused with a plain hint, and
        the Windows cmd window, which hands the single quote marks over as typed, works too."""
        s = Site()
        try:
            for old, new in (("'$31'", "'$32'"), ('$31', '$32')):
                code, out = s.change('price', old, new)
                self.assertEqual(code, 0, out)
                self.assertIn('3 places in 2 files', out)
                self.assertIn('price: "$31" -> "$32"', out)
            code, out = s.change('price', '1', '2')
            self.assertEqual(code, 1, out)
            self.assertIn('single quote marks', out)
            self.assertNotIn('Traceback', out)
            self.assertEqual(tree_hash(s.root), s.before, 'a list, and a refused price, must touch no file')
        finally:
            shutil.rmtree(s.tmp, ignore_errors=True)

    def test_refusals_touch_nothing_and_say_why(self):
        r = got('words_and_refusals')
        for case, (code, out) in r['hostile']:
            self.assertIn(code, (1, 2), '%r: %s' % (case, out))
            self.assertNotIn('Traceback', out, repr(case))
        self.assertEqual(r['only_hostile'][0], 1, r['only_hostile'][1])
        self.assertEqual(r['unknown_kind'][0], 2, r['unknown_kind'][1])
        for code, out in r['bad_hours']:
            self.assertEqual(code, 1, out)
            self.assertNotIn('Traceback', out)
        code, out = r['ambiguous']
        self.assertEqual(code, 1, out)
        self.assertIn('means more than one thing', out)
        self.assertIn('--only', out)
        code, out = r['barrel']
        self.assertEqual(code, 0, out)
        self.assertRegex(out, r'\d+ places in 2 files')
        self.assertNotIn('per person', out.split('Translations to copy')[0], 'only the barrel train is listed')
        code, out = r['nothing']
        self.assertEqual(code, 1, out)
        self.assertIn('I found no place', out)
        self.assertTrue(r['untouched'], 'a refused change, and a list without --yes, must touch no file')

    def test_without_beautifulsoup4_nothing_is_changed(self):
        """pages.py cannot run without the helper package, so the change must say so BEFORE it touches a file. (It used to change the English, stop, and a second run then found no place to change.)"""
        s = Site()
        try:
            code = "import sys, runpy; sys.modules['bs4'] = None; sys.argv = ['change_fact.py', 'price', '$31', '$32', '--yes']; runpy.run_path('tools/change_fact.py', run_name='__main__')"
            r = subprocess.run([sys.executable, '-c', code], cwd=s.root, capture_output=True, text=True, encoding='utf-8', timeout=300, env=dict(os.environ, WA_BACKUP_DIR=s.backups))
            out = r.stdout + r.stderr
            self.assertEqual(r.returncode, 1, out)
            self.assertIn('beautifulsoup4', out)
            self.assertIn('Nothing was changed', out)
            self.assertNotIn('Traceback', out)
            self.assertEqual(tree_hash(s.root), s.before, 'a change that cannot be rebuilt must touch no file')
        finally:
            shutil.rmtree(s.tmp, ignore_errors=True)

    def test_source_follows_the_windows_rules(self):
        with open(os.path.join(HERE, 'change_fact.py'), encoding='utf-8') as f:
            src = f.read()
        self.assertNotIn('shell=True', src)
        self.assertNotIn('os.system', src)
        self.assertNotIn("'/tmp", src)
        for m in re.finditer(r'\bopen\(', src):
            depth, i = 1, m.end()
            while depth and i < len(src):
                depth += {'(': 1, ')': -1}.get(src[i], 0)
                i += 1
            call = src[m.start():i]
            if "'rb'" in call:
                continue
            self.assertIn('encoding=', call, 'every open call names its encoding: ' + call)
        self.assertIn("newline=''", src, 'files are written back with the line ends they had')
        self.assertIn('--help', src)


if __name__ == '__main__':
    result = unittest.main(exit=False, verbosity=1)
    if result.result.wasSuccessful():
        print('OK: tools/change_fact.py changes a price, an e-mail address (also in a script), a phone number, hours and a street number everywhere with their translations, refuses hostile words and undoes it all', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
