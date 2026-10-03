#!/usr/bin/env python3
"""Adds a photo to the website: makes it web-sized, removes the hidden camera and location data, saves it in assets/photos/
and lists it in the photo gallery (js/content.js).

  python3 tools/add_photo.py <picture> --name goat-in-frog-hat --alt "A small animal wearing a green knitted frog hat" --caption "Frog hat"

  <picture>        a JPEG, PNG, WebP or HEIC (iPhone) file. For HEIC: pip install pillow-heif
  --name WORDS     the file name to use, in a few plain words: "goat in frog hat" becomes assets/photos/goat-in-frog-hat.webp
  --alt "TEXT"     what is VISIBLE in the picture, read aloud to people who cannot see it. No prices, no names of people, no dates.
  --caption "TEXT" (optional) a short line shown under the picture when it is enlarged
  --tags a,b       (optional) the topic buttons above the gallery it belongs under, for example  --tags berries,flowers . Only tag what you can
                   SEE in the picture. Allowed: the list after "Allowed tags:" in js/content.js. No tags = it shows under "All" only.
  --place gallery  (the default) also list the picture in the photo gallery
  --place none     only save the file (for a picture you will put on a page yourself)
  --seasonal-text  the picture has words printed on it (a season, a date, a price, "Happy Easter"). Such pictures go out of date, so
                   they are listed LAST in the gallery, after the ones without words. Say the words in --alt.
  --replace        replace a picture that is already saved under this name (without it, an existing file is never touched)
  --dry-run        show what would happen and change nothing

What it does
  - turns the picture upright when the phone stored it sideways, and shrinks it to at most 1400 pixels on the long side
    (a smaller picture is never blown up: it stays as it is)
  - saves a WebP copy at quality 85 with NO camera, GPS or other hidden data in it (the original file is not changed)
  - adds one entry to  photos: [ ... ]  in js/content.js, before any entry marked  // words on the picture,  so those stay last
  - checks that js/content.js still works before it writes it, and warns when the picture looks like one that is already there
  - prints the next steps (translations for the alt text and caption; the topic buttons are already translated)

Needs:  pip install pillow
"""
import argparse, difflib, html, io, os, re, shutil, subprocess, sys, tempfile, unicodedata

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit('This needs the Pillow package:  pip install pillow')
try:
    from PIL import ImageCms
except ImportError:      # colour profiles are a nicety; without it the picture is still saved
    ImageCms = None
try:
    import pillow_heif   # iPhone HEIC pictures (optional)
    pillow_heif.register_heif_opener()
except ImportError:
    pillow_heif = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, 'assets', 'photos')
CONTENT = os.path.join(ROOT, 'js', 'content.js')

MAX_SIDE = 1400          # longest side of the published picture, in pixels
QUALITY = 85
SOFT_BELOW = 500         # a picture smaller than this (long side) looks soft when shown big
MIN_SIDE = 120           # smaller than this is a thumbnail or an icon, not a photo
MAX_FILE_MB = 60         # bigger files are not photos from a phone (videos, scans...)
MAX_PIXELS = 100_000_000
MAX_ALT, MIN_ALT, MAX_CAPTION = 300, 10, 80
FORMATS = {'JPEG': 'JPEG', 'MPO': 'JPEG', 'PNG': 'PNG', 'WEBP': 'WebP', 'HEIF': 'HEIC', 'HEIC': 'HEIC', 'AVIF': 'AVIF'}
WORDS_MARK = 'words on the picture'      # the comment that marks a gallery entry that has words printed on the picture
GPS_IFD = 0x8825
Image.MAX_IMAGE_PIXELS = None            # the size is checked below, with a plain message instead of a Python error


def fail(msg):
    sys.exit('Problem: ' + msg)


# ---------------------------------------------------------------- the words that go into js/content.js

def clean_text(text, what, limit, minimum=0):
    """One tidy line that is safe inside a "..." string in js/content.js and that the translation tool can read."""
    text = re.sub(r'\s+', ' ', text or '').strip()
    if re.search(r'[<>\\]', text):
        fail(f'the {what} may not contain < > or a backslash. Write the words without them.')
    notes = []
    if '"' in text or "'" in text:
        text = re.sub(r'"([^"]*)"', '“\\1”', text).replace('"', '”').replace("'", '’')
        notes.append(f'note: straight quote marks in the {what} became curly ones (“ ” ’): the translation tool cannot read straight ones inside a text.')
    if len(text) < minimum:
        fail(f'the {what} is too short. Describe what is visible in the picture in a few words, for example "A small animal wearing a green knitted frog hat".')
    if len(text) > limit:
        fail(f'the {what} is {len(text)} letters long; the most I take is {limit}. Say it more briefly.')
    return text, notes


