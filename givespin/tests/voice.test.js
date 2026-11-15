// Run with:  node --test givespin/tests/voice.test.js
// The brand voice (docs/voice.md) in the source: the shared lines (js/ui/voice.js), the style guide itself, and a lint over everything a
// visitor can read so the vocabulary cannot drift ("cash out" and "Give responsibly" gone, the jackpot is a Triple Threat).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/** Every page-building source file: index.html and each js file under js/. */
function sourceFiles() {
  const out = ['index.html'];
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).forEach((e) => {
    const rel = dir + '/' + e.name;
    if (e.isDirectory()) { walk(rel); } else if (e.name.endsWith('.js')) { out.push(rel); }
  });
  walk('js');
  return out;
}

/** js/ui/voice.js loaded the way the page loads it, with a stand-in for the icon helper. */
function loadVoice() {
  const sandbox = { window: {} };
  sandbox.window = sandbox;
  sandbox.GS = { ui: { icon: (name) => '<svg data-icon="' + name + '"></svg>' } };
  vm.createContext(sandbox);
  vm.runInContext(read('js/ui/voice.js'), sandbox, { filename: 'js/ui/voice.js' });
  return sandbox.GS.ui.voice;
}

test('the loading lines are three short lines that end in an ellipsis, handed out in turn', () => {
  const v = loadVoice();
  assert.equal(v.LOADING.length, 3);
  assert.ok(v.LOADING.every((l) => /…$/.test(l) && l.length < 40), v.LOADING.join(' | '));
  assert.ok(v.LOADING.includes('Shuffling the charities…') && v.LOADING.includes('Polishing the confetti…'));
  const seen = [v.loading(), v.loading(), v.loading(), v.loading()];
  assert.deepEqual(seen, [v.LOADING[0], v.LOADING[1], v.LOADING[2], v.LOADING[0]]);
});

test('the house-edge strip says the house edge is 0%, the house is a charity, and links to "How we make money"', () => {
  const v = loadVoice();
  const html = v.houseStrip();
  assert.equal(v.HOUSE, 'House edge: 0%. The house is a charity.');
  assert.ok(html.includes('House edge: 0%.') && html.includes('The house is a charity.'), html);
  assert.ok(/<a href="#help-money">How we make money: we do not\.<\/a>/.test(html), html);
  assert.ok(html.includes('data-icon="house"'), 'it carries the house icon');
});

test('docs/voice.md has its ten rules, the vocabulary table, fifteen example lines and the banned words', () => {
  const md = read('docs/voice.md');
  const rules = md.split('## The 10 rules')[1].split('## Vocabulary')[0].split('\n').filter((l) => /^\d+\. \*\*/.test(l));
  assert.equal(rules.length, 10, 'ten numbered rules');
  const table = md.split('## Vocabulary')[1].split('## 15 example lines')[0];
  ['Give out', 'Triple Threat', 'The house', 'Responsible giving', 'VIP lounge', 'Shuffling the charities', 'Something went wrong. Nothing was charged.', 'How we make money: we do not.'].forEach((w) => {
    assert.ok(table.includes(w), 'the vocabulary table mentions "' + w + '"');
  });
  const lines = md.split('## 15 example lines')[1].split('\n## ')[0].split('\n').filter((l) => /^- /.test(l));
  assert.equal(lines.length, 15, 'fifteen example lines');
  const banned = md.split('## Banned words')[1];
  ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'wallet', 'NFT', 'token', 'cash out', 'superlatives'].forEach((w) => assert.ok(banned.includes(w), 'the banned list names ' + w));
});

test('no source file says "cash out" (give out instead), and none says "Give responsibly" (it is Responsible giving)', () => {
  const cash = /\bcash(?:ed|ing)?[\s-]*out\b/i;
  const bad = sourceFiles().filter((f) => cash.test(read(f)) || /Give responsibly/i.test(read(f)));
  assert.deepEqual(bad, [], 'these still use the old wording: ' + bad.join(', '));
});

test('the word "jackpot" is only code in the source: no sentence a visitor reads uses it (it is a Triple Threat)', () => {
  // look at every quoted string; a name like 'chip-ev--jackpot' or 'jackpot' on its own is a class or an id, a phrase with a space in it is text
  const hits = [];
  sourceFiles().filter((f) => f !== 'js/data.js').forEach((f) => {
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
    const strings = src.match(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"/g) || [];
    strings.forEach((s) => {
      const text = s.replace(/class=\\?"[^"]*"/g, '');
      if (/jackpot/i.test(text) && /\s/.test(text.replace(/^['"]|['"]$/g, '').trim())) { hits.push(f + ': ' + s.slice(0, 80)); }
    });
  });
  assert.deepEqual(hits, [], 'visitor-facing "jackpot" left: ' + hits.join(' | '));
});
