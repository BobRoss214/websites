/* Wise Acres demo: Mrs. Cathy and Rob's desk (farm-desk.html).
 *
 * PRETEND. This screen reads and writes only the demo's own state in this browser (js/demo-store.js). Nothing is sent to anyone and nothing is
 * saved on a server. It stays asleep unless demo mode is on (WA_DEMO_MODE() in js/demo-header.js).
 *
 * What it shows (work-notes/ACCOUNT-DEMO-PLAN.md, "Farm desk"):
 *   Waiting for you      one card per open request or question: Yes / No / Suggest another day or time, with a note box
 *   Photos and reviews   Approve / Not now
 *   This week            who is coming each day (people, never a capacity), pizzas by pick-up time
 *   Weather              close or open a day; every family booked that day gets a notice
 *   People waiting       how many asked "tell me when", and a button that sends the alert
 *   Groups and schools   the family's event (a school trip, a party or another event, when the family has one) and its messages
 *
 * How it is built: render(state) draws the whole screen from the store's state, and the store calls it again whenever anything changes (also when
 * another tab changes it), so a request sent from the family's page arrives here by itself. Cards that did not change are kept as they are, so
 * a note being typed, and the keyboard focus, are not lost. Everything the screen needs to know about the SHAPE of the store's objects is in
 * section 3 ("Reading the store"); the rest does not look inside them.
 *
 * The pretend rush (js/demo-live.js, window.DemoLive): the box at the top, "Right now", holds the rush's own control strip (DemoLive.strip(), the same on the kitchen), the
 * counters (waiting for you, photos and reviews, answered today, people waiting) and a feed of the last things that happened ("just now: ..."). The families that the rush makes
 * are in the store's normal lists, marked live: true, with their name in `fam`; this screen reads them with the extra argument S.list(coll, { live: true }) and prints
 * `fam` where it used to print the signed-in family. Nothing here counts, remembers or invents what the rush did: the counters and the feed are read from the store (so every
 * tab and every reload agrees, and a fake clock in a test gives the same words), the order of the cards is the order they arrived in, and a card that is answered leaves the
 * waiting list at once (its result shows under "Answered", the focus goes to the next card). The list changes only when you answer, and new cards come at the bottom, so
 * what you are reading never moves under your finger. Without window.DemoLive the box has no strip and everything else works.
 */
