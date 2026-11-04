// Run with:  node --test givespin/tests/transport.test.js
// The live-room transport (js/transport.js, written down in docs/live-protocol.md): the message format and its validation, the local stand-in for a
// server, the commit/reveal check, the adapter that turns the real live engine (js/live.js) into messages, and the rules for the waitlist note.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const nodeCrypto = require('node:crypto');

const T = require('../js/transport.js');
const fair = require('../js/fair.js');
const profile = require('../js/profile.js');

const ROOT = path.join(__dirname, '..');
const HEX = (c) => c.repeat(64);

/** A well-formed message of each type (a fresh copy every call, so a test may change it). */
function sample(type) {
  const from = type === 'state' || type === 'lock' || type === 'result' ? { kind: 'table', id: 'plinko25', name: 'Table' } : { kind: 'bot', id: 'bot-LuckyLark', name: 'LuckyLark' };
  const bodies = {
    join: {},
    leave: {},
    bet: { round: 4, charityId: 'oxfam', dollars: 20, action: 'place' },
    chat: { text: 'Good luck, everyone' },
    state: { round: 4, phase: 'open', msLeft: 12000, pot: 45, players: 6, bots: 5, seats: [['oxfam', 20], ['wateraid', 25]], commit: HEX('a') },
    lock: { round: 4, commit: HEX('a'), pot: 45, weights: [['oxfam', 20], ['wateraid', 25]] },
    result: { round: 4, winnerId: 'oxfam', pot: 45, winShare: 0.4444, players: 6, bots: 5, fair: null }
  };
  return { v: 1, type, room: 'plinko25', seq: 7, ts: 1700000000000, from, body: bodies[type] };
}
const reason = (msg) => T.validateMessage(msg).reason;

test('every message type has a well-formed example that is accepted, and survives encode then decode unchanged', () => {
  assert.deepEqual(T.TYPES, ['join', 'leave', 'bet', 'chat', 'state', 'lock', 'result']);
  T.TYPES.forEach((type) => {
    const m = sample(type);
    const v = T.validateMessage(m);
    assert.ok(v.ok, type + ': ' + JSON.stringify(v));
    const e = T.encode(m);
    assert.ok(e.ok && e.bytes === T.utf8Length(e.text) && e.bytes < T.LIMITS.maxBytes, type);
    const d = T.decode(e.text);
    assert.ok(d.ok, type + ': ' + JSON.stringify(d));
    assert.deepEqual(d.msg, m);
  });
});

test('the envelope is strict: exactly the seven keys, a known version, type, room, seq and ts', () => {
  const bad = [
    [null, 'shape'], [undefined, 'shape'], [7, 'shape'], ['x', 'shape'], [[], 'shape'],
    [Object.assign(sample('bet'), { extra: 1 }), 'shape'],
    [(() => { const m = sample('bet'); delete m.ts; return m; })(), 'shape'],
    [Object.assign(sample('bet'), { v: 2 }), 'version'], [Object.assign(sample('bet'), { v: '1' }), 'version'],
    [Object.assign(sample('bet'), { type: 'cashout' }), 'type'], [Object.assign(sample('bet'), { type: 5 }), 'type'],
    [Object.assign(sample('bet'), { room: 'Plinko25' }), 'room'], [Object.assign(sample('bet'), { room: '25plinko' }), 'room'], [Object.assign(sample('bet'), { room: 'a'.repeat(41) }), 'room'], [Object.assign(sample('bet'), { room: '' }), 'room'],
    [Object.assign(sample('bet'), { seq: -1 }), 'seq'], [Object.assign(sample('bet'), { seq: 1.5 }), 'seq'], [Object.assign(sample('bet'), { seq: NaN }), 'seq'], [Object.assign(sample('bet'), { seq: '3' }), 'seq'],
    [Object.assign(sample('bet'), { ts: -5 }), 'ts'], [Object.assign(sample('bet'), { ts: Infinity }), 'ts'], [Object.assign(sample('bet'), { ts: 1e20 }), 'ts']
  ];
  bad.forEach(([m, why]) => assert.equal(reason(m), why, JSON.stringify(m)));
  assert.ok(T.validateMessage(Object.assign(sample('bet'), { seq: 0 })).ok, 'seq 0 is allowed');
  assert.ok(T.validateMessage(Object.assign(sample('bet'), { room: 'a' })).ok);
  assert.ok(T.validateMessage(Object.assign(sample('bet'), { room: 'a' + '1'.repeat(39) })).ok, '40 characters is the longest room');
});

