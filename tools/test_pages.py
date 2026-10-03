#!/usr/bin/env python3
"""Checks how tools/pages.py writes each page's share picture (og:image, twitter:image, size, description), on a throw-away copy of the site.

  python3 tools/test_pages.py

Also checks the real site: every extra page names its own share picture, the file is there, 1200 x 630 and under 250 KB, and it has a description.
Prints "OK" when everything passes. Needs: pip install beautifulsoup4  (and pillow for the picture-size tests).
"""
import os, re, shutil, struct, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)
try:
    from PIL import Image
except ImportError:
    Image = None


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


if __name__ == '__main__':
    result = unittest.main(exit=False, verbosity=1)
    if result.result.wasSuccessful():
        print('OK: tools/pages.py share pictures passed', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