(function () {
  'use strict';

  const doc = document, win = window;

  /* ------------------------------------------------------------------ *
   * 1. Small helpers
   * ------------------------------------------------------------------ */
  const arr = (v) => (Array.isArray(v) ? v : []);
  const str = (v) => (v == null ? '' : String(v));
  const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // Builds one element. a: attributes ("class", "text", "on<event>" and plain attributes; null/false are skipped). kids: text, nodes or lists of them.
  function el(tag, a, kids) {
    const e = doc.createElement(tag);
    if (a) {
      Object.keys(a).forEach((k) => {
        const v = a[k];
        if (v == null || v === false) return;
        if (k === 'class') e.className = v;
        else if (k === 'text') e.textContent = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      });
    }
    add(e, kids);
    return e;
  }
  function add(e, kids) {
    if (kids == null || kids === false) return;
    if (Array.isArray(kids)) kids.forEach((k) => add(e, k));
    else e.appendChild(kids.nodeType ? kids : doc.createTextNode(String(kids)));
  }

  // Small line drawings (24 x 24, drawn with the text colour). Never the only carrier of meaning: a word is always beside them.
  const ICONS = {
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    x: ['M6 6l12 12M18 6L6 18'],
    clock: ['c12,12,9', 'M12 7v5l3 2'],
    swap: ['M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4'],
    chat: ['M4 5h16v11H9l-5 4z'],
    star: ['M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 16.9l-5.2 2.9 1-5.9L3.5 9.7l5.9-.8z'],
    camera: ['M4 8h3l2-3h6l2 3h3v11H4z', 'c12,13,3.5'],
    cloud: ['M7.5 15.5a3.8 3.8 0 0 1-.3-7.6 5.2 5.2 0 0 1 9.9 1.1 3.3 3.3 0 0 1-.6 6.5z', 'M9 19l-.8 2M13 19l-.8 2M17 19l-.8 2'],
    bell: ['M6 17h12l-1.5-2v-4a4.5 4.5 0 0 0-9 0v4z', 'M10 20a2 2 0 0 0 4 0'],
    users: ['c9,8,3', 'M3.5 20c0-3.6 2.5-6 5.5-6s5.5 2.4 5.5 6', 'c17,9,2.4', 'M17 14c2.6 0 4.5 2 4.5 5.5'],
    calendar: ['M4 6h16v14H4z', 'M4 10.5h16M8 3.5v4M16 3.5v4'],
    pizza: ['M12 21L4 7a14 14 0 0 1 16 0z', 'c11,11,1', 'c14,8,1'],
    arrow: ['M5 12h14M13 6l6 6-6 6'],
    warn: ['M12 4l9 16H3z', 'M12 10v4M12 17v.5'],
    plus: ['M12 5v14M5 12h14'],
    pulse: ['M3 12h4l3-7 4 14 3-7h4']
  };
  function icon(name) {
    const NS = 'http://www.w3.org/2000/svg';
    const s = doc.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ds-ico' + (name === 'star' ? ' ds-ico-fill' : ''));
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.setAttribute('stroke-linejoin', 'round');
    (ICONS[name] || []).forEach((d) => {
      let p;
      if (d.charAt(0) === 'c' && d.charAt(1) !== ' ' && /^c[\d.]+,/.test(d)) {   // "cx,cy,r" is a circle
        const q = d.slice(1).split(',');
        p = doc.createElementNS(NS, 'circle');
        p.setAttribute('cx', q[0]); p.setAttribute('cy', q[1]); p.setAttribute('r', q[2]);
      } else {
        p = doc.createElementNS(NS, 'path');
        p.setAttribute('d', d);
      }
      s.appendChild(p);
    });
    return s;
  }
  const chip = (tone, text, ic) => el('span', { class: 'ds-chip ds-chip-' + tone }, [ic ? icon(ic) : null, text]);

  /* ------------------------------------------------------------------ *
   * 2. Dates and words  ("Saturday, Nov 14", "2:00 pm", dates are YYYY-MM-DD, times HH:MM on the farm's own clock)
   * ------------------------------------------------------------------ */
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const isYmd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(str(s));
  const utc = (s) => { const p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); };
  const two = (n) => (n < 10 ? '0' : '') + n;
  const ymdOf = (d) => d.getUTCFullYear() + '-' + two(d.getUTCMonth() + 1) + '-' + two(d.getUTCDate());
  const addDays = (s, n) => { const d = utc(s); d.setUTCDate(d.getUTCDate() + n); return ymdOf(d); };
  const dateLong = (s) => { if (!isYmd(s)) return str(s); const d = utc(s); return WEEKDAYS[d.getUTCDay()] + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
  const dateShort = (s) => { if (!isYmd(s)) return str(s); const d = utc(s); return WEEKDAYS[d.getUTCDay()].slice(0, 3) + ', ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate(); };
  function timeText(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(str(t));
    if (!m) return str(t);
    const h = +m[1], mi = m[2];
    return ((h % 12) || 12) + ':' + mi + (h < 12 ? ' am' : ' pm');
  }
  const mins = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(str(t)); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
  const when = (date, time) => dateLong(date) + (time ? ' at ' + timeText(time) : '');
  const possessive = (n) => n + (/s$/i.test(n) ? '’' : '’s');

  // The farm's own day and clock (Eastern Time), as every other page of the site reads it.
  let etFmt = null;
  function etParts(date) {
    const o = {};
    try {
      (etFmt || (etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })))
        .formatToParts(date).forEach((p) => { o[p.type] = p.value; });
    } catch (e) { return null; }
    return { ymd: o.year + '-' + o.month + '-' + o.day, time: o.hour + ':' + o.minute };
  }
  function farmToday() { const p = etParts(new Date()); return p ? p.ymd : ymdOf(new Date()); }
  // A stored moment: the farm's wall clock as 'YYYY-MM-DD HH:MM' (what the store writes), or an ISO text, or a number of milliseconds
  function wall(v) {
    if (v == null || v === '') return null;
    if (typeof v === 'string') {
      const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(v.trim());
      if (m) return { ymd: m[1], time: m[2] };
    }
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : etParts(d);
  }
  // "today at 2:15 pm" / "Mon, Nov 2 at 2:15 pm"
  function sentText(at, today) {
    const w = wall(at);
    return w ? (w.ymd === today ? 'today' : dateShort(w.ymd)) + ' at ' + timeText(w.time) : '';
  }
  // a number to sort moments by (minutes are enough)
  const stamp = (v) => { const w = wall(v); return w ? Date.UTC(+w.ymd.slice(0, 4), +w.ymd.slice(5, 7) - 1, +w.ymd.slice(8, 10), +w.time.slice(0, 2), +w.time.slice(3, 5)) : 0; };
  const dayOf = (v) => { const w = wall(v); return w ? w.ymd : ''; };
  // the number at the end of an id ("r12", "rL12", "q-L3" are 12, 12 and 3): ids of one list grow, so it breaks a tie between two moments in the same minute
  const idNum = (id) => { const m = /(\d+)$/.exec(str(id)); return m ? +m[1] : 0; };
  // a few words of a longer text, never cut in the middle of a word
  const shorten = (t, n) => { t = str(t).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '\u2026' : t; };

  /* ------------------------------------------------------------------ *
   * 3. Reading the store   (the ONLY part that knows what the objects look like)
   * ------------------------------------------------------------------ */
  function readState(S, D) {
    // { live: true }: the families of the pretend rush are in the same lists but the store hides them unless they are asked for (the family's own screens never see them)
    const list = (c) => { try { return arr(S.list(c, { live: true })); } catch (e) { return []; } };
    let account = null, family = null, counts = {}, alerts = {};
    try { account = S.current(); } catch (e) {}
    try { family = typeof S.get === 'function' ? S.get('family') : null; } catch (e) {}
    if (!family || typeof family !== 'object') { try { const f = S.list('family'); family = Array.isArray(f) ? (f[0] || null) : (f || null); } catch (e) { family = null; } }
    try { counts = S.alertCounts() || {}; } catch (e) {}
    try { alerts = (typeof S.get === 'function' && S.get('alerts')) || {}; } catch (e) {}
    const visits = list('visits');
    // closedDays is a list of days; the reason, if one was given, is kept on the visits of that day (closedReason)
    const closed = list('closedDays').map((c) => {
      const date = typeof c === 'string' ? c : str(c && c.date);
      const hit = visits.filter((v) => v.date === date && v.closedReason)[0];
      return { date, reason: str((c && c.reason) || (hit && hit.closedReason)) };
    });
    const today = (typeof S.today === 'function' && S.today()) || (D && typeof D.today === 'function' && D.today()) || farmToday();
    // the store's own clock (a test moves it): 'YYYY-MM-DD HH:MM'
    let nowAt = '';
    try { const n = typeof S.now === 'function' ? S.now() : null; if (n && n.date && n.time) nowAt = n.date + ' ' + n.time; } catch (e) {}
    if (!nowAt) { const p = etParts(new Date()); if (p) nowAt = p.ymd + ' ' + p.time; }
    return {
      today, nowAt, account, family, counts, alerts, closed, visits,
      orders: list('orders'), requests: list('requests'), messages: list('messages'),
      reviews: list('reviews'), photos: list('photos'), events: list('events'), waitlist: list('waitlist')
    };
  }
  const hasData = (st) => !!(st.visits.length || st.requests.length || st.events.length || st.orders.length || st.messages.length);

  // "Alex's family"
  function familyLabel(st) {
    const f = st.family || {}, a = st.account || {};
    const n = str(f.name || a.name).trim();
    if (!n) return 'The sample family';
    return /\s/.test(n) ? n : possessive(n) + ' family';
  }
  // The name to print for a record: the pretend rush's families carry their own (`fam`, "The Ortiz family"); everything else belongs to the signed-in family
  const famOf = (st, rec) => str(rec && rec.fam).trim() || familyLabel(st);
  const byId = (list, id) => list.filter((x) => x && x.id === id)[0] || null;
  const eventTitle = (e) => str(e && (e.title || e.name)) || 'The group trip';
  const visitOf = (st, r) => (r && r.target && r.target.coll === 'visits' ? byId(st.visits, r.target.id) : null);
  const eventOf = (st, r) => (r && r.target && r.target.coll === 'events' ? byId(st.events, r.target.id) : null);

  // How many people: the visit's own total, or adults + kids + babies in the shapes a visit may hold them
  function people(v) {
    if (!v) return 0;
    if (typeof v.people === 'number') return v.people;
    if (typeof v.total === 'number') return v.total;
    const n = (x) => (Array.isArray(x) ? x.length : num(x));
    const p = v.party && typeof v.party === 'object' ? v.party : v;
    return n(p.adults) + n(p.kids != null ? p.kids : p.children) + n(p.babies != null ? p.babies : p.infants);
  }
  const packageOf = (v) => (v && /pizza/i.test(str(v.package || v.pkg || v.kind)) ? 'pizza' : 'farm');
  const pizzaCount = (o) => arr(o && o.pizzas).reduce((n, p) => n + (num(p.count != null ? p.count : p.qty) || 1), 0);

  // Request: what it asks, the family's note, when it was sent, what kind it is
  const reqAsk = (r) => str(r.summary) || 'A change';
  const reqNote = (r) => str(r.note || r.familyNote || r.message).trim();
  const reqSent = (r) => (r.created != null ? r.created : r.at != null ? r.at : r.createdAt != null ? r.createdAt : (arr(r.history)[0] || {}).at);
  const reqHistory = (r) => arr(r.history).map((x) => ({ at: x && x.at, text: str(x && (x.text || x.sentence)) })).filter((x) => x.text);
  // The kinds the team agreed on (/tmp/helpers/KEYS.md): visit-change, event-change, pizza-change; a weather move is a visit-change with weather: true
  function kindOf(r) {
    const k = str(r.kind).toLowerCase();
    if (r.weather || (r.patch && r.patch.weather) || /weather/.test(k)) return 'weather';
    if (/event|group|head|school|trip/.test(k) || (r.target && r.target.coll === 'events')) return 'group';
    if (/pizza|order/.test(k) || (r.target && r.target.coll === 'orders')) return 'pizza';
    return 'visit';
  }
  const KIND_TEXT = { visit: ['sky', 'Change of day', 'calendar'], weather: ['sun', 'Weather move', 'cloud'], group: ['mint', 'Group trip', 'users'], pizza: ['pink', 'Pizza', 'pizza'] };
  const suggestionOf = (r) => (r.suggestion && typeof r.suggestion === 'object' ? r.suggestion : null);
  const answerNote = (r) => str((r.reply && r.reply.note) || r.replyNote || r.answerNote).trim();

  // Messages: { id, thread, from: 'family' | 'cathy', text, at }. Thread 'farm' is the family's general "Ask the farm"; 'event-<eventId>' is a group trip.
  function threadsOf(st) {
    const map = {}, order = [];
    st.messages.slice().sort((a, b) => stamp(a.at) - stamp(b.at)).forEach((m) => {
      const id = str(m.thread || m.threadId || 'farm');
      if (!map[id]) { map[id] = []; order.push(id); }
      map[id].push({ id: m.id, from: m.from === 'family' ? 'family' : 'cathy', text: str(m.text), at: m.at, fam: str(m.fam).trim() });
    });
    // since: when the family's latest run of messages began (where the card stands in the list, before and after the answer)
    return order.map((id) => {
      const m = map[id];
      let i = m.length - 1;
      while (i >= 0 && m[i].from !== 'family') i--;
      while (i > 0 && m[i - 1].from === 'family') i--;
      return { id, msgs: m, last: m[m.length - 1], since: stamp((m[Math.max(i, 0)] || m[0]).at), fam: (m.filter((x) => x.fam)[0] || {}).fam || '' };
    });
  }
  const eventThreadId = (e) => 'event-' + e.id;
  function threadEvent(st, id) { return st.events.filter((e) => eventThreadId(e) === id)[0] || null; }

  // Reviews and photos to look at
  function approvalItems(st) {
    const out = [];
    st.reviews.forEach((x) => out.push({ coll: 'reviews', x }));
    st.photos.forEach((x) => out.push({ coll: 'photos', x }));
    return out.map((it) => ({ coll: it.coll, id: it.x.id, status: str(it.x.status) || 'waiting', stars: num(it.x.stars), text: str(it.x.text).trim(), photoName: str(it.x.photoName || it.x.name || it.x.fileName), thumb: str(it.x.thumb || it.x.thumbnail || it.x.photo || it.x.dataUrl), visitId: it.x.visitId, at: it.x.at, decided: it.x.decided, fam: str(it.x.fam).trim() }));
  }

  // The "tell me when" switches, with the labels the family sees. Keys (agreed in /tmp/helpers/KEYS.md): strawberries, blueberries, pumpkins, trees, spot.
  // If DemoData lists them (alertKinds), its words win so the desk and the family screen always read the same.
  const ALERT_TEXT = {
    strawberries: 'Strawberries open', blueberries: 'Blueberries and sunflowers open', pumpkins: 'Pumpkins and tomatoes open',
    trees: 'Christmas trees arrive', spot: 'A spot opens on a full day'
  };
  const ALERT_ORDER = ['strawberries', 'blueberries', 'pumpkins', 'trees', 'spot'];
  function alertKinds(D) {
    const k = D && (D.alertKinds || D.ALERT_KINDS);
    if (Array.isArray(k)) return k.map((a) => ({ key: str(a.key || a.id), label: str(a.label || a.title || a.text) })).filter((a) => a.key);
    if (k && typeof k === 'object') return Object.keys(k).map((key) => ({ key, label: str(typeof k[key] === 'string' ? k[key] : (k[key] && (k[key].label || k[key].title)) || '') }));
    return ALERT_ORDER.map((key) => ({ key, label: ALERT_TEXT[key] }));
  }
  const alertLabel = (key, D) => {
    const hit = alertKinds(D).filter((a) => a.key === key)[0];
    return (hit && hit.label) || ALERT_TEXT[key] || key.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase());
  };
  const countOf = (v) => (typeof v === 'boolean' ? (v ? 1 : 0) : v && typeof v === 'object' ? num(v.count != null ? v.count : v.n) : num(v));
  // The day waitlist: { id, day (or date), party, active }. A switched-off entry stays in the list with active: false.
  const waitDay = (w) => str(w.day || w.date);
  const waitActive = (w) => w.active !== false;

  // A trip's head count: students, and the guests who come with them (parents and siblings 3 and up). The store's field is `guests`; the sentence says
  // "chaperones", as the family's own request does.
  const guestsOf = (e) => num(e && (e.guests != null ? e.guests : e.chaperones));
  // (a party or another event has guests only, with no `students` at all: then it is "24 guests")
  const headText = (students, guests) => (students == null ? plural(num(guests), 'guest', 'guests') : plural(num(students), 'student', 'students') + ' and ' + plural(num(guests), 'chaperone', 'chaperones'));
  function slipsText(e) {
    if (e.slipsReceived != null) return num(e.slipsReceived) + ' of ' + num(e.students) + ' received (sample)';
    const s = e.slips || e.permissionSlips;
    return s && typeof s === 'object' ? num(s.received != null ? s.received : s.got) + ' of ' + num(s.total != null ? s.total : s.of) + ' received (sample)' : '';
  }
  const money = (n) => '$' + (Math.round(n * 100) % 100 ? n.toFixed(2) : String(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // The pizza ordered for a visit, per day and pick-up time
  function orderDate(st, o) { const v = o.visitId ? byId(st.visits, o.visitId) : null; return v ? v.date : str(o.date); }

  /* ------------------------------------------------------------------ *
   * 4. Keeping cards that did not change
   * ------------------------------------------------------------------ */
  // items: [{ key, sig, make() }]. A child with the same key and the same sig stays as it is (so typing and focus survive); the others are made again.
  function sync(parent, items) {
    const have = {};
    Array.prototype.forEach.call(parent.children, (c) => { have[c.getAttribute('data-key')] = c; });
    const nodes = items.map((it) => {
      let n = have[it.key];
      if (!n || n.getAttribute('data-sig') !== it.sig) {
        n = it.make();
        n.setAttribute('data-key', it.key);
        n.setAttribute('data-sig', it.sig);
      }
      return n;
    });
    Array.prototype.slice.call(parent.children).forEach((c) => { if (nodes.indexOf(c) < 0) parent.removeChild(c); });
    nodes.forEach((n, i) => { if (parent.children[i] !== n) parent.insertBefore(n, parent.children[i] || null); });
  }

  /* ------------------------------------------------------------------ *
   * 5. The screen
   * ------------------------------------------------------------------ */
  function mount(root, S, D) {
    if (!root || !S) return null;
    // What the person is doing right now (not saved anywhere): open panels, typed words, the order the cards came in, the lines of the feed.
    // order: the number each waiting card got when this screen first saw it (the cards stay in that order, new ones go last); waitKeys / apprKeys: the cards on the screen now, in order;
    // feed: the lines of "Just now" (newest has the biggest seq); feedSeen: the lines already taken; pending: the new cards the person may not have seen yet (the "new" button);
    // fresh: the moment (ms) a card arrived while this screen was open, for its New mark.
    const ui = { mode: {}, val: {}, fresh: {}, seen: null, focus: '', alertSent: {}, status: {}, why: {}, order: {}, seq: 0, waitKeys: [], apprKeys: [], feed: [], feedSeen: {}, feedSeq: 0, pending: [], waitTotal: 0, drawn: false };
    let st = null, nowStamp = 0, timer = 0;
    // The numbers that keep the screen calm and short: no more cards than this are drawn (the rest are counted and said), the feed shows a few lines, a day of "This week"
    // lists a few visits, and a New mark (on a card, on a line of the feed) fades after this many milliseconds.
    const MAX_WAITING = 24, MAX_ANSWERED = 6, MAX_FEED = 6, MAX_DAY_LINES = 5, FRESH_CARD_MS = 30000, FRESH_LINE_MS = 6000;
    const liveApi = () => { const L = window.DemoLive; return L && typeof L === 'object' ? L : null; };   // the pretend rush's engine, when the page has it
    const liveOn = () => { const L = liveApi(); try { return !!(L && typeof L.isOn === 'function' && L.isOn()); } catch (e) { return false; } };
    const baseTitle = doc.title;
    // The engine keeps a count of the answers given on this desk (DemoLive.tally) that does not shrink when it tidies old pretend records away; "Answered today" is never less than it.
    const tallied = () => { const L = liveApi(); try { return L && typeof L.tallies === 'function' ? num((L.tallies() || {}).desk) : 0; } catch (e) { return 0; } };
    const countAnswer = () => { const L = liveApi(); try { if (L && typeof L.tally === 'function') L.tally('desk'); } catch (e) { /* the count is only a help */ } };

    root.textContent = '';
    root.classList.add('ds');

    const live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    const say = (t) => { live.textContent = ''; live.textContent = t; };
    // Arrivals are said in a place of their own and in batches (at most one message every 4 seconds: "New: ..." or "3 new: ... and 2 more"), so a busy rush never floods a screen reader
    // and never talks over what the person's own answer just said.
    const liveNew = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    let said = [], saidAt = 0, saidTimer = 0;
    function flushSaid() {
      saidTimer = 0;
      if (!said.length) return;
      const q = said; said = []; saidAt = Date.now();
      liveNew.textContent = '';
      liveNew.textContent = q.length === 1 ? 'New: ' + q[0] : q.length + ' new: ' + q[0] + ' and ' + (q.length - 1) + ' more.';
    }
    function sayNew(t) {
      said.push(t);
      if (!saidTimer) saidTimer = setTimeout(flushSaid, Math.max(0, 4000 - (Date.now() - saidAt)));
    }

    // ----- the frame (built once; the parts inside are redrawn as needed)
    const parts = {};
    const intro = el('p', { class: 'ds-who' }, [icon('bell'), el('span', null, [el('strong', { text: 'Demo: you are Mrs. Cathy (or Rob).' }), ' No sign-in is needed on this screen. Whatever a family sends shows up below by itself.'])]);
    // "Right now": the rush's control strip, the counters (the tiles: they are links to the sections below, and "Answered today"), and the feed. The strip is the engine's own
    // (DemoLive.strip(), the same on the kitchen screen); a page without the engine has no strip. Every part is drawn again from the store whenever it changes.
    parts.live = el('section', { class: 'ds-live', 'data-tour': 'desk-live', 'aria-labelledby': 'ds-live-h' });
    parts.clock = el('span', { class: 'ds-clock', 'aria-hidden': 'true' });
    parts.strip = el('div', { class: 'ds-live-strip' });
    parts.tiles = el('ul', { class: 'ds-tiles', 'aria-label': 'Where to look first' });
    parts.feedHead = el('h3', { class: 'ds-sub ds-feed-h' }, [icon('pulse'), 'Just now']);
    parts.feed = el('ol', { class: 'ds-feed', 'aria-label': 'Just now' });
    parts.feedEmpty = el('p', { class: 'ds-empty ds-feed-empty', text: 'Nothing has happened yet. Start the pretend rush to see a busy day, or send a request from the family page.' });
    parts.live.appendChild(el('div', { class: 'ds-live-head' }, [el('h2', { id: 'ds-live-h', tabindex: '-1', text: 'Right now' }), parts.clock]));
    [parts.strip, parts.tiles, parts.feedHead, parts.feedEmpty, parts.feed].forEach((n) => parts.live.appendChild(n));
    // a small button that says new cards came in below the part of the page that is on the screen
    parts.pill = el('button', { type: 'button', class: 'ds-pill', hidden: '', onclick: () => showNewest() });
    const section = (id, tour, title, help, extra) => {
      const hid = id + '-h';
      const head = el('h2', { id: hid, tabindex: '-1' }, [title, extra || null]);
      const body = el('div', { class: 'ds-body' });
      const sec = el('section', { class: 'ds-section', id, 'data-tour': tour, 'aria-labelledby': hid }, [head, help ? el('p', { class: 'ds-help', text: help }) : null, body]);
      return { sec, head, body };
    };
    const badge = () => el('span', { class: 'ds-badge' });
    parts.waiting = section('desk-waiting', 'desk-waiting', 'Waiting for you', 'A family asked for something. Answer with a tap. They see your answer right away.', null);
    parts.waitingBadge = badge();
    parts.waiting.head.appendChild(doc.createTextNode(' '));
    parts.waiting.head.appendChild(parts.waitingBadge);
    parts.waitingList = el('div', { class: 'ds-stack', 'aria-live': 'off' });
    parts.answeredHead = el('h3', { class: 'ds-sub', text: 'Answered' });
    parts.answeredList = el('div', { class: 'ds-stack ds-stack-tight' });
    parts.kitchenNote = el('p', { class: 'ds-kitchen-note', hidden: '' });
    parts.waiting.body.appendChild(el('p', { class: 'ds-empty', 'data-for': 'waiting', 'data-focus': 'empty:waiting', tabindex: '-1', hidden: '' }));
    parts.waiting.body.appendChild(parts.waitingList);
    parts.moreWaiting = el('p', { class: 'ds-more', hidden: '' });
    parts.waiting.body.appendChild(parts.moreWaiting);
    parts.waiting.body.appendChild(parts.kitchenNote);
    parts.waiting.body.appendChild(parts.answeredHead);
    parts.waiting.body.appendChild(parts.answeredList);

    parts.approvals = section('desk-approvals', 'desk-approvals', 'Photos and reviews', 'Families can send a photo and a few words after a visit. Nothing shows to the family as shared until you approve it. Demo: this never touches the real photo gallery or the real reviews.', null);
    parts.approvalsBadge = badge();
    parts.approvals.head.appendChild(doc.createTextNode(' '));
    parts.approvals.head.appendChild(parts.approvalsBadge);
    parts.approvalsList = el('div', { class: 'ds-stack' });
    parts.approvalsDone = el('div', { class: 'ds-stack ds-stack-tight' });
    parts.approvals.body.appendChild(el('p', { class: 'ds-empty', 'data-for': 'approvals', hidden: '' }));
    parts.approvals.body.appendChild(parts.approvalsList);
    parts.approvals.body.appendChild(parts.approvalsDone);

    parts.week = section('desk-week', 'desk-week', 'This week', 'Who is coming, day by day. These are people counted, not room left. Pizzas are counted by pick-up time.', null);
    parts.weekList = el('ol', { class: 'ds-days' });
    parts.week.body.appendChild(parts.weekList);

    parts.weather = section('desk-weather', 'desk-weather', 'Weather', 'If the weather is bad, close a day. Every family booked that day gets a notice, and can pick a new day with one tap.', null);
    parts.weatherForm = el('div', { class: 'ds-weather' });
    parts.weatherClosed = el('div', { class: 'ds-closed' });
    parts.weather.body.appendChild(parts.weatherForm);
    parts.weather.body.appendChild(parts.weatherClosed);

    parts.people = section('desk-people', 'desk-people', 'People waiting for news', 'Families who asked to be told. The button sends them a notice (pretend: nothing leaves this browser).', null);
    parts.peopleList = el('ul', { class: 'ds-people' });
    parts.people.body.appendChild(parts.peopleList);

    parts.groups = section('desk-groups', 'desk-groups', 'Groups and schools', 'School trips and parties. A change in the head count shows up under "Waiting for you".', null);
    parts.groupsList = el('div', { class: 'ds-stack' });
    parts.groups.body.appendChild(parts.groupsList);

    parts.empty = el('div', { class: 'ds-card ds-nodata', hidden: '' }, [
      el('h2', { text: 'No family has signed up in this browser yet' }),
      el('p', { text: 'Open the family page and make an account. That loads a sample family with a visit and a pizza order. Say yes to the question about a party, an event or a school trip to get one of those too. Then come back here.' }),
      el('a', { class: 'btn btn-red btn-lg', href: 'account.html' }, ['Open the family page ', icon('arrow')])
    ]);

    // the page's one h1 (the shell keeps its own h1 inside the box that is hidden in demo mode)
    root.appendChild(el('div', { class: 'ds-head' }, [el('h1', { class: 'demo-h1', id: 'desk-h1', tabindex: '-1', text: 'Mrs. Cathy and Rob\u2019s desk' }), intro]));
    root.appendChild(live);
    root.appendChild(liveNew);
    root.appendChild(parts.live);
    root.appendChild(parts.empty);
    const main = el('div', { class: 'ds-main' }, [parts.waiting.sec, parts.approvals.sec, parts.week.sec, parts.weather.sec, parts.people.sec, parts.groups.sec]);
    root.appendChild(main);
    root.appendChild(parts.pill);

    // ----- little builders used by several cards
    const field = (id, label, control, hint) => el('div', { class: 'ds-field' }, [el('label', { for: id, text: label }), control, hint ? el('p', { class: 'ds-hint', text: hint }) : null]);
    function textBox(id, key, rows) {
      const t = el('textarea', { id, class: 'ds-text', rows: rows || 2, 'data-focus': id });
      t.value = ui.val[key] || '';
      t.addEventListener('input', () => { ui.val[key] = t.value; });
      return t;
    }
    function select(id, key, options, current, onchange) {
      const s = el('select', { id, class: 'ds-select', 'data-focus': id });
      options.forEach((o) => s.appendChild(el('option', { value: o[0], text: o[1] })));
      s.value = options.some((o) => o[0] === current) ? current : (options[0] ? options[0][0] : '');
      ui.val[key] = s.value;
      s.addEventListener('change', () => { ui.val[key] = s.value; if (onchange) onchange(); });
      return s;
    }
    function bigBtn(cls, label, ic, on, extra) {
      return el('button', Object.assign({ type: 'button', class: 'btn ds-big ' + cls, onclick: on }, extra || {}), [ic ? icon(ic) : null, label]);
    }
    const stars = (n) => {
      const w = el('span', { class: 'ds-stars', role: 'img', 'aria-label': n + ' of 5 stars' });
      for (let i = 1; i <= 5; i++) w.appendChild(el('span', { class: 'ds-star' + (i <= n ? ' on' : '') }, [icon('star')]));
      return w;
    };
    const quote = (who, text) => (text ? el('blockquote', { class: 'ds-quote' }, [el('span', { class: 'ds-quote-who', text: who }), el('p', { text: '“' + text + '”' })]) : null);
    const rerender = (focus) => { if (focus) ui.focus = focus; render(); };

    // The next open days for a package ('farm' = Thursday to Sunday, 'pizza' = Friday to Sunday), without the days already closed.
    // A's store has openDays(from, pkg, n); DemoData's own takes the closed days as a fourth word.
    function openDaysFor(from, pkg, n) {
      try {
        if (typeof S.openDays === 'function') return arr(S.openDays(from, pkg, n));
        if (D && typeof D.openDays === 'function') return arr(D.openDays(from, pkg, n, st.closed.map((c) => c.date)));
      } catch (e) {}
      return [];
    }
    // Is this date a day of the week the farm opens (closed or not)?
    function isFarmDay(ymd) {
      try { if (D && typeof D.openDays === 'function') return arr(D.openDays(ymd, 'farm', 1))[0] === ymd; } catch (e) {}
      const dow = utc(ymd).getUTCDay();
      return dow === 0 || dow >= 4;
    }
    const sampleSlots = () => { const sl = D && (D.SLOTS || D.slots); return arr(sl).length ? sl : ['10:00', '11:00', '12:00', '13:00', '14:00']; };

    // Who a request is from: the school for a group trip, the family otherwise (a family of the pretend rush has its own name)
    const whoOf = (r) => { if (kindOf(r) === 'group') { const e = eventOf(st, r); if (e) return eventTitle(e); } return famOf(st, r); };

    // Where the keyboard focus goes when a card leaves its list because it was answered: the next card, or the one before when it was the last, else the "nothing is waiting" line.
    // (The card is not kept where it was: its result is under "Answered" and in the feed, so the list holds only what still needs an answer.)
    const focusAfter = (key, keys, empty) => { const i = keys.indexOf(key), next = keys[i + 1] || keys[i - 1] || ''; return next ? 'card:' + next : 'empty:' + empty; };

    // ----- the answer to a request
    function answer(r, how, suggestion) {
      const note = (ui.val['note:' + r.id] || '').trim();
      ui.mode[r.id] = '';
      ui.focus = focusAfter('r:' + r.id, ui.waitKeys, 'waiting');
      const body = { answer: how, note };
      if (how === 'suggest') body.suggestion = suggestion;
      const res = S.reply(r.id, body);
      if (res === null || res === false) {   // the store would not take it: somebody (another tab) answered or took it back first
        ui.focus = '';
        say('This one was already answered or taken back. The screen shows how it stands now.');
        render();
        return;
      }
      delete ui.val['note:' + r.id];
      countAnswer();
      say(how === 'yes' ? 'Sent: you said Yes to ' + whoOf(r) + '.' : how === 'no' ? 'Sent: you said No to ' + whoOf(r) + '.' : 'Sent: you suggested ' + (suggestion && suggestion.summary) + '.');
    }

    // The suggestion panel: for a visit, a day and a time; for a group, head counts; otherwise only words.
    function suggestPanel(r, kind, target) {
      const id = 'sg-' + r.id;
      const box = el('fieldset', { class: 'ds-suggest' }, [el('legend', { text: kind === 'group' ? 'Suggest other numbers' : 'Suggest another day or time' })]);
      let build = null;
      if (kind === 'visit' || kind === 'weather') {
        const pkg = packageOf(target);
        const askedDate = str((r.patch || {}).date) || (target && target.date) || st.today;
        const askedTime = str((r.patch || {}).time) || (target && target.time) || '';
        let days = openDaysFor(st.today, pkg, 10);
        if (!days.length) days = [askedDate];
        if (days.indexOf(askedDate) < 0 && askedDate >= st.today && !st.closed.some((c) => c.date === askedDate)) days = days.concat([askedDate]).sort();
        const slots = sampleSlots();
        const dayOpts = days.map((d) => [d, dateLong(d)]);
        const timeOpts = slots.map((t) => [t, timeText(t)]);
        box.appendChild(el('div', { class: 'ds-row2' }, [
          field(id + '-day', 'Day', select(id + '-day', 'sgday:' + r.id, dayOpts, ui.val['sgday:' + r.id] || askedDate)),
          field(id + '-time', 'Time', select(id + '-time', 'sgtime:' + r.id, timeOpts, ui.val['sgtime:' + r.id] || askedTime), 'Sample times')
        ]));
        build = () => {
          const day = ui.val['sgday:' + r.id], time = ui.val['sgtime:' + r.id];
          return { patch: { date: day, time }, summary: when(day, time) };
        };
      } else if (kind === 'group') {
        const p = r.patch || {}, ev = target || {}, guestsOnly = ev.students == null && p.students == null;   // a party or another event has guests only
        box.appendChild(el('div', { class: 'ds-row2' }, [
          guestsOnly ? null : field(id + '-st', 'Students', el('input', { id: id + '-st', class: 'ds-select', type: 'number', min: '0', inputmode: 'numeric', value: str(ui.val['sgst:' + r.id] != null ? ui.val['sgst:' + r.id] : (p.students != null ? p.students : ev.students)), 'data-focus': id + '-st', oninput: (e) => { ui.val['sgst:' + r.id] = e.target.value; } })),
          field(id + '-ch', guestsOnly ? 'Guests' : 'Chaperones', el('input', { id: id + '-ch', class: 'ds-select', type: 'number', min: '0', inputmode: 'numeric', value: str(ui.val['sgch:' + r.id] != null ? ui.val['sgch:' + r.id] : (p.guests != null ? p.guests : p.chaperones != null ? p.chaperones : guestsOf(ev))), 'data-focus': id + '-ch', oninput: (e) => { ui.val['sgch:' + r.id] = e.target.value; } }))
        ]));
        build = () => {
          const s = num(ui.val['sgst:' + r.id] != null ? ui.val['sgst:' + r.id] : (p.students != null ? p.students : ev.students));
          const c = num(ui.val['sgch:' + r.id] != null ? ui.val['sgch:' + r.id] : (p.guests != null ? p.guests : p.chaperones != null ? p.chaperones : guestsOf(ev)));
          return guestsOnly ? { patch: { guests: c }, summary: headText(null, c) } : { patch: { students: s, guests: c }, summary: headText(s, c) };
        };
      } else {
        box.appendChild(field(id + '-w', 'What do you suggest?', el('input', { id: id + '-w', class: 'ds-select', type: 'text', value: str(ui.val['sgw:' + r.id] || ''), 'data-focus': id + '-w', oninput: (e) => { ui.val['sgw:' + r.id] = e.target.value; } })));
        build = () => ({ patch: {}, summary: str(ui.val['sgw:' + r.id]).trim() || 'Another way' });
      }
      box.appendChild(el('div', { class: 'ds-actions' }, [
        bigBtn('btn-green', 'Send my suggestion', 'check', () => answer(r, 'suggest', build()), { 'data-focus': 'send-' + id }),
        bigBtn('btn-white', 'Never mind', null, () => { ui.mode[r.id] = ''; rerender('sgbtn:' + r.id); })
      ]));
      return box;
    }

    function requestCard(r) {
      const kind = kindOf(r);
      const target = kind === 'group' ? eventOf(st, r) : visitOf(st, r);
      const open = r.status === 'waiting';
      const hid = 'ds-h-' + r.id;
      const tone = KIND_TEXT[kind] || KIND_TEXT.visit;
      const sentAt = sentText(reqSent(r), st.today);
      const note = reqNote(r);
      const card = el('article', { class: 'ds-card ds-req ds-s-' + (r.status || 'waiting') + (ui.fresh['r:' + r.id] && open ? ' is-new' : ''), 'aria-labelledby': hid, 'data-tour': 'desk-card', 'data-req-kind': str(r.kind) });
      card.appendChild(el('div', { class: 'ds-card-top' }, [
        chip(tone[0], tone[1], tone[2]),
        ui.fresh['r:' + r.id] && open ? chip('new', 'New') : null,
        sentAt ? el('span', { class: 'ds-sent', text: 'Sent ' + sentAt }) : null
      ]));
      card.appendChild(el('h3', { id: hid, tabindex: '-1', 'data-focus': 'card:r:' + r.id, text: whoOf(r) }));
      card.appendChild(el('p', { class: 'ds-ask', text: reqAsk(r) }));
      add(card, quote('Their note', note));
      if (target && kind !== 'group') {
        card.appendChild(el('p', { class: 'ds-context' }, [icon('calendar'), 'Booked now: ' + when(target.date, target.time) + ' · ' + plural(people(target), 'person', 'people') + (packageOf(target) === 'pizza' ? ' · with pizza' : '') + (target.closed ? ' · farm closed that day' : '')]));
      } else if (target && kind === 'group') {
        card.appendChild(el('p', { class: 'ds-context' }, [icon('users'), 'Booked now: ' + headText(target.students, guestsOf(target))]));
      }

      if (open) {
        card.appendChild(field('note-' + r.id, 'Note for the family (you do not have to write one)', textBox('note-' + r.id, 'note:' + r.id, 2)));
        const lab = (b) => b.setAttribute('aria-describedby', hid);
        const yes = bigBtn('btn-green', 'Yes', 'check', () => answer(r, 'yes'), { 'data-tour': 'desk-yes', 'data-focus': 'yes:' + r.id });
        const no = bigBtn('btn-white', 'No', 'x', () => answer(r, 'no'), { 'data-tour': 'desk-no', 'data-focus': 'no:' + r.id });
        const sg = bigBtn('btn-sun', kind === 'group' ? 'Suggest other numbers' : kind === 'visit' || kind === 'weather' ? 'Suggest another day or time' : 'Suggest something else', 'swap',
          () => { ui.mode[r.id] = ui.mode[r.id] === 'suggest' ? '' : 'suggest'; rerender(ui.mode[r.id] ? 'sg-' + r.id + (kind === 'group' ? '-st' : kind === 'other' ? '-w' : '-day') : 'sgbtn:' + r.id); },
          { 'data-tour': 'desk-suggest', 'data-focus': 'sgbtn:' + r.id, 'aria-expanded': ui.mode[r.id] === 'suggest' ? 'true' : 'false' });
        [yes, no, sg].forEach(lab);
        card.appendChild(el('div', { class: 'ds-actions' }, [yes, no, sg]));
        if (ui.mode[r.id] === 'suggest') card.appendChild(suggestPanel(r, kind, target));
      } else {
        card.appendChild(resultBlock(r, kind, target));
      }
      const hist = reqHistory(r);
      if (hist.length > 1) {
        card.appendChild(el('details', { class: 'ds-hist' }, [
          el('summary', { text: 'What happened, step by step' }),
          el('ol', null, hist.map((x) => el('li', null, [el('span', { class: 'ds-hist-at', text: sentText(x.at, st.today) }), x.text])))
        ]));
      }
      return card;
    }

    // What happened to a request that is no longer waiting for Mrs. Cathy
    function resultBlock(r, kind, target) {
      const sg = suggestionOf(r);
      const n = answerNote(r);
      const now = kind === 'group' ? (target ? 'The head count is now ' + headText(target.students, guestsOf(target)) + '.' : '')
        : target ? (r.status === 'no' || r.status === 'declined' ? 'Their visit stays ' : 'Their visit is now ') + when(target.date, target.time) + '.' : '';
      let tone = 'plain', ic = 'check', title = '', lines = [];
      switch (r.status) {
        case 'yes': tone = 'good'; title = 'You said Yes.'; lines = [n ? 'Your note: “' + n + '”' : '', now]; break;
        case 'no': tone = 'no'; ic = 'x'; title = 'You said No.'; lines = [n ? 'Your note: “' + n + '”' : '', now]; break;
        case 'suggested': tone = 'wait'; ic = 'clock'; title = 'You suggested ' + (sg ? str(sg.summary) : 'something else') + '.'; lines = [n ? 'Your note: “' + n + '”' : '', 'Waiting for the family’s OK.']; break;
        case 'accepted': tone = 'good'; title = 'The family said OK to your suggestion.'; lines = [now]; break;
        case 'declined': tone = 'plain'; ic = 'x'; title = 'The family said no thanks, and keeps what they had.'; lines = [now]; break;
        case 'cancelled': tone = 'plain'; ic = 'x'; title = 'The family took this request back.'; break;
        default: title = str(r.status);
      }
      return el('div', { class: 'ds-result ds-result-' + tone, tabindex: '-1', 'data-focus': 'res:' + r.id }, [
        el('p', { class: 'ds-result-title' }, [icon(ic), title]),
        lines.filter(Boolean).map((t) => el('p', { class: 'ds-result-line', text: t }))
      ]);
    }

    // ----- a question from a family (or a school)
    function messageCard(t) {
      const ev = threadEvent(st, t.id);
      const who = ev ? str(ev.title || ev.name) : (t.fam || familyLabel(st));
      const hid = 'ds-h-t-' + t.id;
      const open = t.last.from === 'family';
      const card = el('article', { class: 'ds-card ds-msg ds-s-' + (open ? 'waiting' : 'yes') + (ui.fresh['t:' + t.id] && open ? ' is-new' : ''), 'aria-labelledby': hid, 'data-tour': 'desk-card' });
      const sentAt = sentText(t.last.at, st.today);
      card.appendChild(el('div', { class: 'ds-card-top' }, [chip('pink', 'Question', 'chat'), ui.fresh['t:' + t.id] && open ? chip('new', 'New') : null, sentAt ? el('span', { class: 'ds-sent', text: (open ? 'Sent ' : 'You wrote ') + sentAt }) : null]));
      card.appendChild(el('h3', { id: hid, tabindex: '-1', 'data-focus': 'card:t:' + t.id, text: ev ? who + ' wrote to you' : who + ' asks the farm' }));
      const chat = el('ol', { class: 'ds-chat', 'aria-label': 'Messages' });
      t.msgs.slice(-4).forEach((m) => chat.appendChild(el('li', { class: 'ds-bubble ds-from-' + m.from }, [el('span', { class: 'ds-bubble-who', text: m.from === 'family' ? (ev ? 'They wrote' : 'They wrote') : 'You wrote' }), el('p', { text: m.text })])));
      card.appendChild(chat);
      if (open) {
        card.appendChild(field('reply-' + t.id, 'Your reply', textBox('reply-' + t.id, 'reply:' + t.id, 3)));
        card.appendChild(el('div', { class: 'ds-actions' }, [
          bigBtn('btn-green', 'Send reply', 'check', () => {
            const text = (ui.val['reply:' + t.id] || '').trim();
            if (!text) { say('Write a few words first.'); const box = doc.getElementById('reply-' + t.id); if (box) box.focus(); return; }
            ui.focus = focusAfter('t:' + t.id, ui.waitKeys, 'waiting'); delete ui.val['reply:' + t.id];
            S.post(t.id, 'cathy', text);
            countAnswer();
            say('Sent: your reply to ' + who + '.');
          }, { 'aria-describedby': hid, 'data-focus': 'send-t:' + t.id })
        ]));
      } else {
        card.appendChild(el('div', { class: 'ds-result ds-result-good', tabindex: '-1', 'data-focus': 'res:t:' + t.id }, [el('p', { class: 'ds-result-title' }, [icon('check'), 'Your reply was sent.'])]));
      }
      return card;
    }

    // ----- a photo or review to approve
    function approvalCard(it) {
      const hid = 'ds-h-a-' + it.coll + it.id;
      const v = it.visitId ? byId(st.visits, it.visitId) : null;
      const open = it.status === 'waiting';
      const isReview = it.coll === 'reviews' && (it.stars || it.text);
      const isNew = open && !!ui.fresh[it.coll + it.id];
      const card = el('article', { class: 'ds-card ds-appr ds-s-' + (open ? 'waiting' : it.status === 'approved' ? 'yes' : 'no') + (isNew ? ' is-new' : ''), 'aria-labelledby': hid });
      card.appendChild(el('div', { class: 'ds-card-top' }, [chip('pink', isReview ? 'Review' : 'Photo', isReview ? 'star' : 'camera'), isNew ? chip('new', 'New') : null, it.at ? el('span', { class: 'ds-sent', text: 'Sent ' + sentText(it.at, st.today) }) : null]));
      card.appendChild(el('h3', { id: hid, tabindex: '-1', 'data-focus': 'card:' + it.coll + it.id, text: (isReview ? 'Review from ' : 'Photo from ') + (it.fam || familyLabel(st)) }));
      const body = el('div', { class: 'ds-appr-body' });
      if (it.thumb) body.appendChild(el('img', { class: 'ds-thumb', src: it.thumb, alt: 'The photo they sent' + (it.photoName ? ' (' + it.photoName + ')' : ''), width: '160', height: '160' }));
      const txt = el('div', { class: 'ds-appr-text' });
      if (it.stars) txt.appendChild(stars(it.stars));
      add(txt, quote('Their words', it.text));
      if (!it.thumb && it.photoName) txt.appendChild(el('p', { class: 'ds-photo-name' }, [icon('camera'), 'Photo: ' + it.photoName + ' (the demo kept only the file name)']));
      if (v) txt.appendChild(el('p', { class: 'ds-context' }, [icon('calendar'), 'Visit: ' + dateLong(v.date)]));
      body.appendChild(txt);
      card.appendChild(body);
      if (open) {
        const decide = (ok) => {
          ui.focus = focusAfter(it.coll + it.id, ui.apprKeys, 'approvals');
          if (it.coll === 'reviews') S.decideReview(it.id, ok);
          else S.decidePhoto(it.id, ok);   // both tell the family (the store makes the notice)
          countAnswer();
          say(ok ? 'Approved.' : 'Not now.');
        };
        card.appendChild(el('div', { class: 'ds-actions' }, [
          bigBtn('btn-green', 'Approve', 'check', () => decide(true), { 'aria-describedby': hid, 'data-focus': 'ok:' + it.coll + it.id }),
          bigBtn('btn-white', 'Not now', 'x', () => decide(false), { 'aria-describedby': hid, 'data-focus': 'notnow:' + it.coll + it.id })
        ]));
      } else {
        card.appendChild(el('div', { class: 'ds-result ds-result-' + (it.status === 'approved' ? 'good' : 'plain'), tabindex: '-1', 'data-focus': 'res:a:' + it.coll + it.id }, [
          el('p', { class: 'ds-result-title' }, [icon(it.status === 'approved' ? 'check' : 'x'), it.status === 'approved' ? 'Approved.' : 'Not now. It stays private.']),
          it.status === 'approved' ? el('p', { class: 'ds-result-line', text: 'The family sees it under “Shared with the farm (demo)”.' }) : null
        ]));
      }
      return card;
    }

    // ----- one day of "This week"
    function dayRow(ymd, i) {
      const isClosed = st.closed.some((c) => c.date === ymd);
      const visits = st.visits.filter((v) => v.date === ymd && v.date >= st.today);
      const events = st.events.filter((e) => e.date === ymd);
      const openDay = isFarmDay(ymd);
      const total = visits.reduce((n, v) => n + people(v), 0) + events.reduce((n, e) => n + num(e.students) + guestsOf(e), 0);
      const lines = [];
      visits.slice(0, MAX_DAY_LINES).forEach((v) => lines.push(el('li', null, [el('strong', { text: timeText(v.time) }), ' ' + famOf(st, v) + ' · ' + plural(people(v), 'person', 'people') + (packageOf(v) === 'pizza' ? ' · with pizza' : ' · farm only') + (v.closed ? ' · told about the closing' : '')])));
      if (visits.length > MAX_DAY_LINES) lines.push(el('li', { class: 'ds-more-line', text: 'and ' + plural(visits.length - MAX_DAY_LINES, 'more visit', 'more visits') }));
      events.forEach((e) => lines.push(el('li', null, [el('strong', { text: e.time ? timeText(e.time) : 'Group' }), ' ' + eventTitle(e) + ' \u00B7 ' + plural(num(e.students) + guestsOf(e), 'person', 'people') + ' (' + headText(e.students, guestsOf(e)) + ')'])));
      // pizzas by pick-up time
      const slots = {};
      st.orders.forEach((o) => {
        if (orderDate(st, o) !== ymd || !o.pickup) return;
        const s = slots[o.pickup] || (slots[o.pickup] = { n: 0, gf: 0, vegan: 0 });
        s.n += pizzaCount(o);
        arr(o.pizzas).forEach((p) => { const c = num(p.count != null ? p.count : p.qty) || 1; if (p.gf || p.glutenFree) s.gf += c; if (p.vegan || p.veganCheese) s.vegan += c; });
      });
      const pizzaLines = Object.keys(slots).sort((a, b) => mins(a) - mins(b)).map((t) => {
        const s = slots[t], extra = [s.gf ? s.gf + ' gluten-free' : '', s.vegan ? s.vegan + ' vegan cheese' : ''].filter(Boolean).join(', ');
        return el('li', null, [icon('pizza'), el('strong', { text: timeText(t) }), ' pick-up · ' + plural(s.n, 'pizza', 'pizzas') + (extra ? ' (' + extra + ')' : '')]);
      });
      const state = isClosed ? chip('no', 'Closed for weather', 'cloud') : openDay ? chip('mint', 'Open', 'check') : chip('plain', 'Not a farm day');
      const li = el('li', { class: 'ds-day' + (isClosed ? ' is-closed' : '') + (!openDay && !isClosed && !lines.length ? ' is-quiet' : '') }, [
        el('div', { class: 'ds-day-date' }, [el('strong', { text: dateShort(ymd) }), i === 0 ? el('span', { class: 'ds-today', text: 'Today' }) : null]),
        el('div', { class: 'ds-day-what' }, [
          el('div', { class: 'ds-day-line' }, [state, total ? el('span', { class: 'ds-total', text: plural(total, 'person', 'people') + ' coming' }) : (openDay || isClosed ? el('span', { class: 'ds-none', text: 'No visits booked yet' }) : null)]),
          lines.length ? el('ul', { class: 'ds-lines' }, lines) : null,
          pizzaLines.length ? el('ul', { class: 'ds-lines ds-pizza-lines', 'aria-label': 'Pizza' }, pizzaLines) : null
        ])
      ]);
      return li;
    }

    // ----- Weather: close or open a day
    function renderWeather() {
      const form = parts.weatherForm;
      const days = openDaysFor(st.today, 'farm', 10);
      const info = (d) => { const vs = st.visits.filter((v) => v.date === d); const n = vs.reduce((a, v) => a + people(v), 0); return vs.length ? ' (' + plural(vs.length, 'visit', 'visits') + ', ' + plural(n, 'person', 'people') + ')' : ''; };
      const sig = JSON.stringify([days, days.map(info), ui.mode.close || '', ui.val['close-day'], ui.val['close-why'], st.today]);
      if (form.getAttribute('data-sig') !== sig) {
        form.setAttribute('data-sig', sig);
        form.textContent = '';
        if (!days.length) {
          form.appendChild(el('p', { class: 'ds-empty', text: 'There are no open days coming up to close.' }));
        } else {
          const dayOpts = days.map((d) => [d, dateLong(d) + info(d)]);
          const whyOpts = [['rain', 'Rain'], ['wind', 'Strong wind'], ['other', 'Something else (I will write it)']];
          const whySel = select('ds-close-why', 'close-why', whyOpts, ui.val['close-why'] || 'rain', () => { render(); });
          const daySel = select('ds-close-day', 'close-day', dayOpts, ui.val['close-day']);
          const wrap = el('div', { class: 'ds-row3' }, [field('ds-close-day', 'Day to close', daySel), field('ds-close-why', 'Why', whySel)]);
          if (ui.val['close-why'] === 'other') {
            const w = el('input', { id: 'ds-close-words', class: 'ds-select', type: 'text', value: str(ui.val['close-words'] || ''), 'data-focus': 'ds-close-words', oninput: (e) => { ui.val['close-words'] = e.target.value; } });
            wrap.appendChild(field('ds-close-words', 'In your own words', w));
          }
          form.appendChild(wrap);
          const day = ui.val['close-day'];
          if (ui.mode.close === 'confirm') {
            const vs = st.visits.filter((v) => v.date === day);
            const reasonText = ui.val['close-why'] === 'rain' ? 'rain' : ui.val['close-why'] === 'wind' ? 'strong wind' : (str(ui.val['close-words']).trim() || 'weather');
            form.appendChild(el('div', { class: 'ds-confirm', role: 'group', 'aria-labelledby': 'ds-confirm-h' }, [
              el('p', { id: 'ds-confirm-h', class: 'ds-confirm-q', text: 'Close ' + dateLong(day) + ' for ' + reasonText + '?' }),
              el('p', { text: vs.length ? plural(vs.length, 'family has', 'families have') + ' a visit that day. They will read: “The farm is closed on ' + dateLong(day) + ' because of ' + reasonText + '. Pick a new day for your visit.”' : 'No family is booked that day. Anyone who books later will see the day as closed.' }),
              el('div', { class: 'ds-actions' }, [
                bigBtn('btn-red', 'Yes, close this day', 'cloud', () => {
                  const why = ui.val['close-why'] === 'other' ? (str(ui.val['close-words']).trim() || 'weather') : reasonText;
                  ui.mode.close = ''; ui.focus = 'closed-h'; delete ui.val['close-words']; delete ui.val['close-day'];
                  ui.why[day] = why;
                  S.closeDay(day, why);
                  say('Closed ' + dateLong(day) + '.');
                }, { 'data-focus': 'close-yes' }),
                bigBtn('btn-white', 'No, go back', null, () => { ui.mode.close = ''; rerender('close-go'); })
              ])
            ]));
          } else {
            form.appendChild(el('div', { class: 'ds-actions' }, [bigBtn('btn-red', 'Close this day', 'cloud', () => { ui.mode.close = 'confirm'; rerender('close-yes'); }, { 'data-focus': 'close-go' })]));
          }
        }
      }
      // closed days
      const csig = JSON.stringify([st.closed, st.visits.map((v) => [v.date, v.closed]), ui.why]);
      if (parts.weatherClosed.getAttribute('data-sig') !== csig) {
        parts.weatherClosed.setAttribute('data-sig', csig);
        parts.weatherClosed.textContent = '';
        parts.weatherClosed.appendChild(el('h3', { class: 'ds-sub', id: 'closed-h', tabindex: '-1', 'data-focus': 'closed-h', text: 'Closed days' }));
        if (!st.closed.length) parts.weatherClosed.appendChild(el('p', { class: 'ds-empty', text: 'No closed days.' }));
        else {
          const ul = el('ul', { class: 'ds-closed-list' });
          st.closed.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((c) => {
            const vs = st.visits.filter((v) => v.date === c.date);
            ul.appendChild(el('li', null, [
              el('div', null, [el('strong', { text: dateLong(c.date) }), (c.reason || ui.why[c.date]) ? ' · ' + (c.reason || ui.why[c.date]) : '', vs.length ? el('span', { class: 'ds-hint', text: ' · ' + plural(vs.length, 'family', 'families') + ' told' }) : null]),
              bigBtn('btn-white btn-sm', 'Open this day again', 'check', () => { ui.focus = 'closed-h'; S.openDay(c.date); say('Opened ' + dateLong(c.date) + ' again.'); }, { 'aria-label': 'Open ' + dateLong(c.date) + ' again', 'data-focus': 'reopen:' + c.date })
            ]));
          });
          parts.weatherClosed.appendChild(ul);
        }
      }
    }

    // ----- People waiting: the four seasonal switches, then one row for each day somebody waits for a spot
    function peopleRows() {
      const rows = [];
      alertKinds(D).forEach((a) => {
        if (a.key === 'spot') return;
        const n = st.counts && st.counts[a.key] != null ? countOf(st.counts[a.key]) : (st.alerts && st.alerts[a.key] ? 1 : 0);
        rows.push({ key: a.key, label: a.label || alertLabel(a.key, D), n, date: '', names: [] });
      });
      // the days somebody waits for a spot: the store's own count when it gives one (alertCounts().days), else the waitlist entries still waiting
      const byDay = {};
      const cd = st.counts && st.counts.days && typeof st.counts.days === 'object' ? st.counts.days : null;
      if (cd) Object.keys(cd).forEach((d) => { if (num(cd[d]) > 0) byDay[d] = { n: num(cd[d]), names: [] }; });
      st.waitlist.filter((w) => waitActive(w) && !w.notified).forEach((w) => {
        const d = waitDay(w);
        if (!d) return;
        if (!cd) { const o = byDay[d] || (byDay[d] = { n: 0, names: [] }); o.n += 1; }
        const o = byDay[d];
        if (o && typeof w.party === 'string' && w.party && o.names.indexOf(w.party) < 0) o.names.push(w.party);
      });
      // a day whose alert was sent while this screen was open stays, with its "Sent to ..." line (the store drops it from the counts once it is sent)
      Object.keys(ui.alertSent).forEach((k) => { if (k.indexOf('spot:') === 0 && !byDay[k.slice(5)]) byDay[k.slice(5)] = { n: 0, names: [] }; });
      const days = Object.keys(byDay).sort();
      days.forEach((d) => rows.push({ key: 'spot:' + d, label: 'A spot opens on ' + dateLong(d), n: byDay[d].n, names: byDay[d].names, date: d }));
      if (!days.length) {
        const n = st.counts && st.counts.spot != null ? countOf(st.counts.spot) : (st.alerts && st.alerts.spot ? 1 : 0);
        rows.push({ key: 'spot', label: alertLabel('spot', D), n, date: '', names: [] });
      }
      return rows;
    }

    // ----- group trips
    function eventCard(e) {
      const hid = 'ds-h-e-' + e.id;
      const card = el('article', { class: 'ds-card ds-event', 'aria-labelledby': hid });
      card.appendChild(el('div', { class: 'ds-card-top' }, [chip('mint', 'Group trip', 'users')]));
      card.appendChild(el('h3', { id: hid, text: eventTitle(e) }));
      const facts = el('ul', { class: 'ds-facts' });
      if (e.date) facts.appendChild(el('li', null, [icon('calendar'), when(e.date, e.time)]));
      facts.appendChild(el('li', null, [icon('users'), headText(e.students, guestsOf(e))]));
      const sl = slipsText(e);
      if (sl) facts.appendChild(el('li', null, [icon('check'), 'Permission slips: ' + sl]));
      let price = null;
      try { price = D && typeof D.priceEvent === 'function' ? D.priceEvent(e) : null; } catch (err) {}
      if (price && typeof price.total === 'number') facts.appendChild(el('li', null, [icon('calendar'), 'Admission: ' + money(price.total) + (arr(price.lines).length ? ' (' + arr(price.lines).map((l) => str(l.qty) + ' \u00D7 ' + str(l.label).toLowerCase() + (typeof l.unit === 'number' ? ' at ' + money(l.unit) : '')).join(', ') + ')' : '')]));
      if (e.deposit) facts.appendChild(el('li', null, [icon('check'), 'Deposit: ' + str(e.deposit)]));
      if (e.balance) facts.appendChild(el('li', null, [icon('clock'), 'Balance: ' + str(e.balance)]));
      card.appendChild(facts);
      const th = threadsOf(st).filter((t) => t.id === eventThreadId(e))[0];
      card.appendChild(el('h4', { class: 'ds-sub2', text: 'Messages' }));
      if (th) {
        const chat = el('ol', { class: 'ds-chat', 'aria-label': 'Messages with ' + str(e.title || e.name) });
        th.msgs.slice(-5).forEach((m) => chat.appendChild(el('li', { class: 'ds-bubble ds-from-' + m.from }, [el('span', { class: 'ds-bubble-who', text: m.from === 'family' ? 'They wrote' : 'You wrote' }), el('p', { text: m.text })])));
        card.appendChild(chat);
      } else card.appendChild(el('p', { class: 'ds-empty', text: 'No messages yet.' }));
      const tid = eventThreadId(e);
      card.appendChild(field('write-' + e.id, 'Write to them', textBox('write-' + e.id, 'write:' + e.id, 2)));
      card.appendChild(el('div', { class: 'ds-actions' }, [bigBtn('btn-green', 'Send message', 'check', () => {
        const text = (ui.val['write:' + e.id] || '').trim();
        if (!text) { say('Write a few words first.'); const box = doc.getElementById('write-' + e.id); if (box) box.focus(); return; }
        delete ui.val['write:' + e.id];
        ui.focus = 'write-' + e.id;
        S.post(tid, 'cathy', text);
        say('Sent.');
      }, { 'aria-describedby': hid, 'data-focus': 'send-e:' + e.id })]));
      return card;
    }

    /* ---------------------------------------------------------------- *
     * The live parts: the feed ("just now: ..."), the counters, the clock, the "new" button, the title
     * ---------------------------------------------------------------- */
    // How many things Mrs. Cathy answered today: requests (the store stamps reply.at), replies to a question (her message right after a family message), and photos and reviews
    // (the store stamps decided). Counted from the store, so every tab and every reload says the same; the engine's tally of the answers given on this desk keeps it from shrinking
    // when the engine tidies old pretend records away.
    function answeredToday() {
      let n = 0;
      st.requests.forEach((r) => { if ((r.to === 'cathy' || r.to === 'farm') && r.reply && dayOf(r.reply.at) === st.today) n++; });
      threadsOf(st).forEach((t) => t.msgs.forEach((m, i) => { if (i > 0 && m.from === 'cathy' && t.msgs[i - 1].from === 'family' && dayOf(m.at) === st.today) n++; }));
      approvalItems(st).forEach((a) => { if (a.status !== 'waiting' && dayOf(a.decided) === st.today) n++; });
      return Math.max(n, tallied());
    }

    // Every line the feed could show, oldest first: what arrived and what was answered, each with the words of one plain line. A line is named by what it is about
    // (`ask:r12`, `ans:r12`), so it is taken once. `ago` says how long before now it happened, as far as the store knows (a family of the rush has its own clock: arrived).
    function feedLines() {
      const out = [];
      const pretendNow = (() => { const L = liveApi(); try { return L && typeof L.time === 'function' ? L.time() : 0; } catch (e) { return 0; } })();
      const put = (key, at, rank, id, text, tone, arrived) => {
        const t = stamp(at);
        out.push({ key: key + '@' + str(at), t, rank, n: idNum(id), text, tone, ago: arrived != null && pretendNow ? Math.max(0, pretendNow - arrived) : Math.max(0, nowStamp - t) });
      };
      st.requests.forEach((r) => {
        if (r.to !== 'cathy' && r.to !== 'farm') return;   // pizza changes are the kitchen's
        const who = whoOf(r);
        put('ask:' + r.id, reqSent(r), 0, r.id, who + ' asks: ' + reqAsk(r), 'ask', r.arrived);
        if (r.reply && r.reply.at) {
          const how = r.reply.answer;
          put('ans:' + r.id, r.reply.at, 1, r.id, how === 'yes' ? 'You said Yes to ' + who + '.' : how === 'no' ? 'You said No to ' + who + '.' : 'You suggested something else to ' + who + '.', how === 'no' ? 'no' : 'good');
        }
        if (r.status === 'accepted' || r.status === 'declined' || r.status === 'cancelled') {
          put('fam:' + r.id + ':' + r.status, r.updated || reqSent(r), 2, r.id, r.status === 'accepted' ? who + ' said OK to your suggestion.' : r.status === 'declined' ? who + ' said no thanks to your suggestion.' : who + ' took a request back.', 'plain');
        }
      });
      threadsOf(st).forEach((t) => {
        const ev = threadEvent(st, t.id), who = ev ? eventTitle(ev) : (t.fam || familyLabel(st));
        t.msgs.forEach((m, i) => {
          if (m.from === 'family') put('msg:' + m.id, m.at, 0, m.id, who + (ev ? ' wrote to you: ' : ' asks the farm: ') + '“' + shorten(m.text, 70) + '”', 'ask', m.arrived);
          else if (i > 0 && t.msgs[i - 1].from === 'family') put('rep:' + m.id, m.at, 1, m.id, 'You replied to ' + who + '.', 'good');
        });
      });
      approvalItems(st).forEach((a) => {
        const who = a.fam || familyLabel(st), what = a.coll === 'reviews' && (a.stars || a.text) ? 'review' : 'photo';
        put('new:' + a.coll + a.id, a.at, 0, a.id, who + ' sent a ' + what + (what === 'review' && a.stars ? ': ' + plural(a.stars, 'star', 'stars') : '') + '.', 'ask', a.arrived);
        if (a.status !== 'waiting' && a.decided) put('dec:' + a.coll + a.id, a.decided, 1, a.id, a.status === 'approved' ? 'You approved the ' + what + ' from ' + who + '.' : 'You said Not now to the ' + what + ' from ' + who + '.', a.status === 'approved' ? 'good' : 'plain');
      });
      return out.sort((a, b) => a.t - b.t || a.rank - b.rank || a.n - b.n);
    }
    // the lines this screen has not taken yet go to the feed, in the order they happened (the biggest seq is the newest); returns how many were taken
    function takeFeed(first) {
      const lines = feedLines(), now = Date.now(), present = {};
      lines.forEach((e) => { present[e.key] = true; });
      // a line of a record that is gone (the tour takes the rush away, the engine tidies old things) goes with it, and its name can be used again
      ui.feed = ui.feed.filter((e) => present[e.key]);
      Object.keys(ui.feedSeen).forEach((k) => { if (!present[k]) delete ui.feedSeen[k]; });
      lines.forEach((e) => {
        if (ui.feedSeen[e.key]) return;
        ui.feedSeen[e.key] = true;
        ui.feed.push({ key: e.key, seq: ++ui.feedSeq, ms: first ? now - e.ago : now, text: e.text, tone: e.tone });   // a line that was already there is as old as the store says; one that comes while the screen is open is "just now"
      });
      if (ui.feed.length > 40) ui.feed = ui.feed.slice(-40);
    }
    // "just now" for the first 45 seconds, then whole minutes: the words change once a minute, so the feed stays calm to read
    function agoWords(ms) {
      const sec = Math.max(0, Math.round((Date.now() - ms) / 1000));
      if (sec < 45) return 'just now';
      const min = Math.max(1, Math.round(sec / 60));
      return min < 60 ? min + ' min ago' : min < 120 ? '1 hr ago' : Math.floor(min / 60) + ' hr ago';
    }
    function feedLine(e) {
      return el('li', { class: 'ds-feed-line ds-f-' + e.tone + (Date.now() - e.ms < FRESH_LINE_MS ? ' is-fresh' : ''), 'data-ms': String(e.ms) }, [el('span', { class: 'ds-feed-at', text: agoWords(e.ms) }), el('span', { class: 'ds-feed-text', text: e.text })]);
    }
    function paintFeed() {
      const lines = ui.feed.slice().sort((a, b) => b.seq - a.seq).slice(0, MAX_FEED);
      sync(parts.feed, lines.map((e) => ({ key: e.key, sig: e.key + '|' + agoWords(e.ms), make: () => feedLine(e) })));
      parts.feed.hidden = lines.length === 0;
      parts.feedHead.hidden = lines.length === 0;
      parts.feedEmpty.hidden = lines.length > 0;
    }
    function paintClock() {
      const L = liveApi(), made = (() => { try { return (S.get('live') || {}).count || 0; } catch (e) { return 0; } })();
      let text = '';
      if (L && made) { try { text = timeText(L.clock()); } catch (e) { text = ''; } }   // the rush has made things: its clock is the one on the cards it made
      if (!text && st) { const w = wall(st.nowAt); text = w ? timeText(w.time) : ''; }
      const next = text ? 'Time: ' + text : '';
      if (parts.clock.textContent !== next) parts.clock.textContent = next;
    }
    function paintPill() {
      const n = ui.pending.length;
      parts.pill.hidden = n === 0;
      if (n) parts.pill.textContent = 'Show ' + plural(n, 'new card', 'new cards');   // (the words on it are its name for a screen reader too)
    }
    function paintTitle() {   // the tab says how many things wait while the rush is on, so it can be read from another tab or window
      const t = (liveOn() && ui.waitTotal > 0 ? '(' + ui.waitTotal + ') ' : '') + baseTitle;
      if (doc.title !== t) doc.title = t;
    }
    // a new card that is on the screen is not "new below" any more
    function checkPending() {
      if (!ui.pending.length) return;
      const vh = win.innerHeight || doc.documentElement.clientHeight;
      ui.pending = ui.pending.filter((k) => {
        const n = root.querySelector('[data-key="' + k + '"]');
        if (!n) return false;
        const r = n.getBoundingClientRect();
        return !(r.top < vh && r.bottom > 0);
      });
      paintPill();
    }
    function showNewest() {
      const k = ui.pending[0];
      ui.pending = [];
      paintPill();
      const target = k ? root.querySelector('[data-focus="card:' + k + '"]') : null;
      if (target) { try { target.focus(); } catch (e) { /* the card went away */ } }
    }
    // a card's New mark fades after a while; it is taken off in place (the card is not drawn again, so a note being typed keeps its place)
    function expireNew() {
      const now = Date.now();
      Object.keys(ui.fresh).forEach((k) => {
        if (now - ui.fresh[k] < FRESH_CARD_MS) return;
        delete ui.fresh[k];
        const card = root.querySelector('[data-key="' + k + '"]');
        if (!card) return;
        card.classList.remove('is-new');
        const chipEl = card.querySelector('.ds-chip-new');
        if (chipEl && chipEl.parentNode) chipEl.parentNode.removeChild(chipEl);
      });
      Array.prototype.forEach.call(parts.feed.querySelectorAll('.is-fresh'), (li) => { if (now - Number(li.getAttribute('data-ms')) >= FRESH_LINE_MS) li.classList.remove('is-fresh'); });
    }
    // once a second: the words of the feed and the clock, the New marks, the "new" button, the title
    function tick() {
      if (!st) return;
      Array.prototype.forEach.call(parts.feed.children, (li) => {
        const t = li.firstChild, w = agoWords(Number(li.getAttribute('data-ms')));
        if (t && t.textContent !== w) { t.textContent = w; li.setAttribute('data-sig', li.getAttribute('data-key') + '|' + w); }   // (the line keeps its place: it is not drawn again)
      });
      paintClock();
      expireNew();
      checkPending();
      paintTitle();
    }

    // Keeps what the person is looking at where it is: when the cards above it grow, shrink, come or go, the page is scrolled by the same amount. (A browser that does this itself
    // has already done it when we look, so nothing is added twice.) The anchor is the first card or box whose top edge is on the screen.
    function holdPlace(fn) {
      let anchor = null, top = 0;
      try {
        const vh = win.innerHeight || doc.documentElement.clientHeight, all = root.querySelectorAll('[data-key], .ds-section, .ds-live');
        for (let i = 0; i < all.length && !anchor; i++) { const r = all[i].getBoundingClientRect(); if (r.top >= 0 && r.top < vh && r.height > 0) { anchor = all[i]; top = r.top; } }
      } catch (e) { anchor = null; }
      fn();
      if (!anchor || !anchor.isConnected) return;
      const dy = anchor.getBoundingClientRect().top - top;
      if (Math.abs(dy) >= 1) { try { win.scrollTo({ top: win.pageYOffset + dy, left: 0, behavior: 'instant' }); } catch (e) { win.scrollTo(0, win.pageYOffset + dy); } }   // a browser that rejects 'instant' still scrolls
    }

    /* ---------------------------------------------------------------- *
     * render: draw everything from the store's state
     * ---------------------------------------------------------------- */
    function render() {
      st = readState(S, D);
      nowStamp = stamp(st.nowAt);
      const active = doc.activeElement;
      const hadFocus = active && root.contains(active) ? active.getAttribute('data-focus') : '';
      const first = !ui.drawn;

      const any = hasData(st);
      parts.empty.hidden = any;
      main.hidden = !any;
      parts.tiles.hidden = !any;
      if (!any) {   // an empty desk that is open: whatever arrives next is new; the box with the strip stays
        if (!ui.seen) ui.seen = {};
        ui.waitTotal = 0;
        takeFeed(first); paintFeed(); paintClock(); paintTitle(); paintPill();
        ui.drawn = true;
        return;
      }
      ui.drawn = true;
      holdPlace(paint);

      // put the keyboard focus back where it was, or where the last action asked for
      const want = ui.focus || hadFocus;
      ui.focus = '';
      if (want) {
        const now = doc.activeElement;
        if (!now || now === doc.body || !root.contains(now) || now.getAttribute('data-focus') !== want) {
          const target = root.querySelector('[data-focus="' + want.replace(/"/g, '\\"') + '"]');
          if (target && target !== now) { try { target.focus({ preventScroll: false }); } catch (e) { target.focus(); } }
        }
      }

      function paint() {
        // requests for Mrs. Cathy
        const reqs = st.requests.filter((r) => r.to === 'cathy' || r.to === 'farm');
        const waitingReqs = reqs.filter((r) => r.status === 'waiting');
        const threads = threadsOf(st);
        const needReply = threads.filter((t) => t.last.from === 'family');
        const apprAll = approvalItems(st);
        const apprOpen = apprAll.filter((a) => a.status === 'waiting');

        // The family answered a suggestion, or took a request back: say it once (what Mrs. Cathy herself just did is said when she does it)
        const present = {};
        reqs.forEach((r) => {
          const was = ui.status[r.id];
          if (was !== undefined && was !== r.status && (r.status === 'accepted' || r.status === 'declined' || r.status === 'cancelled')) {
            say(whoOf(r) + (r.status === 'accepted' ? ' said OK to your suggestion.' : r.status === 'declined' ? ' said no thanks to your suggestion.' : ' took a request back.'));
          }
          ui.status[r.id] = r.status;
          present[r.id] = true;
        });
        Object.keys(ui.status).forEach((id) => { if (!present[id]) delete ui.status[id]; });   // a request the rush has tidied away is forgotten here too

        // "New" marks: things that arrived while this screen was open. They are said (in batches), marked on their card for half a minute, and counted by the "new" button.
        const nowKeys = {}, words = {};
        waitingReqs.forEach((r) => { nowKeys['r:' + r.id] = 1; words['r:' + r.id] = whoOf(r) + ' asks: ' + reqAsk(r); });
        needReply.forEach((t) => { nowKeys['t:' + t.id] = 1; words['t:' + t.id] = (t.fam || familyLabel(st)) + ' asks the farm a question'; });
        apprOpen.forEach((a) => { nowKeys[a.coll + a.id] = 1; words[a.coll + a.id] = (a.fam || familyLabel(st)) + ' sent a ' + (a.coll === 'reviews' && (a.stars || a.text) ? 'review' : 'photo'); });
        if (ui.seen) {
          Object.keys(nowKeys).forEach((k) => {
            if (ui.seen[k]) return;
            ui.fresh[k] = Date.now();
            if (ui.pending.indexOf(k) < 0) ui.pending.push(k);
            sayNew(words[k] + '.');
          });
        }
        ui.seen = nowKeys;
        ui.pending = ui.pending.filter((k) => nowKeys[k]);   // a card that was answered (or tidied away) before it was seen is not "new below" any more

        // Waiting for you: the cards stay in the order they came in (the first time this screen saw them, oldest first), new ones go last, and a card that is answered leaves
        const nWaiting = waitingReqs.length + needReply.length;
        ui.waitTotal = nWaiting + apprOpen.length;
        parts.waitingBadge.textContent = String(nWaiting);
        parts.waitingBadge.setAttribute('data-n', String(nWaiting));
        setHeadSr(parts.waitingBadge, nWaiting, 'waiting');
        const ordered = [];
        waitingReqs.forEach((r) => ordered.push({ key: 'r:' + r.id, at: stamp(reqSent(r)), r }));
        needReply.forEach((t) => ordered.push({ key: 't:' + t.id, at: t.since, t }));
        apprOpen.forEach((a) => ordered.push({ key: a.coll + a.id, at: stamp(a.at), a }));
        ordered.sort((a, b) => a.at - b.at);
        ordered.forEach((o) => { if (ui.order[o.key] === undefined) ui.order[o.key] = ++ui.seq; });
        Object.keys(ui.order).forEach((k) => { if (!nowKeys[k]) delete ui.order[k]; });
        const byOrder = (a, b) => ui.order[a.key] - ui.order[b.key];
        const waitingAll = ordered.filter((o) => !o.a).sort(byOrder), waitingShown = waitingAll.slice(0, MAX_WAITING);
        ui.waitKeys = waitingShown.map((o) => o.key);
        const items = waitingShown.map((o) => {
          if (o.r) {
            const r = o.r, tgt = kindOf(r) === 'group' ? eventOf(st, r) : visitOf(st, r);
            return { key: o.key, sig: JSON.stringify([r, tgt, ui.mode[r.id] || '', st.account && st.account.name, st.today]), make: () => requestCard(r) };
          }
          const t = o.t;
          return { key: o.key, sig: JSON.stringify([t.msgs.slice(-4), st.events.length]), make: () => messageCard(t) };
        });
        sync(parts.waitingList, items);
        const emptyW = parts.waiting.body.querySelector('[data-for="waiting"]');
        emptyW.hidden = nWaiting > 0;
        emptyW.textContent = 'Nothing is waiting for you. When a family asks for a change or sends a question, it shows up here by itself.';
        const hiddenWaiting = waitingAll.length - waitingShown.length;
        parts.moreWaiting.hidden = hiddenWaiting === 0;
        parts.moreWaiting.textContent = hiddenWaiting ? plural(hiddenWaiting, 'more is', 'more are') + ' waiting. Answer some and they show up here.' : '';

        // pizza changes are the kitchen's to answer: only a pointer here, never a button to answer them
        const kitchenWaiting = st.requests.filter((r) => r.to === 'kitchen' && r.status === 'waiting').length;
        parts.kitchenNote.hidden = kitchenWaiting === 0;
        if (kitchenWaiting) {
          parts.kitchenNote.textContent = '';
          parts.kitchenNote.appendChild(icon('pizza'));
          parts.kitchenNote.appendChild(el('span', { text: 'The kitchen answers pizza changes: ' + kitchenWaiting + ' waiting there. ' }));
          parts.kitchenNote.appendChild(el('a', { href: 'kitchen.html', text: 'Open the kitchen screen' }));
        }

        // Answered: the latest few, newest answer first (a request that waits for the family's OK is answered for the desk too)
        const done = [];
        reqs.filter((r) => r.status !== 'waiting').forEach((r) => done.push({ at: stamp((r.reply && r.reply.at) || r.updated || reqSent(r)), n: idNum(r.id), r }));
        threads.filter((t) => t.last.from !== 'family' && threadEvent(st, t.id) === null).forEach((t) => done.push({ at: stamp(t.last.at), n: idNum(t.last.id), t }));
        done.sort((a, b) => b.at - a.at || b.n - a.n);
        const aItems = done.slice(0, MAX_ANSWERED).map((o) => {
          if (o.r) {
            const r = o.r, tgt = kindOf(r) === 'group' ? eventOf(st, r) : visitOf(st, r);
            return { key: 'r:' + r.id, sig: JSON.stringify([r, tgt, 'old']), make: () => requestCard(r) };
          }
          return { key: 't:' + o.t.id, sig: JSON.stringify([o.t.msgs.slice(-4), 'old']), make: () => messageCard(o.t) };
        });
        sync(parts.answeredList, aItems);
        parts.answeredHead.hidden = aItems.length === 0;
        parts.answeredList.hidden = aItems.length === 0;

        // Photos and reviews
        parts.approvalsBadge.textContent = String(apprOpen.length);
        parts.approvalsBadge.setAttribute('data-n', String(apprOpen.length));
        setHeadSr(parts.approvalsBadge, apprOpen.length, 'to look at');
        const apprWaiting = ordered.filter((o) => o.a).sort(byOrder).map((o) => o.a);
        ui.apprKeys = apprWaiting.map((a) => a.coll + a.id);
        const apprDone = apprAll.filter((a) => a.status !== 'waiting').sort((a, b) => stamp(b.decided || b.at) - stamp(a.decided || a.at) || idNum(b.id) - idNum(a.id)).slice(0, 4);
        sync(parts.approvalsList, apprWaiting.map((a) => ({ key: a.coll + a.id, sig: JSON.stringify([a, a.visitId ? byId(st.visits, a.visitId) : null]), make: () => approvalCard(a) })));
        sync(parts.approvalsDone, apprDone.map((a) => ({ key: a.coll + a.id, sig: JSON.stringify([a, 'old']), make: () => approvalCard(a) })));
        const emptyA = parts.approvals.body.querySelector('[data-for="approvals"]');
        emptyA.hidden = apprWaiting.length > 0;   // (shown whenever nothing waits, also under the answered ones: the focus goes there after the last answer)
        emptyA.textContent = 'No photos or reviews to look at.';
        emptyA.setAttribute('data-focus', 'empty:approvals');
        emptyA.setAttribute('tabindex', '-1');

        // This week
        const week = [];
        for (let i = 0; i < 7; i++) week.push(addDays(st.today, i));
        sync(parts.weekList, week.map((d, i) => ({
          key: d,
          sig: JSON.stringify([d, i, st.closed, st.visits.filter((v) => v.date === d), st.events.filter((e) => e.date === d), st.orders.filter((o) => orderDate(st, o) === d), st.family && st.family.name, st.account && st.account.name]),
          make: () => dayRow(d, i)
        })));

        renderWeather();

        // People waiting
        const pr = peopleRows();
        sync(parts.peopleList, pr.map((r) => ({
          key: r.key,
          sig: JSON.stringify([r, ui.alertSent[r.key] === undefined ? -1 : ui.alertSent[r.key]]),
          make: () => peopleRow(r)
        })));

        // Groups
        const gItems = st.events.map((e) => ({ key: e.id, sig: JSON.stringify([e, threadsOf(st).filter((t) => t.id === eventThreadId(e)).map((t) => t.msgs.slice(-5))]), make: () => eventCard(e) }));
        sync(parts.groupsList, gItems);
        let emptyG = parts.groups.body.querySelector('[data-for="groups"]');
        if (!emptyG) { emptyG = el('p', { class: 'ds-empty', 'data-for': 'groups' }); parts.groups.body.appendChild(emptyG); }
        emptyG.hidden = gItems.length > 0;
        emptyG.textContent = 'No group trips yet.';

        // the counters at the top: where to look first (links to the sections) and what was answered today
        const totalPeople = pr.reduce((n, r) => n + r.n, 0), doneToday = answeredToday();
        const tiles = [
          ['desk-waiting', nWaiting, 'Waiting for you', 'bell', 'ask'],
          ['desk-approvals', apprOpen.length, 'Photos and reviews to look at', 'camera', 'ask'],
          ['', doneToday, 'Answered today', 'check', 'done'],
          ['desk-people', totalPeople, 'People waiting for news', 'users', 'info']
        ];
        sync(parts.tiles, tiles.map((t) => ({
          key: t[0] || 'answered', sig: JSON.stringify(t),
          make: () => {
            const inside = [icon(t[3]), el('span', { class: 'ds-tile-n', text: String(t[1]) }), el('span', { class: 'ds-tile-l', text: t[2] })];
            return el('li', null, [t[0] ? el('a', { class: 'ds-tile ds-tile-' + t[4] + (t[1] ? ' has' : ''), href: '#' + t[0] }, inside) : el('div', { class: 'ds-tile ds-tile-' + t[4] + (t[1] ? ' has' : '') }, inside)]);
          }
        })));

        // the feed, the clock, the "new" button and the title
        takeFeed(first);
        paintFeed(); paintClock(); paintPill(); paintTitle();
      }
    }

    function setHeadSr(badgeEl, n, word) {
      badgeEl.setAttribute('aria-label', n + ' ' + word);
      badgeEl.setAttribute('role', 'img');
    }

    function peopleRow(r) {
      const { label, n, key, date } = r;
      const sent = ui.alertSent[key];
      const hid = 'ds-p-' + key.replace(/[^\w-]/g, '_');
      return el('li', { class: 'ds-person' }, [
        el('div', { class: 'ds-person-what' }, [
          el('strong', { id: hid, text: label }),
          el('span', { class: 'ds-person-n', text: n ? plural(n, 'family is', 'families are') + ' waiting' + (r.names && r.names.length ? ' (' + r.names.join(', ') + ')' : '') : (sent !== undefined ? 'Everyone who was waiting has been told.' : 'Nobody is waiting for this yet') })
        ]),
        el('div', { class: 'ds-person-act' }, [
          bigBtn('btn-sun btn-sm', 'Send the alert', 'bell', () => {
            ui.alertSent[key] = n;
            ui.focus = 'alert:' + key;
            const reached = S.fireAlert(date ? 'spot' : key, date || undefined);
            say(reached === false ? 'Nobody was signed up for that alert.' : 'Alert sent to ' + plural(n, 'family', 'families') + '.');
          }, { 'aria-labelledby': 'ds-send-' + hid + ' ' + hid, id: 'ds-send-' + hid, 'data-focus': 'alert:' + key, disabled: n ? false : true }),
          sent !== undefined ? el('p', { class: 'ds-person-sent', role: 'status' }, [icon('check'), 'Sent to ' + plural(sent, 'family', 'families') + '.']) : null
        ])
      ]);
    }

    // ----- go
    // The rush's own control goes into its place (the page without js/demo-live.js has no strip), and its one-second timer starts (it does nothing while the rush is off).
    const engine = liveApi();
    let stopRun = null;
    if (engine) {
      try { if (typeof engine.strip === 'function') parts.strip.appendChild(engine.strip()); } catch (e) { /* no strip: the rest of the screen works as it is */ }
      try { if (typeof engine.run === 'function') stopRun = engine.run(); } catch (e) { stopRun = null; }
    }
    parts.strip.hidden = !parts.strip.firstChild;
    const unsub = S.subscribe(() => { render(); });
    timer = win.setInterval(tick, 1000);
    let scrollWait = 0;
    const onScroll = () => { if (!scrollWait) scrollWait = win.setTimeout(() => { scrollWait = 0; checkPending(); }, 120); };   // the "new" button goes when the new cards are on the screen
    win.addEventListener('scroll', onScroll);
    render();
    return {
      render, ui,
      destroy() {
        unsub(); win.clearInterval(timer); win.removeEventListener('scroll', onScroll);
        if (saidTimer) win.clearTimeout(saidTimer);
        if (stopRun) stopRun();
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 6. Start up (only in demo mode)
   * ------------------------------------------------------------------ */
  function demoOn() { try { return typeof window.WA_DEMO_MODE === 'function' && !!window.WA_DEMO_MODE(); } catch (e) { return false; } }
  function start() {
    if (!demoOn() || !window.DemoStore) return;
    const root = doc.querySelector('[data-demo-screen="desk"]') || doc.getElementById('desk-root') || doc.querySelector('[data-demo-app="desk"]');
    if (root) window.DemoDesk.app = mount(root, window.DemoStore, window.DemoData);
  }
  window.DemoDesk = { mount, start };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})();
