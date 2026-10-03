#!/usr/bin/env python3
"""Checks how tools/pages.py writes each page's share picture (og:image, twitter:image, size, description), on a throw-away copy of the site.

  python3 tools/test_pages.py

Also checks the real site: every extra page names its own share picture, the file is there, 1200 x 630 and under 250 KB, and it has a description;
every page has its own title and description of a length search results can show; and every question and answer in a page's structured data
(FAQPage) is word for word what the page shows, with no markup left in it.
Prints "OK" when everything passes. Needs: pip install beautifulsoup4  (and pillow for the picture-size tests).
"""
import json, os, re, shutil, struct, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)
try:
    from PIL import Image
except ImportError:
    Image = None
from bs4 import BeautifulSoup


def png_size(path):
    with open(path, 'rb') as f:
        d = f.read(24)
    return struct.unpack('>II', d[16:24])


class Pages(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='pages-test-')
        self.root = os.path.join(self.tmp, 'site')
        for sub in ('tools', 'pages', 'assets'):
            os.makedirs(os.path.join(self.root, sub))
        shutil.copy(os.path.join(HERE, 'pages.py'), os.path.join(self.root, 'tools', 'pages.py'))
        shutil.copy(os.path.join(REAL, 'index.html'), os.path.join(self.root, 'index.html'))
        shutil.copy(os.path.join(REAL, 'assets', 'og-share.png'), os.path.join(self.root, 'assets', 'og-share.png'))
        shutil.copy(os.path.join(REAL, 'assets', 'og-share.png'), os.path.join(self.root, 'assets', 'og-own.png'))   # a second 1200 x 630 picture

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def page(self, name, extra=''):
        with open(os.path.join(self.root, 'pages', name + '.html'), 'w', encoding='utf-8') as f:
            f.write(f'---\ntitle: Test page\ndescription: A test page.\n{extra}---\n<section><h1>Test</h1></section>\n')

    def build(self):
        p = subprocess.run([sys.executable, os.path.join(self.root, 'tools', 'pages.py')], capture_output=True, text=True, cwd=self.tmp)
        return p.returncode, p.stdout + p.stderr

    def out(self, name):
        with open(os.path.join(self.root, name + '.html'), encoding='utf-8') as f:
            return f.read()

    def tags(self, html, key):
        return re.findall(r'<meta (?:property|name)="%s" content="([^"]*)">' % re.escape(key), html)

    # -------------------------------------------------------------
    def test_a_page_with_its_own_picture(self):
        self.page('one', 'image: assets/og-own.png\nimage_alt: Illustration of a barn & "a tractor"\n')
        code, text = self.build()
        self.assertEqual(code, 0, text)
        h = self.out('one')
        for key in ('og:image', 'twitter:image'):
            self.assertEqual(self.tags(h, key), ['https://www.wiseacresorganic.com/assets/og-own.png'], key)
        self.assertEqual(self.tags(h, 'og:image:width'), ['1200'])
        self.assertEqual(self.tags(h, 'og:image:height'), ['630'])
        alt = 'Illustration of a barn &amp; &quot;a tractor&quot;'
        self.assertEqual(self.tags(h, 'og:image:alt'), [alt])
        self.assertEqual(self.tags(h, 'twitter:image:alt'), [alt])
        self.assertEqual(self.tags(h, 'twitter:card'), ['summary_large_image'])
        self.assertNotIn('og-share.png', h)

    def test_a_page_without_one_uses_the_home_picture_and_its_description(self):
        self.page('two')
        code, text = self.build()
        self.assertEqual(code, 0, text)
        h = self.out('two')
        with open(os.path.join(self.root, 'index.html'), encoding='utf-8') as f:
            home_alt = re.search(r'<meta property="og:image:alt" content="([^"]*)">', f.read()).group(1)
        self.assertEqual(self.tags(h, 'og:image'), ['https://www.wiseacresorganic.com/assets/og-share.png'])
        self.assertEqual(self.tags(h, 'twitter:image'), ['https://www.wiseacresorganic.com/assets/og-share.png'])
        self.assertEqual(self.tags(h, 'og:image:alt'), [home_alt])
        self.assertEqual(self.tags(h, 'twitter:image:alt'), [home_alt])
        self.assertEqual((self.tags(h, 'og:image:width'), self.tags(h, 'og:image:height')), (['1200'], ['630']))

    def test_a_picture_without_a_description_is_refused(self):
        self.page('three', 'image: assets/og-own.png\n')
        code, text = self.build()
        self.assertNotEqual(code, 0)
        self.assertIn('image_alt', text)
        self.assertNotIn('Traceback', text)

    def test_a_picture_that_is_not_there_is_refused(self):
        self.page('four', 'image: assets/og-nope.png\nimage_alt: Anything\n')
        code, text = self.build()
        self.assertNotEqual(code, 0)
        self.assertIn('is not in the site folder', text)
        self.assertNotIn('Traceback', text)

    def test_the_size_comes_from_the_file(self):
        if Image is None:
            self.skipTest('pillow is not installed')
        Image.new('RGB', (800, 420), 'white').save(os.path.join(self.root, 'assets', 'small.png'))
        Image.new('RGB', (640, 336), 'white').save(os.path.join(self.root, 'assets', 'photo.jpg'), quality=80)
        self.page('five', 'image: assets/small.png\nimage_alt: A small picture\n')
        self.page('six', 'image: assets/photo.jpg\nimage_alt: A photo\n')
        code, text = self.build()
        self.assertEqual(code, 0, text)
        self.assertEqual((self.tags(self.out('five'), 'og:image:width'), self.tags(self.out('five'), 'og:image:height')), (['800'], ['420']))
        self.assertEqual((self.tags(self.out('six'), 'og:image:width'), self.tags(self.out('six'), 'og:image:height')), (['640'], ['336']))

    def test_every_tag_appears_once(self):
        self.page('seven', 'image: assets/og-own.png\nimage_alt: Alt\n')
        self.assertEqual(self.build()[0], 0)
        h = self.out('seven')
        for key in ('og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:card', 'twitter:image', 'twitter:image:alt'):
            self.assertEqual(len(self.tags(h, key)), 1, key)

    # -------------------------------------------------------------
    def test_the_real_site_gives_every_extra_page_its_own_picture(self):
        pages = sorted(f[:-5] for f in os.listdir(os.path.join(REAL, 'pages')) if f.endswith('.html'))
        self.assertTrue(pages)
        seen = set()
        for slug in pages:
            with open(os.path.join(REAL, 'pages', slug + '.html'), encoding='utf-8-sig') as f:
                head = f.read().split('\n---\n')[0]
            meta = dict(l.split(':', 1) for l in head.splitlines() if ':' in l)
            meta = {k.strip(): v.strip() for k, v in meta.items()}
            self.assertEqual(meta.get('image'), f'assets/og-{slug}.png', f'pages/{slug}.html: image:')
            self.assertGreaterEqual(len(meta.get('image_alt', '')), 30, f'pages/{slug}.html: image_alt:')
            self.assertLessEqual(len(meta['image_alt']), 400)
            self.assertNotIn(meta['image'], seen)
            seen.add(meta['image'])
            path = os.path.join(REAL, meta['image'])
            self.assertTrue(os.path.exists(path), f'{meta["image"]} is missing')
            self.assertEqual(png_size(path), (1200, 630), meta['image'])
            self.assertLess(os.path.getsize(path), 250 * 1000, meta['image'] + ' is over 250 KB')

    # -------------------------------------------------------------
    def test_a_list_in_an_answer_reads_as_sentences(self):
        body = ('<section data-faq><details><summary>What is the rule?</summary><div class="answer"><p>It is simple.</p>'
                '<ul><li>Change it before noon</li><li>We refund the rest.</li><li>Call us (anytime)</li></ul></div></details></section>')
        with open(os.path.join(self.root, 'pages', 'rule.html'), 'w', encoding='utf-8') as f:
            f.write('---\ntitle: Rule\ndescription: A rule.\n---\n' + body + '\n')
        code, text = self.build()
        self.assertEqual(code, 0, text)
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', self.out('rule'), re.S).group(1))
        faq = [g for g in ld['@graph'] if g['@type'] == 'FAQPage'][0]['mainEntity']
        self.assertEqual(faq[0]['acceptedAnswer']['text'], 'It is simple. Change it before noon. We refund the rest. Call us (anytime)')

    # -------------------------------------------------------------
    def real_pages(self):
        pages = ['index'] + sorted(f[:-5] for f in os.listdir(os.path.join(REAL, 'pages')) if f.endswith('.html'))
        out = {}
        for slug in pages:
            with open(os.path.join(REAL, slug + '.html'), encoding='utf-8') as f:
                out[slug] = BeautifulSoup(f.read(), 'html.parser')
        return out

    def test_the_real_pages_have_their_own_title_and_description(self):
        titles, descriptions = {}, {}
        for slug, soup in self.real_pages().items():
            title = soup.title.get_text().strip()
            desc = soup.find('meta', attrs={'name': 'description'})['content'].strip()
            self.assertTrue(30 <= len(title) <= 62, f'{slug}: the title is {len(title)} letters (search results show about 50 to 60): {title}')
            self.assertTrue(110 <= len(desc) <= 165, f'{slug}: the description is {len(desc)} letters (search results show about 120 to 160)')
            self.assertNotIn(title, titles, f'{slug} has the same title as {titles.get(title)}')
            self.assertNotIn(desc, descriptions, f'{slug} has the same description as {descriptions.get(desc)}')
            titles[title], descriptions[desc] = slug, slug

    def test_the_structured_data_of_the_real_pages_is_what_the_page_shows(self):
        checked = 0
        for slug, soup in self.real_pages().items():
            for tag in soup.find_all('script', type='application/ld+json'):
                data = json.loads(tag.string)
                nodes = data['@graph'] if '@graph' in data else [data]
                for node in nodes:
                    if node.get('@type') != 'FAQPage':
                        continue
                    shown = soup.select('[data-faq] details')
                    self.assertEqual(len(node['mainEntity']), len(shown), f'{slug}: the page shows {len(shown)} questions, its structured data has {len(node["mainEntity"])}')
                    for q, d in zip(node['mainEntity'], shown):
                        want_q = re.sub(r'\s+', ' ', d.find('summary').get_text(' ', strip=True))
                        want_a = re.sub(r'\s+', ' ', d.select_one('.answer').get_text(' ', strip=True))
                        got_a = q['acceptedAnswer']['text']
                        self.assertEqual(q['name'], want_q, f'{slug}: question differs')
                        self.assertFalse(re.search(r'<[^>]+>|&[a-z#0-9]+;', got_a + q['name']), f'{slug}: markup left in {q["name"]}')
                        # the page shows list items without full stops; the structured data adds them, nothing else may differ
                        self.assertEqual(re.sub(r'[.!?]', '', got_a), re.sub(r'[.!?]', '', want_a), f'{slug}: answer to "{want_q}" is not what the page shows')
                        checked += 1
        self.assertGreater(checked, 20)


if __name__ == '__main__':
    result = unittest.main(exit=False, verbosity=1)
    if result.result.wasSuccessful():
        print('OK: tools/pages.py share pictures, titles and structured data passed', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
