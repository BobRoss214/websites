/*
 * Crews: small groups you can join to play alongside. A crew chats, has a weekly goal, and its members back the same
 * charity as you at live tables.
 *
 * Every crewmate is a BOT for now, standing in for the real people a launch would have. The chat is scripted and
 * stays on this device: nothing you type is sent anywhere, and every screen says so.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});
  var core = GS.core;
  var store = GS.store;

  var CREWS = [
    { id: 'tide',      name: 'Tide Turners',       blurb: 'Early risers who like water, oceans and the planet.', members: ['MapleMoon', 'RiverRuby', 'OtterOllie', 'WillowWren', 'KiwiKai', 'SunnySid', 'AtlasAnt'] },
    { id: 'owls',      name: 'Night Owls Giving',  blurb: 'Late-night givers. The tables are busiest after dark.', members: ['NightOwlNell', 'ZigZagZed', 'HoneyHawk', 'CloudyCleo', 'EmberEli', 'LanternLou', 'OrbitOz'] },
    { id: 'paws',      name: 'Paws & Co',          blurb: 'Animal lovers, and proud of it.', members: ['PixelPaw', 'KoalaKay', 'FoxTrotFin', 'QuietQuokka', 'PepperPip', 'HazelHop', 'BramblePie'] },
    { id: 'longshots', name: 'The Long Shots',     blurb: 'We always back the underdog. Sometimes it pays off.', members: ['TangoTom', 'JollyJet', 'GlimmerGia', 'BoldBasil', 'LemonDrop', 'TurboTess', 'PocketAces'] }
  ];

  var EMOTES = [
    { id: 'cheer', label: 'Cheer', icon: 'party-popper' },
    { id: 'fire',  label: 'On fire', icon: 'flame' },
    { id: 'lucky', label: 'Lucky', icon: 'sparkles' },
    { id: 'gg',    label: 'GG', icon: 'handshake' }
  ];

  var LINES = [
    'who is backing the underdog this round?', 'that pot is getting spicy', 'last call, last call!', 'I put $10 on the favourite, wish me luck',
    'any charity wins, the whole pot goes to a good cause', 'did you see that photo finish?', 'good luck everyone', 'new table just opened',
    'my pick never wins and I still love this', 'GG all', 'who is up for the weekly league?', 'I am one win from a hot streak'
  ];

  var chats = {};
  var timer = 0;

  function find(id) { return CREWS.filter(function (c) { return c.id === id; })[0] || null; }
  function log(id) { return chats[id] || (chats[id] = []); }

  function push(id, msg) {
    msg.t = Date.now();
    var l = log(id);
    l.push(msg);
    if (l.length > 60) { l.shift(); }
    GS.bus.emit('crew', { type: 'chat', crew: id });
  }

  function botLine(id) {
    var c = find(id);
    if (!c) { return; }
    if (core.randomFloat() < 0.3) { push(id, { name: core.pickOne(c.members), bot: true, emote: core.pickOne(EMOTES).id }); }
    else { push(id, { name: core.pickOne(c.members), bot: true, text: core.pickOne(LINES) }); }
  }

  function startChat() {
    if (timer) { return; }
    var id = store.crew();
    if (id && !log(id).length) { push(id, { name: core.pickOne(find(id).members), bot: true, text: 'welcome to ' + find(id).name + '!' }); }
    timer = setInterval(function () {
      var cur = store.crew();
      if (!cur) { return; }
      if (!document.hidden && core.randomFloat() < 0.55) { botLine(cur); }
    }, Math.max(1500, 6500 * (GS.timeScale || 1)));
  }

  GS.crews = {
    CREWS: CREWS,
    EMOTES: EMOTES,
    get: find,
    mine: function () { return find(store.crew()); },
    chat: function (id) { return log(id).slice(); },

    /** Joins a crew (or pass '' to leave). Returns the badges earned. */
    join: function (id) {
      var badges = store.setCrew(id);
      if (id) { push(id, { name: core.pickOne(find(id).members), bot: true, text: 'welcome to the crew!' }); startChat(); }
      GS.bus.emit('crew', { type: 'join', crew: id });
      return badges;
    },

    /** You say something (it stays on this device). */
    say: function (text) {
      var id = store.crew();
      text = String(text || '').trim().slice(0, 80);
      if (!id || !text) { return false; }
      push(id, { name: 'You', bot: false, text: text });
      // a crewmate answers now and then
      if (core.randomFloat() < 0.6) { setTimeout(function () { botLine(id); }, 900 * (GS.timeScale || 1) + 200); }
      return true;
    },
    emote: function (emoteId) {
      var id = store.crew();
      if (!id || !EMOTES.some(function (e) { return e.id === emoteId; })) { return false; }
      push(id, { name: 'You', bot: false, emote: emoteId });
      return true;
    },

    /** The crew's weekly XP goal: crewmates' simulated XP (the same for everyone this week) plus yours. */
    goal: function () {
      var id = store.crew();
      var c = find(id);
      if (!c) { return null; }
      var week = core.weekKey();
      var frac = core.weekFraction();
      var rng = core.seeded('crew:' + id + ':' + week);
      var botXp = 0;
      c.members.forEach(function () { botXp += Math.round((400 + rng() * 1400) * Math.pow(frac, 0.9)); });
      var mine = store.weekly().xp;
      var goal = 8000;
      return { crew: c, botXp: botXp, myXp: mine, xp: botXp + mine, goal: goal, pct: Math.min(100, Math.round((botXp + mine) / goal * 100)) };
    },

    /** When you back a charity at a live table, two or three crewmates back it too (simulated stakes). */
    backYou: function (room, charity) {
      var c = find(store.crew());
      if (!c) { return; }
      var n = 2 + core.randomInt(2);
      var names = core.shuffle(c.members.slice()).slice(0, n);
      var seat = room.seats[charity.id];
      if (!seat) { return; }
      var total = 0;
      names.forEach(function (name) {
        var d = core.pickOne([5, 10, 10, 20]);
        seat.tickets += d;
        seat.bots += 1;
        total += d;
      });
      room._note({ kind: 'crew', name: c.name, dollars: total, charityId: charity.id, members: names });
    },

    start: function () { if (store.crew()) { startChat(); } }
  };
})();
