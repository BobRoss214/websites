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
    r = subprocess.run([sys.executable, os.path.join(root, 'tools', 'check_facts.py')] + list(args), cwd=root, capture_output=True, universal_newlines=True, encoding='utf-8', errors='replace', env=dict(os.environ, PYTHONIOENCODING='utf-8'), timeout=120)
    return r.returncode, r.stdout + r.stderr


class CheckFacts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='facts-test-')
        self.root = os.path.join(self.tmp, 'site')
        os.makedirs(os.path.join(self.root, 'tools'))
        os.makedirs(os.path.join(self.root, 'lang'))
        shutil.copy(os.path.join(HERE, 'check_facts.py'), os.path.join(self.root, 'tools', 'check_facts.py'))
        shutil.copy(os.path.join(REAL, 'index.html'), self.root)
        shutil.copytree(os.path.join(REAL, 'js'), os.path.join(self.root, 'js'))   # the scripts hold facts too (the waitlist address, the street addresses)
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
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
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

    def test_day_of_link_typo(self):
        # the number that is written and the number the link dials are one place: a typo in either is two day-of numbers
        self.edit('index.html', 'tel:+17042076347', 'tel:+17042076348')
        code, out = run(self.root, 'phone')
        self.assertEqual(code, 1, out)
        self.assertIn('two different day-of emergency numbers: 704-207-6347, 704-207-6348', out)

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

    def test_hours_in_double_quotes_or_without_a_leading_zero_are_still_read(self):
        # js/content.js may say "9:00" as well as '09:00': the hours there must still be compared with the pages (10:00-20:00)
        self.edit('js/content.js', "greenhouse: { days: [5, 6, 0], open: '10:00', close: '20:00' }", 'greenhouse: { days: [5, 6, 0], open: "9:00", close: "20:00" }')
        code, out = run(self.root, 'greenhouse')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'09:00-20:00 +\(1 place\(s\)\)\n +js/content\.js:\d+ ')

    def test_a_wrong_translation_is_found(self):
        p = os.path.join(self.root, 'lang', 'src', 'es.json')
        with open(p, encoding='utf-8') as f:
            s = f.read()
        s2 = s.replace('más $3 por persona', 'más $4 por persona', 1)
        self.assertNotEqual(s, s2, 'the Spanish text this test changes was not found')
        with open(p, 'w', encoding='utf-8', newline='\n') as f:
            f.write(s2)
        code, out = run(self.root, 'farm fee')
        self.assertEqual(code, 1, out[-800:])
        self.assertRegex(out, r'lang/src/es\.json:\d+ ')

    def test_a_range_with_one_am_or_pm_is_read_the_way_a_person_reads_it(self):
        # "11-1 pm" is 11 in the morning to 1 in the afternoon; "10-8 pm" is 10 am to 8 pm. (Both used to start in the evening and end before they began.)
        sys.dont_write_bytecode = True
        sys.path.insert(0, HERE)
        import check_facts as cf
        read = lambda text: cf.hours(re.search(cf.RANGE, text, re.I))   # the tool reads with re.I
        for text, want in [('11-1 pm', '11:00-13:00'), ('10-8 pm', '10:00-20:00'), ('9 - 5 pm', '09:00-17:00'), ('11:30-1:30 pm', '11:30-13:30'),
                           ('12-8 pm', '12:00-20:00'), ('12-1 pm', '12:00-13:00'), ('4-8 pm', '16:00-20:00'), ('10 am - 8 pm', '10:00-20:00'),
                           ('4:00-8:00 PM', '16:00-20:00'), ('11 to 1 p.m.', '11:00-13:00')]:
            self.assertEqual(read(text), want, text)

    def test_a_price_with_a_thousands_comma_is_read_whole(self):
        sys.dont_write_bytecode = True
        sys.path.insert(0, HERE)
        import check_facts as cf
        for text, want in [('$1,200 per party', '$1200'), ('$12,345.50 base', '$12345.5'), ('$31 base', '$31'), ('$3.50 per person', '$3.5'), ('plus $3 per person', '$3'), ('$1,20 or $12', '$1')]:
            m = re.search(cf.MONEY, text)
            self.assertEqual(cf.money(m), want, text)

    def test_the_waitlist_address_in_a_script_is_checked(self):
        # the real bug: the farm changes its e-mail address on the pages, and the waitlist button (js/features.js, WAITLIST) keeps the old one, silently
        for rel in ('index.html', 'pages/first-visit.html', 'js/content.js'):
            self.edit(rel, 'cathy@wiseacresorganic.com', 'office@wiseacresorganic.com', 99)
        code, out = run(self.root, 'e-mail')
        self.assertEqual(code, 1, out[-900:])
        self.assertRegex(out, r'cathy@wiseacresorganic\.com is held by a script \(js/features\.js:\d+: the waitlist button uses it\) but is written on no page')
        code, brief = run(self.root, '--brief')
        self.assertEqual(code, 1)
        self.assertIn('DIFFERENT cathy@wiseacresorganic.com is held by a script', brief)
        self.edit('js/features.js', "const WAITLIST = 'cathy@wiseacresorganic.com'", "const WAITLIST = 'office@wiseacresorganic.com'")
        code, out = run(self.root, 'e-mail')
        self.assertEqual(code, 0, out[-900:])
        self.assertIn('js/features.js:', out, 'the script is one of the places')

    def test_street_addresses_and_the_5_pm_fallback_in_the_scripts_are_checked(self):
        self.edit('js/features.js', "addr: '4701 Hartis Rd, Indian Trail", "addr: '4702 Hartis Rd, Indian Trail")
        code, out = run(self.root, 'hartis')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'4702 +\(1 place\(s\)\)\n +js/features\.js:\d+ ')
        self.edit('js/live.js', "table.dataset.releaseTime : '17:00'", "table.dataset.releaseTime : '16:00'")
        code, out = run(self.root, 'reservations open')
        self.assertEqual(code, 1, out)
        self.assertRegex(out, r'16:00 +\(1 place\(s\)\)\n +js/live\.js:\d+ ')

    def test_a_comment_in_a_script_is_not_a_fact(self):
        self.edit('js/features.js', "const WAITLIST = 'cathy@wiseacresorganic.com';", "const WAITLIST = 'cathy@wiseacresorganic.com'; // not ava.smith@wiseacresorganic.com, call 704-111-2222 or 1,500 dollars")
        code, out = run(self.root)
        self.assertEqual(code, 0, out[-600:])
        self.assertNotIn('704-111-2222', out)
        self.assertNotIn('ava.smith', out)

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
        print('OK: tools/check_facts.py finds a wrong price, a second main phone number, an e-mail typo, other hours, a wrong translation, a stale waitlist address and facts held by the scripts', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