test('who may send what: a player or a bot cannot announce a state, a lock or a result, and the table can send nothing else', () => {
  ['state', 'lock', 'result'].forEach((type) => {
    ['bot', 'player'].forEach((kind) => {
      const m = sample(type);
      m.from = { kind, id: 'someone', name: 'Someone' };
      assert.equal(reason(m), 'from', kind + ' sending ' + type);
    });
  });
  ['join', 'leave', 'bet', 'chat'].forEach((type) => {
    const m = sample(type);
    m.from = { kind: 'table', id: 'plinko25', name: 'Table' };
    assert.equal(reason(m), 'from', 'table sending ' + type);
    m.from = { kind: 'player', id: 'you', name: 'You' };
    assert.ok(T.validateMessage(m).ok, 'a player may send ' + type);
  });
});

test('"from" is strict: the three keys, a plain id, a short name with no markup or control characters', () => {
  const withFrom = (from) => Object.assign(sample('chat'), { from });
  assert.equal(reason(withFrom({ kind: 'robot', id: 'a', name: 'A' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a b', name: 'A' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: '', name: 'A' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a'.repeat(41), name: 'A' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a', name: '' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a', name: 'N'.repeat(21) })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a', name: '<b>Hi</b>' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a', name: 'tab\there' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a' })), 'from');
  assert.equal(reason(withFrom({ kind: 'bot', id: 'a', name: 'A', admin: true })), 'from');
  assert.equal(reason(withFrom('bot')), 'from');
  assert.ok(T.validateMessage(withFrom({ kind: 'bot', id: 'a', name: 'N'.repeat(20) })).ok);
});

test('a bet needs a round, a charity id, whole dollars from 1 to 1,000 and place or cancel', () => {
  const bet = (patch) => Object.assign(sample('bet'), { body: Object.assign(sample('bet').body, patch) });
  [{ dollars: 0 }, { dollars: 1001 }, { dollars: 2.5 }, { dollars: -3 }, { dollars: NaN }, { dollars: '20' }, { dollars: Infinity },
    { round: 0 }, { round: 1.5 }, { charityId: 'Oxfam' }, { charityId: '' }, { charityId: '../x' }, { charityId: 'a'.repeat(65) }, { action: 'raise' }, { action: undefined }]
    .forEach((p) => assert.equal(reason(bet(p)), 'body', JSON.stringify(p)));
  assert.ok(T.validateMessage(bet({ dollars: 1 })).ok && T.validateMessage(bet({ dollars: 1000 })).ok && T.validateMessage(bet({ action: 'cancel' })).ok);
  const extra = sample('bet'); extra.body.sneaky = true;
  assert.equal(reason(extra), 'body', 'an extra key in a body is refused');
  const missing = sample('bet'); delete missing.body.action;
  assert.equal(reason(missing), 'body');
  const j = sample('join'); j.body = { name: 'x' };
  assert.equal(reason(j), 'body', 'join has an empty body');
});

test('chat is 1 to 200 characters with no control characters', () => {
  const chat = (text) => Object.assign(sample('chat'), { body: { text } });
  assert.ok(T.validateMessage(chat('a')).ok && T.validateMessage(chat('x'.repeat(200))).ok);
  ['', 'x'.repeat(201), 'line\nbreak', 'nul\u0000', 'del\u007f', 5, null].forEach((t) => assert.equal(reason(chat(t)), 'body', JSON.stringify(t)));
  assert.ok(T.validateMessage(chat('<script>alert(1)</script>')).ok, 'markup is allowed in the message: the screen must escape it (the doc says so)');
});

test('a state message cannot have more bots than players, a bad phase, a wrong seat list or a hash that is not 64 hex characters', () => {
  const st = (patch) => Object.assign(sample('state'), { body: Object.assign(sample('state').body, patch) });
  [{ bots: 7 }, { phase: 'idle' }, { phase: 'LOCKED' }, { msLeft: -1 }, { msLeft: 3600001 }, { pot: -1 }, { pot: 1.5 }, { round: 0 },
    { seats: [['oxfam']] }, { seats: [['oxfam', 0]] }, { seats: [['Oxfam', 5]] }, { seats: 'oxfam' }, { seats: Array.from({ length: 65 }, (_, i) => ['c' + i, 1]) },
    { commit: 'abc' }, { commit: HEX('G') }, { commit: HEX('A') }, { commit: undefined }]
    .forEach((p) => assert.equal(reason(st(p)), 'body', JSON.stringify(p).slice(0, 80)));
  assert.ok(T.validateMessage(st({ commit: null })).ok, 'null is how a browser that cannot hash says so');
  assert.ok(T.validateMessage(st({ seats: Array.from({ length: 64 }, (_, i) => ['c' + i, 1]) })).ok);
  assert.ok(T.validateMessage(st({ seats: [] })).ok, 'a table with no stakes yet');
});

test('a lock message: the weights are sorted by charity id, once each, and add up to the pot', () => {
  const lk = (patch) => Object.assign(sample('lock'), { body: Object.assign(sample('lock').body, patch) });
  assert.equal(reason(lk({ pot: 44 })), 'body', 'pot must equal the tickets');
  assert.equal(reason(lk({ weights: [['wateraid', 25], ['oxfam', 20]] })), 'body', 'unsorted');
  assert.equal(reason(lk({ weights: [['oxfam', 20], ['oxfam', 25]] })), 'body', 'a charity twice');
  assert.equal(reason(lk({ weights: [], pot: 0 })), 'body', 'an empty pot cannot lock');
  assert.equal(reason(lk({ commit: 'nope' })), 'body');
  assert.ok(T.validateMessage(lk({ commit: null })).ok);
});

test('a result message: the winner, a share from 0 to 1, and either no fair record or a full, consistent one', () => {
  const rs = (patch) => Object.assign(sample('result'), { body: Object.assign(sample('result').body, patch) });
  const good = { roundSeed: HEX('1'), serverHash: HEX('2'), clientSeed: 'abcd1234', nonce: 4, poolHash: HEX('3'), ticket: 17, weights: [['oxfam', 20], ['wateraid', 25]], winners: ['oxfam'] };
  assert.ok(T.validateMessage(rs({ fair: good })).ok);
  assert.ok(T.validateMessage(rs({ winShare: 0 })).ok && T.validateMessage(rs({ winShare: 1 })).ok);
  [{ winShare: 1.2 }, { winShare: -0.1 }, { winShare: NaN }, { winnerId: 'OXFAM' }, { pot: 0 }, { bots: 9 },
    { fair: Object.assign({}, good, { winners: ['wateraid'] }) }, { fair: Object.assign({}, good, { winners: ['oxfam', 'wateraid'] }) },
    { fair: Object.assign({}, good, { roundSeed: 'short' }) }, { fair: Object.assign({}, good, { ticket: -1 }) }, { fair: Object.assign({}, good, { clientSeed: 'x'.repeat(65) }) },
    { fair: Object.assign({}, good, { extra: 1 }) }, { fair: {} }, { fair: undefined }]
    .forEach((p) => assert.equal(reason(rs(p)), 'body', JSON.stringify(p).slice(0, 90)));
  assert.ok(T.validateMessage(rs({ fair: Object.assign({}, good, { ticket: null }) })).ok, 'a ticket may be null');
});

test('size: the limit counts bytes, text is checked before it is parsed, and no input ever throws', () => {
  assert.equal(T.utf8Length('abc'), 3);
  assert.equal(T.utf8Length('é'), 2);
  assert.equal(T.utf8Length('€'), 3);
  assert.equal(T.utf8Length('😀'), 4);
  assert.equal(T.utf8Length(''), 0);
  // an over-long text is refused as too big even though it is not JSON: the size is looked at first
  assert.equal(T.decode('x'.repeat(T.LIMITS.maxBytes + 1)).reason, 'size');
  assert.equal(T.decode('{"v":1').reason, 'shape');
  assert.equal(T.decode('not json').reason, 'shape');
  assert.equal(T.decode(null).reason, 'shape');
  assert.equal(T.decode(42).reason, 'shape');
  assert.equal(T.decode('[]').reason, 'shape');
  assert.equal(T.decode('null').reason, 'shape');
  // the biggest legal bodies stay inside the limit (so the byte limit is a safety net, not something a normal table meets)
  const seats = Array.from({ length: 64 }, (_, i) => ['c' + 'x'.repeat(61) + i % 10, 999999999]);
  const big = sample('state'); big.body.seats = seats; big.body.pot = 5; // (the pot is not checked against seats in a state)
  const e = T.encode(big);
  assert.ok(e.ok && e.bytes < T.LIMITS.maxBytes, JSON.stringify(e).slice(0, 100));
  // a __proto__ key in the text is an unknown key, not a way to change the message
  const polluted = '{"v":1,"type":"chat","room":"a","seq":1,"ts":1,"from":{"kind":"bot","id":"a","name":"A"},"body":{"text":"hi"},"__proto__":{"admin":true}}';
  assert.equal(T.decode(polluted).reason, 'shape');
  assert.equal({}.admin, undefined);
  // odd values
  const cyc = sample('chat'); cyc.body.self = cyc;
  const weird = [undefined, null, 0, NaN, '', {}, [], () => 1, Symbol('x'), 10n, new Date(), /x/, Object.create(null), cyc, new Proxy({}, { ownKeys() { throw new Error('boom'); } })];
  weird.forEach((w) => { assert.doesNotThrow(() => T.validateMessage(w)); assert.equal(T.validateMessage(w).ok, false); });
  assert.doesNotThrow(() => T.encode(cyc));
});

test('the local transport: join, bet and state reach everyone in the room in order, with seq counting up and the clock stamping every message', async () => {
  const hub = T.createHub({ seed: 5 });
  const table = T.createLocalTransport({ hub, role: 'table' });
  const ann = T.createLocalTransport({ hub, name: 'Ann' });
  const bot = T.createLocalTransport({ hub, role: 'bot', id: 'bot-LuckyLark', name: 'LuckyLark' });
  const heard = [];
  ann.on('*', (m) => heard.push(m));
  assert.ok((await table.connect('plinko10')).ok);
  const a = await ann.connect('plinko10');
  assert.ok(a.ok && a.room === 'plinko10' && a.you.kind === 'player' && a.you.name === 'Ann');
  assert.ok((await bot.connect('plinko10')).ok);
  assert.ok(bot.send({ type: 'bet', body: { round: 1, charityId: 'oxfam', dollars: 10, action: 'place' } }).ok);
  assert.ok(table.send({ type: 'state', body: { round: 1, phase: 'open', msLeft: 1000, pot: 10, players: 2, bots: 1, seats: [['oxfam', 10]], commit: null } }).ok);
  ann.close();
  assert.deepEqual(heard.map((m) => m.type + ':' + m.seq + ':' + m.from.kind), ['join:1:player', 'join:2:bot', 'bet:3:bot', 'state:4:table', 'leave:5:player'], 'a client hears its own messages too, its own leave included');
  assert.ok(heard.every((m, i) => T.validateMessage(m).ok && (i === 0 || m.ts > heard[i - 1].ts)), 'valid, and each later than the last');
  assert.deepEqual(hub.backlog('plinko10').map((m) => m.type), ['join', 'join', 'bet', 'state', 'leave']);
  assert.equal(hub.seq('plinko10'), 5);
  assert.equal(hub.members('plinko10'), 2);
  // another room is counted on its own
  const other = T.createLocalTransport({ hub });
  await other.connect('wheel10');
  assert.equal(hub.seq('wheel10'), 1);
  assert.equal(hub.seq('plinko10'), 5);
});

test('a seeded clock gives the same times every run, and a different seed another start; advance() moves it by hand', () => {
  const a = T.createClock({ seed: 3 }), b = T.createClock({ seed: 3 }), c = T.createClock({ seed: 4 });
  assert.equal(a.now(), b.now());
  assert.equal(a.now(), b.now());
  assert.notEqual(T.createClock({ seed: 3 }).peek(), c.peek());
  const d = T.createClock({ start: 1000, step: 0 });
  assert.equal(d.now(), 1000);
  assert.equal(d.now(), 1000);
  d.advance(250);
  assert.equal(d.now(), 1250);
  d.advance(-50);   // it never goes back
  assert.equal(d.peek(), 1250);
  const run = async (seed) => {
    const hub = T.createHub({ seed });
    const t = T.createLocalTransport({ hub, name: 'Ann' });
    await t.connect('plinko5');
    t.send({ type: 'chat', body: { text: 'hello' } });
    return hub.backlog('plinko5');
  };
  return Promise.all([run(9), run(9), run(10)]).then(([x, y, z]) => {
    assert.deepEqual(x, y);
    assert.notDeepEqual(x, z);
  });
});

test('a sender cannot choose seq, ts or from, cannot use another room, and a player cannot send what only a table may', async () => {
  const hub = T.createHub({ seed: 1 });
  const p = T.createLocalTransport({ hub, name: 'Ann' });
  const t = T.createLocalTransport({ hub, role: 'table' });
  assert.equal(p.send({ type: 'chat', body: { text: 'x' } }).reason, 'not-connected');
  await p.connect('plinko10'); await t.connect('plinko10');
  const ok = p.send({ type: 'chat', body: { text: 'hi' }, seq: 999, ts: 5 });
  assert.ok(ok.ok && ok.msg.seq === hub.seq('plinko10') && ok.msg.ts !== 5, 'seq and ts are the room\'s, whatever was sent');
  assert.equal(p.send({ type: 'chat', body: { text: 'hi' }, from: { kind: 'bot', id: 'x', name: 'X' } }).reason, 'from');
  assert.equal(p.send({ type: 'chat', body: { text: 'hi' }, room: 'wheel10' }).reason, 'wrong-room');
  assert.equal(p.send({ type: 'result', body: {} }).reason, 'not-allowed');
  assert.equal(p.send({ type: 'state', body: {} }).reason, 'not-allowed');
  assert.equal(t.send({ type: 'bet', body: { round: 1, charityId: 'oxfam', dollars: 5, action: 'place' } }).reason, 'not-allowed');
  assert.equal(p.send({ type: 'join', body: {} }).reason, 'not-allowed');
  assert.equal(p.send({ type: 'cashout', body: {} }).reason, 'type');
  assert.equal(p.send(null).reason, 'shape');
  assert.equal(p.send({ type: 'bet', body: { round: 1, charityId: 'oxfam', dollars: 5000, action: 'place' } }).reason, 'body', 'a bad body is refused and uses no seq');
  const before = hub.seq('plinko10');
  p.send({ type: 'bet', body: {} });
  assert.equal(hub.seq('plinko10'), before);
  // connect: only a good room, once, and not after close
  const q = T.createLocalTransport({ hub });
  assert.equal((await q.connect('Bad Room')).reason, 'room');
  assert.ok((await q.connect('wheel5')).ok);
  assert.equal((await q.connect('wheel5')).reason, 'connected');
  q.close();
  assert.equal((await q.connect('wheel5')).reason, 'closed');
  assert.equal(q.send({ type: 'chat', body: { text: 'x' } }).reason, 'not-connected');
});

test('listeners: on() returns a way to stop, "*" hears everything, a listener that throws does not stop the others, and a delivered copy cannot change what others see', async () => {
  const hub = T.createHub({ seed: 2 });
  const a = T.createLocalTransport({ hub, name: 'Ann' });
  const b = T.createLocalTransport({ hub, name: 'Bo', id: 'bo' });
  await a.connect('plinko10'); await b.connect('plinko10');
  const chats = [], all = [];
  const off = a.on('chat', (m) => chats.push(m.body.text));
  a.on('*', (m) => all.push(m.type));
  a.on('chat', () => { throw new Error('a bad listener'); });
  b.on('chat', (m) => { m.body.text = 'tampered'; });
  const seenByB = [];
  a.on('chat', (m) => seenByB.push(m.body.text));
  assert.equal(typeof off, 'function');
  assert.equal(typeof a.on('nope', () => {}), 'function', 'an unknown type gives a harmless stopper');
  a.send({ type: 'chat', body: { text: 'one' } });
  off();
  a.send({ type: 'chat', body: { text: 'two' } });
  assert.deepEqual(chats, ['one']);
  assert.deepEqual(seenByB, ['one', 'two'], 'a tampering listener elsewhere changed nothing for this one');
  assert.deepEqual(all.filter((t) => t === 'chat'), ['chat', 'chat']);
  assert.ok(hub.errors.length >= 2 && /bad listener/.test(hub.errors[0]));
  assert.equal(hub.backlog('plinko10').filter((m) => m.type === 'chat')[0].body.text, 'one', 'the stored message is untouched');
});

test('a message sent from inside a listener is delivered after the one being delivered, so everyone sees the same order', async () => {
  const hub = T.createHub({ seed: 2 });
  const a = T.createLocalTransport({ hub, name: 'Ann' });
  const b = T.createLocalTransport({ hub, name: 'Bo', id: 'bo' });
  await a.connect('plinko10'); await b.connect('plinko10');
  const orderA = [], orderB = [];
  a.on('chat', (m) => { orderA.push(m.body.text); if (m.body.text === 'first') { b.send({ type: 'chat', body: { text: 'reply' } }); } });
  b.on('chat', (m) => orderB.push(m.body.text));
  a.send({ type: 'chat', body: { text: 'first' } });
  assert.deepEqual(orderA, ['first', 'reply']);
  assert.deepEqual(orderB, ['first', 'reply']);
});

test('close() announces a leave, stops delivery to that client, and the room remembers at most 100 messages', async () => {
  const hub = T.createHub({ seed: 2 });
  const a = T.createLocalTransport({ hub, name: 'Ann' });
  const b = T.createLocalTransport({ hub, name: 'Bo', id: 'bo' });
  await a.connect('plinko10'); await b.connect('plinko10');
  const got = [];
  a.on('*', (m) => got.push(m.type));
  b.close();
  assert.deepEqual(got, ['leave']);
  assert.equal(hub.members('plinko10'), 1);
  for (let i = 0; i < 130; i++) { a.send({ type: 'chat', body: { text: 'n' + i } }); }
  assert.equal(hub.backlog('plinko10').length, 100);
  assert.equal(hub.seq('plinko10'), 3 + 130, 'seq keeps counting past what is remembered');
  assert.equal(hub.backlog('plinko10')[99].seq, 133);
});

/** Wraps `fair.js` the way a table would: commit, frozen weights, the draw, then the reveal. */
async function realRound(weights, round) {
  const commit = await fair.newCommit();
  const sorted = fair.sortWeights(weights);
  const clientSeed = 'cafe1234';
  const draw = await fair.drawWeighted(commit.roundSeed, clientSeed, round, sorted);
  const poolHash = await fair.weightsHash(sorted);
  const pot = fair.weightsTotal(sorted);
  const lock = { round, commit: commit.serverHash, pot, weights: sorted };
  const win = sorted.filter((w) => w[0] === draw.winner)[0][1];
  const result = {
    round, winnerId: draw.winner, pot, winShare: win / pot, players: 5, bots: 4,
    fair: { roundSeed: commit.roundSeed, serverHash: commit.serverHash, clientSeed, nonce: round, poolHash, ticket: draw.ticket, weights: sorted, winners: [draw.winner] }
  };
  return { lock, result };
}

test('checkFair agrees with the real draw (and with GS.fair.verifyWeighted), and catches a swapped seed, a changed pot or a different winner', async () => {
  const { lock, result } = await realRound([['oxfam', 20], ['wateraid', 25], ['unicef', 5]], 4);
  assert.ok(T.checkFair(lock, result).ok, JSON.stringify(T.checkFair(lock, result)));
  assert.ok((await fair.verifyWeighted(result.fair)).ok, 'the reveal passes the real verifier');
  // as messages
  const lm = Object.assign(sample('lock'), { body: lock }), rm = Object.assign(sample('result'), { body: result });
  assert.ok(T.validateMessage(lm).ok && T.validateMessage(rm).ok, JSON.stringify([T.validateMessage(lm), T.validateMessage(rm)]));
  assert.ok(T.checkFair(lm, rm).ok, 'works on whole messages too');
  const swapped = JSON.parse(JSON.stringify(result)); swapped.fair.serverHash = HEX('9');
  assert.ok(!T.checkFair(lock, swapped).ok && /different commit/.test(T.checkFair(lock, swapped).problems[0]));
  const pot = JSON.parse(JSON.stringify(result)); pot.fair.weights[0][1] += 5;
  assert.ok(!T.checkFair(lock, pot).ok);
  const round = JSON.parse(JSON.stringify(result)); round.round = 5;
  assert.ok(!T.checkFair(lock, round).ok);
  const winner = JSON.parse(JSON.stringify(result)); winner.winnerId = 'unicef';
  assert.ok(!T.checkFair(lock, winner).ok);
  assert.ok(!T.checkFair(lock, Object.assign({}, result, { fair: null })).ok);
  assert.ok(!T.checkFair(Object.assign({}, lock, { commit: null }), result).ok);
  assert.ok(!T.checkFair(null, result).ok);
  // and the real verifier catches a tampered reveal too, which checkFair (a shape check) does not claim to do
  const forged = JSON.parse(JSON.stringify(result.fair)); forged.roundSeed = HEX('7');
  assert.ok(!(await fair.verifyWeighted(forged)).ok);
});

/**
 * The real live engine (js/live.js) on a pretend page with the real roster, core and fair-play code, a real event bus and timers written down
 * instead of fired. Only bots take part (a stake of the visitor's needs the whole store, which section 29b of the end-to-end tests covers).
 */
function liveEngine() {
  const timers = [];
  const sandbox = {
    console, Date, Promise, TextEncoder, Uint8Array, Math,
    crypto: nodeCrypto.webcrypto,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['core.js', 'config.js', 'data.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', f), 'utf8'), sandbox, { filename: f }));
  const GS = sandbox.GS;
  const handlers = {};
  GS.bus = { on: (n, fn) => { (handlers[n] = handlers[n] || []).push(fn); }, emit: (n, d) => { (handlers[n] || []).forEach((fn) => fn(d)); } };
  GS.payments = { mode: () => 'demo' };
  GS.fair = fair;
  GS.store = { refundPending: () => 0, fair: () => ({ clientSeed: 'cafe1234' }), crew: () => '' };
  GS.games = { plinko: { name: 'Plinko', live: true, setField() {}, playLive() {} } };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/live.js'), 'utf8'), sandbox, { filename: 'live.js' });
  GS.live.setEvent(null);
  return { GS, timers };
}

