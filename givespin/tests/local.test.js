// Run with:  node --test givespin/tests/local.test.js
// js/local.js: the small storage helper the newer features share. Runs the real file on a pretend page.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

/** A value made in the pretend page has that page's Object prototype: copy it so deepEqual compares plain data. */
const plain = (v) => JSON.parse(JSON.stringify(v));

const SRC = fs.readFileSync(path.join(__dirname, '../js/local.js'), 'utf8');

/** A pretend page whose localStorage is a plain object (or throws, or is missing). */
function load(storage) {
  const sandbox = { GS: {} };
  sandbox.window = sandbox;
  if (storage !== undefined) { Object.defineProperty(sandbox, 'localStorage', { get() { if (storage instanceof Error) { throw storage; } return storage; } }); }
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: 'local.js' });
  return sandbox.GS.local;
}

function fakeStorage() {
  const data = new Map();
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    key: (i) => Array.from(data.keys())[i] || null,
    get length() { return data.size; }
  };
}

test('a value comes back as saved, under a key that is not the main save', () => {
  const s = fakeStorage();
  const local = load(s);
  assert.equal(local.set('quests', { a: 1, list: [1, 2] }), true);
  assert.deepEqual(plain(local.get('quests')), { a: 1, list: [1, 2] });
  assert.deepEqual(Array.from(s.data.keys()), ['givespin:x:quests']);
  assert.ok(!s.data.has('givespin:v2'));
});

test('a missing or broken key gives the fallback, never an error', () => {
  const s = fakeStorage();
  const local = load(s);
  assert.equal(local.get('nothing', 'x'), 'x');
  s.data.set('givespin:x:bad', '{not json');
  assert.equal(local.get('bad', 7), 7);
  s.data.set('givespin:x:nul', 'null');
  assert.equal(local.get('nul', 'd'), 'd');
});

test('blocked, throwing or missing storage still works for the visit (memory) and says it did not reach storage', () => {
  [new Error('blocked'), null, undefined].forEach((blocked) => {
    const local = load(blocked);
    assert.equal(local.set('a', { n: 1 }), false);
    assert.deepEqual(plain(local.get('a')), { n: 1 });
    local.remove('a');
    assert.equal(local.get('a', 'gone'), 'gone');
  });
  const full = fakeStorage();
  full.setItem = () => { throw new Error('quota'); };
  const local = load(full);
  assert.equal(local.set('a', 5), false);
  assert.equal(local.get('a'), 5);
});

test('odd names cannot escape the prefix, and a value that JSON cannot hold is refused', () => {
  const s = fakeStorage();
  const local = load(s);
  local.set('../v2 x', 1);
  assert.deepEqual(Array.from(s.data.keys()), ['givespin:x:.._v2_x']);
  const cyc = {}; cyc.self = cyc;
  assert.equal(local.set('c', cyc), false);
  assert.equal(local.set('u', undefined), false);
});

test('clearAll removes only its own keys', () => {
  const s = fakeStorage();
  s.setItem('givespin:v2', '{"x":1}');
  const local = load(s);
  local.set('a', 1); local.set('b', 2);
  local.clearAll();
  assert.deepEqual(Array.from(s.data.keys()), ['givespin:v2']);
  assert.equal(local.get('a', 'none'), 'none');
});