MONTHS = r'(?:January|February|March|April|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)'
RISKY = [
    (r'[$€£]|\b\d+(?:\.\d{2})?\s*(?:dollars?|cents?|USD)\b|\b\d+\.\d{2}\b', 'a price'),
    (r'\b' + MONTHS + r'\.?\s+\d{1,2}\b|\b\d{1,2}\s+' + MONTHS + r'\b|\bMay\s+\d{1,2}\b|\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b|\b(?:19|20)\d{2}\b', 'a date or a year'),
    (r'@|\b\d{3}[-. ]\d{3,4}\b|https?://|www\.', 'a phone number, email or web address'),
]


def risky_words(text):
    return [label for pat, label in RISKY if re.search(pat, text)]


def slug(name):
    name = os.path.basename(name or '').strip()
    name = re.sub(r'\.(jpe?g|png|webp|heic|heif|avif)$', '', name, flags=re.I)
    name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii').lower()
    name = re.sub(r'[^a-z0-9]+', '-', name).strip('-')[:60].strip('-')
    if not re.search(r'[a-z]', name):
        fail('--name needs a few plain words with letters, for example  --name goat-in-frog-hat  (they become the file name).')
    return name


# ---------------------------------------------------------------- the picture

def open_picture(path):
    if not os.path.isfile(path):
        fail(f'I cannot find the picture "{path}". Check the spelling, or drag the file into the window to paste its full path.')
    size = os.path.getsize(path)
    if size > MAX_FILE_MB * 1024 * 1024:
        fail(f'this file is {size / 1048576:.0f} MB. That is too big to be a photo (the limit is {MAX_FILE_MB} MB). Is it a video or a scan? Send the photo itself.')
    if size < 1024:
        fail('this file is almost empty, so it is not a picture I can use. Send the photo again.')
    try:
        im = Image.open(path)          # only the header is read here
    except Exception:
        with open(path, 'rb') as f:
            head = f.read(16)
        if head[4:8] == b'ftyp' and head[8:12] in (b'heic', b'heix', b'hevc', b'heim', b'heis', b'mif1', b'msf1', b'avif'):
            fail('this is an iPhone (HEIC) picture and I need one more package to read it:  pip install pillow-heif\n'
                 '(or send it as a JPEG: on the iPhone choose Share, then Options, then "Most Compatible".)')
        fail('I cannot read this file as a picture. I can use JPEG, PNG, WebP or HEIC pictures. Was it saved or sent properly?')
    fmt = FORMATS.get(im.format or '')
    if not fmt:
        fail(f'this is a {im.format or "unknown"} file. I can use JPEG, PNG, WebP or HEIC pictures. Save it as a JPEG first.')
    if getattr(im, 'is_animated', False) and im.format != 'MPO':
        fail('this is an animated picture. Send a single still photo.')
    w, h = im.size
    if max(w, h) < MIN_SIDE:
        fail(f'this picture is only {w} x {h} pixels. That is too small to show: it would be a blurry dot. Send the original photo.')
    if w * h > MAX_PIXELS:
        fail(f'this picture is {w} x {h} pixels ({w * h / 1e6:.0f} megapixels). That is more than a phone takes: it may be a scan or a panorama. Shrink it first or send another one.')
    return im, fmt, size


def to_8bit(im):
    """A 16-bit or 32-bit grey picture (a scanner, some editors) is scaled down to 8 bits. A plain convert() would cut everything above 255 off
    and turn the whole picture white."""
    if not (im.mode.startswith('I;16') or im.mode == 'I'):
        return im
    top = max(65535, im.getextrema()[1])
    return im.point(lambda v: v * (255 / top)).convert('L')