test('attachLive: a real round of the real engine becomes valid messages (state, bets, lock, result), and the lock and result pass checkFair and the real verifier', async () => {
  const { GS } = liveEngine();
  const bridge = T.attachLive(GS.live, GS.bus, { now: () => 1700000000000 });
  GS.live.start();
  const room = GS.live.room('plinko10');
  assert.ok(room && room.phase === 'open');
  // the engine seated its first bots as it opened: they are bets in the stream, and the room has begun with a state
  const t = T.createLocalTransport({ hub: bridge.hub, name: 'Watcher' });
  await t.connect('plinko10');
  const heard = [];
  t.on('*', (m) => heard.push(m));
  while (!room.commit) { await new Promise((r) => setImmediate(r)); }   // (the engine seals the round's secret a moment after it opens)
  const before = bridge.hub.backlog('plinko10');
  assert.ok(before.some((m) => m.type === 'bet' && m.from.kind === 'bot' && /^bot-/.test(m.from.id)), 'bots\' stakes are bets from kind "bot"');
  assert.ok(before.some((m) => m.type === 'state' && m.body.phase === 'open'));
  room.lock();
  await room.drawP;
  room.play();
  room.finish();
  const mine = bridge.hub.backlog('plinko10').filter((m) => m.type !== 'join');
  const types = mine.map((m) => m.type);
  assert.ok(types.includes('lock') && types.includes('result'), types.join());
  assert.ok(types.lastIndexOf('result') > types.lastIndexOf('lock'), 'the result comes after the lock');
  assert.deepEqual(bridge.problems, [], 'every message the adapter made was valid');
  assert.equal(bridge.count() >= mine.length, true);
  const lock = mine.filter((m) => m.type === 'lock').pop(), result = mine.filter((m) => m.type === 'result').pop();
  assert.equal(lock.body.round, result.body.round);
  assert.equal(lock.body.pot, room.result.pot);
  assert.ok(result.body.fair, 'the engine had fair play available, so the reveal is there');
  const chk = T.checkFair(lock, result);
  assert.ok(chk.ok, JSON.stringify(chk));
  assert.ok((await fair.verifyWeighted(result.body.fair)).ok, 'the real verifier accepts what the adapter published');
  assert.equal(result.body.winnerId, room.result.winnerId);
  // the stream never contained a player claiming to be the table
  assert.ok(mine.every((m) => (['state', 'lock', 'result'].includes(m.type)) === (m.from.kind === 'table')));
  // seq has no gaps in the room
  const seqs = bridge.hub.backlog('plinko10').map((m) => m.seq);
  assert.ok(seqs.every((s, i) => i === 0 || s === seqs[i - 1] + 1));
  // stop() makes it deaf
  const n = bridge.count();
  bridge.stop();
  GS.live.room('plinko25').openRound(0);
  assert.equal(bridge.count(), n);
});

