/* The tour, chapter 10: the account demo (PRETEND). Written for Mrs. Cathy and Rob; English only.
 *
 * What this file is: 25 steps (order 1001 to 1025) that walk through the pretend account pages (account.html, farm-desk.html, kitchen.html).
 * The engine (js/tour.js) merges them with the steps of js/tour-steps.js and js/tour-steps-b.js and sorts them by order.
 * The words of the cards are the only thing the owners read; the rest of the file makes the demo ready for each card.
 *
 * How the demo is driven: the tour never clicks for the owner. It uses the demo's own store (js/demo-store.js, js/demo-data.js, the names are in
 * docs/ACCOUNT_DEMO.md): createAccount, seedSample, ask, reply, respond, setAlert, fireAlert, post, submitReview, decideReview, closeDay, openDay.
 * Rules this file keeps:
 *   - Every change to the demo is made in before() of the step that SHOWS the result, never in an after(), so Back never answers a request.
 *   - Every before() can run twice, or out of order (the owner goes Back): it looks at what the store holds now and only does what is missing.
 *     When a request is already past the stage a step needs, the sample family is made again (seedSample) or the pizza part is put back.
 *   - Everything is guarded. Without window.DemoStore (demo mode off) a before() does nothing; if a call fails, the target is not found and the
 *     engine skips the step (skipIfMissing). Nothing here ever throws into the page.
 *   - before() does not read its argument (a test calls it with an empty one) and returns a Promise that settles when the step's target is on
 *     the screen (3 seconds at most).
 * Prices in the texts are the site's own (index.html): $31 base price with 2 pizzas, $3 per person ages 3 and up, wagon ride $4.50, barrel train $3
 * per child, gluten-free crust +$9, vegan cheese +$3, school tours $11 per student (at least 100 students). Never write another number here.
 * The hooks (data-tour="...") are listed in work-notes/ACCOUNT-DEMO-PLAN.md; C put data-req-kind on the request cards of the desk. */
