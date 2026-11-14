#!/usr/bin/env python3
"""Makes the three Latin font files of the site smaller: only the letters the site can show are kept.

  python3 tools/font_subset.py           make assets/fonts/*.woff2 again from the full fonts in tools/fonts-full/
  python3 tools/font_subset.py --check   change nothing; say whether a letter the site uses is missing from a font (exit code 1)

Why: the fonts are a third of what a phone downloads for every page. The full fonts (as they came from Fontsource) stay in
tools/fonts-full/ and are never uploaded. Nothing looks different: a letter is only left out when no page, script, translation
or sign of the site uses it. The Vietnamese font is not touched.

When the site gets a new letter (say a name with a letter no page had yet), run this tool again: tests/font-letters.test.mjs
fails until you do, and names the letter. A letter that is missing is never lost on the page: the browser draws that one
letter in the stand-in font.

Needs, once:  python3 -m pip install fonttools brotli   (only for this tool; --check needs them too)
"""
import glob
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FULL = os.path.join(HERE, 'fonts-full')
OUT = os.path.join(ROOT, 'assets', 'fonts')
FONTS = ['caveat-latin-700-normal.woff2', 'fredoka-latin-wght-normal.woff2', 'nunito-latin-wght-normal.woff2']

# Every file whose words can reach a visitor's screen or a printed sign.
TEXT = ['*.html', 'js/*.js', 'css/*.css', 'lang/*.js', 'lang/src/*.json', 'print/*.html', 'pages/*.html',
        'tools/qr_links.json', 'tools/notice_phrases.json']

# Always kept, used or not: the keyboard letters, and the letters of Western European names and words that a review,
# a notice or a new page could bring tomorrow.
ALWAYS = set(range(0x20, 0x7F)) | set('ÁÄÅÇÉÍÑÓÖØÚÜàáâãäåæçèéêëìíîïñòóôõöøùúûüýßœ¡¿°©€™•·×')
ALWAYS = {c if isinstance(c, int) else ord(c) for c in ALWAYS}


def site_letters():
    used = set()
    for pattern in TEXT:
        for path in sorted(glob.glob(os.path.join(ROOT, pattern))):
            with open(path, encoding='utf-8-sig') as f:
                used.update(f.read())
    return {ord(c) for c in used}


def need_fonttools():
    try:
        from fontTools import subset  # noqa: F401
        from fontTools.ttLib import TTFont  # noqa: F401
        import brotli  # noqa: F401
    except ImportError:
        sys.exit('This tool needs two helper packages. Install them once:  python3 -m pip install fonttools brotli')


def letters_of(path):
    from fontTools.ttLib import TTFont
    return set(TTFont(path).getBestCmap())


def make(path, keep):
    from fontTools import subset
    from fontTools.ttLib import TTFont
    opt = subset.Options()
    opt.layout_features = ['*']      # every joining and spacing rule stays: the kept letters are shaped as before
    opt.name_IDs = ['*']             # the copyright line and the licence address stay inside the file
    opt.name_languages = ['*']
    opt.notdef_outline = True
    opt.hinting = True
    font = TTFont(path, recalcTimestamp=False)   # the same input always gives the same file
    s = subset.Subsetter(opt)
    s.populate(unicodes=sorted(keep))
    s.subset(font)
    font.flavor = 'woff2'
    buf = io.BytesIO()
    font.save(buf)
    return buf.getvalue()


def main(argv):
    check = '--check' in argv
    need_fonttools()
    used = site_letters()
    bad = 0
    for name in FONTS:
        full = os.path.join(FULL, name)
        out = os.path.join(OUT, name)
        if not os.path.exists(full):
            sys.exit('The full font is missing: tools/fonts-full/%s. Nothing was changed.' % name)
        have = letters_of(full)
        keep = have & (used | ALWAYS)
        if check:
            missing = sorted(keep - letters_of(out))
            if missing:
                bad += 1
                print('%s: missing %s' % (name, ' '.join('%s (U+%04X)' % (chr(c), c) for c in missing)))
            continue
        data = make(full, keep)
        before = os.path.getsize(out) if os.path.exists(out) else 0
        with open(out + '.new', 'wb') as f:
            f.write(data)
        os.replace(out + '.new', out)
        print('%s: %d of %d letters kept, %.1f KB (the full font: %.1f KB; before this run: %.1f KB)'
              % (name, len(keep), len(have), len(data) / 1024.0, os.path.getsize(full) / 1024.0, before / 1024.0))
    if check:
        if bad:
            print('A letter the site uses is not in a font. Run:  python3 tools/font_subset.py')
            return 1
        print('Every letter the site uses is in the fonts.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
