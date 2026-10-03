#!/usr/bin/env python3
"""Checks tools/check_facts.py on throw-away copies of the site (your files are never touched).

  python3 tools/test_check_facts.py

The real site must agree with itself; then, one at a time, a wrong price, a second main phone number, a misspelled e-mail address, other opening hours
in js/content.js and a wrong translation must each be found, with the file and line, and the tool must end by saying what to do next. The pages built
into the top folder (first-visit.html ...) are not read: a change there alone is not reported. Prints "OK" when everything passes. Needs only Python 3.
"""
import os, re, shutil, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)


def run(root, *args):
    r = subprocess.run([sys.executable, os.path.join(root, 'tools', 'check_facts.py')] + list(args), cwd=root, capture_output=True, text=True, timeout=120)
    return r.returncode, r.stdout + r.stderr


class CheckFacts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='facts-test-')
        self.root = os.path.join(self.tmp, 'site')
        os.makedirs(os.path.join(self.root, 'tools'))
        os.makedirs(os.path.join(self.root, 'js'))
        os.makedirs(os.path.join(self.root, 'lang'))
        shutil.copy(os.path.join(HERE, 'check_facts.py'), os.path.join(self.root, 'tools', 'check_facts.py'))
        shutil.copy(os.path.join(REAL, 'index.html'), self.root)
        shutil.copy(os.path.join(REAL, 'js', 'content.js'), os.path.join(self.root, 'js'))
        shutil.copy(os.path.join(REAL, 'lang', 'en.json'), os.path.join(self.root, 'lang'))
        shutil.copytree(os.path.join(REAL, 'pages'), os.path.join(self.root, 'pages'))
        shutil.copytree(os.path.join(REAL, 'lang', 'src'), os.path.join(self.root, 'lang', 'src'))
        shutil.copy(os.path.join(REAL, 'first-visit.html'), self.root)   # the built copy: must not be read

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def edit(self, rel, old, new, count=1):
        p = os.path.join(self.root, rel)
        with open(p, encoding='utf-8') as f:
            s = f.read()
        self.assertGreaterEqual(s.count(old), 1, f'{rel} no longer contains {old!r}: this test needs the new wording')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(s.replace(old, new, count))

    def test_real_site_agrees(self):
        code, out = run(self.root)
        self.assertEqual(code, 0, out[-1500:])
        self.assertRegex(out, r'(\d+) of \1 facts agree everywhere; 0 disagree\.')
        self.assertIn('WHAT TO DO NEXT', out)
        for needle in ('index.html:', 'pages/', 'js/content.js:', 'lang/src/es.json:'):
            self.assertIn(needle, out, 'a place in ' + needle + ' should be listed')
        self.assertNotRegex(out, r'^\s+first-visit\.html', 'the built page must not be read')

    def test_a_wrong_price_is_found_with_file_and_line(self):
        self.edit('pages/pumpkin-patch.html', 'farm fun without pizza is $3 per person', 'farm fun without pizza is $4 per person')
        code, out = run(self.root)
        self.assertEqual(code, 1, out[-800:])
        self.assertRegex(out, r'PRICE: FARM FEE PER PERSON[^\n]*\n  DIFFERENT: 2 answers\. Most places \(\d+\) say \$3\.')
        self.assertRegex(out, r'\$4 +\(1 place\(s\)\)\n +pages/pumpkin-patch\.html:\d+ ')
        self.assertIn('WHAT TO DO NEXT', out)
        self.assertIn('never the built copy', out)
        self.assertIn('python3 tools/pages.py', out)

    def test_main_phone_number(self):
        foot = '<a href="mailto:cathy@wiseacresorganic.com">cathy@wiseacresorganic.com</a>\n      </address>'
        self.edit('index.html', foot, '<a href="mailto:cathy@wiseacresorganic.com">cathy@wiseacresorganic.com</a><br> <a href="tel:+17046286232">(704) 628-6232</a>\n      </address>')
        code, out = run(self.root, 'phone')
        self.assertEqual(code, 0, out)
        self.assertIn('704-628-6232  (main number)', out)
        self.assertIn('704-207-6347  (day-of emergencies)', out)
        self.assertNotIn('E-MAIL', out, 'a word picks the facts: only the phone numbers are shown')
        self.edit('pages/wise-pie.html', 'Wise Pie', 'Wise Pie (call 704-628-6233)')
        code, out = run(self.root, 'phone')
        self.assertEqual(code, 1, out)
        self.assertIn('more than one main phone number', out)

    def test_email_typo(self):
        self.edit('index.html', 'mailto:vanessa@wiseacresorganic.com', 'mailto:vanesa@wiseacresorganic.com')
        code, out = run(self.root, 'e-mail')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'vanessa@wiseacresorganic\.com and vanesa@wiseacresorganic\.com look like two spellings of one address|vanesa@wiseacresorganic\.com and vanessa@wiseacresorganic\.com look like')

    def test_other_hours_in_the_settings(self):
        self.edit('js/content.js', "greenhouse: { days: [5, 6, 0], open: '10:00', close: '20:00' }", "greenhouse: { days: [5, 6, 0], open: '10:00', close: '21:00' }")
        code, out = run(self.root, 'greenhouse')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'DIFFERENT: 2 answers[^\n]*\n[^\n]*\n(?:[^\n]*\n)*? +10:00-21:00 +\(1 place\(s\)\)\n +js/content\.js:\d+ ')

    def test_a_wrong_translation_is_found(self):
        p = os.path.join(self.root, 'lang', 'src', 'es.json')
        with open(p, encoding='utf-8') as f:
            s = f.read()
        s2 = s.replace('más $3 por persona', 'más $4 por persona', 1)
        self.assertNotEqual(s, s2, 'the Spanish text this test changes was not found')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(s2)
        code, out = run(self.root, 'farm fee')
        self.assertEqual(code, 1, out[-800:])
        self.assertRegex(out, r'lang/src/es\.json:\d+ ')

    def test_built_pages_are_not_read(self):
        self.edit('first-visit.html', 'Children age 2 and younger are free', 'Children age 7 and younger are free')
        code, out = run(self.root)
        self.assertEqual(code, 0, out[-600:])

    def test_no_match_and_wrong_folder(self):
        code, out = run(self.root, 'zzzz-nothing')
        self.assertEqual(code, 2)
        self.assertIn('No fact matches', out)
        os.remove(os.path.join(self.root, 'index.html'))
        code, out = run(self.root)
        self.assertEqual(code, 2)
        self.assertIn('I cannot find index.html', out)
        self.assertNotIn('Traceback', out)


if __name__ == '__main__':
    result = unittest.main(exit=False, verbosity=1)
    if result.result.wasSuccessful():
        print('OK: tools/check_facts.py finds a wrong price, a second main phone number, an e-mail typo, other hours and a wrong translation', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
