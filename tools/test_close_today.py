#!/usr/bin/env python3
"""Checks for tools/close_today.py (python3 tools/test_close_today.py; about 20 seconds; Python 3.8+ and Node; no browser, no internet).

Everything runs on a temporary copy of the files the tool uses (your own js/content.js is never touched). The tool is run as a program, with a
pretend clock (CLOSE_TODAY_NOW) and a backup folder of its own (CLOSE_TODAY_BACKUP_DIR). What is checked:
  - every kind of day gives a notice in all five languages (no { } left, no < > or straight quotes), and closes or does not close as it should
  - after a closure the file differs from the old one ONLY in closures:, notice: and noticeUntil: (comments, byte order mark, Windows line ends,
    quote marks, trailing commas, a list over several lines, untouched), Node still runs it and says what it should
  - --undo gives back the old file byte for byte; a hand edit made since is never overwritten
  - it refuses (plain message, nothing written) a day more than yesterday in the past, a day already closed, a missing or broken js/content.js,
    a notice that is already there, a run that is too long, words with < > a backslash, very long words, a bad time
  - the copy of the old file is kept OUTSIDE the website folder
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
NODE = shutil.which('node')
TEMPLATE = None


def setUpModule():
    global TEMPLATE
    TEMPLATE = tempfile.mkdtemp(prefix='wa-close-')
    for rel in ('tools/close_today.py', 'tools/notice_phrases.json', 'tools/date_phrases.py', 'js/content.js', 'lang/en.json', 'lang/src/es.json'):
        dst = os.path.join(TEMPLATE, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, rel), dst)


def tearDownModule():
    shutil.rmtree(TEMPLATE, ignore_errors=True)


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


@unittest.skipUnless(NODE, 'needs Node (the tool checks the new file with it)')
class CloseToday(unittest.TestCase):
    NOW = '2026-10-04T16:00:00'      # Sunday 4 Oct 2026, noon on the farm clock

    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix='wa-close-site-')
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.site = os.path.join(self.dir, 'site')
        shutil.copytree(TEMPLATE, self.site)
        self.backups = os.path.join(self.dir, 'backups')       # outside the site folder
        self.content = os.path.join(self.site, 'js', 'content.js')
        self.orig = sha(self.content)

    def run_tool(self, *args, now=None):
        env = dict(os.environ, CLOSE_TODAY_NOW=now or self.NOW, CLOSE_TODAY_BACKUP_DIR=self.backups, PYTHONIOENCODING='utf-8', NO_COLOR='1')
        r = subprocess.run([sys.executable, '-B', 'tools/close_today.py'] + list(args), cwd=self.site, capture_output=True, env=env, timeout=120)
        return r.returncode, (r.stdout + r.stderr).decode('utf-8', 'replace')

    def settings(self, path=None):
        script = ("const vm=require('vm'),fs=require('fs');const sb={window:{}};vm.createContext(sb);vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),sb);"
                  "const W=sb.window.WISE_ACRES;process.stdout.write(JSON.stringify(W));")
        r = subprocess.run([NODE, '-e', script, path or self.content], capture_output=True, timeout=30)
        self.assertEqual(r.returncode, 0, r.stderr.decode()[-300:])
        return json.loads(r.stdout.decode('utf-8'))

    def read(self):
        with open(self.content, 'rb') as f:
            return f.read()

    def unchanged(self):
        self.assertEqual(sha(self.content), self.orig, 'js/content.js must not have been touched')

    # ---- doing it
    def test_rain_today_closes_the_day_and_writes_the_notice_in_five_languages(self):
        code, out = self.run_tool('rain')
        self.assertEqual(code, 0, out)
        s = self.settings()
        self.assertEqual(s['closures'], ['2026-10-04'])
        self.assertEqual(s['noticeUntil'], '2026-10-04')
        self.assertEqual(sorted(s['notice']), ['en', 'es', 'hi', 'vi', 'zh'])
        self.assertEqual(s['notice']['en'], 'Closed Sunday, Oct 4, for rain. Thank you for understanding.')
        self.assertIn('domingo 4 de oct', s['notice']['es'])
        self.assertIn('रविवार, 4 अक्टूबर', s['notice']['hi'])
        self.assertIn('10 月 4 日（周日）', s['notice']['zh'])
        self.assertIn('Chủ Nhật, 4 thg 10', s['notice']['vi'])
        self.assertIn('WHAT THIS TOOL CANNOT DO', out)
        for place in ('BOOKEO', 'GOOGLE BUSINESS PROFILE', 'INSTAGRAM'):
            self.assertIn(place, out)
        self.assertIn('make_deploy_folder.py', out)      # the one next command
        self.assertIn('we’ll email you and give a full refund', out)      # the site's own refund sentence, quoted because it exists
        self.assertNotEqual(sha(self.content), self.orig)

    def test_everything_else_in_the_file_stays_as_it_was(self):
        before = self.read().decode('utf-8')
        s0 = self.settings()
        self.assertEqual(self.run_tool('rain')[0], 0)
        after = self.read().decode('utf-8')
        s1 = self.settings()
        for k in ('closures', 'notice', 'noticeUntil'):
            s0.pop(k), s1.pop(k)
        self.assertEqual(s0, s1)
        a, b = before.split('\n'), after.split('\n')
        import difflib
        changed = [l for l in difflib.unified_diff(a, b, lineterm='', n=0) if l[:1] in '+-' and l[:3] not in ('+++', '---')]
        for line in changed:
            self.assertTrue(re.match(r'^[+-]\s+(notice|noticeUntil|closures|en|es|hi|zh|vi|\}),?', line) or line[1:].strip() in ('}', '},'), line)
        self.assertEqual(before.count('/*') , after.count('/*'))
        self.assertEqual(before.count('//'), after.count('//'))

    def test_undo_gives_back_the_old_file_byte_for_byte(self):
        self.assertEqual(self.run_tool('rain')[0], 0)
        self.assertNotEqual(sha(self.content), self.orig)
        code, out = self.run_tool('--undo')
        self.assertEqual(code, 0, out)
        self.assertIn('byte for byte', out)
        self.unchanged()
        code, out = self.run_tool('--undo')
        self.assertEqual(code, 1)
        self.assertIn('no record', out)

    def test_the_copy_of_the_old_file_is_kept_outside_the_website_folder(self):
        self.assertEqual(self.run_tool('rain')[0], 0)
        files = [f for f in os.listdir(self.backups) if f.endswith('content.js')]
        self.assertEqual(len(files), 1)
        self.assertFalse(os.path.abspath(self.backups).startswith(os.path.abspath(self.site)))
        self.assertEqual(sha(os.path.join(self.backups, files[0])), self.orig)

    def test_dry_run_shows_the_change_and_writes_nothing(self):
        code, out = self.run_tool('rain', '--dry-run')
        self.assertEqual(code, 0, out)
        self.assertIn("+  closures: ['2026-10-04'],", out)
        self.assertIn('Nothing was written', out)
        self.unchanged()
        self.assertFalse(os.path.exists(self.backups))

    def test_check_says_what_the_file_says_and_writes_nothing(self):
        code, out = self.run_tool('--check')
        self.assertEqual(code, 0, out)
        self.assertIn('Closed today: no', out)
        self.assertIn('The notice bar shows today: no', out)
        self.run_tool('rain')
        code, out = self.run_tool('--check')
        self.assertIn('Closed today: YES', out)
        self.assertIn('The notice bar shows today: YES', out)
        self.assertIn('2026-10-04 (rain)', out)

    # ---- the other kinds of day
    def test_every_kind_of_day_gives_clean_sentences(self):
        cases = [('rain',), ('holiday',), ('late-open', '13:00'), ('sold-out',), ('rain', '--until', '2026-10-06'), ('wind', '--until', '2026-10-05')]
        for case in cases:
            self.setUp()
            code, out = self.run_tool(*case)
            self.assertEqual(code, 0, '%s: %s' % (case, out))
            s = self.settings()
            for lang, text in s['notice'].items():
                self.assertFalse(re.search(r'[{}<>"\\]', text), '%s %s: %s' % (case, lang, text))
                self.assertGreater(len(text), 15)
            closes = case[0] in ('rain', 'wind', 'holiday')
            self.assertEqual(s['closures'], (['2026-10-04..%s' % case[-1]] if len(case) > 1 and case[1] == '--until' else ['2026-10-04']) if closes else [], case)
            self.assertEqual(s['noticeUntil'], case[-1] if case[1:2] == ('--until',) else '2026-10-04')
            self.assertEqual(self.run_tool('--undo')[0], 0)
            self.unchanged()
        self.setUp()
        self.run_tool('late-open', '10:30')
        n = self.settings()['notice']
        self.assertIn('10:30 AM', n['en'])
        self.assertIn('10:30 a. m.', n['es'])
        self.assertIn('सुबह 10:30 बजे', n['hi'])
        self.assertIn('上午 10:30', n['zh'])
        self.assertIn('10:30 sáng', n['vi'])

    def test_a_custom_sentence_is_one_english_line_and_safe(self):
        code, out = self.run_tool('custom', 'Closed for a "private" event.   Back\nSaturday.')
        self.assertEqual(code, 0, out)
        s = self.settings()
        self.assertEqual(s['notice'], 'Closed for a “private” event. Back Saturday.')
        self.assertEqual(s['closures'], [])
        self.assertEqual(self.run_tool('--undo')[0], 0)
        self.unchanged()
        code, out = self.run_tool('custom', 'Closed today.', '--close')
        self.assertEqual(self.settings()['closures'], ['2026-10-04'])

    # ---- the file's own habits
    def test_comments_bom_windows_line_ends_quote_marks_and_trailing_commas_survive(self):
        text = self.read().decode('utf-8')
        text = text.replace("  closures: [],", "  closures: [\r\n    \"2026-09-20\",   // an old one\r\n    \"2026-09-27..2026-09-28\",\r\n  ],".replace('\r\n', '\n')).replace("  notice: '',", '  notice: "",  /* off */').replace("  noticeUntil: '',", '  noticeUntil: "", // none')
        text = text.replace('\n', '\r\n')
        with open(self.content, 'wb') as f:
            f.write(b'\xef\xbb\xbf' + text.encode('utf-8'))
        self.orig = sha(self.content)
        self.assertEqual(self.run_tool('rain')[0], 0)
        raw = self.read()
        self.assertTrue(raw.startswith(b'\xef\xbb\xbf'))
        self.assertNotIn(b'\n', raw.replace(b'\r\n', b''), 'no bare line feed was added')
        s = self.settings()
        self.assertEqual(s['closures'], ['2026-09-20', '2026-09-27..2026-09-28', '2026-10-04'])
        body = raw.decode('utf-8')
        self.assertIn('"2026-10-04",\r\n  ]', body)      # same quotes, same trailing comma, same layout
        self.assertIn('// an old one', body)
        self.assertIn('/* off */', body.split('notice:')[1].split('noticeUntil')[0] + '/* off */')
        self.assertEqual(self.run_tool('--undo')[0], 0)
        self.unchanged()

    # ---- refusing
    def test_it_refuses_unsafe_things_and_writes_nothing(self):
        refused = {
            'a day two days ago': (('rain', '--date', '2026-10-02'), 'in the past'),
            'a day that is not a day': (('rain', '--date', '2026-02-30'), 'is not a day'),
            'a day in the next century': (('rain', '--date', '2099-01-01'), 'more than a year'),
            'an end before the start': (('rain', '--until', '2026-10-03'), 'not after'),
            'a run that is too long': (('rain', '--until', '2027-03-01'), 'more than 100 days'),
            'an unknown kind of day': (('flood',), 'do not know'),
            'late-open without a time': (('late-open',), 'needs the time'),
            'late-open with a bad time': (('late-open', '25:99'), 'needs the time'),
            'late-open for a run': (('late-open', '10:30', '--until', '2026-10-06'), 'one day only'),
            'custom without words': (('custom',), 'needs the words'),
            'words with a tag': (('custom', 'Closed <b>today</b>'), 'may not contain'),
            'words with a script': (('custom', 'x</script><script>alert(1)</script>'), 'may not contain'),
            'words with a backslash': (('custom', 'Closed\\today'), 'may not contain'),
            'words that are too long': (('custom', 'Closed ' + 'x' * 200), 'at most'),
            'words that are too short': (('custom', 'ab'), 'too short'),
            'extra words after rain': (('rain', 'because'), 'takes no extra words'),
            'no kind of day': ((), 'Say what happened'),
        }
        for name, (args, why) in refused.items():
            code, out = self.run_tool(*args)
            self.assertEqual(code, 1, name + ': ' + out)
            self.assertIn(why, out, name)
            self.unchanged()
        self.assertFalse(os.path.exists(self.backups), 'a refusal leaves no backup either')

    def test_yesterday_is_allowed_and_a_day_already_closed_is_not(self):
        self.assertEqual(self.run_tool('rain', '--date', '2026-10-03', '--no-notice')[0], 0)
        code, out = self.run_tool('rain', '--date', '2026-10-03')
        self.assertEqual(code, 1)
        self.assertIn('already in closures', out)
        code, out = self.run_tool('rain', '--date', '2026-10-05', '--until', '2026-10-06', '--no-notice')
        self.assertEqual(code, 0, out)
        code, out = self.run_tool('rain', '--date', '2026-10-06', '--no-notice')
        self.assertEqual(code, 1, 'a day inside a run counts as closed')
        self.assertIn('already in closures', out)

    def test_a_notice_that_is_already_there_is_not_replaced_without_asking(self):
        self.assertEqual(self.run_tool('sold-out')[0], 0)
        code, out = self.run_tool('rain')
        self.assertEqual(code, 1)
        self.assertIn('already a notice', out)
        self.assertIn('--replace-notice', out)
        code, out = self.run_tool('rain', '--replace-notice')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.settings()['closures'], ['2026-10-04'])
        self.assertEqual(self.run_tool('--undo')[0], 0)
        self.assertIn('Reservations are full', self.settings()['notice']['en'])
        self.assertEqual(self.run_tool('--undo')[0], 0)
        self.unchanged()

    def test_a_dead_notice_is_replaced_without_asking(self):
        self.assertEqual(self.run_tool('sold-out', '--date', '2026-10-04')[0], 0)
        code, out = self.run_tool('rain', '--date', '2026-10-12', now='2026-10-10T16:00:00')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.settings()['noticeUntil'], '2026-10-12')

    def test_a_missing_or_broken_file_is_never_written(self):
        os.remove(self.content)
        code, out = self.run_tool('rain')
        self.assertEqual(code, 1)
        self.assertIn('cannot find js/content.js', out)
        for name, mutate in (('a typo', lambda t: t.replace("noticeUntil: '',", "noticeUntil: '',,,")), ('no settings object', lambda t: t.replace('window.WISE_ACRES = {', 'var x = {')),
                             ('closures is not a list', lambda t: t.replace('closures: [],', "closures: '2026-10-04',")), ('no closures line', lambda t: t.replace('  closures: [],\n', '')),
                             ('not UTF-8', None)):
            with open(os.path.join(TEMPLATE, 'js', 'content.js'), 'rb') as f:
                raw = f.read()
            with open(self.content, 'wb') as f:
                f.write(raw.replace(b'Wise Acres', b'Wise \xff Acres', 1) if mutate is None else mutate(raw.decode('utf-8')).encode('utf-8'))
            before = sha(self.content)
            code, out = self.run_tool('rain')
            self.assertEqual(code, 1, name + ': ' + out)
            self.assertNotIn('Traceback', out, name)
            self.assertEqual(sha(self.content), before, name)

    def test_undo_will_not_overwrite_a_change_made_by_hand_since(self):
        self.assertEqual(self.run_tool('rain')[0], 0)
        with open(self.content, 'rb') as f:
            text = f.read().decode('utf-8')
        edited = text.replace("closures: ['2026-10-04']", "closures: ['2026-10-04', '2026-10-11']")
        with open(self.content, 'wb') as f:
            f.write(edited.encode('utf-8'))
        before = sha(self.content)
        code, out = self.run_tool('--undo')
        self.assertEqual(code, 1)
        self.assertIn('changed by hand', out)
        self.assertEqual(sha(self.content), before)
        # a change somewhere else is fine: the closure comes out, the other change stays
        # (flip the setting whichever way it starts: the optional patch season-picker-off makes it false)
        was_on = "seasonPicker: true," in text
        flipped = text.replace("seasonPicker: true,", "seasonPicker: false,") if was_on else text.replace("seasonPicker: false,", "seasonPicker: true,")
        with open(self.content, 'wb') as f:
            f.write(flipped.encode('utf-8'))
        code, out = self.run_tool('--undo')
        self.assertEqual(code, 0, out)
        self.assertIn('other changes you made since', out)
        self.assertEqual(self.settings()['seasonPicker'], not was_on)
        self.assertEqual(self.settings()['closures'], [])

    # ---- the words
    def test_the_sentences_file_is_complete_and_says_who_has_read_it(self):
        with open(os.path.join(ROOT, 'tools', 'notice_phrases.json'), encoding='utf-8') as f:
            data = json.load(f)
        self.assertEqual(sorted(data['native_read']), ['en', 'es', 'hi', 'vi', 'zh'])
        self.assertTrue(all(isinstance(v, bool) for v in data['native_read'].values()))
        self.assertEqual(sorted(data['scenarios']), sorted(['late-open', 'rain', 'sold-out', 'wind', 'holiday']))
        for name, sc in data['scenarios'].items():
            for kind in ('one', 'range'):
                if kind not in sc:
                    self.assertIn(name, ('late-open', 'sold-out'))
                    continue
                holders = {}
                for lang in ('en', 'es', 'hi', 'zh', 'vi'):
                    t = sc[kind][lang]
                    holders[lang] = sorted(re.findall(r'\{\w+\}', t))
                    self.assertFalse(re.search(r'[<>\\"]', t), (name, kind, lang))
                    self.assertTrue(t.strip().endswith(('.', '!', '。', '！', '।')), (name, kind, lang))
                self.assertEqual(len({tuple(v) for v in holders.values()}), 1, '%s %s: the five sentences must use the same placeholders' % (name, kind))

    def test_nothing_else_is_written_into_the_website_folder(self):
        self.run_tool('rain')
        self.run_tool('--undo')
        left = []
        for d, _, names in os.walk(self.site):
            for n in names:
                if n.endswith(('.tmp', '.bak', '.orig')):
                    left.append(n)
        self.assertEqual(left, [])


if __name__ == '__main__':
    unittest.main(verbosity=2 if '-v' in sys.argv else 1, argv=[a for a in sys.argv if a != '-v'], warnings='ignore')
