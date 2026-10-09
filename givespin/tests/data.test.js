// Run with:  node --test givespin/tests/data.test.js
// Integrity checks on the charity roster in js/data.js.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../js/core.js');

const sandbox = { window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'), sandbox);
const GS = sandbox.GS;

test('the roster is big and every id is unique', () => {
  assert.ok(GS.charities.length >= 200, 'roster size ' + GS.charities.length);
  const ids = GS.charities.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)), 'ids are url-safe');
});

test('every charity has the fields the UI relies on, using only known vocabulary', () => {
  const causes = new Set(GS.causes.map((c) => c.id));
  const vocab = (g) => new Set(GS.facets[g].map((f) => f.id));
  const serves = vocab('serves'); const where = vocab('where'); const how = vocab('how');
  GS.charities.forEach((c) => {
    assert.ok(c.name && c.short && c.blurb && c.about, c.id + ': text fields');
    assert.ok(c.short.length <= 26, c.id + ': short name too long for a wheel slice: ' + c.short);
    assert.ok(c.blurb.length <= 200, c.id + ': blurb too long');
    assert.ok(c.causes.length >= 1 && c.causes.every((x) => causes.has(x)), c.id + ': causes');
    assert.ok(c.serves.every((x) => serves.has(x)), c.id + ': serves');
    assert.ok(c.where.length >= 1 && c.where.every((x) => where.has(x)), c.id + ': where');
    assert.ok(c.how.length >= 1 && c.how.every((x) => how.has(x)), c.id + ': how');
    assert.match(c.url, /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[a-z]+)?$/, c.id + ': url should be a bare hostname');
    assert.ok(c.founded === null || (Number.isInteger(c.founded) && c.founded > 1800 && c.founded <= 2026), c.id + ': founded');
    assert.ok(c.foundedFrom === undefined || (c.foundedFrom === 'register' && c.founded !== null), c.id + ': foundedFrom is only "register", and only next to a year');
    const regYear = /register lists an established year of (\d{4})/.exec(c.about || '');
    assert.ok(!regYear || Number(regYear[1]) !== c.founded || c.foundedFrom === 'register', c.id + ': its text says the year is the register\'s, so foundedFrom must say so');
    const regYear2 = /established year of (\d{4}) on the register|registered with the ACNC in (\d{4}), which is also its established year/.exec(c.about || '');
    assert.ok(!regYear2 || Number(regYear2[1] || regYear2[2]) !== c.founded || c.foundedFrom === 'register', c.id + ': its text still calls the year the register\'s, so foundedFrom must say so (or the text must say the year is the organisation\'s own)');
    assert.equal(typeof c.hq, 'string');
    assert.ok(/^#[0-9A-F]{6}$/i.test(c.accent), c.id + ': accent colour');
  });
});

test('no two charities share the same short name (they would look identical on a board or a wheel)', () => {
  const seen = {};
  GS.charities.forEach((c) => {
    const k = c.short.toLowerCase();
    assert.ok(!seen[k], c.id + ' and ' + seen[k] + ' are both called "' + c.short + '"');
    seen[k] = c.id;
  });
});

test('charities flagged unverified never carry founding or headquarters facts', () => {
  // (every entry has now been checked, so the list may be empty; the rule still holds for any added later)
  const unverified = GS.charities.filter((c) => c.unverified);
  unverified.forEach((c) => { assert.equal(c.founded, null, c.id); assert.equal(c.hq, '', c.id); });
});

test('every cause has enough charities for a single-cause filter to play well', () => {
  const counts = core.facetCounts(GS.charities).causes;
  GS.causes.forEach((c) => assert.ok((counts[c.id] || 0) >= 4, c.id + ' has only ' + (counts[c.id] || 0)));
  assert.equal(GS.causes.length, 30);
  assert.ok(GS.causes.every((c) => GS.causeGroups.includes(c.group)));
});

test('filter facets: the headline values each match plenty of charities', () => {
  const f = core.facetCounts(GS.charities);
  ['children', 'patients', 'families', 'veterans', 'women', 'seniors', 'refugees'].forEach((id) => assert.ok(f.serves[id] >= 5, id));
  assert.ok(f.where.us >= 100 && f.where.global >= 50);
  ['direct', 'research', 'advocacy', 'training', 'funding', 'protection'].forEach((id) => assert.ok(f.how[id] >= 5, id));
  core.ERA_IDS.forEach((id) => assert.ok(f.era[id] >= 10, id));
});

test('charity names are not duplicated and no entry quietly overstates itself', () => {
  const names = GS.charities.map((c) => c.name.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  const banned = /(\bthe best\b|#1|\bnumber one\b|\bguaranteed\b|\bmiracle cure\b)/i;
  GS.charities.forEach((c) => assert.ok(!banned.test(c.blurb), c.id + ' blurb makes a superlative claim'));
});

test('monograms are short and present for every charity', () => {
  GS.charities.forEach((c) => { const m = GS.mono(c); assert.ok(m && m.length <= 5, c.id + ' ' + m); });
});

test('combined filters always leave something to play for common combinations', () => {
  const combos = [
    { causes: ['kids'], where: ['us'] }, { causes: ['animals', 'planet'] }, { serves: ['veterans'] },
    { how: ['research'], causes: ['health'] }, { era: ['e4'] }, { causes: ['hunger'], era: ['e3', 'e4'] },
  ];
  combos.forEach((f) => assert.ok(core.buildPool(GS.charities, f, []).length >= 2, JSON.stringify(f)));
});
