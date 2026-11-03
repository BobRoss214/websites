/* Wise Acres account demo: the one place that keeps the state (pretend accounts, visits, pizza orders, requests, messages, notices ...).
 *
 * THE DEMO IS PRETEND (see docs/ACCOUNT_DEMO.md). The state lives in this browser only, in localStorage under the one key 'wa-demo-v1'. Nothing goes to a
 * server and nothing is sent to anyone. This file only touches the browser's storage when a demo page asks the store for something, and demo pages only run
 * their scripts in demo mode (js/demo-header.js), so the real site keeps nothing (docs/WHAT_THE_SITE_STORES.md).
 *
 * Plain JavaScript, no libraries. It loads in the browser (window.DemoStore) and in Node (module.exports), and  DemoStore.create(storage, options)  makes a store
 * on any storage that has getItem / setItem / removeItem, so tests can pass a fake one. If the storage is blocked or full the store carries on in memory.
 * Every method is synchronous and returns plain objects (copies: changing one never changes the state). Every change calls the subscribers.
 * Dates are 'YYYY-MM-DD', times 'HH:MM', the farm's own clock. The names and shapes are listed in docs/ACCOUNT_DEMO.md. */
(function () {
  'use strict';

  var Data = (typeof module === 'object' && module && module.exports && typeof require === 'function') ? require('./demo-data.js') : (typeof window === 'object' && window ? window.DemoData : null);

  var KEY = 'wa-demo-v1';
  var LISTS = { visits: 'v', orders: 'o', requests: 'r', messages: 'm', notices: 'n', reviews: 'rv', photos: 'p', events: 'e', waitlist: 'w' };   // the id prefixes
  var OBJECTS = { family: 1, alerts: 1, badges: 1 };                       // one object each
  var KIND_LINK = { 'visit-change': '#visits', 'pizza-change': '#pizza', 'event-change': '#event' };   // where a notice about a request leads
  var SIDES = { cathy: 1, kitchen: 1 };

  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function short(text) { text = trim(text).replace(/\s+/g, ' '); return text.length > 90 ? text.slice(0, 87) + '...' : text; }
  function empty() {
    return {
      v: 1, accounts: [], session: null,
      visits: [], orders: [], requests: [], messages: [], notices: [], reviews: [], photos: [], events: [], waitlist: [],
      family: {}, alerts: {}, closedDays: [], badges: {}, flags: {}
    };
  }

  /* ------------------------------------------------------------------ *
   * The storage: the real one, or memory when it is blocked or full
   * ------------------------------------------------------------------ */
  function makeIO(storage) {
    var mem = null, memory = !storage, status = storage ? 'ok' : 'memory';
    // when the storage is full the state is kept in memory, and a copy without the pictures is tried once so a reload keeps the rest
    function lean(raw) {
      try { var st = JSON.parse(raw); (st.photos || []).forEach(function (p) { p.thumb = ''; }); (st.reviews || []).forEach(function (r) { r.thumb = ''; }); return JSON.stringify(st); } catch (e) { return raw; }
    }
    return {
      read: function () {
        if (!memory) { try { return storage.getItem(KEY); } catch (e) { memory = true; status = 'memory'; } }
        return mem;
      },
      write: function (raw) {
        mem = raw;
        if (memory) return;
        try { storage.setItem(KEY, raw); status = 'ok'; } catch (e) {
          memory = true; status = 'memory';
          try { storage.setItem(KEY, lean(raw)); } catch (e2) { /* nothing more to try */ }
        }
      },
      remove: function () { mem = null; if (!storage) return; try { storage.removeItem(KEY); } catch (e) { /* blocked */ } },
      status: function () { return status; }
    };
  }

  function create(storage, opts) {
    opts = opts || {};
    var io = makeIO(storage), cache = null, subs = [];

    /* ---------------- the clock (injectable, for tests) ---------------- */
    function now() {
      var n = opts.now ? opts.now() : new Date();
      return n instanceof Date ? Data.farmParts(n) : n;
    }
    function stampNow() { var n = now(); return n.date + ' ' + n.time; }

    /* ---------------- reading and changing the state ---------------- */
    function read() {   // parsed state, shared: never changed here
      var raw = io.read();
      if (cache && cache.raw === raw) return cache.state;
      var st = null;
      if (raw) { try { st = JSON.parse(raw); } catch (e) { st = null; } }
      if (!st || typeof st !== 'object' || st.v !== 1) st = empty();
      cache = { raw: raw, state: st };
      return st;
    }
    function changed() {
      subs.slice().forEach(function (f) { try { f(); } catch (e) { setTimeout(function () { throw e; }); } });
      if (typeof window === 'object' && window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
        try { window.dispatchEvent(new CustomEvent('wa-demo-change')); } catch (e) { /* an old browser */ }
      }
    }
    // Runs fn on a private copy of the state, saves it, tells the subscribers. fn returns the answer (copied before it goes out) or undefined to leave nothing saved.
    function edit(fn) {
      var st = clone(read()), res = fn(st);
      if (res === undefined) return null;
      var raw = JSON.stringify(st);
      io.write(raw);
      cache = { raw: io.read(), state: st };
      changed();
      return clone(res);
    }
    function nextId(st, coll) {
      var prefix = LISTS[coll], re = new RegExp('^' + prefix + '(\\d+)$'), max = 0;
      st[coll].forEach(function (r) { var m = re.exec(r.id || ''); if (m && +m[1] > max) max = +m[1]; });
      return prefix + (max + 1);
    }
    function addRec(st, coll, obj) {
      var rec = clone(obj) || {};
      if (!rec.id || find(st[coll], rec.id)) rec.id = nextId(st, coll);
      st[coll].push(rec);
      return rec;
    }
    function noteTo(st, to, text, link) {
      var n = { id: nextId(st, 'notices'), to: to, text: text, link: link || '', at: stampNow(), read: false };
      st.notices.push(n);
      return n;
    }
    var who = function (w) { return (Data.WHO[w] || w); };
    var whoMid = function (w) { return who(w).replace(/^The /, 'the '); };   // "the kitchen" inside a sentence

    /* ---------------- changing a record (shared by update() and by a request that is accepted) ---------------- */
    function merge(st, coll, rec, patch) {
      var oldTime = rec.time;
      Object.keys(patch || {}).forEach(function (k) { if (k !== 'id') rec[k] = clone(patch[k]); });
      if (coll === 'visits') {
        if (patch && 'date' in patch) {   // a visit moved to another day: that day may be closed (or not)
          rec.closed = st.closedDays.indexOf(rec.date) >= 0;
          rec.closedReason = rec.closed ? (rec.closedReason || 'weather') : '';
        }
        if (patch && 'time' in patch && oldTime && rec.time !== oldTime) {   // the pizza is ready 1 hour after the visit time: it follows the visit unless the family chose its own time
          st.orders.forEach(function (o) {
            if (o.visitId === rec.id && o.pickup === Data.defaultPickup(oldTime)) {
              o.pickup = Data.defaultPickup(rec.time);
              noteTo(st, 'family', 'Your pizza pick-up moved to ' + Data.time12(o.pickup) + ', 1 hour after your visit.', '#pizza');
              noteTo(st, 'kitchen', 'Pick-up moved to ' + Data.time12(o.pickup) + ' because the visit moved.', '');
            }
          });
        }
      }
    }

    /* ---------------- the account ---------------- */
    function seed(st) {
      var n = now(), s = Data.sample(n.date, n.time);
      Object.keys(s).forEach(function (k) { st[k] = clone(s[k]); });
      st.flags = { sampleNote: true };
    }
    function accountOf(st) { return st.session ? (st.accounts.filter(function (a) { return a.email === st.session; })[0] || null) : null; }
    var normEmail = function (e) { return trim(e).toLowerCase(); };
    function createAccount(o) {
      if (o === undefined) o = Data.SAMPLE_ACCOUNT;   // no argument: the standard sample account (Alex)
      var name = trim(o && o.name), email = normEmail(o && o.email);
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
      return edit(function (st) {
        var have = st.accounts.filter(function (a) { return a.email === email; })[0];
        if (have) { st.session = have.email; return have; }
        var acct = { id: 'a1', name: name, email: email, created: stampNow() };
        st.accounts = [acct];          // one demo family per browser
        st.session = email;
        seed(st);
        st.family.name = name;
        return acct;
      });
    }
    function signIn(email) {
      email = normEmail(email);
      return edit(function (st) {
        var a = st.accounts.filter(function (x) { return x.email === email; })[0];
        if (!a) return undefined;
        st.session = a.email;
        return a;
      });
    }
    function signOut() { return edit(function (st) { st.session = null; return true; }); }
    function current() { return clone(accountOf(read())); }
    function hasAccount(email) { email = normEmail(email); return read().accounts.some(function (a) { return a.email === email; }); }
    function seedSample() { return edit(function (st) { var keep = st.family && st.family.name; seed(st); if (keep) st.family.name = keep; return true; }); }
    function reset() { io.remove(); cache = null; changed(); return true; }

    /* ---------------- lists and single objects ---------------- */
    function list(coll) {
      var st = read();
      if (coll === 'closedDays') return clone(st.closedDays);
      return LISTS[coll] ? clone(st[coll]) : [];
    }
    function get(coll, id) {
      var st = read();
      if (OBJECTS[coll]) return clone(st[coll]);
      if (coll === 'closedDays') return clone(st.closedDays);
      if (!LISTS[coll]) return null;
      return clone(find(st[coll], id)) || null;
    }
    function add(coll, obj) {
      if (!LISTS[coll]) return null;
      return edit(function (st) { return addRec(st, coll, obj); });
    }
    // update(coll, id, patch) for a list; update('family', null, patch) or update('family', patch) for family, alerts or badges. The patch is merged into the record.
    function update(coll, id, patch) {
      if (OBJECTS[coll]) {
        if (patch === undefined) patch = id;
        return edit(function (st) { Object.keys(patch || {}).forEach(function (k) { st[coll][k] = clone(patch[k]); }); return st[coll]; });
      }
      if (!LISTS[coll]) return null;
      return edit(function (st) {
        var rec = find(st[coll], id);
        if (!rec) return undefined;
        merge(st, coll, rec, patch);
        return rec;
      });
    }
    function remove(coll, id) {
      if (!LISTS[coll]) return false;
      return !!edit(function (st) {
        var i = -1; st[coll].forEach(function (r, k) { if (r.id === id) i = k; });
        if (i < 0) return undefined;
        st[coll].splice(i, 1);
        return true;
      });
    }
    function getFamily() { return get('family'); }
    function setFamily(patch) { return update('family', patch); }
    function setBadges(patch) { return update('badges', patch); }
    function flag(key) { return !!read().flags[key]; }
    function setFlag(key, on) { return edit(function (st) { st.flags[key] = !!on; return true; }); }

    /* ---------------- requests: ask, waiting, reply, (the family says OK), done ---------------- */
    function openRequestFor(coll, id) {
      var st = read();
      for (var i = 0; i < st.requests.length; i++) {
        var q = st.requests[i];
        if (q.target && q.target.coll === coll && q.target.id === id && (q.status === 'waiting' || q.status === 'suggested')) return clone(q);
      }
      return null;
    }
    function requestsFor(coll, id) {   // every request about one visit or order, oldest first
      return clone(read().requests.filter(function (q) { return q.target && q.target.coll === coll && q.target.id === id; }));
    }
    function openRequests(to) {        // the requests a side has to answer (status waiting), oldest first; no argument: both sides
      return clone(read().requests.filter(function (q) { return q.status === 'waiting' && (!to || q.to === to); }));
    }
    function linkFor(q) { return KIND_LINK[q.kind] || '#visits'; }
    function hist(q, w, text) { q.history.push({ at: stampNow(), who: w, text: text }); q.updated = stampNow(); }
    function ask(o) {
      o = o || {};
      if (!o.target || !o.target.coll || !LISTS[o.target.coll]) return null;
      return edit(function (st) {
        var coll = o.target.coll, id = o.target.id, rec = find(st[coll], id);
        if (!rec) return undefined;
        for (var i = 0; i < st.requests.length; i++) {   // only one open request per visit and per order
          var x = st.requests[i];
          if (x.target.coll === coll && x.target.id === id && (x.status === 'waiting' || x.status === 'suggested')) return undefined;
        }
        var to = SIDES[o.to] ? o.to : (o.kind === 'pizza-change' ? 'kitchen' : 'cathy'), patch = clone(o.patch) || {}, before = {};
        Object.keys(patch).forEach(function (k) { before[k] = clone(rec[k]); });
        var at = stampNow(), q = {
          id: nextId(st, 'requests'), kind: o.kind || 'visit-change', to: to, from: o.from || 'family', target: { coll: coll, id: id }, patch: patch, before: before,
          summary: trim(o.summary), note: trim(o.note), weather: !!o.weather, status: 'waiting', suggestion: null, reply: null, history: [], created: at, updated: at
        };
        hist(q, q.from, 'You asked ' + whoMid(to) + (q.summary ? ': ' + q.summary : ' for a change') + (q.summary && /[.!?]$/.test(q.summary) ? '' : '.') + (q.note ? ' Your note: ' + q.note : ''));
        st.requests.push(q);
        noteTo(st, to, 'New request: ' + (q.summary || q.kind) + (q.weather ? ' (the farm was closed that day)' : ''), '');
        return q;
      });
    }
    // reply(id, { answer: 'yes'|'no'|'suggest', note, suggestion: { patch, summary } }): yes applies the patch, no changes nothing, suggest keeps the suggestion
    function reply(id, r) {
      r = r || {};
      return edit(function (st) {
        var q = find(st.requests, id);
        if (!q || q.status !== 'waiting') return undefined;
        var name = who(q.to), note = trim(r.note), tail = note ? ' Note: ' + note : '', text;
        if (r.answer === 'yes') {
          var rec = find(st[q.target.coll] || [], q.target.id);
          if (rec) { merge(st, q.target.coll, rec, q.patch); if (q.target.coll === 'orders') rec.status = 'confirmed'; }
          q.status = 'yes'; text = name + ' said yes.' + tail;
        } else if (r.answer === 'no') {
          q.status = 'no'; text = name + ' said no. Nothing changed.' + tail;
        } else if (r.answer === 'suggest') {
          if (!r.suggestion || !r.suggestion.patch) return undefined;
          q.suggestion = { patch: clone(r.suggestion.patch), summary: trim(r.suggestion.summary) };
          q.status = 'suggested'; text = name + ' suggests something else' + (q.suggestion.summary ? ': ' + q.suggestion.summary : '') + (/[.!?]$/.test(q.suggestion.summary) ? '' : '.') + tail;
        } else return undefined;
        q.reply = { by: q.to, answer: r.answer, note: note, at: stampNow() };
        hist(q, q.to, text);
        noteTo(st, 'family', text, linkFor(q));
        return q;
      });
    }
    // respond(id, 'ok'|'decline'): the family answers a suggestion. ok applies the suggestion; decline keeps the visit or order as it was.
    function respond(id, how) {
      return edit(function (st) {
        var q = find(st.requests, id);
        if (!q || q.status !== 'suggested' || !q.suggestion) return undefined;
        if (how === 'ok') {
          var rec = find(st[q.target.coll] || [], q.target.id);
          if (rec) { merge(st, q.target.coll, rec, q.suggestion.patch); if (q.target.coll === 'orders') rec.status = 'confirmed'; }
          q.status = 'accepted'; hist(q, 'family', 'You said OK to the new plan.');
          noteTo(st, q.to, 'The family said OK to your new plan: ' + (q.suggestion.summary || q.summary), '');
        } else if (how === 'decline') {
          q.status = 'declined'; hist(q, 'family', 'You said no thanks and kept things as they were.');
          noteTo(st, q.to, 'The family said no thanks to your new plan.', '');
        } else return undefined;
        return q;
      });
    }
    function cancel(id) {
      return edit(function (st) {
        var q = find(st.requests, id);
        if (!q || (q.status !== 'waiting' && q.status !== 'suggested')) return undefined;
        q.status = 'cancelled'; hist(q, 'family', 'You cancelled your request.');
        noteTo(st, q.to, 'The family cancelled a request: ' + (q.summary || q.kind), '');
        return q;
      });
    }

    /* ---------------- messages and notices ---------------- */
    function post(threadId, from, text) {
      text = trim(text);
      if (!threadId || !text || (from !== 'family' && from !== 'cathy')) return null;
      return edit(function (st) {
        var m = addRec(st, 'messages', { thread: threadId, from: from, text: text, at: stampNow() });
        if (from === 'cathy') noteTo(st, 'family', 'Mrs. Cathy wrote: ' + short(text), /^event-/.test(threadId) ? '#event' : '#messages');
        else noteTo(st, 'cathy', 'New message from the family: ' + short(text), '');
        return m;
      });
    }
    function thread(threadId) { return clone(read().messages.filter(function (m) { return m.thread === threadId; })); }
    function threadsWaiting() {   // the threads whose last message is from the family (Mrs. Cathy has not answered yet)
      var last = {}, order = [];
      read().messages.forEach(function (m) { if (!last[m.thread]) order.push(m.thread); last[m.thread] = m; });
      return clone(order.filter(function (t) { return last[t].from === 'family'; }).map(function (t) { return { thread: t, last: last[t] }; }));
    }
    function notify(text, link, to) {
      if (!trim(text)) return null;
      return edit(function (st) { return noteTo(st, to || 'family', trim(text), link); });
    }
    function noticesFor(to) { return clone(read().notices.filter(function (n) { return n.to === (to || 'family'); }).reverse()); }   // newest first
    function markRead(id) { return edit(function (st) { var n = find(st.notices, id); if (!n) return undefined; n.read = true; return n; }); }
    function markAllRead(to) { return edit(function (st) { st.notices.forEach(function (n) { if (n.to === (to || 'family')) n.read = true; }); return true; }); }

    /* ---------------- weather ---------------- */
    function isClosed(date) { return read().closedDays.indexOf(date) >= 0; }
    // closeDay(date, reason): the farm is closed that day. Every visit that day is marked closed and the family gets a notice. reason: 'weather' (the default) or a few words.
    function closeDay(date, reason) {
      if (!Data.isDate(date)) return null;
      reason = trim(reason) || 'weather';
      return edit(function (st) {
        if (st.closedDays.indexOf(date) < 0) { st.closedDays.push(date); st.closedDays.sort(); }
        var n = 0;
        st.visits.forEach(function (v) {
          if (v.date !== date) return;
          v.closed = true; v.closedReason = reason; n++;
          noteTo(st, 'family', 'The farm is closed on ' + Data.dateLong(date) + ' because of ' + reason + '. Pick a new day for your visit.', '#visits');
        });
        return { date: date, reason: reason, visits: n };
      });
    }
    function openDay(date) {
      return edit(function (st) {
        var i = st.closedDays.indexOf(date);
        if (i < 0) return undefined;
        st.closedDays.splice(i, 1);
        var n = 0;
        st.visits.forEach(function (v) {
          if (v.date !== date || !v.closed) return;
          v.closed = false; v.closedReason = ''; n++;
          noteTo(st, 'family', 'Good news: the farm is open again on ' + Data.dateLong(date) + '. Your visit is on.', '#visits');
        });
        return { date: date, visits: n };
      });
    }
    function openDays(from, pkg, n) { return Data.openDays(from, pkg, n, read().closedDays); }

    /* ---------------- "Tell me when" ---------------- */
    function kindOf(key) { for (var i = 0; i < Data.alertKinds.length; i++) if (Data.alertKinds[i].key === key) return Data.alertKinds[i]; return null; }
    function setAlert(key, on) {
      if (!kindOf(key)) return null;
      return edit(function (st) { st.alerts[key] = !!on; return true; });
    }
    // -> { strawberries, blueberries, pumpkins, trees, spot, days: { 'YYYY-MM-DD': n } }: how many are waiting for each. One family here, so 0 or 1 for a switch.
    function alertCounts() {
      var st = read(), out = { days: {} };
      Data.alertKinds.forEach(function (k) { out[k.key] = k.key === 'spot' ? 0 : (st.alerts[k.key] ? 1 : 0); });
      st.waitlist.forEach(function (w) {
        if (w.active === false || w.notified || !st.alerts.spot) return;
        out.spot += 1;
        out.days[w.day] = (out.days[w.day] || 0) + 1;
      });
      return out;
    }
    // fireAlert(key[, day]): the farm sends the alert. Makes a notice for the family when they asked for it; returns true then, false when nobody was waiting.
    function fireAlert(key, day) {
      var kind = kindOf(key);
      if (!kind) return false;
      return !!edit(function (st) {
        if (key !== 'spot') {
          if (!st.alerts[key]) return undefined;
          noteTo(st, 'family', kind.notice, '#alerts');
          return true;
        }
        if (!st.alerts.spot) return undefined;
        var hit = st.waitlist.filter(function (w) { return w.active !== false && !w.notified && (!day || w.day === day); });
        if (!hit.length) return undefined;
        hit.forEach(function (w) { w.notified = true; noteTo(st, 'family', 'A spot opened on ' + Data.dateLong(w.day) + '.', '#alerts'); });
        return true;
      });
    }

    /* ---------------- reviews and photos (they wait for Mrs. Cathy) ---------------- */
    function submitReview(o) {
      o = o || {};
      var stars = Math.round(+o.stars);
      if (!(stars >= 1 && stars <= 5)) return null;
      return edit(function (st) {
        if (!find(st.visits, o.visitId)) return undefined;
        var r = addRec(st, 'reviews', { visitId: o.visitId, stars: stars, text: trim(o.text), photoName: trim(o.photoName), thumb: o.thumb || '', status: 'waiting', at: stampNow() });
        noteTo(st, 'cathy', 'A review is waiting for you (' + stars + ' stars).', '');
        return r;
      });
    }
    function decide(coll, id, ok, words) {
      return edit(function (st) {
        var r = find(st[coll], id);
        if (!r || r.status !== 'waiting') return undefined;
        r.status = ok ? 'approved' : 'declined';
        noteTo(st, 'family', ok ? 'Mrs. Cathy approved your ' + words + '. It shows under "Shared with the farm (demo)".' : 'Mrs. Cathy is not sharing your ' + words + ' right now.', '#photos');
        return r;
      });
    }
    function decideReview(id, ok) { return decide('reviews', id, ok, 'review'); }
    function submitPhoto(o) {
      o = o || {};
      return edit(function (st) {
        if (o.visitId && !find(st.visits, o.visitId)) return undefined;
        var p = addRec(st, 'photos', { visitId: o.visitId || '', name: trim(o.name), thumb: o.thumb || '', status: 'waiting', at: stampNow() });
        noteTo(st, 'cathy', 'A photo is waiting for you.', '');
        return p;
      });
    }
    function decidePhoto(id, ok) { return decide('photos', id, ok, 'photo'); }

    /* ---------------- subscribers, and other tabs ---------------- */
    function subscribe(fn) {
      subs.push(fn);
      return function () { subs = subs.filter(function (f) { return f !== fn; }); };
    }
    if (opts.listen && typeof window === 'object' && window && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) { cache = null; changed(); } });   // another tab changed the demo
    }

    return {
      createAccount: createAccount, signIn: signIn, signOut: signOut, current: current, hasAccount: hasAccount, reset: reset, seedSample: seedSample,
      list: list, get: get, add: add, update: update, remove: remove, getFamily: getFamily, setFamily: setFamily, setBadges: setBadges, flag: flag, setFlag: setFlag,
      ask: ask, reply: reply, respond: respond, cancel: cancel, openRequestFor: openRequestFor, requestsFor: requestsFor, openRequests: openRequests,
      post: post, thread: thread, threadsWaiting: threadsWaiting, notify: notify, noticesFor: noticesFor, markRead: markRead, markAllRead: markAllRead,
      closeDay: closeDay, openDay: openDay, isClosed: isClosed, openDays: openDays,
      setAlert: setAlert, alertCounts: alertCounts, fireAlert: fireAlert,
      submitReview: submitReview, decideReview: decideReview, submitPhoto: submitPhoto, decidePhoto: decidePhoto,
      subscribe: subscribe, now: now, today: function () { return now().date; }, snapshot: function () { return clone(read()); }, saveStatus: function () { return io.status(); }
    };
  }

  /* ------------------------------------------------------------------ *
   * The store of the page: made on first use, on the browser's localStorage (nothing is touched when this file only loads)
   * ------------------------------------------------------------------ */
  var api = { create: create, KEY: KEY };
  var theOne = null;
  function the() {
    if (!theOne) {
      var storage = null;
      try { storage = typeof window === 'object' && window ? window.localStorage : null; } catch (e) { storage = null; }   // blocked: memory
      theOne = create(storage, { listen: true });
    }
    return theOne;
  }
  Object.keys(create(null)).forEach(function (name) { api[name] = function () { var s = the(); return s[name].apply(s, arguments); }; });
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof window === 'object' && window) window.DemoStore = api;
})();
