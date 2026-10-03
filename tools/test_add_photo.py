#!/usr/bin/env python3
"""Checks tools/add_photo.py on a throw-away copy of the website, so the real files are never touched.

  python3 tools/test_add_photo.py

Every test builds a fresh temporary folder (tools/add_photo.py + js/content.js + two photos), runs the tool on made-up pictures
and looks at what it did. It prints "OK" when everything passes. Needs: pip install pillow  (and node, if you have it, to double-check js/content.js).
"""
import hashlib, os, re, shutil, subprocess, sys, tempfile, unittest

try:
    from PIL import Image, ImageDraw
except ImportError:
    sys.exit('This needs the Pillow package:  pip install pillow')

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.dirname(HERE)
NODE = shutil.which('node')
try:
    import pillow_heif
except ImportError:
    pillow_heif = None


def picture(w, h, seed=1, mode='RGB'):
    """A made-up 'photo' with colour all over it (so two different seeds do not look alike)."""
    import random
    r = random.Random(seed)
    im = Image.new('RGB', (w, h))
    d = ImageDraw.Draw(im)
    for _ in range(80):
        x, y = r.randint(0, w), r.randint(0, h)
        d.ellipse([x, y, x + w // 6, y + h // 6], fill=(r.randint(0, 255), r.randint(0, 255), r.randint(0, 255)))
    for y in range(0, h, max(2, h // 30)):
        d.line([0, y, w, y + r.randint(-h // 8, h // 8)], fill=(r.randint(0, 255), r.randint(0, 255), r.randint(0, 255)), width=max(1, h // 60))
    return im.convert(mode) if mode != 'RGB' else im


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def snapshot(root):
    out = {}
    for base, _dirs, files in os.walk(root):
        for f in files:
            p = os.path.join(base, f)
            out[os.path.relpath(p, root)] = sha(p)
    return out


class Site(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='add-photo-test-')
        self.root = os.path.join(self.tmp, 'site')
        for sub in ('tools', 'js', os.path.join('assets', 'photos')):
            os.makedirs(os.path.join(self.root, sub))
        shutil.copy(os.path.join(HERE, 'add_photo.py'), os.path.join(self.root, 'tools', 'add_photo.py'))
        shutil.copy(os.path.join(REAL, 'js', 'content.js'), os.path.join(self.root, 'js', 'content.js'))
        for f in ('black-goat-cucumber.webp', 'goats-rubs-sign.webp'):
            src = os.path.join(REAL, 'assets', 'photos', f)
            if os.path.exists(src):
                shutil.copy(src, os.path.join(self.root, 'assets', 'photos', f))
        self.pics = os.path.join(self.tmp, 'pictures')
        os.makedirs(self.pics)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    # ------------------------------------------------------------- helpers
    def run_tool(self, *args):
        p = subprocess.run([sys.executable, os.path.join(self.root, 'tools', 'add_photo.py')] + list(args), capture_output=True, text=True, cwd=self.tmp)
        return p.returncode, p.stdout + p.stderr

    def content(self):
        with open(os.path.join(self.root, 'js', 'content.js'), 'rb') as f:
            return f.read().decode('utf-8')

    def photo_srcs(self):
        text = self.content()
        text = text[text.index('\n  photos: ['):]        # the list itself, not the example in the comment at the top
        return re.findall(r'src: "assets/photos/([^"]+)"', text)

    def out(self, name):
        return os.path.join(self.root, 'assets', 'photos', name + '.webp')

    def save(self, name, im, **kw):
        path = os.path.join(self.pics, name)
        im.save(path, **kw)
        return path

    def info(self, name):
        with Image.open(self.out(name)) as im:
            return im.size, im.mode, (im.getpixel((10, 10)) if im.mode == 'RGBA' else None)

    def assert_node_ok(self):
        if NODE:
            r = subprocess.run([NODE, '--check', os.path.join(self.root, 'js', 'content.js')], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, 'js/content.js no longer works: ' + r.stderr)

    ALT = 'A small animal wearing a green knitted frog hat'

    # ------------------------------------------------------------- the happy path
    def test_big_phone_photo_is_turned_shrunk_and_cleaned(self):
        ex = Image.Exif()
        ex[0x0112] = 6                       # the phone held sideways
        ex[0x010F] = 'SecretCameraMaker'
        gps = ex.get_ifd(0x8825)
        gps[1], gps[2], gps[3], gps[4] = 'N', (35.0, 4.0, 12.0), 'W', (80.0, 40.0, 1.0)
        src = self.save('phone.jpg', picture(4000, 3000), format='JPEG', quality=92, exif=ex)
        before = sha(src)
        code, text = self.run_tool(src, '--name', 'Goat in a Frog Hat!', '--alt', self.ALT, '--caption', 'Frog hat')
        self.assertEqual(code, 0, text)
        with Image.open(self.out('goat-in-a-frog-hat')) as im:
            self.assertEqual(im.size, (1050, 1400))                  # upright (3000 x 4000), then at most 1400 on the long side
            self.assertEqual(len(im.getexif()), 0)
        with open(self.out('goat-in-a-frog-hat'), 'rb') as f:
            raw = f.read()
        for hidden in (b'GPS', b'Exif', b'SecretCameraMaker', b'<x:xmpmeta'):
            self.assertNotIn(hidden, raw)
        self.assertIn('GPS', text)
        self.assertEqual(sha(src), before, 'the original must not change')
        self.assertIn('goat-in-a-frog-hat.webp', self.photo_srcs())
        self.assertIn('alt: "' + self.ALT + '",', self.content())
        self.assertIn('caption: "Frog hat" },', self.content())
        self.assert_node_ok()

    def test_new_picture_goes_before_pictures_with_words_on_them(self):
        order = self.photo_srcs()
        first_words = [m for m in re.findall(r'src: "assets/photos/([^"]+)",\s*// words on the picture', self.content())][0]
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'plain-one', '--alt', 'Rows of green plants in a field')[0], 0)
        now = self.photo_srcs()
        self.assertEqual(now.index('plain-one.webp') + 1, now.index(first_words))
        self.assertEqual(len(now), len(order) + 1)
        self.assert_node_ok()

    def test_seasonal_text_picture_goes_last_and_is_marked(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'easter-sign', '--seasonal-text', '--alt', 'A banner reading Happy Easter above a field of flowers')[0], 0)
        self.assertEqual(self.photo_srcs()[-1], 'easter-sign.webp')
        self.assertRegex(self.content(), r'src: "assets/photos/easter-sign.webp",\s*// words on the picture')
        src2 = self.save('b.jpg', picture(900, 600, seed=2), format='JPEG')
        self.assertEqual(self.run_tool(src2, '--name', 'plain-two', '--alt', 'Rows of green plants in a field')[0], 0)
        now = self.photo_srcs()
        self.assertLess(now.index('plain-two.webp'), now.index('easter-sign.webp'))
        self.assertEqual(now[-1], 'easter-sign.webp')
        self.assert_node_ok()

    def test_picture_without_caption(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'no-caption', '--alt', 'Rows of green plants in a field')[0], 0)
        self.assertRegex(self.content(), r'alt: "Rows of green plants in a field" \},')
        self.assert_node_ok()

    # ------------------------------------------------------------- small, tiny, huge, broken
    def test_small_picture_stays_small_and_is_warned_about(self):
        src = self.save('small.png', picture(300, 200))
        code, text = self.run_tool(src, '--name', 'small-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 0, text)
        self.assertEqual(self.info('small-one')[0], (300, 200))      # never blown up
        self.assertIn('look soft', text)
        self.assertIn('ORIGINAL', text)

    def test_big_enough_picture_gets_no_soft_warning(self):
        src = self.save('ok.jpg', picture(800, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'ok-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 0, text)
        self.assertNotIn('look soft', text)

    def test_tiny_picture_is_refused(self):
        src = self.save('tiny.png', picture(60, 40))
        before = snapshot(self.root)
        code, text = self.run_tool(src, '--name', 'tiny-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('too small', text)
        self.assertEqual(snapshot(self.root), before)

    def test_huge_file_is_refused(self):
        path = os.path.join(self.pics, 'video.jpg')
        with open(path, 'wb') as f:
            f.truncate(61 * 1024 * 1024)
        code, text = self.run_tool(path, '--name', 'huge-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('too big', text)

    def test_not_a_picture_is_refused(self):
        path = os.path.join(self.pics, 'notes.jpg')
        with open(path, 'w') as f:
            f.write('hello ' * 400)
        code, text = self.run_tool(path, '--name', 'text-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('cannot read this file as a picture', text)
        self.assertNotIn('Traceback', text)

    def test_other_picture_types_are_refused_plainly(self):
        src = self.save('a.bmp', picture(400, 300))
        code, text = self.run_tool(src, '--name', 'bmp-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('BMP', text)
        self.assertIn('JPEG, PNG, WebP or HEIC', text)

    def test_animated_picture_is_refused(self):
        frames = [picture(300, 300, seed=s) for s in (1, 2)]
        path = os.path.join(self.pics, 'a.webp')
        frames[0].save(path, save_all=True, append_images=frames[1:], duration=100, loop=0)
        code, text = self.run_tool(path, '--name', 'anim-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('animated', text)

    def test_missing_file(self):
        code, text = self.run_tool(os.path.join(self.pics, 'nothing.jpg'), '--name', 'x-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('cannot find the picture', text)

    # ------------------------------------------------------------- picture types that need care
    def test_png_with_transparency_keeps_it(self):
        im = picture(600, 400).convert('RGBA')
        im.paste((0, 0, 0, 0), (0, 0, 100, 100))
        src = self.save('t.png', im)
        self.assertEqual(self.run_tool(src, '--name', 'see-through', '--alt', 'Rows of green plants in a field')[0], 0)
        size, mode, pixel = self.info('see-through')
        self.assertEqual(mode, 'RGBA')
        self.assertEqual(pixel[3], 0)

    def test_cmyk_and_palette_pictures_work(self):
        s1 = self.save('c.jpg', picture(600, 400).convert('CMYK'), format='JPEG')
        s2 = self.save('p.png', picture(600, 400).convert('P'))
        self.assertEqual(self.run_tool(s1, '--name', 'cmyk-one', '--alt', 'Rows of green plants in a field')[0], 0)
        self.assertEqual(self.run_tool(s2, '--name', 'palette-one', '--alt', 'Rows of green plants in a field')[0], 0)
        self.assertEqual(self.info('cmyk-one')[1], 'RGB')

    def test_heic_without_the_extra_package_gets_a_plain_message(self):
        if pillow_heif is not None:
            self.skipTest('pillow-heif is installed here')
        path = os.path.join(self.pics, 'iphone.heic')
        with open(path, 'wb') as f:
            f.write(b'\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic' + b'\x00' * 3000)
        code, text = self.run_tool(path, '--name', 'heic-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('pip install pillow-heif', text)

    def test_heic_picture_works_when_the_package_is_there(self):
        if pillow_heif is None:
            self.skipTest('pillow-heif is not installed here')
        pillow_heif.register_heif_opener()
        path = os.path.join(self.pics, 'iphone.heic')
        picture(1200, 900).save(path, format='HEIF')
        code, text = self.run_tool(path, '--name', 'heic-one', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 0, text)
        self.assertEqual(self.info('heic-one')[0], (1200, 900))

    # ------------------------------------------------------------- never overwrite, dry run, place none
    def test_never_overwrites_unless_replace(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'same-name', '--alt', 'Rows of green plants in a field')[0], 0)
        first = sha(self.out('same-name'))
        src2 = self.save('b.jpg', picture(800, 800, seed=5), format='JPEG')
        code, text = self.run_tool(src2, '--name', 'same-name', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('never overwrite', text)
        self.assertEqual(sha(self.out('same-name')), first)
        code, text = self.run_tool(src2, '--name', 'same-name', '--replace')            # no new alt needed: the entry stays as it is
        self.assertEqual(code, 0, text)
        self.assertNotEqual(sha(self.out('same-name')), first)
        self.assertEqual(self.photo_srcs().count('same-name.webp'), 1)
        self.assertEqual(self.info('same-name')[0], (800, 800))
        self.assert_node_ok()

    def test_existing_photos_of_the_site_are_protected_too(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'goats-rubs-sign', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('already there', text)

    def test_dry_run_changes_nothing(self):
        src = self.save('a.jpg', picture(2000, 1500), format='JPEG')
        before = snapshot(self.tmp)
        code, text = self.run_tool(src, '--name', 'dry-one', '--alt', self.ALT, '--caption', 'Frog hat', '--dry-run')
        self.assertEqual(code, 0, text)
        self.assertIn('Dry run', text)
        self.assertEqual(snapshot(self.tmp), before)

    def test_place_none_only_saves_the_file(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        old = self.content()
        code, text = self.run_tool(src, '--name', 'file-only', '--alt', 'Rows of green plants in a field', '--place', 'none')
        self.assertEqual(code, 0, text)
        self.assertTrue(os.path.exists(self.out('file-only')))
        self.assertEqual(self.content(), old)

    # ------------------------------------------------------------- the words
    def test_alt_is_required_and_must_say_something(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'no-alt')
        self.assertEqual(code, 1)
        self.assertIn('--alt', text)
        code, text = self.run_tool(src, '--name', 'short-alt', '--alt', 'goat')
        self.assertEqual(code, 1)
        self.assertIn('too short', text)
        self.assertFalse(os.path.exists(self.out('no-alt')))

    def test_quotes_become_curly_and_angle_brackets_are_refused(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'quotes-one', '--alt', 'A sign that says "We\'ve been waiting" over a field', '--seasonal-text')
        self.assertEqual(code, 0, text)
        self.assertIn('“We’ve been waiting”', self.content())
        self.assertNotIn("We've", self.content())
        code, text = self.run_tool(src, '--name', 'bracket-one', '--alt', 'A <b>sign</b> over a field')
        self.assertEqual(code, 1)
        self.assertIn('may not contain', text)
        self.assert_node_ok()

    def test_prices_dates_and_names_trigger_warnings_and_the_reminder(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'risky-one', '--alt', 'Strawberries for $4.50 on May 3 2027 at the farm')
        self.assertEqual(code, 0, text)
        self.assertIn('a price', text)
        self.assertIn('a date or a year', text)
        self.assertIn('No prices, no names of people, no dates', text)

    def test_looks_like_a_picture_that_is_already_there(self):
        src = self.save('a.jpg', picture(1000, 700, seed=9), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'first-copy', '--alt', 'Rows of green plants in a field')[0], 0)
        src2 = self.save('b.png', picture(1000, 700, seed=9))
        code, text = self.run_tool(src2, '--name', 'second-copy', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 0, text)
        self.assertIn('looks like the picture assets/photos/first-copy.webp', text)
        src3 = self.save('c.jpg', picture(1000, 700, seed=77), format='JPEG')
        code, text = self.run_tool(src3, '--name', 'other-one', '--alt', 'Rows of green plants in a field')
        self.assertNotIn('looks like the picture', text)

    def test_next_steps_name_the_texts_to_translate(self):
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, text = self.run_tool(src, '--name', 'steps-one', '--alt', 'Rows of green plants in a field', '--caption', 'Green rows')
        self.assertEqual(code, 0, text)
        for needle in ('i18n.py jsstrings', '"Rows of green plants in a field": "..."', '"Green rows": "..."', 'i18n.py build', 'missing es', 'src="assets/photos/steps-one.webp"'):
            self.assertIn(needle, text)

    # ------------------------------------------------------------- js/content.js is not what we expect
    def test_unexpected_content_js_is_left_alone(self):
        path = os.path.join(self.root, 'js', 'content.js')
        broken = self.content().replace('  photos: [', '  photoz: [')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(broken)
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        before = snapshot(self.root)
        code, text = self.run_tool(src, '--name', 'stay-out', '--alt', 'Rows of green plants in a field')
        self.assertEqual(code, 1)
        self.assertIn('cannot find  photos: [', text)
        self.assertEqual(snapshot(self.root), before)

    def test_empty_one_line_list(self):
        path = os.path.join(self.root, 'js', 'content.js')
        text = self.content()
        start = text.index('  photos: [')
        end = text.index('\n  ],', start) + len('\n  ],')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text[:start] + '  photos: [],' + text[end:])
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        code, out = self.run_tool(src, '--name', 'only-one', '--alt', 'Rows of green plants in a field', '--caption', 'Green rows')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.photo_srcs(), ['only-one.webp'])
        self.assert_node_ok()

    def test_windows_line_endings_are_kept(self):
        path = os.path.join(self.root, 'js', 'content.js')
        data = self.content().replace('\n', '\r\n')
        with open(path, 'wb') as f:
            f.write(data.encode('utf-8'))
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'crlf-one', '--alt', 'Rows of green plants in a field')[0], 0)
        with open(path, 'rb') as f:
            raw = f.read()
        self.assertEqual(raw.count(b'\n'), raw.count(b'\r\n'), 'a line ending was changed')
        self.assertIn(b'crlf-one.webp', raw)

    def test_a_list_whose_last_entry_has_no_comma(self):
        path = os.path.join(self.root, 'js', 'content.js')
        text = self.content()
        text = text.replace('caption: "Foster Village table" },\n  ],', 'caption: "Foster Village table" }\n  ],')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        src = self.save('a.jpg', picture(900, 600), format='JPEG')
        self.assertEqual(self.run_tool(src, '--name', 'after-last', '--alt', 'Rows of green plants in a field', '--seasonal-text')[0], 0)
        self.assertEqual(self.photo_srcs()[-1], 'after-last.webp')
        self.assert_node_ok()

    def test_no_arguments_prints_the_help(self):
        code, text = self.run_tool()
        self.assertEqual(code, 1)
        self.assertIn('Adds a photo to the website', text)


if __name__ == '__main__':
    result = unittest.main(exit=False, verbosity=1)
    if result.result.wasSuccessful():
        print('OK: tools/add_photo.py passed', result.result.testsRun, 'checks')
    else:
        sys.exit(1)
