// Run with:  node --test givespin/tests/readme.test.js
// Keeps the README honest about the facts that can be computed from the code and the data: the roster size and its layers,
// the logos, the games, their biggest boards, the live tables, the unit-test count, the file list and the names it points at.
// Each test finds a sentence in the README with a plain regex; when the sentence is wrong the message names it and gives the
// true value. When a sentence has been reworded so that the regex no longer finds it, the message says so (change the README
// back to a sentence the regex can read, or update the regex here).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const README = read('README.md');
const FLAT = README.replace(/\s+/g, ' ');   // sentences wrap over lines in the README

const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const num = (s) => (/^\d/.test(s) ? Number(String(s).replace(/,/g, '')) : WORDS[String(s).toLowerCase()]);
const fmt = (n) => n.toLocaleString('en-US');
const snip = (m) => '"' + m[0].trim() + '"';

/** The first match of `re` in the README (whitespace flattened), or a failure that says which sentence went missing. */
function find(re, what) {
  const m = FLAT.match(re);
  assert.ok(m, 'The README no longer has the sentence about ' + what + ' in a form this test can read (' + re + '). Change it back, or update tests/readme.test.js.');
  return m;
}
function findAll(re, what, atLeast) {
  const all = Array.from(FLAT.matchAll(re));
  assert.ok(all.length >= (atLeast || 1), 'The README has ' + all.length + ' sentence(s) about ' + what + ' that this test can read (' + re + '), expected at least ' + (atLeast || 1) + '. Change the README back, or update tests/readme.test.js.');
  return all;
}

/* ------------------------------------------------------------------ what the code and the data say */

function loadGS(files) {
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  files.forEach((f) => vm.runInContext(read(f), sandbox, { filename: f }));
  return sandbox.GS;
}
const GS = loadGS(['js/data.js', 'js/logos.js']);
const roster = GS.charities;
const sources = JSON.parse(read('docs/roster-sources.json'));
const byId = {};
roster.forEach((c) => { byId[c.id] = c; });

/** Every game, read from its source file: id, name, biggest and smallest board, whether it has live tables, and whether it has a "Back a charity" board. */
function readGames() {
  const games = [];
  fs.readdirSync(path.join(ROOT, 'js/games')).filter((f) => f.endsWith('.js') && f !== 'crowd.js' && f !== 'slots.js').forEach((f) => {
    const src = read('js/games/' + f);
    const crowd = /GS\.crowdGame\(/.test(src);   // js/games/crowd.js is the engine behind Duck Derby, Marble Run and Balloon Race: it gives them live tables and a board
    const hits = Array.from(src.matchAll(/\bid: '([a-z]+)',\s*\n\s*name: '([^']+)'/g));
    hits.forEach((h, i) => {
      const body = src.slice(h.index, i + 1 < hits.length ? hits[i + 1].index : src.length);
      const max = body.match(/\bmaxSize:\s*(\d+)/);
      const min = body.match(/\bminSize:\s*(\d+)/);
      games.push({
        id: h[1], name: h[2], file: f, maxSize: max ? Number(max[1]) : null, minSize: min ? Number(min[1]) : 2,
        live: crowd || /\blive: true\b/.test(body), hasBoard: crowd || /\bsetBoard:/.test(body)
      });
    });
  });
  const slots = read('js/games/slots.js');
  const std = slots.match(/var STD = \[([^\]]*)\]/)[1].split(',').map((x) => Number(x.trim()));
  Array.from(slots.matchAll(/id: '([a-z]+)', cls: '[a-z]+', name: '([^']+)'[^\n]*?defaultReels: (\d+)/g)).forEach((m) => {
    games.push({ id: m[1], name: m[2], file: 'slots.js', maxSize: null, minSize: 2, reels: [Math.min.apply(null, std), Math.max.apply(null, std)], defaultReels: Number(m[3]), live: false, hasBoard: false, slot: true });
  });
  return games;
}
const GAMES = readGames();