def upright_and_clean(im):
    """Returns (a new picture with no hidden data, list of facts about what was removed or changed)."""
    facts = []
    exif = None
    try:
        exif = im.getexif()
    except Exception:
        pass
    if exif is not None:
        try:
            if exif.get_ifd(GPS_IFD):
                facts.append('the original has a GPS location in it: it is NOT in the saved picture')
        except Exception:
            pass
        if exif.get(0x0112, 1) not in (0, 1):
            facts.append('turned the picture upright (the phone had stored it sideways)')
    icc = im.info.get('icc_profile')
    im = ImageOps.exif_transpose(im)
    im.load()
    im = to_8bit(im)
    if icc and ImageCms is not None and im.mode in ('RGB', 'RGBA', 'CMYK', 'L', 'LA'):
        try:   # keep the colours right: convert from the picture's own colour profile to the standard web one
            src = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            dst = ImageCms.createProfile('sRGB')
            if im.mode in ('RGBA', 'LA'):
                alpha = im.getchannel('A')
                base = ImageCms.profileToProfile(im.convert('RGB' if im.mode == 'RGBA' else 'L'), src, dst, outputMode='RGB')
                base.putalpha(alpha)
                im = base
            else:
                im = ImageCms.profileToProfile(im, src, dst, outputMode='RGB')
        except Exception:
            pass
    has_alpha = im.mode in ('RGBA', 'LA', 'PA') or (im.mode == 'P' and 'transparency' in im.info)
    if has_alpha:
        try:
            alpha = im.convert('RGBA').getchannel('A')
            has_alpha = alpha.getextrema()[0] < 255          # a fully opaque "alpha" is no transparency
        except Exception:
            has_alpha = False
    im = im.convert('RGBA' if has_alpha else 'RGB')
    clean = Image.new(im.mode, im.size)      # a new picture: nothing from the original file (EXIF, GPS, profile, notes) comes along
    clean.paste(im)
    return clean, facts


def shrink(im):
    w, h = im.size
    long_side = max(w, h)
    if long_side <= MAX_SIDE:
        return im, False
    scale = MAX_SIDE / long_side
    return im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS), True


def fingerprint(im):
    """A tiny 'looks like' number: 64 yes/no brightness comparisons. Same picture (even resized or re-saved) gives nearly the same number."""
    g = im.convert('L').resize((9, 8), Image.LANCZOS)
    px = g.tobytes()
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return bits


def look_alikes(bits, skip):
    found = []
    if not os.path.isdir(PHOTOS):
        return found
    for f in sorted(os.listdir(PHOTOS)):
        if f == skip or not re.search(r'\.(webp|jpe?g|png)$', f, re.I):
            continue
        try:
            with Image.open(os.path.join(PHOTOS, f)) as other:
                other.load()
                if bin(fingerprint(other) ^ bits).count('1') <= 4:
                    found.append(f)
        except Exception:
            continue
    return found


# ---------------------------------------------------------------- js/content.js

def read_content():
    try:
        with open(CONTENT, 'rb') as f:
            raw = f.read()
    except OSError:
        fail('I cannot open js/content.js. Run this from the website folder:  python3 tools/add_photo.py ...')
    bom = raw.startswith(b'\xef\xbb\xbf')
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        fail('js/content.js is not saved as UTF-8 text, so I did not touch it.')
    crlf = '\r\n' in text
    return text.replace('\r\n', '\n'), crlf, bom


def photo_entries(lines):
    """Finds  photos: [ ... ]  and the entries in it. Returns (open_line, close_line, entries); entry = (first_line, last_line, src, words)."""
    open_i = None
    for i, line in enumerate(lines):
        if re.match(r'^\s*photos:\s*\[', line):
            open_i = i
            break
    if open_i is None:
        fail('I cannot find  photos: [  in js/content.js (it may have been changed by hand), so nothing was changed.')
    one_line = re.match(r'^(\s*)photos:\s*\[\s*\](\s*,?)\s*(//.*)?$', lines[open_i])
    if one_line:
        return open_i, open_i, []
    if not re.match(r'^\s*photos:\s*\[\s*(//.*)?$', lines[open_i]):
        fail('the  photos: [  line in js/content.js has something after the bracket, so I do not dare to add to it. Nothing was changed.')
    close_i = None
    for i in range(open_i + 1, len(lines)):
        if re.match(r'^\s*\]\s*,?\s*(//.*)?$', lines[i]):
            close_i = i
            break
    if close_i is None:
        fail('I cannot find the end of the photos list in js/content.js, so nothing was changed.')
    entries, i = [], open_i + 1
    while i < close_i:
        line = lines[i]
        m = re.match(r'^\s*\{\s*src:\s*"([^"]*)"', line)
        if m:
            j = i
            while j < close_i and not re.search(r'\}\s*,?\s*(//.*)?$', lines[j]):
                j += 1
            if j >= close_i:
                fail('an entry in the photos list of js/content.js is not closed with  },  so nothing was changed.')
            entries.append((i, j, m.group(1), bool(re.search(r'//.*' + WORDS_MARK, line, re.I))))
            i = j + 1
        else:
            if line.strip() and not line.strip().startswith('//'):
                fail('the photos list in js/content.js has something I do not understand: ' + line.strip()[:60] + '\nNothing was changed.')
            i += 1
    return open_i, close_i, entries