test('attachLive does not change the engine: the same seeded run gives the same table with and without it', async () => {
  const run = async (attach) => {
    const { GS } = liveEngine();
    if (attach) { T.attachLive(GS.live, GS.bus); }
    GS.live.start();
    const r = GS.live.room('plinko10');
    return JSON.stringify([r.round, r.phase, r.pot() > 0, r.field().length > 0]);
  };
  assert.equal(await run(true), await run(false));
});

test('the waitlist note keeps only a nickname and a yes, with the profile page\'s name rules', () => {
  const rules = profile.validateName;
  const w = T.waitlist;
  assert.equal(w.KEY, 'waitlist');
  assert.deepEqual(w.clean({ nickname: 'Ann the Giver', notify: true, savedAt: 1700000000000 }, rules), { nickname: 'Ann the Giver', notify: true, savedAt: 1700000000000 });
  assert.deepEqual(w.clean({ nickname: '  Ann   Lee ', notify: true }, rules), { nickname: 'Ann Lee', notify: true, savedAt: 0 }, 'spaces tidied, a missing time is 0');
  assert.deepEqual(w.clean({ nickname: 'Ann', notify: true, email: 'a@b.co', phone: '555' }, rules), { nickname: 'Ann', notify: true, savedAt: 0 }, 'nothing but the three fields is ever read back');
  [null, undefined, 5, 'x', [], {}, { nickname: 'Ann' }, { nickname: 'Ann', notify: false }, { nickname: 'Ann', notify: 'yes' }, { nickname: '', notify: true }, { nickname: '<b>x</b>', notify: true },
    { nickname: 'x'.repeat(21), notify: true }, { nickname: 'visit www.example.com', notify: true }, { nickname: 'ann@example.com', notify: true }, { nickname: 'https://x.y', notify: true }, { nickname: 7, notify: true }]
    .forEach((x) => assert.equal(w.clean(x, rules), null, JSON.stringify(x)));
  assert.equal(w.validateNickname('Ann', rules).ok, true);
  assert.equal(w.validateNickname('', rules).ok, false);
  // without the profile rules loaded, the plain rules still refuse the obvious
  assert.equal(w.validateNickname('Ann').ok, true);
  assert.equal(w.validateNickname('<i>').ok, false);
  assert.equal(w.validateNickname('ann@example.com').ok, false);
  assert.equal(w.validateNickname('x'.repeat(21)).ok, false);
});