/** The live-table constants at the top of js/live.js. */
function readLive() {
  const src = read('js/live.js');
  const sizes = Array.from(src.matchAll(/\{ size: (\d+),\s+name: '(\w+)'/g)).map((m) => ({ size: Number(m[1]), name: m[2] }));
  const units = Array.from(src.match(/var UNITS = \{([\s\S]*?)\};/)[1].matchAll(/(\w+): \['/g)).map((m) => m[1]);
  const playMs = {};
  Array.from(src.match(/var PLAY_MS = \{([^}]*)\}/)[1].matchAll(/(\w+): (\d+)/g)).forEach((m) => { playMs[m[1]] = Number(m[2]); });
  const sizeRows = Array.from(src.match(/var SIZES = \[([\s\S]*?)\];/)[1].matchAll(/size: (\d+),[^}]*play: (\d+)/g)).map((m) => ({ size: Number(m[1]), play: Number(m[2]) }));
  const lockMs = Number(src.match(/var LOCK_MS = (\d+)/)[1]);
  return { sizes, games: units, playMs, sizeRows, lockMs };
}
const LIVE = readLive();

/* ------------------------------------------------------------------ the tests */

test('the code the README is checked against could be read (so a green run means something)', () => {
  assert.ok(roster.length > 1000, 'roster read: ' + roster.length);
  assert.equal(GAMES.length, 19, 'games read from js/games/*.js: ' + GAMES.map((g) => g.id).join(', '));
  assert.equal(LIVE.sizes.length, 7, 'live table sizes read from js/live.js: ' + JSON.stringify(LIVE.sizes));
  assert.equal(LIVE.games.length, 10, 'live games read from js/live.js: ' + LIVE.games.join(', '));
  assert.equal(GAMES.filter((g) => g.live).length, LIVE.games.length, 'js/games/*.js and js/live.js disagree about which games are live: ' + GAMES.filter((g) => g.live).map((g) => g.id).join(', '));
});

test('every place the README states the roster size, it is the real size', () => {
  // (a board of "1,000 charities" is not the roster, so only the sentences about the roster are read)
  const places = {
    'the opening paragraph': /daily wheel, (\d{1,3},\d{3}) charities/,
    'the "charities, each with a profile" paragraph': /\*\*(\d{1,3},\d{3}) charities, each with a profile\*\*/,
    'the Charity list note': /There are (\d{1,3},\d{3}) charities in/,
    'the Structure list': /vocabulary and the (\d{1,3},\d{3}) charities/
  };
  Object.keys(places).forEach((where) => {
    const m = find(places[where], 'the number of charities (' + where + ')');
    assert.equal(m[1], fmt(roster.length), 'README says "' + m[0] + '" (' + where + ') but js/data.js has ' + fmt(roster.length) + ' charities');
  });
});

test('the layers of the roster add up to the roster, and the two registers are counted right', () => {
  const first = num(find(/first (\d+) were researched/, 'the first layer of the roster')[1]);
  const next = num(find(/next (\d+) were each checked/, 'the second layer of the roster')[1]);
  const later = FLAT.match(/(?:later|further) round of (\d+)/);   // a layer added after the first two (optional)
  const rest = num(find(/remaining (\d+) come from two official government registers/, 'the register layer of the roster')[1]);
  const layers = [first, next].concat(later ? [num(later[1])] : [], [rest]);
  const total = layers.reduce((a, b) => a + b, 0);
  assert.equal(total, roster.length, 'README says the roster is ' + layers.join(' + ') + ' = ' + total + ' charities, js/data.js has ' + roster.length);
  const said = find(/There are [\d,]+ charities in (\w+) layers/, 'the number of layers')[1];
  assert.equal(num(said), layers.length, 'README says the roster has ' + said + ' layers, but it describes ' + layers.length + ' (' + layers.join(' + ') + ')');
  // register records: the entries docs/roster-sources.json marks "official register record" (a charity added later by a web check is not one, even when it is Australian or British)
  const records = sources.filter((s) => byId[s.id] && /official register record/i.test(s.note));
  const ukRegister = records.filter((s) => byId[s.id].where[0] === 'uk').length;
  const auRegister = records.filter((s) => byId[s.id].where[0] === 'australia').length;
  const uk = num(find(/(\d+) list the UK first/, 'the England and Wales register charities')[1]);
  const au = num(find(/(\d+) list Australia first/, 'the Australian register charities')[1]);
  assert.equal(uk, ukRegister, 'README says ' + uk + ' England and Wales register charities list the UK first, docs/roster-sources.json has ' + ukRegister + ' register records that do');
  assert.equal(au, auRegister, 'README says ' + au + ' Australian register charities, docs/roster-sources.json has ' + auRegister + ' register records that list Australia first');
  assert.equal(rest, records.length, 'README says the remaining ' + rest + ' come from the registers, docs/roster-sources.json has ' + records.length + ' register records');
  assert.equal(rest, ukRegister + auRegister, 'README says ' + uk + ' + ' + au + ' register charities but the remaining ' + rest + ' are said to come from them');
  assert.deepEqual(records.filter((s) => byId[s.id].where[0] === 'australia' && !/ACNC/.test(byId[s.id].about)).map((s) => s.id), [], 'these Australian register records do not say they are on the ACNC register');
  const flagged = FLAT.match(/(\w+) of them are flagged `unverified`/);
  if (flagged) { assert.equal(num(flagged[1]), roster.filter((c) => c.unverified).length, 'README says ' + flagged[1] + ' charities are flagged unverified, the data has ' + roster.filter((c) => c.unverified).length); }
});

test('the logo count is right, and every logo file exists and belongs to a charity', () => {
  const ids = Object.keys(GS.logos);
  const quoted = findAll(/\((\d+) of them so far|\((\d+) so far\)/g, 'the number of logos', 2);
  quoted.forEach((m) => assert.equal(Number(m[1] || m[2]), ids.length, 'README says ' + snip(m) + ' but js/logos.js lists ' + ids.length + ' logos'));
  const missing = ids.filter((id) => !fs.existsSync(path.join(ROOT, 'assets/logos', id + '.' + GS.logos[id])));
  assert.deepEqual(missing, [], 'js/logos.js lists logo files that are not in assets/logos/');
  const strangers = ids.filter((id) => !byId[id]);
  assert.deepEqual(strangers, [], 'js/logos.js lists logos for ids that are not charities');
  const files = fs.readdirSync(path.join(ROOT, 'assets/logos'));
  assert.equal(files.length, ids.length, 'assets/logos/ holds ' + files.length + ' files but js/logos.js lists ' + ids.length);
});

test('the number of games and of live games and tables is right', () => {
  const total = GAMES.length;
  findAll(/\b(\w+) (?:casino-style )?games\b/gi, 'the number of games', 1)
    .filter((m) => num(m[1]) !== undefined && num(m[1]) > 12)
    .forEach((m) => assert.equal(num(m[1]), total, 'README says ' + snip(m) + ' but js/games has ' + total + ' games'));
  const slotsN = GAMES.filter((g) => g.slot).length;
  const slotsSaid = num(find(/\((\w+) of them themed slot machines\)/, 'the number of slot machines')[1]);
  assert.equal(slotsSaid, slotsN, 'README says ' + slotsSaid + ' themed slot machines, js/games/slots.js has ' + slotsN);
  const liveGames = LIVE.games.length;
  const liveSaid = num(find(/(\w+) of them also have live tables/, 'the number of live games')[1]);
  assert.equal(liveSaid, liveGames, 'README says ' + liveSaid + ' games have live tables, js/live.js has ' + liveGames);
  const rows = README.split('\n').filter((l) => /^\| .*\(Live\) \|/.test(l)).length;
  assert.equal(rows, liveGames, 'the README game table marks ' + rows + ' games "(Live)", js/live.js has ' + liveGames + ' live games');
  const sizesSaid = num(find(/every live game has (\w+) table sizes/, 'the number of table sizes')[1]);
  assert.equal(sizesSaid, LIVE.sizes.length, 'README says ' + sizesSaid + ' table sizes, js/live.js has ' + LIVE.sizes.length);
  const tablesSaid = num(find(/All (\d+) tables run at once/, 'the number of live tables')[1]);
  assert.equal(tablesSaid, liveGames * LIVE.sizes.length, 'README says ' + tablesSaid + ' tables run at once, ' + liveGames + ' games x ' + LIVE.sizes.length + ' sizes = ' + liveGames * LIVE.sizes.length);
  const list = find(/a table: ((?:\d[\d,]*,? )+(?:or )?\d[\d,]*) spots \(([A-Za-z, ]+)\)/, 'the list of table sizes');
  assert.equal(list[1].replace(/,/g, '').replace(/ or /g, ' ').split(/\s+/).join(','), LIVE.sizes.map((s) => s.size).join(','), 'README lists the table sizes ' + snip(list) + ' but js/live.js has ' + LIVE.sizes.map((s) => s.size).join(', '));
  assert.equal(list[2].replace(/ and /g, ', ').split(/,\s*/).join(','), LIVE.sizes.map((s) => s.name).join(','), 'README names the table sizes ' + list[2] + ' but js/live.js has ' + LIVE.sizes.map((s) => s.name).join(', '));
});

test('the README game table gives each game its real smallest and biggest board', () => {
  const rows = README.split('\n').filter((l) => /^\| [A-Z]/.test(l) && !/^\| Game \|/.test(l) && /\|\s*(\d+) (to|faces)|\|\s*\d+ faces/.test(l));
  const used = [];
  rows.forEach((l) => {
    const cells = l.split('|').map((c) => c.trim());
    const name = cells[1].replace(/\s*\(Live\)\s*$/, '');
    const game = GAMES.find((g) => g.name === name);
    assert.ok(game, 'the README game table has a row for "' + name + '" but js/games has no game of that name');
    used.push(game.id);
    const range = cells[2].match(/^(\d[\d,]*) to (\d[\d,]*)/);
    if (!range) { return; }   // Dice: "6 faces"
    const lo = num(range[1]);
    const hi = num(range[2]);
    if (game.slot) {
      assert.deepEqual([lo, hi], game.reels, 'README says ' + name + ' has ' + lo + ' to ' + hi + ' reels, js/games/slots.js allows ' + game.reels.join(' to '));
      const def = cells[2].match(/\((\d+) by default\)/);
      if (def) { assert.equal(Number(def[1]), game.defaultReels, 'README says ' + name + ' has ' + def[1] + ' reels by default, js/games/slots.js says ' + game.defaultReels); }
    } else {
      assert.equal(hi, game.maxSize, 'README says ' + name + ' goes up to ' + fmt(hi) + ' (' + snip(range) + '), the game allows up to ' + fmt(game.maxSize));
      assert.equal(lo, game.minSize, 'README says ' + name + ' starts at ' + lo + ', the game starts at ' + game.minSize);
    }
  });
  const left = GAMES.filter((g) => used.indexOf(g.id) < 0).map((g) => g.name);
  assert.deepEqual(left, [], 'these games have no row in the README game table: ' + left.join(', '));
});

test('the Help answer in js/ui/pages.js states each game\'s real biggest board', () => {
  // the answer is built in js/ui/pages.js as prose; it is read in groups (a sentence, or a bracket): the numbers in the group that names a game must include
  // that game's biggest board, a number just after the last name of a group ("Pick a Card is a table of cards (up to 100)") belongs to it too, and what follows "fewer" is no claim
  const src = read('js/ui/pages.js');
  const from = src.indexOf("['help-board'");
  const to = src.indexOf("['help-custom'");
  assert.ok(from > 0 && to > from, 'could not find the "How many charities can be on a game?" answer in js/ui/pages.js');
  const text = src.slice(from, to).replace(/<\/p>/g, '\n').replace(/<[^>]*>/g, '').replace(/'\s*\+\s*'/g, '');
  const alias = {
    wheel: ['the wheel', 'Lucky Wheel'], drop: ['the drop crate', 'Drop Crate'], plinko: ['Plinko'], roulette: ['Roulette'], cards: ['Pick a Card'], scratch: ['Scratch Cards', 'scratch cards'],
    coin: ['Coin Flip', 'the coin flip'], derby: ['Charity Derby'], duck: ['Duck Derby'], marble: ['Marble Run'], balloon: ['Balloon Race'], lotto: ['the Lucky Draw', 'Lucky Draw'], standing: ['Last One Standing']
  };
  const all = Object.keys(alias).reduce((a, k) => a.concat(alias[k]), []);
  const numbers = (g) => (g.match(/\d[\d,]*/g) || []).map((n) => Number(n.replace(/,/g, '')));
  const groups = text.split(/\n|(?<=[.!?])\s+|[()]/).map((g) => g.trim()).filter(Boolean);
  const bad = [];
  const claimed = new Set();
  GAMES.filter((g) => g.maxSize && alias[g.id]).forEach((g) => {
    alias[g.id].forEach((a) => {
      groups.forEach((grp, i) => {
        const at = grp.indexOf(a);
        if (at < 0 || grp.slice(0, at).indexOf('fewer') >= 0) { return; }
        let nums = numbers(grp);
        const lastAt = Math.max.apply(null, all.map((x) => grp.lastIndexOf(x)));
        if (at === lastAt && i + 1 < groups.length && !all.some((x) => groups[i + 1].indexOf(x) >= 0)) { nums = nums.concat(numbers(groups[i + 1])); }
        if (!nums.length) { return; }
        claimed.add(g.id);
        if (nums.indexOf(g.maxSize) < 0) { bad.push(g.name + ': the Help answer says "' + grp + '" but the game allows ' + fmt(g.maxSize)); }
      });
    });
  });
  assert.ok(claimed.size >= 8, 'read the biggest board of only ' + claimed.size + ' games from the Help answer; it has been reworded, so update this test');
  assert.deepEqual(Array.from(new Set(bad)), [], 'js/ui/pages.js and the games disagree');
});

test('the README says which games have a "Back a charity" step, and which have none', () => {
  const withStep = GAMES.filter((g) => !g.slot && g.hasBoard && g.id !== 'cards' && g.id !== 'scratch');
  const para = find(/\*\*Back a charity\.\*\*(.{0,900}?)Called It badge/, 'the "Back a charity" paragraph')[1];
  const said = find(/(\w+) games have a \*\*Back a charity\*\* step/, 'how many games have a "Back a charity" step')[1];
  assert.equal(num(said), withStep.length, 'README says ' + said + ' games have a "Back a charity" step, the code has ' + withStep.length + ' (' + withStep.map((g) => g.name).join(', ') + ')');
  // the games that have none must be named: Dice and the slot machines have no board; Pick a Card and Scratch Cards are where you already choose
  const lacking = GAMES.filter((g) => withStep.indexOf(g) < 0).map((g) => (g.slot ? 'slot' : g.name));
  const missing = lacking.filter((n, i) => lacking.indexOf(n) === i && para.toLowerCase().indexOf(n.toLowerCase()) < 0);
  assert.deepEqual(missing, [], 'the README "Back a charity" paragraph does not say that these games have none: ' + missing.join(', '));
});

const TEST_FILES = fs.readdirSync(__dirname).filter((f) => /\.test\.js$/.test(f));

test('the README says how many unit tests there are', () => {
  const count = TEST_FILES.reduce((n, f) => n + (fs.readFileSync(path.join(__dirname, f), 'utf8').match(/^test\(/gm) || []).length, 0);
  const said = num(find(/(\d+) unit tests/, 'the number of unit tests')[1]);
  assert.equal(said, count, 'README says ' + said + ' unit tests, tests/*.test.js has ' + count + ' (' + TEST_FILES.join(', ') + ')');
});

test('the README command for the unit tests runs every unit-test file', () => {
  const cmd = (README.match(/^node --test .*$/m) || [''])[0];
  assert.ok(cmd, 'the README has no "node --test ..." line');
  const left = TEST_FILES.filter((f) => cmd.indexOf(f) < 0 && cmd.indexOf('*.test.js') < 0);
  assert.deepEqual(left, [], 'the README command "' + cmd + '" does not run: ' + left.join(', '));
});

test('every file the README names in its Structure list exists, and every code and style file is named there', () => {
  const block = README.match(/## Structure\s+```[^\n]*\n([\s\S]*?)```/);
  assert.ok(block, 'the README has no "## Structure" code block');
  const named = block[1].split('\n').map((l) => l.match(/^(\S+)\s{2,}/)).filter(Boolean).map((m) => m[1]);
  const missing = named.filter((p) => {
    if (p.indexOf('*') >= 0) {
      const dir = path.join(ROOT, path.dirname(p));
      const re = new RegExp('^' + path.basename(p).replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return !(fs.existsSync(dir) && fs.readdirSync(dir).some((f) => re.test(f)));
    }
    return !fs.existsSync(path.join(ROOT, p));
  });
  assert.deepEqual(missing, [], 'the README Structure list names files that do not exist');
  const list = block[1];
  const unnamed = [];
  fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).forEach((f) => { if (list.indexOf('js/' + f) < 0) { unnamed.push('js/' + f); } });
  fs.readdirSync(path.join(ROOT, 'css')).filter((f) => f.endsWith('.css')).forEach((f) => { if (list.indexOf('css/' + f) < 0) { unnamed.push('css/' + f); } });
  fs.readdirSync(path.join(ROOT, 'assets')).forEach((f) => { if (README.indexOf('assets/' + f) < 0) { unnamed.push('assets/' + f); } });
  assert.deepEqual(unnamed, [], 'these exist but the README never names them (Structure list, or anywhere for assets)');
});

test('the names the README points at really exist in the file it points at', () => {
  const rows = README.split('\n').filter((l) => /^\| /.test(l) && /`js\/[a-z/]+\.js`/.test(l) && !/^\| Game \|/.test(l));
  assert.ok(rows.length >= 3, 'found no rows in the README "Customising" table');
  const gone = [];
  rows.forEach((l) => {
    const cell = l.split('|')[2];
    const files = Array.from(cell.matchAll(/`(js\/[a-z/]+\.js)`/g)).map((m) => m[1]);
    if (files.length !== 1) { return; }
    const src = read(files[0]);
    Array.from(cell.matchAll(/`([A-Za-z_]+)`/g)).map((m) => m[1]).forEach((name) => {
      if (!new RegExp('\\b' + name + '\\b').test(src)) { gone.push('`' + name + '` is not in ' + files[0]); }
    });
  });
  assert.deepEqual(gone, [], 'the README Customising table points at names that are not there');
});

test('the README does not say a 1,000-spot live table takes close to a minute unless the code makes it so', () => {
  const longest = Math.max.apply(null, LIVE.games.map((g) => Math.round(LIVE.playMs[g] * LIVE.sizeRows.filter((r) => r.size === 1000)[0].play / LIVE.playMs.plinko)));
  const m = FLAT.match(/the 1,000-spot tables take close to a minute to play out/);
  if (m) {
    const secs = (longest + LIVE.lockMs) / 1000;
    assert.ok(secs >= 50, 'README says ' + snip(m) + ' but the longest 1,000-spot show in js/live.js is ' + (longest / 1000).toFixed(1) + ' s (+ ' + (LIVE.lockMs / 1000) + ' s lock = ' + secs.toFixed(1) + ' s)');
  }
});

test('the small counts in the README are right: causes, groups, levels, badges, crews', () => {
  const causes = num(find(/Causes \((\d+), in (\w+) groups\)/, 'the number of causes')[1]);
  assert.equal(causes, GS.causes.length, 'README says ' + causes + ' causes, js/data.js has ' + GS.causes.length);
  const groups = num(find(/Causes \((\d+), in (\w+) groups\)/, 'the number of cause groups')[2]);
  assert.equal(groups, GS.causeGroups.length, 'README says ' + groups + ' cause groups, js/data.js has ' + GS.causeGroups.length);
  const levels = num(find(/XP and (\d+) levels/, 'the number of levels')[1]);
  assert.equal(levels, core.LEVELS.length, 'README says ' + levels + ' levels, js/core.js has ' + core.LEVELS.length);
  const badges = num(find(/(\d+) badges and a level ladder/, 'the number of badges')[1]);
  assert.equal(badges, core.BADGES.length, 'README says ' + badges + ' badges, js/core.js has ' + core.BADGES.length);
  const crews = num(find(/Join one of (\w+) simulated crews/, 'the number of crews')[1]);
  const crewsHave = (read('js/crews.js').match(/\{ id: '[a-z]+',\s+name: '/g) || []).length;
  assert.equal(crews, crewsHave, 'README says ' + crews + ' crews, js/crews.js has ' + crewsHave);
});

test('the README uses no crypto wording (the owner\'s rule: this is a charity site)', () => {
  // ("Web Crypto" is the browser's hashing API and the `:root` tokens are the style sheet's colour and spacing variables: neither is crypto wording)
  const prose = README.replace(/```[\s\S]*?```/g, ' ').replace(/Web Crypto( API)?/g, ' ').replace(/the `:root` tokens/g, ' ');
  const hits = Array.from(prose.matchAll(/.{0,40}(?:crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b).{0,40}/gi)).map((m) => m[0].replace(/\s+/g, ' ').trim());
  assert.deepEqual(hits, [], 'the README has crypto wording');
});