def allowed_tags(text):
    """The topics the gallery buttons have, from the line  Allowed tags: berries, flowers, ...  in the comment at the top of js/content.js."""
    m = re.search(r'Allowed tags:\s*([^\n]*)', text)
    if not m:
        return None
    return [t for t in re.split(r'[\s,]+', m.group(1).strip().rstrip('.')) if t]


def clean_tags(raw, allowed):
    """['Berries, flowers'] -> ['berries', 'flowers'], and a plain message for a topic that has no button."""
    wanted = []
    for t in re.split(r'[\s,;]+', (raw or '').lower()):
        if t and t not in wanted:
            wanted.append(t)
    if not wanted:
        return []
    if allowed is None:
        fail('I cannot find the list  Allowed tags: ...  in the comment at the top of js/content.js, so I cannot check --tags. '
             'Add the picture without --tags, or ask Claude.')
    for t in wanted:
        if t not in allowed:
            close = difflib.get_close_matches(t, allowed, n=1)
            fail(f'"{t}" is not a topic the gallery has' + (f' (did you mean "{close[0]}"?)' if close else '') +
                 f'. The topics are: {", ".join(allowed)}. A new topic needs a new button and its translations: ask Claude.')
    return wanted


def plan_listing(text, src, alt, caption, seasonal, tags=()):
    """Returns (new text, where it went, 'added' or 'already listed')."""
    lines = text.split('\n')
    open_i, close_i, entries = photo_entries(lines)
    if any(e[2] == src for e in entries):
        return text, None, 'already listed'
    one_line = not entries and open_i == close_i        # photos: [],  all on one line
    if one_line:
        m = re.match(r'^(\s*)photos:', lines[open_i])
        lines[open_i:open_i + 1] = [f'{m.group(1)}photos: [', f'{m.group(1)}],']
        open_i, close_i = open_i, open_i + 1
        indent = m.group(1) + '  '
    elif entries:
        indent = re.match(r'^(\s*)', lines[entries[0][0]]).group(1)
    else:
        indent = re.match(r'^(\s*)', lines[open_i]).group(1) + '  '
    mark = '   // ' + WORDS_MARK if seasonal else ''
    block = [f'{indent}{{ src: "{src}",{mark}', f'{indent}  alt: "{alt}"' + (',' if caption or tags else ' },')]
    if caption:
        block.append(f'{indent}  caption: "{caption}"' + (',' if tags else ' },'))
    if tags:
        block.append(f'{indent}  tags: [' + ', '.join(f'"{t}"' for t in tags) + '] },')
    first_words = next((e for e in entries if e[3]), None)
    if first_words is not None and not seasonal:
        at, where = first_words[0], f'just before "{os.path.basename(first_words[2])}", the first picture with words on it'
    else:
        at, where = close_i, 'at the end of the gallery' + (' (it has words on it, so it stays last)' if seasonal else '')
    if entries and at == close_i:
        last_end = entries[-1][1]
        if not re.search(r'\}\s*,\s*(//.*)?$', lines[last_end]):
            lines[last_end] = re.sub(r'\}(\s*(//.*)?)$', r'},\1', lines[last_end])      # the one before needs a comma now
    lines[at:at] = block
    return '\n'.join(lines), where, 'added'


def check_javascript(new_text, old_count_src):
    """Stops before anything is written if the new js/content.js would not work."""
    if new_text.count('src: "assets/photos/') != old_count_src + 1:
        fail('I made a mistake while editing js/content.js (the number of photos is not what it should be). Nothing was changed. Please tell Claude.')
    node = shutil.which('node')
    if not node:
        return False
    fd, tmp = tempfile.mkstemp(suffix='.js')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as f:
            f.write(new_text)
        ok = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
    finally:
        os.remove(tmp)
    if ok.returncode != 0:
        fail('the new js/content.js would not work (' + ok.stderr.strip().splitlines()[-1][:120] + '). Nothing was changed. Please tell Claude.')
    return True


