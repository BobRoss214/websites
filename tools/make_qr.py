#!/usr/bin/env python3
"""Makes QR codes and printable signs for the farm.

  python3 tools/make_qr.py            write assets/qr/*.svg and print/qr-signs.html
  python3 tools/make_qr.py --check    also scan every code back and make sure it opens the right address

To change where a sign points, or what it says, edit tools/qr_links.json and run this again.
Open print/qr-signs.html in a browser and use Print (or "Save as PDF"): one sign per page, English and Spanish.

The Google review sign needs your review link first: put it in js/content.js as  reviewUrl: 'https://...'
Until then that sign is skipped (it says so below).

Needs:  pip install segno        (and for --check:  pip install zxing-cpp pillow)
"""
import html, io, json, os, re, sys
from urllib.parse import urlencode

try:
    import segno
except ImportError:
    sys.exit('This needs the segno package:  pip install segno')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_QR = os.path.join(ROOT, 'assets', 'qr')
OUT_PRINT = os.path.join(ROOT, 'print')


def review_url():
    src = open(os.path.join(ROOT, 'js', 'content.js'), encoding='utf-8').read()
    src = re.sub(r'/\*.*?\*/', '', src, flags=re.S)
    m = re.search(r"reviewUrl:\s*'([^']*)'", src)
    return m.group(1).strip() if m else ''


def resolve(sign, site, review):
    url = sign['url'].replace('{site}', site).replace('{reviewUrl}', review)
    if not url or not re.match(r'^https://', url):
        return None
    if sign.get('utm'):
        base, _, frag = url.partition('#')
        base += ('&' if '?' in base else '?') + urlencode({'utm_source': 'qr', 'utm_medium': 'sign', 'utm_campaign': sign['id']})
        url = base + ('#' + frag if frag else '')
    return url


def short(url):
    u = re.sub(r'^https://(www\.)?', '', url)
    u = re.sub(r'[?&]utm_[^&#]*', '', u)
    return u.rstrip('?&')


CSS = """
@font-face{font-family:"Fredoka";src:url("../assets/fonts/fredoka-latin-wght-normal.woff2") format("woff2");font-weight:300 700}
@font-face{font-family:"Nunito";src:url("../assets/fonts/nunito-latin-wght-normal.woff2") format("woff2");font-weight:200 1000}
@page{size:letter;margin:.4in}
*{box-sizing:border-box}
body{margin:0;background:#f4efe3;color:#3a2416;font:600 1.05rem/1.4 "Nunito",system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:12px 16px;background:#3a2416;color:#fff}
.bar button{font:700 1rem "Fredoka",system-ui,sans-serif;padding:.5em 1.2em;border:0;border-radius:999px;background:#ffc928;color:#3a2416;cursor:pointer}
.sign{width:7.7in;max-width:calc(100% - 24px);min-height:10.1in;margin:18px auto;padding:.45in .5in;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff;border:8px solid #3a2416;border-radius:36px;box-shadow:0 10px 0 rgba(58,36,22,.25);page-break-after:always;break-after:page}
.sign:last-child{page-break-after:auto;break-after:auto}
.farm{margin:0;font:700 1.2rem "Fredoka",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d72a43}
h1{margin:.25em 0 0;font:700 3.2rem/1.05 "Fredoka",system-ui,sans-serif;text-wrap:balance}
h1 span{display:block;margin-top:.15em;font-size:2rem;color:#6a5140;font-weight:600}
.qr{margin:.3in 0 .2in;padding:.18in;background:#fff;border:6px solid #3a2416;border-radius:24px;line-height:0}
.qr svg{width:4.3in;height:4.3in}
.how{margin:0 0 .15in;font:700 1.25rem "Fredoka",system-ui,sans-serif}
.how span,.text span{display:block;color:#6a5140;font-weight:600}
.text{margin:0;font-size:1.3rem}
.url{margin:auto 0 0;padding-top:.2in;font:700 .95rem "Nunito",system-ui,sans-serif;color:#6a5140;overflow-wrap:anywhere}
@media print{body{background:#fff}.bar{display:none}.sign{width:auto;max-width:none;min-height:10in;margin:0;border-radius:28px;box-shadow:none}}
"""


def main():
    check = '--check' in sys.argv
    cfg = json.load(open(os.path.join(ROOT, 'tools', 'qr_links.json'), encoding='utf-8'))
    site, review = cfg['site'], review_url()
    os.makedirs(OUT_QR, exist_ok=True)
    os.makedirs(OUT_PRINT, exist_ok=True)
    pages, made, bad = [], 0, 0
    for sign in cfg['signs']:
        url = resolve(sign, site, review)
        if not url:
            print(f"skipped  {sign['id']}: no address yet" + (' (set reviewUrl in js/content.js)' if sign['id'] == 'review' else ''))
            continue
        qr = segno.make(url, error='m')
        qr.save(os.path.join(OUT_QR, sign['id'] + '.svg'), scale=10, border=4, dark='#000000', light='#ffffff', xmldecl=False, svgns=True)
        inline = qr.svg_inline(scale=10, border=4, dark='#000000', light='#ffffff', svgclass=None, lineclass=None, omitsize=True)
        inline = inline.replace('<svg ', '<svg role="img" aria-label="QR code: ' + html.escape(sign['title_en'], quote=True) + '" ', 1)
        pages.append(f'''  <section class="sign" id="{sign['id']}">
    <p class="farm">Wise Acres Organic Farm</p>
    <h1>{html.escape(sign['title_en'])}<span lang="es">{html.escape(sign['title_es'])}</span></h1>
    <div class="qr">{inline}</div>
    <p class="how">Point your phone camera at the square.<span lang="es">Apunta la cámara de tu teléfono al cuadrado.</span></p>
    <p class="text">{html.escape(sign['text_en'])}<span lang="es">{html.escape(sign['text_es'])}</span></p>
    <p class="url">{html.escape(short(url))}</p>
  </section>''')
        made += 1
        line = f"made     {sign['id']:<11} {url}"
        if check:
            try:
                import zxingcpp
                from PIL import Image
            except ImportError:
                sys.exit('--check needs:  pip install zxing-cpp pillow')
            buf = io.BytesIO()
            qr.save(buf, kind='png', scale=8, border=4)
            buf.seek(0)
            got = [r.text for r in zxingcpp.read_barcodes(Image.open(buf))]
            if got != [url]:
                bad += 1
                line += f'   CHECK FAILED, scanned: {got}'
            else:
                line += '   scans OK'
        print(line)
    doc = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Wise Acres QR signs (print)</title>
  <style>{CSS}</style>
</head>
<body>
  <div class="bar"><span>One sign per page. Print on letter paper, or choose Save as PDF.</span><button type="button" onclick="window.print()">Print all signs</button></div>
{chr(10).join(pages)}
</body>
</html>
'''
    open(os.path.join(OUT_PRINT, 'qr-signs.html'), 'w', encoding='utf-8').write(doc)
    print(f'\n{made} signs -> print/qr-signs.html, codes in assets/qr/')
    if bad:
        sys.exit(f'{bad} code(s) did not scan back correctly')


if __name__ == '__main__':
    main()