(function () {
  'use strict';

  var CHAPTER = 10;

  function hook(name) { return '[data-tour="' + name + '"]'; }
  var BAR = hook('demo-bar');

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  function ready() { return !!(window.DemoStore && window.DemoData); }
  function D() { return window.DemoData; }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  // A store call that never throws: the answer, or null.
  function call(name) {
    var s = window.DemoStore, args = Array.prototype.slice.call(arguments, 1), v;
    if (!s || typeof s[name] !== 'function') return null;
    try { v = s[name].apply(s, args); } catch (e) { return null; }
    return v === undefined ? null : v;
  }
  function rows(coll) { return call('list', coll) || []; }

  // Waits (without blocking the page) until test() gives something, up to ms milliseconds; settles with that thing, or null.
  function until(test, ms) {
    return new Promise(function (resolve) {
      var t0 = new Date().getTime();
      (function poll() {
        var v = null;
        try { v = test(); } catch (e) { v = null; }
        if (v) { resolve(v); return; }
        if (new Date().getTime() - t0 > ms) { resolve(null); return; }
        setTimeout(poll, 50);
      })();
    });
  }
  function firstVisible(selector) {
    var all = document.querySelectorAll(selector), i, r;
    for (i = 0; i < all.length; i++) {
      r = all[i].getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return all[i];
    }
    return null;
  }
  function seen(selector) { return until(function () { return firstVisible(selector); }, 3000); }

  // The family screens are tabs on one page (account.html). The demo's own function DemoApp.go(name) opens one; the tab that shows now is DemoApp.route().name.
  // If that function is missing, the tab's own link is pressed instead (it has data-tab="<name>").
  function openTab(name) {
    var app = window.DemoApp, now = null;
    try { now = app && typeof app.route === 'function' ? app.route().name : null; } catch (e) { now = null; }
    if (app && typeof app.go === 'function') {
      try { if (now !== name) app.go(name); } catch (e) { /* the target will not be found and the engine skips the card */ }
      return Promise.resolve(true);
    }
    return until(function () { return document.querySelector('[data-demo-app] [data-tab="' + name + '"]'); }, 2500).then(function (link) {
      if (link && link.getAttribute('aria-current') !== 'page') link.click();
      return true;
    });
  }

  /* ------------------------------------------------------------------ *
   * The sample family and its visit
   * ------------------------------------------------------------------ */
  function today() { return String(call('today') || D().today()); }
  function upcoming() {   // the next visit (the sample one)
    var t = today(), best = null;
    rows('visits').forEach(function (v) { if (v.date >= t && (!best || v.date < best.date)) best = v; });
    return best;
  }
  function lastVisit() {   // the most recent visit that is over
    var t = today(), best = null;
    rows('visits').forEach(function (v) { if (v.date < t && (!best || v.date > best.date)) best = v; });
    return best;
  }
  function lastRequest(coll, id, kind) {   // the newest request about this visit or order
    var all = call('requestsFor', coll, id) || [], i;
    for (i = all.length - 1; i >= 0; i--) if (all[i].kind === kind) return all[i];
    return null;
  }
  // A signed-in sample family with a visit to come. A new one is made when there is none, or when its visit is already over.
  function account() {
    if (call('current') && upcoming()) return true;
    call('reset');
    call('createAccount', D().SAMPLE_ACCOUNT);
    return !!(call('current') && upcoming());
  }

  /* ------------------------------------------------------------------ *
   * Story 1: the family asks to move the visit, Mrs. Cathy answers
   * ------------------------------------------------------------------ */
  function visitRequest() { var v = upcoming(); return v ? lastRequest('visits', v.id, 'visit-change') : null; }
  function laterOpenDay(v) {   // the first open day after the visit's day
    var days = call('openDays', v.date, v.package, 12) || [], i;
    for (i = 0; i < days.length; i++) if (days[i] > v.date) return days[i];
    return null;
  }
  function sampleTime(v) {   // 1:00 pm when the sample times have it, and not the time the visit has now
    var slots = (D().SLOTS || []).filter(function (x) { return x !== v.time; }), i;
    for (i = 0; i < slots.length; i++) if (slots[i] === '13:00') return slots[i];
    return slots[0] || v.time;
  }
  function askVisit() {
    var v = upcoming(), day = v ? laterOpenDay(v) : null, time;
    if (!v || !day) return null;
    time = sampleTime(v);
    return call('ask', {
      kind: 'visit-change', to: 'cathy', from: 'family', target: { coll: 'visits', id: v.id }, patch: { date: day, time: time },
      summary: 'Move ' + D().dateLong(v.date) + ', ' + D().time12(v.time) + ' to ' + D().dateLong(day) + ', ' + D().time12(time),
      note: 'Another day works better for us.'
    });
  }
  function answerVisit(r) { return call('reply', r.id, { answer: 'yes', note: 'Yes, that works. See you then!' }); }
  // want: 'none' (no request yet), 'waiting' (a request waits for Mrs. Cathy), 'answered' (she has answered)
  function visitIs(want) {
    var r;
    if (!account()) return;
    r = visitRequest();
    if (want === 'none') { if ((call('list', 'requests') || []).length || rows('closedDays').length) call('seedSample'); return; }
    if (want === 'waiting') {
      if (r && r.status === 'waiting') return;
      if (r && r.status !== 'cancelled') call('seedSample');   // it was answered already: begin again from the clean sample
      askVisit();
      return;
    }
    if (r && r.status === 'waiting') { answerVisit(r); return; }
    if (r && r.status !== 'cancelled') return;
    r = askVisit();
    if (r) answerVisit(r);
  }

  /* ------------------------------------------------------------------ *
   * Story 2: the family asks the kitchen for an earlier pick-up, the kitchen offers a later time, the family says OK
   * ------------------------------------------------------------------ */
  var STAGE = { none: 0, waiting: 1, suggested: 2, accepted: 3 };
  function pizzaScene() {
    var v = upcoming(), o = null;
    if (!v) return null;
    rows('orders').forEach(function (x) { if (!o && x.visitId === v.id) o = x; });
    return o ? { v: v, o: o } : null;
  }
  function pizzaRequest(c) { return lastRequest('orders', c.o.id, 'pizza-change'); }
  function pizzaClear(c) {   // no open request, and the pick-up back at 1 hour after the visit
    var r = pizzaRequest(c), back = D().defaultPickup(c.v.time);
    if (r && (r.status === 'waiting' || r.status === 'suggested')) call('cancel', r.id);
    if (c.o.pickup !== back || c.o.status !== 'new') call('update', 'orders', c.o.id, { pickup: back, status: 'new' });
  }
  function askPizza(c) {
    var early = D().addMinutes(c.v.time, 30);
    return call('ask', {
      kind: 'pizza-change', to: 'kitchen', from: 'family', target: { coll: 'orders', id: c.o.id }, patch: { pizzas: clone(c.o.pizzas), pickup: early },
      summary: 'Pizza ready at ' + D().time12(early) + ' instead of ' + D().time12(D().defaultPickup(c.v.time)),
      note: 'Could the pizza be ready a little earlier?'
    });
  }
  function suggestPizza(c, r) {   // the kitchen: "Change it", a little later than asked
    var later = D().addMinutes(c.v.time, 45);
    return call('reply', r.id, {
      answer: 'suggest', note: 'We can have it ready at ' + D().time12(later) + '.',
      suggestion: { patch: { pizzas: clone(c.o.pizzas), pickup: later }, summary: 'Same pizzas, ready at ' + D().time12(later) }
    });
  }
  // want: 'none', 'waiting' (the kitchen has to answer), 'suggested' (the kitchen offered a time), 'accepted' (the family said OK)
  function pizzaIs(want) {
    var c, r, have;
    if (!account()) return;
    c = pizzaScene();
    if (!c) return;
    r = pizzaRequest(c);
    have = r && STAGE[r.status] ? STAGE[r.status] : 0;
    if (want === 'none' || have > STAGE[want] || (r && !have)) { pizzaClear(c); r = null; have = 0; }   // past the stage, or ended in another way: start the pizza part again
    if (want === 'none') return;
    if (!have) { r = askPizza(c); have = r ? 1 : 0; }
    if (r && have < 2 && STAGE[want] >= 2) { r = suggestPizza(c, r); have = r ? 2 : have; }
    if (r && have < 3 && STAGE[want] >= 3) call('respond', r.id, 'ok');
  }

  /* ------------------------------------------------------------------ *
   * Alerts, questions, reviews, weather
   * ------------------------------------------------------------------ */
  function alertNotice(key) {
    var kinds = D().alertKinds || [], i;
    for (i = 0; i < kinds.length; i++) if (kinds[i].key === key) return kinds[i].notice;
    return '';
  }
  function alertOn() { if (account()) call('setAlert', 'pumpkins', true); }
  function alertSent() {   // the farm sends the alert once
    var text = alertNotice('pumpkins'), got = false;
    alertOn();
    (call('noticesFor', 'family') || []).forEach(function (n) { if (n.text === text) got = true; });
    if (!got) call('fireAlert', 'pumpkins');
  }

  var QUESTION = 'Where do we park?';
  var REPLY = 'We are in a neighborhood on Hartis Road with limited parking. Vehicles are not allowed in the fields, barn or garden areas.';   // the FAQ's own words
  function questionSent() {
    var asked = false, answered = false;
    if (!account()) return;
    (call('thread', 'farm') || []).forEach(function (m) { if (m.text === QUESTION) asked = true; if (m.text === REPLY) answered = true; });
    if (!asked) call('post', 'farm', 'family', QUESTION);
    if (!answered) call('post', 'farm', 'cathy', REPLY);
  }

  var REVIEW = 'Sample review: a lovely day for the whole family.';
  function sampleReview() { var mine = null; rows('reviews').forEach(function (r) { if (r.text === REVIEW) mine = r; }); return mine; }
  function reviewWaiting() {   // a review that waits for Mrs. Cathy
    var past, mine;
    if (!account()) return;
    mine = sampleReview();
    past = lastVisit();
    if (!mine && past) call('submitReview', { visitId: past.id, stars: 5, text: REVIEW });
    else if (mine && mine.status !== 'waiting') call('update', 'reviews', mine.id, { status: 'waiting' });
  }
  function reviewApproved() {
    var mine = sampleReview();
    if (mine && mine.status === 'waiting') call('decideReview', mine.id, true);
  }

  function daysOpened() {   // every closed day opens again
    rows('closedDays').forEach(function (d) { call('openDay', typeof d === 'string' ? d : d.date); });
  }
  function dayClosed() {   // the day of the family's visit is closed for weather
    var v;
    if (!account()) return;
    v = upcoming();
    if (v && !v.closed) call('closeDay', v.date, 'weather');
  }

  /* ------------------------------------------------------------------ *
   * A card's before(): make the demo ready (prepare), open the tab, wait for the target
   * ------------------------------------------------------------------ */
  // The last argument is a second thing to wait for (the kitchen card shows its Yes / No / Change it buttons a moment after the card).
  function scene(prepare, target, tab, also) {
    return function () {
      var opened;
      if (!ready()) return;
      try { if (prepare) prepare(); } catch (e) { /* the target will not be found and the engine skips the card */ }
      opened = tab ? openTab(tab) : Promise.resolve(true);
      return opened.then(function () { return target ? seen(target) : true; }).then(function (found) {
        return also && found ? seen(also).then(function () { return found; }) : found;
      });
    };
  }

  /* ------------------------------------------------------------------ *
   * The steps
   * ------------------------------------------------------------------ */
  var steps = [
    {
      id: 'ch10-intro', order: CHAPTER * 100 + 1, chapter: CHAPTER, page: 'account', target: BAR, skipIfMissing: true,
      title: 'A pretend account',
      text: 'This part is a demo of accounts. Nothing in it is real: no server, no real families, and nothing is sent to anyone. This strip says so on every demo screen. The Start over button clears the demo.'
    },
    {
      id: 'ch10-signup', order: CHAPTER * 100 + 2, chapter: CHAPTER, page: 'account', target: hook('acct-signup'), skipIfMissing: true,
      title: 'Create an account',
      text: 'A visitor types a name and an email. In this demo any password works and nothing is saved on a server. Press Next and the tour creates a sample family for you.',
      before: scene(function () { if (ready() && call('current')) call('reset'); }, hook('acct-signup'))
    },
    {
      id: 'ch10-sample', order: CHAPTER * 100 + 3, chapter: CHAPTER, page: 'account', target: hook('acct-visit-card'), skipIfMissing: true,
      title: 'My visits, with a sample family',
      text: 'The tour added a made-up family with a visit and a pizza order, so you can try every button. The card shows the day, the time, who is coming and what was booked.',
      before: scene(function () { visitIs('none'); }, hook('acct-visit-card'), 'visits')
    },
    {
      id: 'ch10-paid', order: CHAPTER * 100 + 4, chapter: CHAPTER, page: 'account', target: hook('acct-paid'), skipIfMissing: true,
      title: 'What was paid',
      text: "Every paid line is listed, with the total. The sample uses your site's prices: the $31 base price with 2 pizzas and $3 per person ages 3 and up. The wagon ride is $4.50 (ages 3 and younger ride free) and the barrel train $3 per child.",
      before: scene(function () { visitIs('none'); }, hook('acct-paid'), 'visits')
    },
    {
      id: 'ch10-request', order: CHAPTER * 100 + 5, chapter: CHAPTER, page: 'account', target: hook('acct-request-day'), skipIfMissing: true,
      title: 'Request a different day',
      text: 'A family can ask to move its visit. It picks one of the next open days and a sample time. Nothing changes until Mrs. Cathy says yes. Press Next and the tour sends a sample request.',
      before: scene(function () { visitIs('none'); }, hook('acct-request-day'), 'visits')
    },
    {
      id: 'ch10-waiting', order: CHAPTER * 100 + 6, chapter: CHAPTER, page: 'account', target: hook('acct-request-status'), skipIfMissing: true,
      title: 'Waiting for a reply',
      text: "The tour sent the request. The family now sees 'Waiting for a reply from Mrs. Cathy' and can cancel it. The visit does not change until she answers.",
      before: scene(function () { visitIs('waiting'); }, hook('acct-request-status'), 'visits')
    },
    {
      id: 'ch10-desk-request', order: CHAPTER * 100 + 7, chapter: CHAPTER, page: 'farm-desk', target: hook('desk-card') + '[data-req-kind="visit-change"]', skipIfMissing: true, allowClicks: true,
      title: 'Your desk, with the request waiting',
      text: "This is your side. The request waits here with the family's name and note. Yes moves the visit, No keeps it, and Suggest offers another day. Try one, or press Next and the tour says Yes.",
      before: scene(function () { visitIs('waiting'); }, hook('desk-card') + '[data-req-kind="visit-change"]')
    },
    {
      id: 'ch10-answer', order: CHAPTER * 100 + 8, chapter: CHAPTER, page: 'account', target: hook('acct-reply'), skipIfMissing: true,
      title: 'The answer arrives',
      text: 'Back on the family side, your answer is already here. A yes moves the visit. A no keeps it and shows your note. A suggestion asks the family to say OK. The bell at the top counts it too.',
      before: scene(function () { visitIs('answered'); }, hook('acct-reply'), 'visits')
    },
    {
      id: 'ch10-pizza', order: CHAPTER * 100 + 9, chapter: CHAPTER, page: 'account', target: hook('acct-pizza-card'), skipIfMissing: true,
      title: 'My pizza',
      text: "The family sees its pizza order: each pizza, the pick-up time and the price lines. The pizza is ready 1 hour after the visit time, as on your packages. The family's allergies show next to it.",
      before: scene(function () { pizzaIs('none'); }, hook('acct-pizza-card'), 'pizza')
    },
    {
      id: 'ch10-pizza-edit', order: CHAPTER * 100 + 10, chapter: CHAPTER, page: 'account', target: hook('acct-pizza-edit'), skipIfMissing: true,
      title: 'Change everything',
      text: 'A family can change how many pizzas, the toppings, the type, gluten-free crust, vegan cheese and the pick-up time. Your menu prices apply: gluten-free crust is +$9 and vegan cheese is +$3. Next, the tour asks the kitchen for an earlier time.',
      before: scene(function () { pizzaIs('none'); }, hook('acct-pizza-edit'), 'pizza')
    },
    {
      id: 'ch10-kitchen', order: CHAPTER * 100 + 11, chapter: CHAPTER, page: 'kitchen', target: hook('kit-card'), skipIfMissing: true, allowClicks: true,
      title: 'The kitchen screen',
      text: "The kitchen sees the time before and after, and the family's allergy note. Yes accepts, No keeps the old time, Change it offers another. Try one, or press Next and the tour offers a later time.",
      before: scene(function () { pizzaIs('waiting'); }, hook('kit-card'), null, hook('kit-yes'))
    },
    {
      id: 'ch10-family-ok', order: CHAPTER * 100 + 12, chapter: CHAPTER, page: 'account', target: hook('acct-reply'), skipIfMissing: true, allowClicks: true,
      title: 'The family says OK',
      text: "The kitchen offered a time a little later than asked. The family sees the old and new time and can say OK, or 'No thanks, keep mine'. Press Next and the tour says OK for you.",
      before: scene(function () { pizzaIs('suggested'); }, hook('acct-reply'), 'pizza')
    },
    {
      id: 'ch10-family', order: CHAPTER * 100 + 13, chapter: CHAPTER, page: 'account', target: hook('acct-family'), skipIfMissing: true,
      title: 'My family',
      text: "The family saves its adults, kids' names and ages, and allergies once. The kitchen sees the allergies on pizza orders. Your site keeps almost nothing about visitors today, so a real version needs extra care with kids' details.",
      before: scene(function () { pizzaIs('accepted'); }, hook('acct-family'), 'family')
    },
    {
      id: 'ch10-alerts', order: CHAPTER * 100 + 14, chapter: CHAPTER, page: 'account', target: hook('acct-alerts'), skipIfMissing: true, allowClicks: true,
      title: 'Tell me when',
      text: 'Families choose where messages go: text, email or both. The first choice is a spot on a full day. For visits there are two kinds of "when": a spot opens, or reservations open. Strawberries, blueberries and sunflowers, pumpkins and tomatoes, and Christmas trees follow.',
      before: scene(alertOn, hook('acct-alerts'), 'alerts')
    },
    {
      id: 'ch10-desk-people', order: CHAPTER * 100 + 15, chapter: CHAPTER, page: 'farm-desk', target: hook('desk-people'), skipIfMissing: true,
      title: 'Who is waiting for news',
      text: 'Your desk counts the families waiting for each kind of news, and for each full day. The switch the tour turned on shows as 1. One button sends the alert. In this demo nothing leaves the browser.',
      before: scene(alertOn, hook('desk-people'))
    },
    {
      id: 'ch10-bell', order: CHAPTER * 100 + 16, chapter: CHAPTER, page: 'account', target: hook('acct-bell'), skipIfMissing: true,
      title: 'The alert arrives',
      text: 'The tour sent the alert. The family sees it in the bell at the top. Replies, alerts and weather notices all land there, and each one links to the right screen.',
      before: scene(alertSent, hook('acct-bell'))
    },
    {
      id: 'ch10-year', order: CHAPTER * 100 + 17, chapter: CHAPTER, page: 'account', target: hook('acct-year'), skipIfMissing: true,
      title: 'My year',
      text: 'The badges shown here are samples. The game on the home page keeps badges for one visit only and saves nothing, on purpose, for privacy. A real account could keep them.',
      before: scene(account, hook('acct-year'), 'year')
    },
    {
      id: 'ch10-messages', order: CHAPTER * 100 + 18, chapter: CHAPTER, page: 'account', target: hook('acct-messages'), skipIfMissing: true,
      title: 'Receipts and questions',
      text: 'Receipts are kept here, line by line. A family can also ask the farm a question, and your reply shows in the same place. The tour sent a sample question and reply.',
      before: scene(questionSent, hook('acct-messages'), 'messages')
    },
    {
      id: 'ch10-photos', order: CHAPTER * 100 + 19, chapter: CHAPTER, page: 'account', target: hook('acct-photos'), skipIfMissing: true,
      title: 'Photos and reviews',
      text: 'After a visit a family can send stars, words and a picture (one of three samples here). The tour sent a sample review. It stays private until Mrs. Cathy approves it, and never reaches your real reviews or gallery.',
      before: scene(reviewWaiting, hook('acct-photos'), 'photos')
    },
    {
      id: 'ch10-desk-approve', order: CHAPTER * 100 + 20, chapter: CHAPTER, page: 'farm-desk', target: hook('desk-approvals'), skipIfMissing: true,
      title: 'Approve before it shows',
      text: 'Reviews and photos wait here for you. Approve shows it as shared. Not now keeps it private. The tour approves the sample when you go on.',
      before: scene(reviewWaiting, hook('desk-approvals'))
    },
    {
      id: 'ch10-event', order: CHAPTER * 100 + 21, chapter: CHAPTER, page: 'account', target: hook('acct-event'), skipIfMissing: true,
      title: 'My event, for groups and schools',
      text: 'A school sees its trip here: head count, checklist, payment status and messages. A head count change is a request to you. The sample follows your school tour prices: $11 per student, at least 100 students.',
      before: scene(function () { if (account()) reviewApproved(); }, hook('acct-event'), 'event')
    },
    {
      id: 'ch10-desk-weather', order: CHAPTER * 100 + 22, chapter: CHAPTER, page: 'farm-desk', target: hook('desk-weather'), skipIfMissing: true,
      title: 'Close a day for weather',
      text: 'Pick a day and close it. Every family booked that day gets a notice at once. Today your site says you email each family if severe weather closes the farm. The tour closes a day for you next.',
      before: scene(function () { if (account()) daysOpened(); }, hook('desk-weather'))
    },
    {
      id: 'ch10-closed', order: CHAPTER * 100 + 23, chapter: CHAPTER, page: 'account', target: hook('acct-closed-banner'), skipIfMissing: true,
      title: 'Every booked family sees it',
      text: 'The tour closed the day for weather. The booked family now sees that the farm is closed that day, with a button to pick a new day. One tap starts a request to you.',
      before: scene(dayClosed, hook('acct-closed-banner'), 'visits')
    },
    {
      id: 'ch10-real-needs', order: CHAPTER * 100 + 24, chapter: CHAPTER, page: 'account', target: BAR, skipIfMissing: true,
      title: 'What a real version needs',
      text: 'A real version would need:\n- a safe place for logins\n- a link to your booking tool\n- alerts to Mrs. Cathy and the kitchen\n- extra care with kids\' information\n- an updated privacy page'
    },
    {
      id: 'ch10-worth-asking', order: CHAPTER * 100 + 25, chapter: CHAPTER, page: 'account', target: BAR, skipIfMissing: true,
      title: 'Worth asking your booking tool',
      text: 'Your booking tool (Bookeo) may already do part of this. Your FAQ says guests can click View Booking in their email to change a reservation. Ask what else it offers before building anything.'
    }
  ];

  var all = (window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []);
  steps.forEach(function (s) { all.push(s); });
})();