def write_content(text, crlf, bom):
    data = text.replace('\n', '\r\n') if crlf else text
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(CONTENT), suffix='.tmp')
    with os.fdopen(fd, 'wb') as f:
        f.write((b'\xef\xbb\xbf' if bom else b'') + data.encode('utf-8'))
    try:                                      # a temporary file is private (mode 600): keep the file's own permissions, so the web server can still read it
        os.chmod(tmp, os.stat(CONTENT).st_mode & 0o777)
    except OSError:
        pass
    os.replace(tmp, CONTENT)


# ---------------------------------------------------------------- the whole job

def parse_args():
    class Quiet(argparse.ArgumentParser):
        def error(self, message):
            fail(message.replace('the following arguments are required', 'you still need to give') + '\nExample:  python3 tools/add_photo.py my-photo.jpg --name goat-in-frog-hat --alt "A small animal wearing a green knitted frog hat"\n(Run it with no words after it to read all the options.)')
    p = Quiet(add_help=False)
    p.add_argument('picture')
    p.add_argument('--name', required=True)
    p.add_argument('--alt', default=None)
    p.add_argument('--caption', default='')
    p.add_argument('--tags', default='')
    p.add_argument('--place', choices=('gallery', 'none'), default='gallery')
    p.add_argument('--seasonal-text', action='store_true')
    p.add_argument('--replace', action='store_true')
    p.add_argument('--dry-run', action='store_true')
    return p.parse_args()