test('the protocol document and the code agree: every type, every limit and the file names it mentions', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/live-protocol.md'), 'utf8');
  T.TYPES.forEach((t) => assert.ok(new RegExp('`' + t + '`').test(doc), 'the doc names the ' + t + ' message'));
  assert.ok(doc.includes(T.LIMITS.maxBytes.toLocaleString('en-US') + ' bytes'), 'the doc states the byte limit');
  assert.ok(doc.includes('**' + T.LIMITS.seats + '**') && doc.includes(String(T.LIMITS.text)) && doc.includes(String(T.LIMITS.name)), 'seat, chat and name limits');
  assert.ok(doc.includes('1,000'), 'the stake limit');
  ['js/transport.js', 'js/fair.js', 'js/live.js', 'docs/make-it-real.md'].forEach((f) => { assert.ok(doc.includes(f), 'the doc mentions ' + f); });
  ['roundSeed', 'serverHash', 'clientSeed', 'nonce', 'poolHash', 'ticket', 'weights', 'winners'].forEach((k) => assert.ok(doc.includes(k), 'the doc names the fair field ' + k));
  assert.ok(/\bbot\b/.test(doc) && /BOT/.test(doc), 'the doc says bots are labelled');
});

test('the wording rules: no crypto words in the protocol document or in the transport code, and no claim of real players', () => {
  const banned = /crypto(?!graph)|bitcoin|ethereum|blockchain|wallet|\bNFTs?\b|\btokens?\b|\bcoins?\b/i;
  ['docs/live-protocol.md', 'js/transport.js'].forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const hit = src.match(banned);
    assert.equal(hit, null, f + ' uses a banned word: ' + (hit && hit[0]));
    assert.equal(/real players/i.test(src.replace(/not a real player|no real player/gi, '')), false, f + ' says "real players"');
  });
});
