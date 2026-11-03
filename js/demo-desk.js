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
 *   Groups and schools   the sample school trip and its messages
 *
 * How it is built: render(state) draws the whole screen from the store's state, and the store calls it again whenever anything changes (also when
 * another tab changes it), so a request sent from the family's page arrives here by itself. Cards that did not change are kept as they are, so
 * a note being typed, and the keyboard focus, are not lost. Everything the screen needs to know about the SHAPE of the store's objects is in
 * section 3 ("Reading the store"); the rest does not look inside them.
 */
(function () {
  'use strict';

  const doc = document;

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
    plus: ['M12 5v14M5 12h14']
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

  /* ------------------------------------------------------------------ *
   * 3. Reading the store   (the ONLY part that knows what the objects look like)
   * ------------------------------------------------------------------ */
  function readState(S, D) {
    const list = (c) => { try { return arr(S.list(c)); } catch (e) { return []; } };
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
    return {
      today, account, family, counts, alerts, closed, visits,
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
      map[id].push({ id: m.id, from: m.from === 'family' ? 'family' : 'cathy', text: str(m.text), at: m.at });
    });
    // since: when the family's latest run of messages began (where the card stands in the list, before and after the answer)
    return order.map((id) => {
      const m = map[id];
      let i = m.length - 1;
      while (i >= 0 && m[i].from !== 'family') i--;
      while (i > 0 && m[i - 1].from === 'family') i--;
      return { id, msgs: m, last: m[m.length - 1], since: stamp((m[Math.max(i, 0)] || m[0]).at) };
    });
  }
  const eventThreadId = (e) => 'event-' + e.id;
  function threadEvent(st, id) { return st.events.filter((e) => eventThreadId(e) === id)[0] || null; }

  // Reviews and photos to look at
  function approvalItems(st) {
    const out = [];
    st.reviews.forEach((x) => out.push({ coll: 'reviews', x }));
    st.photos.forEach((x) => out.push({ coll: 'photos', x }));
    return out.map((it) => ({ coll: it.coll, id: it.x.id, status: str(it.x.status) || 'waiting', stars: num(it.x.stars), text: str(it.x.text).trim(), photoName: str(it.x.photoName || it.x.name || it.x.fileName), thumb: str(it.x.thumb || it.x.thumbnail || it.x.photo || it.x.dataUrl), visitId: it.x.visitId, at: it.x.at }));
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
  const headText = (students, guests) => plural(num(students), 'student', 'students') + ' and ' + plural(num(guests), 'chaperone', 'chaperones');
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
    // What the person is doing right now (not saved anywhere): open panels, typed words, cards answered in this visit to the screen
    const ui = { mode: {}, val: {}, sent: {}, fresh: {}, seen: null, focus: '', alertSent: {}, status: {}, why: {} };
    let st = null;

    root.textContent = '';
    root.classList.add('ds');

    const live = el('p', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
    const say = (t) => { live.textContent = ''; live.textContent = t; };

    // ----- the frame (built once; the parts inside are redrawn as needed)
    const parts = {};
    const intro = el('p', { class: 'ds-who' }, [icon('bell'), el('span', null, [el('strong', { text: 'Demo: you are Mrs. Cathy (or Rob).' }), ' No sign-in is needed on this screen. Whatever a family sends shows up below by itself.'])]);
    parts.tiles = el('ul', { class: 'ds-tiles', 'aria-label': 'Where to look first' });
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
    parts.waiting.body.appendChild(el('p', { class: 'ds-empty', 'data-for': 'waiting', hidden: '' }));
    parts.waiting.body.appendChild(parts.waitingList);
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
      el('p', { text: 'Open the family page and make an account. That loads a sample family with a visit, a pizza order and a school trip. Then come back here.' }),
      el('a', { class: 'btn btn-red btn-lg', href: 'account.html' }, ['Open the family page ', icon('arrow')])
    ]);

    // the page's one h1 (the shell keeps its own h1 inside the box that is hidden in demo mode)
    root.appendChild(el('div', { class: 'ds-head' }, [el('h1', { class: 'demo-h1', id: 'desk-h1', tabindex: '-1', text: 'Mrs. Cathy and Rob\u2019s desk' }), intro]));
    root.appendChild(live);
    root.appendChild(parts.empty);
    const main = el('div', { class: 'ds-main' }, [parts.tiles, parts.waiting.sec, parts.approvals.sec, parts.week.sec, parts.weather.sec, parts.people.sec, parts.groups.sec]);
    root.appendChild(main);

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

    // Who a request is from: the school for a group trip, the family otherwise
    const whoOf = (r) => { if (kindOf(r) === 'group') { const e = eventOf(st, r); if (e) return eventTitle(e); } return familyLabel(st); };

    // ----- the answer to a request
    function answer(r, how, suggestion) {
      const note = (ui.val['note:' + r.id] || '').trim();
      ui.sent[r.id] = true;
      ui.mode[r.id] = '';
      ui.focus = 'res:' + r.id;
      const body = { answer: how, note };
      if (how === 'suggest') body.suggestion = suggestion;
      const res = S.reply(r.id, body);
      if (res === null || res === false) {   // the store would not take it: somebody (another tab) answered or took it back first
        delete ui.sent[r.id];
        ui.focus = '';
        say('This one was already answered or taken back. The screen shows how it stands now.');
        render();
        return;
      }
      delete ui.val['note:' + r.id];
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
        const p = r.patch || {}, ev = target || {};
        box.appendChild(el('div', { class: 'ds-row2' }, [
          field(id + '-st', 'Students', el('input', { id: id + '-st', class: 'ds-select', type: 'number', min: '0', inputmode: 'numeric', value: str(ui.val['sgst:' + r.id] != null ? ui.val['sgst:' + r.id] : (p.students != null ? p.students : ev.students)), 'data-focus': id + '-st', oninput: (e) => { ui.val['sgst:' + r.id] = e.target.value; } })),
          field(id + '-ch', 'Chaperones', el('input', { id: id + '-ch', class: 'ds-select', type: 'number', min: '0', inputmode: 'numeric', value: str(ui.val['sgch:' + r.id] != null ? ui.val['sgch:' + r.id] : (p.guests != null ? p.guests : p.chaperones != null ? p.chaperones : guestsOf(ev))), 'data-focus': id + '-ch', oninput: (e) => { ui.val['sgch:' + r.id] = e.target.value; } }))
        ]));
        build = () => {
          const s = num(ui.val['sgst:' + r.id] != null ? ui.val['sgst:' + r.id] : (p.students != null ? p.students : ev.students));
          const c = num(ui.val['sgch:' + r.id] != null ? ui.val['sgch:' + r.id] : (p.guests != null ? p.guests : p.chaperones != null ? p.chaperones : guestsOf(ev)));
          return { patch: { students: s, guests: c }, summary: headText(s, c) };
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
      const card = el('article', { class: 'ds-card ds-req ds-s-' + (r.status || 'waiting') + (ui.fresh[r.id] && open ? ' is-new' : ''), 'aria-labelledby': hid, 'data-tour': 'desk-card', 'data-req-kind': str(r.kind) });
      card.appendChild(el('div', { class: 'ds-card-top' }, [
        chip(tone[0], tone[1], tone[2]),
        ui.fresh[r.id] && open ? chip('new', 'New') : null,
        sentAt ? el('span', { class: 'ds-sent', text: 'Sent ' + sentAt }) : null
      ]));
      card.appendChild(el('h3', { id: hid, text: whoOf(r) }));
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
      const who = ev ? str(ev.title || ev.name) : familyLabel(st);
      const hid = 'ds-h-t-' + t.id;
      const open = t.last.from === 'family';
      const card = el('article', { class: 'ds-card ds-msg ds-s-' + (open ? 'waiting' : 'yes') + (ui.fresh['t:' + t.id] && open ? ' is-new' : ''), 'aria-labelledby': hid, 'data-tour': 'desk-card' });
      const sentAt = sentText(t.last.at, st.today);
      card.appendChild(el('div', { class: 'ds-card-top' }, [chip('pink', 'Question', 'chat'), ui.fresh['t:' + t.id] && open ? chip('new', 'New') : null, sentAt ? el('span', { class: 'ds-sent', text: (open ? 'Sent ' : 'You wrote ') + sentAt }) : null]));
      card.appendChild(el('h3', { id: hid, text: ev ? who + ' wrote to you' : who + ' asks the farm' }));
      const chat = el('ol', { class: 'ds-chat', 'aria-label': 'Messages' });
      t.msgs.slice(-4).forEach((m) => chat.appendChild(el('li', { class: 'ds-bubble ds-from-' + m.from }, [el('span', { class: 'ds-bubble-who', text: m.from === 'family' ? (ev ? 'They wrote' : 'They wrote') : 'You wrote' }), el('p', { text: m.text })])));
      card.appendChild(chat);
      if (open) {
        card.appendChild(field('reply-' + t.id, 'Your reply', textBox('reply-' + t.id, 'reply:' + t.id, 3)));
        card.appendChild(el('div', { class: 'ds-actions' }, [
          bigBtn('btn-green', 'Send reply', 'check', () => {
            const text = (ui.val['reply:' + t.id] || '').trim();
            if (!text) { say('Write a few words first.'); const box = doc.getElementById('reply-' + t.id); if (box) box.focus(); return; }
            ui.sent['t:' + t.id] = true; ui.focus = 'res:t:' + t.id; delete ui.val['reply:' + t.id];
            S.post(t.id, 'cathy', text);
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
      const card = el('article', { class: 'ds-card ds-appr ds-s-' + (open ? 'waiting' : it.status === 'approved' ? 'yes' : 'no'), 'aria-labelledby': hid });
      card.appendChild(el('div', { class: 'ds-card-top' }, [chip('pink', isReview ? 'Review' : 'Photo', isReview ? 'star' : 'camera'), it.at ? el('span', { class: 'ds-sent', text: 'Sent ' + sentText(it.at, st.today) }) : null]));
      card.appendChild(el('h3', { id: hid, text: (isReview ? 'Review from ' : 'Photo from ') + familyLabel(st) }));
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
          ui.sent['a:' + it.coll + it.id] = true; ui.focus = 'res:a:' + it.coll + it.id;
          if (it.coll === 'reviews') S.decideReview(it.id, ok);
          else S.decidePhoto(it.id, ok);   // both tell the family (the store makes the notice)
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
      visits.forEach((v) => lines.push(el('li', null, [el('strong', { text: timeText(v.time) }), ' ' + familyLabel(st) + ' · ' + plural(people(v), 'person', 'people') + (packageOf(v) === 'pizza' ? ' · with pizza' : ' · farm only') + (v.closed ? ' · told about the closing' : '')])));
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
     * render: draw everything from the store's state
     * ---------------------------------------------------------------- */
    function render() {
      st = readState(S, D);
      const active = doc.activeElement;
      const hadFocus = active && root.contains(active) ? active.getAttribute('data-focus') : '';

      const any = hasData(st);
      parts.empty.hidden = any;
      main.hidden = !any;
      if (!any) { if (!ui.seen) ui.seen = {}; return; }   // an empty desk that is open: whatever arrives next is new

      // requests for Mrs. Cathy
      const reqs = st.requests.filter((r) => r.to === 'cathy' || r.to === 'farm');
      const waitingReqs = reqs.filter((r) => r.status === 'waiting');
      const later = reqs.filter((r) => r.status !== 'waiting' && !ui.sent[r.id]);
      const threads = threadsOf(st);
      const needReply = threads.filter((t) => t.last.from === 'family');
      const laterThreads = threads.filter((t) => t.last.from !== 'family' && !ui.sent['t:' + t.id] && threadEvent(st, t.id) === null);
      const apprAll = approvalItems(st);
      const apprOpen = apprAll.filter((a) => a.status === 'waiting');
      const apprDone = apprAll.filter((a) => a.status !== 'waiting' && !ui.sent['a:' + a.coll + a.id]);

      // The family answered a suggestion, or took a request back: say it once (what Mrs. Cathy herself just did is said when she does it)
      reqs.forEach((r) => {
        const was = ui.status[r.id];
        if (was !== undefined && was !== r.status && (r.status === 'accepted' || r.status === 'declined' || r.status === 'cancelled')) {
          say(whoOf(r) + (r.status === 'accepted' ? ' said OK to your suggestion.' : r.status === 'declined' ? ' said no thanks to your suggestion.' : ' took a request back.'));
        }
        ui.status[r.id] = r.status;
      });

      // "New" marks: things that arrived while this screen was open
      const nowKeys = {};
      waitingReqs.forEach((r) => { nowKeys[r.id] = 1; });
      needReply.forEach((t) => { nowKeys['t:' + t.id] = 1; });
      if (ui.seen) {
        const fresh = [];
        Object.keys(nowKeys).forEach((k) => { if (!ui.seen[k]) { ui.fresh[k] = true; fresh.push(k); } });
        if (fresh.length) {
          const first = fresh[0];
          const r = byId(waitingReqs, first);
          say('New: ' + (r ? whoOf(r) + ' asks: ' + reqAsk(r) : 'a question') + '.');
        }
      }
      ui.seen = nowKeys;

      // Waiting for you
      const nWaiting = waitingReqs.length + needReply.length;
      parts.waitingBadge.textContent = String(nWaiting);
      parts.waitingBadge.setAttribute('data-n', String(nWaiting));
      setHeadSr(parts.waitingBadge, nWaiting, 'waiting');
      const items = [];
      // oldest first, and an answered card stays exactly where it was (the sort is stable and ignores the status: same moment, same place)
      const ordered = [];
      reqs.forEach((r) => { if (r.status === 'waiting' || ui.sent[r.id]) ordered.push({ at: stamp(reqSent(r)), r }); });
      threads.forEach((t) => { if (t.last.from === 'family' || ui.sent['t:' + t.id]) ordered.push({ at: t.since, t }); });
      ordered.sort((a, b) => a.at - b.at);
      ordered.forEach((o) => {
        if (o.r) {
          const r = o.r, tgt = kindOf(r) === 'group' ? eventOf(st, r) : visitOf(st, r);
          items.push({ key: 'r:' + r.id, sig: JSON.stringify([r, tgt, !!ui.fresh[r.id], ui.mode[r.id] || '', st.account && st.account.name, st.today]), make: () => requestCard(r) });
        } else {
          const t = o.t;
          items.push({ key: 't:' + t.id, sig: JSON.stringify([t.msgs.slice(-4), !!ui.fresh['t:' + t.id], !!ui.sent['t:' + t.id], st.events.length]), make: () => messageCard(t) });
        }
      });
      sync(parts.waitingList, items);
      const emptyW = parts.waiting.body.querySelector('[data-for="waiting"]');
      emptyW.hidden = nWaiting > 0;
      emptyW.textContent = items.length ? 'Everything is answered. A new request or question shows up here by itself.' : 'Nothing is waiting for you. When a family asks for a change or sends a question, it shows up here by itself.';

      // pizza changes are the kitchen's to answer: only a pointer here, never a button to answer them
      const kitchenWaiting = st.requests.filter((r) => r.to === 'kitchen' && r.status === 'waiting').length;
      parts.kitchenNote.hidden = kitchenWaiting === 0;
      if (kitchenWaiting) {
        parts.kitchenNote.textContent = '';
        parts.kitchenNote.appendChild(icon('pizza'));
        parts.kitchenNote.appendChild(el('span', { text: 'The kitchen answers pizza changes: ' + kitchenWaiting + ' waiting there. ' }));
        parts.kitchenNote.appendChild(el('a', { href: 'kitchen.html', text: 'Open the kitchen screen' }));
      }

      // Answered earlier
      const answered = later.slice().sort((a, b) => stamp(reqSent(b)) - stamp(reqSent(a))).slice(0, 6);
      const aItems = answered.map((r) => {
        const tgt = kindOf(r) === 'group' ? eventOf(st, r) : visitOf(st, r);
        return { key: 'r:' + r.id, sig: JSON.stringify([r, tgt, 'old']), make: () => requestCard(r) };
      });
      laterThreads.slice(-3).forEach((t) => aItems.push({ key: 't:' + t.id, sig: JSON.stringify([t.msgs.slice(-4), 'old']), make: () => messageCard(t) }));
      sync(parts.answeredList, aItems);
      parts.answeredHead.hidden = aItems.length === 0;
      parts.answeredList.hidden = aItems.length === 0;

      // Photos and reviews
      parts.approvalsBadge.textContent = String(apprOpen.length);
      parts.approvalsBadge.setAttribute('data-n', String(apprOpen.length));
      setHeadSr(parts.approvalsBadge, apprOpen.length, 'to look at');
      const ap = apprAll.filter((a) => a.status === 'waiting' || ui.sent['a:' + a.coll + a.id]).sort((a, b) => stamp(a.at) - stamp(b.at)).map((a) => ({ key: a.coll + a.id, sig: JSON.stringify([a, a.visitId ? byId(st.visits, a.visitId) : null]), make: () => approvalCard(a) }));
      sync(parts.approvalsList, ap);
      sync(parts.approvalsDone, apprDone.slice(-4).map((a) => ({ key: a.coll + a.id, sig: JSON.stringify([a, 'old']), make: () => approvalCard(a) })));
      const emptyA = parts.approvals.body.querySelector('[data-for="approvals"]');
      emptyA.hidden = ap.length > 0 || apprDone.length > 0;
      emptyA.textContent = 'No photos or reviews to look at.';

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

      // the three tiles at the top
      const totalPeople = pr.reduce((n, r) => n + r.n, 0);
      const tiles = [
        ['desk-waiting', nWaiting, 'Waiting for you', 'bell', 'ask'],
        ['desk-approvals', apprOpen.length, 'Photos and reviews to look at', 'camera', 'ask'],
        ['desk-people', totalPeople, 'People waiting for news', 'users', 'info']
      ];
      sync(parts.tiles, tiles.map((t) => ({
        key: t[0], sig: JSON.stringify(t),
        make: () => el('li', null, [el('a', { class: 'ds-tile ds-tile-' + t[4] + (t[1] ? ' has' : ''), href: '#' + t[0] }, [icon(t[3]), el('span', { class: 'ds-tile-n', text: String(t[1]) }), el('span', { class: 'ds-tile-l', text: t[2] })])])
      })));

      // put the keyboard focus back where it was, or where the last action asked for
      const want = ui.focus || hadFocus;
      ui.focus = '';
      if (want) {
        const now = doc.activeElement;
        if (ui.focusAsked || !now || now === doc.body || !root.contains(now) || now.getAttribute('data-focus') !== want) {
          const target = root.querySelector('[data-focus="' + want.replace(/"/g, '\\"') + '"]');
          if (target && target !== now) { try { target.focus({ preventScroll: false }); } catch (e) { target.focus(); } }
        }
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
    const unsub = S.subscribe(() => { render(); });
    render();
    return { render, destroy() { unsub(); }, ui };
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