def main():
    if len(sys.argv) < 2 or sys.argv[1] in ('-h', '--help'):
        sys.exit(__doc__)
    args = parse_args()
    dry = args.dry_run
    name = slug(args.name)
    src = f'assets/photos/{name}.webp'
    out = os.path.join(PHOTOS, name + '.webp')
    exists = os.path.exists(out)
    if exists and not args.replace:
        fail(f'{src} is already there, and I never overwrite a picture. Pick another --name, or add --replace if you really mean to swap it.')

    text, crlf, bom = read_content()
    listed = any(e[2] == src for e in photo_entries(text.split('\n'))[2])
    if args.alt is None and not (args.replace and listed):
        fail('you still need to give --alt "what is visible in the picture". It is read aloud for people who cannot see it.')
    notes, alt, caption = [], '', ''
    allowed = allowed_tags(text)
    tags = clean_tags(args.tags, allowed)
    if args.alt is not None:
        alt, n = clean_text(args.alt, 'alt text', MAX_ALT, MIN_ALT)
        notes += n
        caption, n = clean_text(args.caption, 'caption', MAX_CAPTION)
        notes += n
    seasonal = args.seasonal_text
    if args.alt is not None and not seasonal and re.search(r'\b(reading|reads|says|banner|words|text|written|printed)\b', alt, re.I):
        notes.append('note: the alt text talks about words on the picture. If the words are on the picture itself, add --seasonal-text so it stays last in the gallery.')

    im, fmt, size = open_picture(args.picture)
    w0, h0 = im.size
    try:
        clean, facts = upright_and_clean(im)
    except MemoryError:
        fail('this picture is too big for this computer to open ({} x {} pixels). Shrink it first (or send a smaller copy) and try again.'.format(*im.size))
    except Exception:
        fail('this picture is damaged, or it was cut off while it was copied or sent, so I could not read all of it. Nothing was changed. Send the photo again (from the phone itself, not from a message that stopped part-way).')
    ow, oh = clean.size
    final, was_shrunk = shrink(clean)
    fw, fh = final.size
    bits = fingerprint(final)
    twins = look_alikes(bits, os.path.basename(out))

    new_text, where, state, checked = text, None, 'skipped', True
    if args.place == 'gallery' and (args.alt is not None):
        new_text, where, state = plan_listing(text, src, alt, caption, seasonal, tags)
        if state == 'added':
            checked = check_javascript(new_text, text.count('src: "assets/photos/'))
    elif args.place == 'gallery':
        state = 'already listed'

    # ------- do it (or, with --dry-run, only say it)
    before = f'{fmt}, {w0} x {h0}, {size / 1024:.0f} KB'
    if not dry:
        os.makedirs(PHOTOS, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=PHOTOS, suffix='.tmp')
        os.close(fd)
        try:
            final.save(tmp, 'WEBP', quality=QUALITY, method=6)
            with Image.open(tmp) as check:           # prove that nothing hidden came along
                check.load()
                if check.info.get('exif') or check.info.get('icc_profile') or check.info.get('xmp') or len(check.getexif()):
                    raise ValueError('hidden data was found in the saved picture')
            try:                              # same reason: a temporary file is private; a picture should be readable like the others
                os.chmod(tmp, 0o644)
            except OSError:
                pass
            os.replace(tmp, out)
        except Exception as e:
            if os.path.exists(tmp):
                os.remove(tmp)
            fail(f'I could not save the picture ({e}). Nothing was changed.')
        if state == 'added':
            try:
                write_content(new_text, crlf, bom)
            except Exception as e:
                if not exists:
                    os.remove(out)
                fail(f'I could not write js/content.js ({e}). The new picture was removed again.')
        kb = os.path.getsize(out) / 1024
    else:
        kb = None

    # ------- tell the owner
    say = 'Dry run: nothing was changed. This is what I would do:' if dry else 'Done.'
    print(say)
    print(f'  picture:   {src}  ({"replacing the old one, " if exists else ""}{fw} x {fh}, WebP' + (f', {kb:.0f} KB' if kb else '') + f')   from {before}')
    if was_shrunk:
        print(f'  shrunk:    from {ow} x {oh} to at most {MAX_SIDE} pixels on the long side')
    for fact in facts:
        print('  cleaned:  ', fact)
    print('  removed:    camera, location (GPS) and all other hidden data: the saved file starts clean' if not dry else '  will remove: camera, location (GPS) and all other hidden data')
    if state == 'added':
        print(f'  gallery:    {"will be listed" if dry else "listed"} in js/content.js {where}')
        print('  topics:     ' + (', '.join(tags) if tags else 'none: it shows under "All" only') + '   (the buttons above the gallery)')
    elif state == 'already listed':
        print('  gallery:    this picture is already listed in js/content.js: its alt text, caption and topics were left as they are')
    else:
        print('  gallery:    not listed (--place none): the file is only saved')
    for n in notes:
        print(n)
    if state == 'added' and not tags and allowed:
        print(f'note: no topic given, so it shows under "All" only. To put it under the topic buttons add  --tags  and one or more of: {", ".join(allowed)}  (only what you can see in the picture).')
    if tags and state != 'added':
        print('note: --tags was not used, because the picture is not listed in the gallery here.')
    if max(fw, fh) < SOFT_BELOW:
        print(f'warning: this picture is only {max(fw, fh)} pixels on its long side, so it will look soft if it is shown big. '
              'The website keeps pictures like this to small tiles. If you can, send the ORIGINAL from the phone (not a screenshot, and not a copy that went through a chat app).')
    for t in twins:
        print(f'warning: this looks like the picture assets/photos/{t}, which is already on the website. Is it the same one?')
    if args.alt is not None:
        for what in risky_words(alt + ' ' + caption):
            print(f'warning: the alt text or caption seems to contain {what}. Words like that go out of date or can be wrong: if it is not printed ON the picture, take it out.'
                  + ('' if seasonal else ' (If it IS printed on the picture, use --seasonal-text.)'))
        print('reminder: alt text says only what you can SEE. No prices, no names of people, no dates (they go out of date and can be wrong).')
    if state == 'added' and not checked:
        print('note: I could not double-check js/content.js here (node is not installed). Open the website and look at the gallery.')
    print()
    print('Next steps (Claude or the owner):')
    n = 1
    if args.place == 'gallery':
        print(f'  {n}. python3 tools/i18n.py jsstrings         (finds the new alt text and caption)'); n += 1
        print(f'  {n}. Translate the texts below. Add them under "js" in lang/src/es.json, hi.json, zh.json and vi.json:'); n += 1
        print(f'       "{alt}": "...",' if alt else '       (the alt text that is already in js/content.js)')
        if caption:
            print(f'       "{caption}": "...",')
        print(f'  {n}. python3 tools/i18n.py build; python3 tools/i18n.py missing es   (then hi, zh, vi: each must say 0 missing)'); n += 1
    print(f'  {n}. Open the website and tap the picture in the gallery to see it.' if args.place == 'gallery' else f'  {n}. Ask Claude to put the picture on a page.'); n += 1
    print()
    print('To show it on a page as well, ask Claude. A small tile in a "photo strip" looks like this (then run tools/pages.py and tools/i18n.py extract):')
    print(f'  <li><figure><img data-zoom src="{src}" alt="{html.escape(alt or "WHAT IS VISIBLE", quote=True)}" width="{fw}" height="{fh}" loading="lazy" decoding="async"><figcaption>{html.escape(caption or "CAPTION")}</figcaption></figure></li>')


if __name__ == '__main__':
    main()
