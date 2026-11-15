/*
 * Charity marks: the picture that stands for a charity.
 *   GS.emblemSVG(ch)  an illustrated emblem as an SVG string, made from the charity's own data (causes, who it serves, words in its
 *                     name and blurb, accent colour). Same charity, same emblem, every time. No files, no network.
 *   GS.emblemInfo(ch) which badge shape, glyph and colours that emblem uses (for tests and for the profile dialog)
 *   GS.markImage(ch)  for canvas games: a loaded image to draw (the real logo, or the emblem) or null while it is still loading;
 *                     draw the monogram until it is not null.
 * See also GS.logoFor (js/data.js) and ui.mono (js/ui/common.js) for the DOM side. An emblem is NOT a logo: it is a generic
 * picture (a drop for water, a paw for animals, a book for books ...) and never copies any organisation's own mark.
 * Every badge shape fits inside the circle that touches the edge of its 64 x 64 box, so a canvas can clip it to a circle safely.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var INK = '#0b1620';
  var made = {};     // id -> { s: svg text with "@" where the gradient id goes, info }
  var cache = {};    // id -> { img, ready, src } for GS.markImage

  /* ------------------------------------------------------------------ small helpers */

  /** 32-bit FNV-1a (no Math.imul, so it works the same everywhere), then a final mix so that the low bits are good too. */
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    h ^= h >>> 15; h = (h + (h << 7) + (h << 17)) >>> 0; h ^= h >>> 13;
    return h >>> 0;
  }

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }
  function r1(x) { return String(Math.round(x * 10) / 10); }

  function toRgb(hex) {
    var m = /^#([0-9a-f]{6})$/i.exec(hex || '');
    var n = parseInt(m ? m[1] : '6ab0f0', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) {
    var out = '#';
    for (var i = 0; i < 3; i++) { var v = Math.round(clamp(c[i], 0, 255)); out += (v < 16 ? '0' : '') + v.toString(16); }
    return out;
  }
  function rgbToHsl(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0, d = mx - mn;
    if (d > 0) {
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) { h = (g - b) / d + (g < b ? 6 : 0); } else if (mx === g) { h = (b - r) / d + 2; } else { h = (r - g) / d + 4; }
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 1); l = clamp(l, 0, 1);
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return toHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
  }
  function luminance(hex) {
    var c = toRgb(hex).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }

  /** A polygon with rounded corners as path data (each corner is a small curve of size r). */
  function roundPoly(pts, r) {
    var n = pts.length, d = '';
    for (var i = 0; i < n; i++) {
      var p = pts[(i + n - 1) % n], c = pts[i], q = pts[(i + 1) % n];
      var l1 = Math.sqrt((c[0] - p[0]) * (c[0] - p[0]) + (c[1] - p[1]) * (c[1] - p[1]));
      var l2 = Math.sqrt((q[0] - c[0]) * (q[0] - c[0]) + (q[1] - c[1]) * (q[1] - c[1]));
      var a = [c[0] + (p[0] - c[0]) * Math.min(r, l1 / 2) / l1, c[1] + (p[1] - c[1]) * Math.min(r, l1 / 2) / l1];
      var b = [c[0] + (q[0] - c[0]) * Math.min(r, l2 / 2) / l2, c[1] + (q[1] - c[1]) * Math.min(r, l2 / 2) / l2];
      d += (i ? 'L' : 'M') + r1(a[0]) + ' ' + r1(a[1]) + 'Q' + r1(c[0]) + ' ' + r1(c[1]) + ' ' + r1(b[0]) + ' ' + r1(b[1]);
    }
    return d + 'Z';
  }
  function polar(n, rOut, rIn, start) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (start + i * 360 / n) * Math.PI / 180, r = rIn && i % 2 ? rIn : rOut;
      pts.push([32 + r * Math.cos(a), 32 + r * Math.sin(a)]);
    }
    return pts;
  }

  /* ------------------------------------------------------------------ badge shapes (all inside the circle of radius 32)
   * d: path data; c: the centre the inner plate shrinks towards; g: where the glyph sits [x, y, size]. */
  var SHAPES = [
    { n: 'circle', d: 'M3 32a29 29 0 1 0 58 0a29 29 0 1 0-58 0Z', c: [32, 32], g: [32, 32, 37] },
    { n: 'squircle', d: roundPoly([[6, 6], [58, 6], [58, 58], [6, 58]], 15), c: [32, 32], g: [32, 32, 37] },
    { n: 'shield', d: 'M32 4.5C39 8.5 46 10 52 10.5V32C52 45.5 43.5 54 32 59.5C20.5 54 12 45.5 12 32V10.5C18 10 25 8.5 32 4.5Z', c: [32, 32], g: [32, 30.5, 33] },
    { n: 'hexagon', d: roundPoly(polar(6, 31.5, 0, -90), 6), c: [32, 32], g: [32, 32, 34] },
    { n: 'leaf', d: 'M34 8H44Q56 8 56 20V30A26 26 0 0 1 30 56H20Q8 56 8 44V34A26 26 0 0 1 34 8Z', c: [32, 32], g: [32, 32, 35] },
    { n: 'drop', d: 'M32 3C40 14 54 26 54 39A22 22 0 0 1 10 39C10 26 24 14 32 3Z', c: [32, 38], g: [32, 41, 31] },
    { n: 'ticket', d: 'M14 9H50Q56 9 56 15V27A5 5 0 0 0 56 37V49Q56 55 50 55H14Q8 55 8 49V37A5 5 0 0 0 8 27V15Q8 9 14 9Z', c: [32, 32], g: [32, 32, 33] },
    { n: 'seal', d: roundPoly(polar(12, 31, 26, -90), 4.5), c: [32, 32], g: [32, 32, 34] },
    { n: 'arch', d: 'M10 50V32A22 22 0 0 1 54 32V50Q54 56 48 56H16Q10 56 10 50Z', c: [32, 34], g: [32, 35, 33] }
  ];

  /* ------------------------------------------------------------------ glyphs
   * Names that exist in js/icons.js (Lucide, ISC licence) are taken from there; the ones below are drawn in the same style on the same
   * 24 x 24 grid for the causes that set lacks (a child, a bowl of food, a tree, a fish, an antler, a medical cross, a ball, rank
   * stripes, a speech bubble). Strokes are round, 2 units wide before scaling. */
  var OWN = {
    child: '<circle cx="12" cy="5" r="2.6"/><path d="M4.5 10 12 12l7.5-2"/><path d="M12 12v4.5"/><path d="m8.5 22 3.5-5.5 3.5 5.5"/>',
    bowl: '<path d="M3 12h18a9 9 0 0 1-18 0Z"/><path d="M8 3.5c-1 1.3 1 2.3 0 3.7"/><path d="M12 3c-1 1.3 1 2.3 0 3.7"/><path d="M16 3.5c-1 1.3 1 2.3 0 3.7"/>',
    tree: '<path d="M12 2.5 6 10.5h3L4.5 16.5h15L15 10.5h3Z"/><path d="M12 16.5v5"/>',
    fish: '<path d="M2.5 12c3-5 9-6.5 13-3.5L21.5 5v14l-6-3.5c-4 3.5-10 2-13-3.5Z"/><path d="M7 11h.01"/>',
    antler: '<path d="M9 14.5c0 4 1.4 6.5 3 6.5s3-2.5 3-6.5"/><path d="M9.5 14.5 6.5 10.5v-7"/><path d="M14.5 14.5l3-4v-7"/><path d="M6.5 8 3.5 6"/><path d="m17.5 8 3-2"/><path d="M6.5 5.5 9 4"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z"/>',
    ball: '<circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M2 12h20"/><path d="M5.2 5.2a10 10 0 0 1 0 13.6"/><path d="M18.8 5.2a10 10 0 0 0 0 13.6"/>',
    rank: '<path d="m5 9 7-5 7 5"/><path d="m5 15 7-5 7 5"/><path d="m5 21 7-5 7 5"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/>'
  };
  /** Glyphs that look good with a light fill inside their outline (closed shapes). */
  var FILLABLE = {
    'heart': 1, 'droplet': 1, 'leaf': 1, 'house': 1, 'star': 1, 'cross': 1, 'child': 0, 'bowl': 1, 'tree': 1, 'fish': 1, 'baby': 1, 'shield-half': 0,
    'shield': 1, 'ribbon': 0, 'medal': 1, 'bird': 1, 'brain': 0, 'chat': 1, 'ball': 1, 'sun': 1, 'cloud': 1, 'book-open': 1, 'ticket': 1, 'smile': 1,
    'trophy': 1, 'palette': 1, 'globe': 1, 'sailboat': 1, 'flame': 1, 'gift': 1, 'rocket': 1, 'landmark': 0, 'tent': 1, 'armchair': 1
  };

  function glyphMarkup(name) {
    var raw = OWN[name] || (GS.iconPaths && GS.iconPaths[name]);
    if (!raw) { raw = GS.iconPaths && GS.iconPaths.heart; name = 'heart'; }
    return { name: name, svg: String(raw || '').replace(/>\s+</g, '><') };
  }

  /** What each cause draws by default. A charity takes one of its cause's pictures (chosen from its id), so a cause with
   *  many charities does not look like one repeated stamp. */
  var CAUSE_GLYPHS = {
    kids: ['child', 'star', 'smile'], education: ['graduation-cap', 'book-open', 'pen-line'], women: ['venus', 'hand-heart'],
    seniors: ['armchair', 'hand-heart'], disability: ['accessibility', 'hand-helping'], veterans: ['rank', 'star', 'medal'],
    refugees: ['tent', 'hand-helping'], hunger: ['wheat', 'bowl'], housing: ['house', 'house', 'hammer'],
    poverty: ['hand-coins', 'piggy-bank', 'coins'], water: ['droplet'], community: ['handshake', 'users', 'hand-heart'],
    health: ['stethoscope', 'cross', 'heart-pulse'], cancer: ['ribbon'], neuro: ['brain'],
    chronic: ['activity', 'heart-pulse', 'pill'], 'global-health': ['syringe', 'cross', 'globe'], mental: ['brain', 'chat', 'hand-heart'],
    recovery: ['sprout', 'sun', 'hand-helping'], disaster: ['life-buoy', 'siren', 'hand-helping'], safety: ['shield-half', 'shield', 'hand-helping'],
    justice: ['scale', 'scale', 'megaphone'], animals: ['paw-print'], wildlife: ['bird', 'antler', 'tree', 'leaf'],
    planet: ['leaf', 'leaf', 'tree', 'sun', 'wind'], oceans: ['waves', 'waves', 'fish', 'sailboat'], arts: ['palette', 'music', 'ticket', 'landmark'],
    knowledge: ['book-open', 'newspaper', 'library', 'globe'], stem: ['atom', 'flask-conical', 'rocket', 'bot'], sports: ['trophy', 'ball', 'dumbbell']
  };
  /** Who a charity serves can decide the picture too (only a hint). */
  var SERVES_GLYPH = {
    homeless: 'house', veterans: 'rank', refugees: 'tent', disability: 'accessibility', women: 'venus', seniors: 'armchair',
    students: 'graduation-cap', children: 'child', patients: 'stethoscope', teens: 'star', families: 'users'
  };

  /* Words that point at a picture: [words, glyph or list of glyphs, weight when in the name, weight when in the blurb].
   * The main cause counts 2.5, so a word in the NAME (3 to 4) wins over it, and the blurb only wins when
   * several of its words agree (a second hit counts half again, a third double). A glyph is never chosen from words that name a religion or a faith. */
  var RULES = [
    ['cancer|leukemia|lymphoma|melanoma|tumou?r|oncolog|hiv\\b|aids\\b|breast', 'ribbon', 4, 1.6],
    ['suicide|lifeline|helpline|hotline|crisis (?:text|line)|samaritans|text line|listening', 'chat', 4, 1.4],
    ['alzheimer|dementia|brain|neuro|autism|epilepsy|parkinson|mental|depress|anxiety|psych|minds?\\b', 'brain', 4, 1.2],
    ['blind|sight|eyes?\\b|ophthal|glaucoma|retina', 'eye', 4, 1.6],
    ['disab|wheelchair|paralym|cerebral palsy|muscular dystrophy|spina bifida|special olympics|handicap|inclusi|accessib', 'accessibility', 4, 1.2],
    ['veteran|military|armed forces|troops?\\b|navy|army\\b|marines?\\b|wounded|warrior|soldier|service members?|air force|coast guard|uso\\b', ['rank', 'star', 'medal'], 4, 1.5],
    ['refugee|migrant|immigra|asylum|displaced|resettle|unhcr|stateless|camps?\\b', 'tent', 4, 1.5],
    ['ocean|marine\\b|seas?\\b|reef|coral|surf|whale|dolphin|shark|beach|coast|river|lake', 'waves', 4, 1.6],
    ['fish(?:es|ing|eries|ery)?\\b|salmon|trout|aquatic|angler', 'fish', 4, 1.2],
    ['sail|boat|ships?\\b|maritime|voyage', 'sailboat', 3.6, 1],
    ['water|wells?\\b|sanitation|hygiene|wash\\b|drought|drinking', 'droplet', 4, 1.8],
    ['animal|pets?\\b|dogs?\\b|cats?\\b|humane|spca|puppy|puppies|kitten|horses?\\b|equine|guide dog|rabbit|veterinar|sanctuar', 'paw-print', 4, 1.6],
    ['bird|raptor|owl|eagle|penguin|puffin|audubon|wetland|duck|crane|parrot|dove', 'bird', 4, 1.2],
    ['wildlife|species|rhino|elephant|tusk|gorilla|tiger|lion|wolf|wolves|bear\\b|bears\\b|panther|deer|elk\\b|bison|endangered|safari|african parks', 'antler', 4, 1.4],
    ['forest|trees?\\b|woods|woodland|rainforest|grove|arbor|timber|jungle|reforest', 'tree', 4, 1.4],
    ['solar|sunshine|sunrise|energy|power\\b', 'sun', 4, 1],
    ['climate|carbon|emission|atmosphere|weather|clean air', 'cloud', 4, 1.4],
    ['conservation|nature|environment|green|earth|planet|sustainab|ecolog|parks?\\b|garden|land trust|landscape|biodivers|organic', 'leaf', 3.2, 0.9],
    ['hunger|food|harvest|bread|farm|crop|grain|agricultur|gleaners|nutrition|malnutrition|meals?\\b|pantry|pantries|feeding|kitchen|soup|hungry|breakfast|lunch|nourish', ['wheat', 'bowl'], 4, 1.5],
    ['housing|homeless|shelter|habitat for humanity|homes?\\b|rebuilding|tenant|eviction|rent\\b|roof|mortgage', 'house', 4, 1.6],
    ['build|builders|construction|repair|carpent', 'hammer', 3, 0.5],
    ['book|reading|read\\b|literacy|library|libraries|story|poetry|writers?\\b|author|storytime', 'book-open', 4, 1.5],
    ['news|journalis|press\\b|media|radio|broadcast|wiki|archive|reporters|investigative', 'newspaper', 4, 0.8],
    ['music|orchestra|symphon|opera\\b|philharmonic|choir|chorus|concert|jazz|bands?\\b|sing(?:s|ing|er|ers)?\\b|songs?\\b|guitar|instrument|piano', 'music', 4, 1.4],
    ['theatre|theater|drama|film|cinema|festival|stage|circus|puppet|comedy|performing', 'ticket', 4, 1.2],
    ['museum|heritage|historic|monument|memorial|history', 'landmark', 3.2, 0.8],
    ['arts?\\b|artists?\\b|gallery|paint|design|craft|photograph|creative|cultur|dance|ballet|sculpt', 'palette', 3.5, 1],
    ['school|college|universit|scholar|student|teach|learning|academy|educat|tutor|classroom', 'graduation-cap', 3.8, 1.3],
    ['science|stem\\b|physics|chemistry|engineer|math|maker|scientific|laborator', 'atom', 3.8, 1.2],
    ['research|institute|lab\\b|discover', 'flask-conical', 3, 0.6],
    ['robot|coding|code\\b|computer|digital|cyber|software|tech\\b|technology|internet|programm', 'bot', 4, 1.2],
    ['space|astronom|planetary|rocket|mars\\b|moon|telescope|cosmos', 'rocket', 4, 1.2],
    ['justice|legal|law\\b|lawyer|rights|equality|liberty|innocen|civil|freedom|court|democracy', 'scale', 3.6, 1.2],
    ['responder|firefight|ambulance|paramedic|first aid', 'siren', 4, 1.5],
    ['disaster|emergency|rescue|lifeboat|flood|earthquake|hurricane', 'life-buoy', 3.4, 1.2],
    ['relief|crisis|aid\\b|humanitarian', 'life-buoy', 1.6, 0.7],
    ['police|safety|safe\\b|abuse|violence|domestic|trafficking|protect|survivor|victim|assault|bullying|crime|security|defen[cs]e', 'shield-half', 3.2, 0.9],
    ['women|woman|girls?\\b|female|maternal|mothers?\\b|midwi|feminis', 'venus', 3.6, 1.2],
    ['baby|babies|infant|newborn|neonat|maternity|birth|prenatal|toddler', 'baby', 4, 1.4],
    ['child|kids?\\b|youth|young|teens?\\b|teenagers?|boys|orphan|pediatric|paediatric|childhood|playground|scouts?\\b|junior|big brothers', ['child', 'star'], 3.8, 0.8],
    ['senior|elder|aged\\b|older|ageing|aging|retire|pension|age uk|grandparent', 'armchair', 3.8, 1.2],
    ['heart|cardiac|cardio|stroke|diabetes|kidney|lung|asthma|arthritis|cystic|sickle|chronic', 'heart-pulse', 3.6, 1],
    ['health|medical|medicine|hospital|clinic|doctor|nurse|surg|dental|physician|healthcare|patient', ['stethoscope', 'cross'], 3.4, 0.7],
    ['malaria|vaccin|immuniz|polio|tropical|neglected|infectious|tuberculosis|ebola|measles', 'syringe', 4, 1.6],
    ['recovery|addiction|drug|alcohol|sober|substance|rehab|seed|sprout|regenerat', 'sprout', 3.6, 1.2],
    ['olympic|champion|cup\\b|trophy|winner|games\\b', 'trophy', 3.5, 0.8],
    ['sports?\\b|athlet|football|soccer|basketball|baseball|cricket|rugby|tennis|swim|league|netball|hockey|golf|skate|cycling', 'ball', 4, 1.2],
    ['fitness|gym|strength|exercise|workout', 'dumbbell', 4, 1.2],
    ['microfinance|microloan|loan|savings|financial|income|jobs|employment|workforce|entrepreneur|livelihood|wage|poverty|economic', ['hand-coins', 'piggy-bank'], 3.4, 0.8],
    ['community|communities|neighbo|together|volunteer|partnership|network|collective|alliance|united|unite\\b', 'handshake', 0.9, 0.3],
    ['giving|gift|donat|philanthrop', 'gift', 0.9, 0.2],
    ['famil', 'users', 0.9, 0.2],
    ['world|global|international|worldwide|humanity', 'globe', 0.9, 0.2]
  ];
  var compiled = null;
  function compile() {
    compiled = RULES.map(function (r) {
      var src = '\\b(?:' + r[0] + ')';
      return { re: new RegExp(src, 'i'), reAll: new RegExp(src, 'ig'), g: r[1], wn: r[2], wb: r[3] };
    });
  }

  function pickOne(g, h) { return typeof g === 'string' ? g : g[h % g.length]; }

  /** A few names that mislead the word rules ("Black Dog" is a mood disorder, "farming" is about animals here): picked by hand. */
  var FIXES = {
    'black-dog-institute': 'brain', 'compassion-in-world-farming': 'paw-print', 'guide-dogs-nsw-act': 'paw-print',
    'mothers-day-classic-foundation': 'ribbon', 'fred-hollows-foundation': 'eye'
  };

  /** The picture for a charity: the glyph with the most points from its causes, its name, its blurb and who it serves. */
  function chooseGlyph(ch) {
    if (FIXES[ch.id]) { return FIXES[ch.id]; }
    if (!compiled) { compile(); }
    var h = hash(ch.id + '|glyph');
    var score = {}, order = [];
    function add(name, w) { if (!(name in score)) { score[name] = 0; order.push(name); } score[name] += w; }
    var causes = ch.causes || [];
    var weights = [2.5, 1.2, 0.8];
    for (var i = 0; i < causes.length && i < 3; i++) {
      var list = CAUSE_GLYPHS[causes[i]];
      if (list) { add(pickOne(list, h), weights[i]); }
    }
    var serves = ch.serves || [];
    for (var k = 0; k < serves.length; k++) { if (SERVES_GLYPH[serves[k]]) { add(SERVES_GLYPH[serves[k]], 0.9); } }
    var name = (ch.name || '') + ' ' + (ch.short || ''), blurb = ch.blurb || '';
    for (var j = 0; j < compiled.length; j++) {
      var r = compiled[j], hn = r.re.test(name), found = blurb.match(r.reAll);
      if (hn || found) { add(pickOne(r.g, h >>> 3), (hn ? r.wn : 0) + (found ? r.wb * (found.length > 2 ? 2 : (found.length > 1 ? 1.5 : 1)) : 0)); }
    }
    var best = null, bestScore = -1;
    for (var m = 0; m < order.length; m++) { if (score[order[m]] > bestScore + 1e-9) { best = order[m]; bestScore = score[order[m]]; } }
    return best || 'heart-handshake';
  }

  /* ------------------------------------------------------------------ colours */

  var GRADIENTS = [[0, 0, 1, 1], [0, 1, 1, 0], [0, 0, 0, 1], [1, 0, 0, 1], [0.15, 0, 0.85, 1], [1, 0.1, 0, 0.9]];
  var HUE_STEPS = [-24, -12, 0, 12, 24];

  /** Two tones from the charity's accent, and the colour of the glyph on top. The glyph keeps at least 4.5:1 against both tones
   *  (WCAG asks 3:1 for graphics), because the lighter or darker tone is moved until it does. */
  function colours(accent, mode, dh) {
    var hsl = rgbToHsl(toRgb(accent));
    var hue = hsl[0], sat = clamp(hsl[1], 0.5, 0.95), light = hsl[2];
    var a, b, glyph, rim, tries = 0;
    if (mode === 'night') {
      glyph = hslToHex(hue, clamp(sat, 0.55, 0.95), clamp(light + 0.1, 0.62, 0.82));
      var la = 0.27, lb = 0.14;
      a = hslToHex(hue + dh / 2, sat * 0.55, la);
      b = hslToHex(hue - dh / 2, sat * 0.6, lb);
      while ((contrast(glyph, a) < 4.5 || contrast(glyph, b) < 4.5) && tries++ < 14) {
        la -= 0.02; lb = Math.max(0.05, lb - 0.01);
        a = hslToHex(hue + dh / 2, sat * 0.55, Math.max(0.06, la)); b = hslToHex(hue - dh / 2, sat * 0.6, lb);
      }
      rim = hslToHex(hue, sat, clamp(light - 0.02, 0.5, 0.75));
    } else {
      glyph = INK;
      var lA = Math.min(0.9, light + 0.13), lB = clamp(light - 0.05, 0.4, 0.8);
      a = hslToHex(hue + dh / 2, sat, lA);
      b = hslToHex(hue - dh / 2, Math.min(0.95, sat + 0.05), lB);
      while ((contrast(glyph, a) < 4.5 || contrast(glyph, b) < 4.5) && tries++ < 14) {
        lB += 0.02; lA += 0.01;
        a = hslToHex(hue + dh / 2, sat, Math.min(0.95, lA)); b = hslToHex(hue - dh / 2, Math.min(0.95, sat + 0.05), Math.min(0.95, lB));
      }
      rim = hslToHex(hue - dh / 2, Math.min(0.9, sat + 0.1), Math.max(0.2, lB - 0.2));
    }
    return { a: a, b: b, glyph: glyph, rim: rim };
  }

  /* ------------------------------------------------------------------ the emblem */

  function make(ch) {
    var e = made[ch.id];
    if (e) { return e; }
    var id = String(ch.id);
    var pick = function (k, n) { return hash(id + '|' + k) % n; };
    var shape = SHAPES[pick('shape', SHAPES.length)];
    var mode = pick('mode', 10) < 3 ? 'night' : 'day';
    var deco = pick('deco', 4);
    var grad = GRADIENTS[pick('angle', GRADIENTS.length)];
    var dh = HUE_STEPS[pick('hue', HUE_STEPS.length)];
    var glyphName = chooseGlyph(ch);
    var gm = glyphMarkup(glyphName);
    var fill = FILLABLE[gm.name] && pick('fill', 3) > 0;
    var col = colours(ch.accent, mode, dh);
    var night = mode === 'night';

    var k = shape.g[2] / 24;
    var gx = r1(shape.g[0] - 12 * k), gy = r1(shape.g[1] - 12 * k);
    var plate = 'transform="matrix(.84 0 0 .84 ' + r1(shape.c[0] * 0.16) + ' ' + r1(shape.c[1] * 0.16) + ')"';
    var ring = 'transform="matrix(.88 0 0 .88 ' + r1(shape.c[0] * 0.12) + ' ' + r1(shape.c[1] * 0.12) + ')"';
    var soft = night ? col.rim : '#fff';
    var decoSvg = '';
    if (deco === 0 || deco === 2) { decoSvg += '<path d="' + shape.d + '" ' + plate + ' fill="' + soft + '" fill-opacity="' + (night ? '.12' : '.2') + '"/>'; }
    if (deco === 1 || deco === 2) { decoSvg += '<path d="' + shape.d + '" ' + (deco === 2 ? 'transform="matrix(.92 0 0 .92 ' + r1(shape.c[0] * 0.08) + ' ' + r1(shape.c[1] * 0.08) + ')"' : ring) + ' fill="none" stroke="' + soft + '" stroke-opacity="' + (night ? '.5' : '.55') + '" stroke-width="1.1"/>'; }

    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" class="emblem" aria-hidden="true" focusable="false">' +
      '<linearGradient id="@" x1="' + grad[0] + '" y1="' + grad[1] + '" x2="' + grad[2] + '" y2="' + grad[3] + '"><stop stop-color="' + col.a + '"/><stop offset="1" stop-color="' + col.b + '"/></linearGradient>' +
      '<path d="' + shape.d + '" fill="url(#@)" stroke="' + col.rim + '" stroke-width="' + (night ? '2' : '1.6') + '" stroke-linejoin="round"/>' + decoSvg +
      '<g transform="translate(' + gx + ' ' + gy + ') scale(' + Math.round(k * 1000) / 1000 + ')" fill="' + (fill ? (night ? col.glyph : '#fff') : 'none') + '"' + (fill ? ' fill-opacity="' + (night ? '.28' : '.55') + '"' : '') +
      ' stroke="' + col.glyph + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' + gm.svg.split('currentColor').join(col.glyph) + '</g></svg>';

    e = made[ch.id] = {
      s: s,
      uid: 'e' + hash(id + '|id').toString(36),
      info: { id: id, shape: shape.n, glyph: gm.name, mode: mode, deco: deco, fill: !!fill, from: col.a, to: col.b, ink: col.glyph, rim: col.rim }
    };
    return e;
  }

  /** The emblem as an SVG string. `uid` is the id used inside the SVG for its gradient: it must be different for every copy that is on
   *  the same page (ui.mono passes a fresh one), and may be left out where the SVG stands alone (an image file, a test). */
  GS.emblemSVG = function (ch, uid) {
    if (!ch || !ch.id) { return ''; }
    var e = make(ch);
    return e.s.split('@').join(uid || e.uid);
  };

  /** Which shape, glyph and colours the emblem for this charity uses. */
  GS.emblemInfo = function (ch) {
    if (!ch || !ch.id) { return null; }
    var i = make(ch).info, out = {};
    for (var k in i) { if (Object.prototype.hasOwnProperty.call(i, k)) { out[k] = i[k]; } }
    return out;
  };

  /* ------------------------------------------------------------------ canvas image */

  function emblemSource(ch) {
    var svg = GS.emblemSVG(ch);
    return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : '';
  }

  function load(e, src, fallback) {
    var img = new Image();
    e.img = img; e.ready = false;
    img.onload = function () { if (e.img === img) { e.ready = true; } };
    img.onerror = function () {
      if (e.img !== img) { return; }
      e.ready = false;
      if (fallback) { load(e, fallback, ''); }   // a logo file that will not load: show the emblem instead
    };
    img.decoding = 'async';
    img.src = src;
  }

  /** A loaded image for this charity's mark (its real logo, or its illustrated emblem), or null (not ready yet, or nothing to show).
   *  Call it every frame you draw. The picture is square and every emblem shape fits the circle that touches its edge. */
  GS.markImage = function (ch) {
    if (!ch) { return null; }
    var e = cache[ch.id];
    if (e) { return e.ready ? e.img : null; }
    e = cache[ch.id] = { img: null, ready: false };
    var logo = GS.logoFor ? GS.logoFor(ch) : '';
    var emblem = emblemSource(ch);
    if (logo) { load(e, logo, emblem); } else if (emblem) { load(e, emblem, ''); }
    return null;
  };
})();
