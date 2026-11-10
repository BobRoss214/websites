/*
 * The words of the tour "Take a tour": chapters 1 to 5 and 11, and the titles of all the chapters.
 * (Chapters 6 to 9 are in js/tour-steps-b.js and chapter 10, the pretend account demo, in js/tour-steps-c.js.)
 * The tour is only for Mrs. Cathy and Rob. It never starts by itself: js/tour.js (the engine) loads these files when somebody opens the tour.
 *
 * HOW A STEP IS WRITTEN
 *   id             a short name, never used twice ("ch2-strip": chapter 2, the strip)
 *   order          chapter * 100 + the place in the chapter (205 = chapter 2, fifth step). The engine sorts by it, so gaps are fine.
 *   chapter        the number of the chapter (its title is in WA_TOUR_CHAPTERS below)
 *   page           'index' (the home page), 'first-visit', 'account', 'farm-desk' or 'kitchen'
 *   target         ONE CSS selector for the thing to light up, or null for a card in the middle of the screen.
 *                  The engine takes the first VISIBLE match, so a selector may also match hidden things.
 *   title, text    plain English: "you", short sentences (25 words at most), the whole text 45 words at most.
 *                  In text, a line break is \n and a line that starts with "- " is a bullet.
 *   allowClicks    leave it out: the lit part can be used (a question opens, a tab changes, a menu opens) and nothing else can, and a link that leaves the page is switched off.
 *                  What a lit button opens is lit too and can be used: a list under a menu bar, the bell's panel (the button says so in aria-controls and aria-expanded),
 *                  and a dialog of the pretend account (it sits above the dimmer). So no step needs more than this. false: nothing can be clicked.
 *                  (true is the whole page; no step uses it.)
 *   also           optional: a CSS selector (or a list of them) for a part that is lit and can be used together with the target. Only the basket game uses it:
 *                  its picture is the playground (#hero-scene), and the menu and the links around it stay locked.
 *   choices        optional: a row of small buttons on the card (the season walk: seasonWalk() below); choicesLabel is the few words above the row
 *   skipIfMissing  true when the target can be missing or hidden on some days or screens (a box that hides itself by date)
 *   before, after  small functions that open or put back something on the page (a menu, a tab). They use plain page code and never read
 *                  their argument; before() may run twice (Back), so it must be safe to repeat; after() puts back what the step changed.
 * tests/tour-targets.test.mjs checks every rule above, and that every target is on the page at 1440 and 390 px wide.
 * A fact in a text must be on the site's own pages (never invent a price, an hour or a rule), and no year is written in this file.
 */
(function () {
  'use strict';

  var W = window;

  // The titles shown after "Step 7 of 52 - ". The numbers are the chapter numbers used by every steps file.
  W.WA_TOUR_CHAPTERS = [
    { n: 1, title: 'Welcome' },
    { n: 2, title: 'The first screen' },
    { n: 3, title: 'This week and the menu' },
    { n: 4, title: 'Planning a visit' },
    { n: 5, title: 'What is in season' },
    { n: 6, title: 'The GreenHouse and pizza' },
    { n: 7, title: 'The Store' },
    { n: 8, title: 'Groups, story and contact' },
    { n: 9, title: 'Works for everyone' },
    { n: 10, title: 'A pretend account' },
    { n: 11, title: 'What we need from you' }
  ];

  /* ------------------------------------------------------------------ *
   * Small helpers for before() and after(): plain page code, nothing from the engine
   * ------------------------------------------------------------------ */
  function q(selector) { return document.querySelector(selector); }
  function qa(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function click(selector) { var e = q(selector); if (e) e.click(); }
  function pause(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function site() { return W.WISE_ACRES || {}; }
  function onScreen(selector) { var e = q(selector); return !!(e && e.getClientRects().length); }
  function pageSeason() { return document.documentElement.getAttribute('data-season') || ''; }
  function chosenTab() {   // the tab of "What's in season" that is open
    var on = q('#season-tabs [aria-selected="true"]');
    return on ? on.getAttribute('data-season') : '';
  }
  function chosenFarm() {   // the season picked above the "What's on the farm" cards
    var on = q('#farm-seasons .fs-btn[aria-pressed="true"]');
    return on ? on.getAttribute('data-fs') : '';
  }

  /* ------------------------------------------------------------------ *
   * The season walk. A step with  choices: seasonWalk({ spring: ..., summer: ..., fall: ..., winter: ... }),  before: seasonsBegin  and
   * after: seasonsEnd  shows Spring, Summer, Fall and Winter on its card. Pressing one changes the WHOLE page to that season, as a visitor
   * would see it in the middle of it, and the card says what the lit part shows. When the step is left the page is put back as it was.
   * What a press does, in this order:
   *   1. the page's own season switch (WISE_ACRES.hero.setSeason, as the "See the farm in" buttons do): the picture, the headline and buttons,
   *      the "What's in season" tabs, the farm cards, the menu link to Playgrounds;
   *   2. the lines that say data-in-season (shown only while that season is really on) are shown, as on those days;
   *   3. the parts that follow the clock (the strip at the top, the countdown, "This week at the farm", the open-now badges, the Now and Next tags on the season buttons) draw themselves again
   *      for a PRETEND day: the Saturday on or before the middle of that season's dates (js/season.js), in the latest year when that day is not after today.
   *      The clock is pretended only while they draw (an instant), then it is the real one. A pretend day is never after today, so a line with a
   *      last day (data-until) is never hidden by it.
   * Putting back: the season switch again, then every data-only line as it was, the open tabs, and the clock parts drawn again with the real date.
   * One change after the other (a press is waited for before the page is put back). The walk is also offered to tour-steps-b.js as window.WA_TOUR_SEASONS.
   * ------------------------------------------------------------------ */
  var SEASON_IDS = ['spring', 'summer', 'fall', 'winter'];
  var SEASON_LABELS = { spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter' };
  var SWAP = 320;                  // the page draws a new season 240 ms after the press
  var walk = null;                 // while a step has changed the page: how it was before, and which season is pretended now
  var line = Promise.resolve();    // the changes are made, and put back, one after the other

  function queued(job) {
    line = line.then(job).then(null, function (e) {   // one change that fails must not stop the ones after it
      try { console.warn('Wise Acres tour, season walk: ' + (e && e.message ? e.message : e)); } catch (x) { /* no console */ }
    });
    return line;
  }

  // Runs job() while new Date() and Date.now() say it is `at` (the clock goes on from there); the real Date is back before this returns, whatever happens.
  function withNow(at, job) {
    var Real = W.Date, delta = at - Real.now();
    function Pretend() {
      if (!(this instanceof Pretend)) return new Real(Real.now() + delta).toString();   // Date() without new gives text
      if (arguments.length === 0) return new Real(Real.now() + delta);
      return new (Function.prototype.bind.apply(Real, [null].concat(Array.prototype.slice.call(arguments))))();
    }
    Pretend.prototype = Real.prototype;
    Pretend.now = function () { return Real.now() + delta; };
    Pretend.UTC = Real.UTC;
    Pretend.parse = Real.parse;
    W.Date = Pretend;
    try { job(); } finally { W.Date = Real; }
  }

  // The pretend day of a season: the Saturday on or before the middle of its dates, in the latest year when it is not after today (the farm's day).
  // As a moment: 17:00 UTC, which is noon or 1 pm in New York, so the open-now badges read the same whatever time of day the tour is looked at.
  function pretendAt(id) {
    var S = site().seasons, def = null, i, y, today, a, b, mid, sat;
    if (!S || !S.list || !S.farmDay) return null;
    for (i = 0; i < S.list.length; i++) if (S.list[i].id === id) def = S.list[i];
    if (!def) return null;
    today = S.farmDay(new Date());
    for (y = today.getFullYear(); y >= today.getFullYear() - 1; y--) {
      a = def.start(y); b = def.end(y);
      mid = new Date(a.getFullYear(), a.getMonth(), a.getDate() + Math.floor(Math.round((b - a) / 864e5) / 2));
      sat = new Date(mid.getFullYear(), mid.getMonth(), mid.getDate() - ((mid.getDay() + 1) % 7));
      if (sat < a) sat = a;
      if (sat <= today) return Date.UTC(sat.getFullYear(), sat.getMonth(), sat.getDate(), 17, 0, 0);
    }
    return null;
  }

  // The open-now badges draw themselves again every minute and when the tab is shown again (js/live.js), with the real moment. While a season is pretended they
  // ask for the pretend moment instead: the one hook in js/live.js, WISE_ACRES.pretendNow.
  function hold(at) { var S = site(), Real = W.Date; if (S === W.WISE_ACRES) S.pretendNow = function () { return new Real(at); }; }
  function release() { var S = W.WISE_ACRES; if (S && S.pretendNow) S.pretendNow = null; }

  function redrawClock() {   // the parts that follow the clock draw themselves again: what js/live.js does when the farm's day changes (it draws, then announces wa:day)
    var S = site();
    try { if (S.live && S.live.refresh) S.live.refresh(); } catch (e) { /* the page's own problem */ }
    try { document.dispatchEvent(new CustomEvent('wa:day', { detail: '' })); } catch (e) { /* same */ }
    try { if (S.features && S.features.renderWeek) S.features.renderWeek(); } catch (e) { /* same */ }
  }

  function take() {   // how the page is now
    return {
      season: pageSeason(), tab: chosenTab(), farm: chosenFarm(), pretend: '',
      lines: qa('[data-only]').map(function (el) { return [el, el.hasAttribute('hidden')]; })
    };
  }

  function seasonsBegin() { return queued(function () { if (!walk) walk = take(); }); }

  function showSeason(id) {
    return queued(function () {
      if (!walk) walk = take();
      var hero = site().hero, same = pageSeason() === id;
      if (hero && !same) hero.setSeason(id);
      return (hero && !same ? pause(SWAP) : Promise.resolve()).then(function () {
        qa('[data-only]').forEach(function (el) {
          if (el.getAttribute('data-only').split(/\s+/).indexOf(id) >= 0) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
        });
        var at = pretendAt(id);
        if (at !== null) { hold(at); withNow(at, redrawClock); }
        walk.pretend = id;
      });
    });
  }

  function seasonsEnd() {
    return queued(function () {
      var was = walk, hero = site().hero, away;
      if (!was) return null;
      walk = null;
      release();
      away = !!hero && pageSeason() !== was.season;
      if (away) hero.setSeason(was.season);
      return (away ? pause(SWAP) : Promise.resolve()).then(function () {
        was.lines.forEach(function (l) { if (l[1]) l[0].setAttribute('hidden', ''); else l[0].removeAttribute('hidden'); });
        if (was.tab && chosenTab() !== was.tab) click('#season-tabs [data-season="' + was.tab + '"]');
        if (was.farm && chosenFarm() !== was.farm) click('#farm-seasons .fs-btn[data-fs="' + was.farm + '"]');
        if (was.pretend) redrawClock();
      });
    });
  }

  // The four buttons of a step, given the words for each season: a text, or { title, text } when the card's title changes too. Written as a function
  // because the engine asks for the list when the card shows (the button of a season that is already pretended is shown pressed).
  // `then(id)`, when given, runs after the page has changed (for example to scroll to the part that matters in a tall box).
  function seasonWalk(words, then) {
    return function () {
      return SEASON_IDS.map(function (id) {
        var w = words[id], one = typeof w === 'string' ? { text: w } : w;
        return {
          label: SEASON_LABELS[id], title: one.title, text: one.text, pressed: !!walk && walk.pretend === id,
          run: function () { return showSeason(id).then(function () { if (then) then(id); }); }
        };
      });
    };
  }

  W.WA_TOUR_SEASONS = { ids: SEASON_IDS, begin: seasonsBegin, end: seasonsEnd, show: showSeason, walk: seasonWalk, onScreen: onScreen };

  var steps = [

    /* ---------------------------------------------------------------- 1. Welcome */
    {
      id: 'ch1-hello', order: 101, chapter: 1, page: 'index', target: null,
      title: 'Welcome, Mrs. Cathy and Rob',
      text: 'This tour shows your new website one part at a time. You will see what each part is and how it may help you. Whatever is lit up on the page, you can click and try. Nothing you click changes the site for anyone else.'
    },
    {
      id: 'ch1-real', order: 102, chapter: 1, page: 'index', target: null,
      title: 'What is real, and what is pretend',
      text: 'The words, hours and prices come from your own signs, photos and older web page. A few prices are still waiting for you. The account area near the end is a pretend demo. It sends nothing to anyone.'
    },
    {
      id: 'ch1-seasons', order: 103, chapter: 1, page: 'index', target: null,
      title: 'The page changes with the seasons',
      text: 'Parts of the site change with the seasons. Their steps have season buttons. A button pretends it is a Saturday at noon, in the middle of that season. Words in ‘single quotes’ show on another day. Is it right? Tell us. Next puts it back.'
    },

    /* ---------------------------------------------------------------- 2. The first screen */
    {
      id: 'ch2-strip', order: 201, chapter: 2, page: 'index', target: '.announce',
      title: 'The strip at the very top',
      text: 'This strip is on every page. It says the farm takes reservations only, and The GreenHouse needs none. It also says what is in season, or what comes next, from the calendar. On a phone, that part is left out. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring, April 15 to June 7. The strip begins “In season: Strawberries”. After June 7 it says ‘Next up: Blueberries & sunflowers, usually mid-June’.',
        summer: 'Summer, June 15 to July 10. It now says “In season: Blueberries & sunflowers”. After July 10 it says ‘Next up: Pumpkins & tomatoes, usually mid-September’.',
        fall: 'Fall, September 13 to November 8. It says “In season: Pumpkins & tomatoes”. After November 8 it says ‘Next up: Christmas trees at The GreenHouse, usually the last weekend in November’.',
        winter: 'Winter, from the last Saturday in November to the Sunday after the first Saturday in December (the trees are on those two weekends, Saturday and Sunday only). It says “In season: Christmas trees at The GreenHouse”. After that Sunday it says ‘Next up: Strawberries, usually mid-April’.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch2-seasons', order: 202, chapter: 2, page: 'index', target: '.hero-copy',
      title: 'The first screen follows the season',
      text: 'The page dresses itself for the real season, using the calendar. Headline, line, buttons and picture all follow it. Visitors can peek at other seasons with the buttons at the top. Your site builder can switch them off. Press a season to see it.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. The line says “It’s strawberry season!” and talks about strawberries, flowers and the animals. The buttons are “Reserve your visit” and “See what’s in season”, with a note about The GreenHouse. In the picture, kids pick strawberries in the rows.',
        summer: 'Summer. The line changes to “It’s blueberry season!” with blueberries, sunflowers and flowers. The buttons and the note stay the same.',
        fall: 'Fall. The line says “It’s pumpkin season!” and adds tomatoes and basil, wagon rides and a haunted trail. The buttons stay the same. Leaves fall in the picture.',
        winter: 'Winter. The headline becomes “Wise Acres Christmas trees”. The red button turns into “Visit The GreenHouse”, and the note about The GreenHouse is gone. Snow falls in the picture.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch2-tags', order: 203, chapter: 2, page: 'index', target: '#season-switch', skipIfMissing: true,   // the buttons can be switched off (seasonPicker: false)
      title: 'The Now and Next tags',
      text: 'Two little tags tell visitors at a glance where the farm is in the year. “Now” marks the season happening today. “Next” marks the one after it, so they know what to look forward to. Between seasons only “Next” shows. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. “Now” is on Spring, for strawberries. “Next” is on Summer, for blueberries and sunflowers.',
        summer: 'Summer. “Now” moves to Summer. “Next” moves to Fall, for pumpkins and tomatoes.',
        fall: 'Fall. “Now” is on Fall. “Next” is on Winter, so visitors see that the Christmas trees are coming. After November 8 only “Next” shows.',
        winter: 'Winter. “Now” is on Winter, for the Christmas trees. “Next” is on Spring, for strawberries. After the last tree Sunday only “Next” shows.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch2-badges', order: 204, chapter: 2, page: 'index', target: '.hero-live', skipIfMissing: true,
      title: 'Open now, or closed today',
      text: 'These badges say if the farm and The GreenHouse are open, from your hours and the clock. For a rain day, your site builder adds the date and they show closed. Your booking tool needs its own change. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring, on a Saturday at noon. Only The GreenHouse has a badge: “Open now, until 8 pm”. The farm has none, because no farm days are set for spring.',
        summer: 'Summer, on a Saturday at noon. The same: only The GreenHouse badge, “Open now, until 8 pm”. No farm days are set for summer.',
        fall: 'Fall, on a Saturday at noon. The farm gets a badge too: “Reserved visits today”. The farm days set are Thursday to Sunday. On other days it names the next reserved day.',
        winter: 'Winter, on a tree Saturday at noon. The farm badge says “Open today. No reservation needed”. The GreenHouse badge says “Open now, until 8 pm”, with the small label “Not official yet” next to the hours.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch2-reserve', order: 205, chapter: 2, page: 'index', target: '.hero-cta',
      title: 'The big buttons',
      text: 'Reserve opens your booking tool (Bookeo) in a new tab. Nothing is booked on this site. The white button leads to what is in season. In winter the big red button says “Visit The GreenHouse”, and the top bar keeps its Reserve.'
    },
    {
      id: 'ch2-game', order: 206, chapter: 2, page: 'index', target: '#picker', also: '#hero-scene',
      title: 'The basket game',
      text: 'Try it: press the yellow button to pick. Kids can also tap fruit, flowers or trees in the picture. Picking 100 of one kind earns a badge, like Pumpkin Champion. It is only for fun, and nothing is saved. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. The box says “Try it! Tap the strawberries to pick them, or snip a sunflower.” The button says “Pick a strawberry”. The sunflowers at the sides can be snipped too: tap one and it grows back.',
        summer: 'Summer. “Try it! Tap the blueberries to pick them, or snip a sunflower.” The button says “Pick a blueberry”.',
        fall: 'Fall. “Try it! Tap the pumpkins to pick one, or tap the wagon.” The button says “Pick a pumpkin”.',
        winter: 'Winter. The game is about trees: “Tap the trees to light them up. Tap a fire to stoke it.” The button says “Light a tree”.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch2-chips', order: 207, chapter: 2, page: 'index', target: '.hero .chips',
      title: 'The small labels under the badges',
      text: 'These small labels give quick facts. Two stay all year: organic and family farm. In fall a yellow label says New: u-pick tomatoes and basil, and a pizza label says when reservations open. They follow the calendar.'
    },

    /* ---------------------------------------------------------------- 3. This week and the menu */
    {
      id: 'ch3-countdown', order: 301, chapter: 3, page: 'index', target: '.next-up',
      title: 'The countdown to the next season',
      text: 'This box counts the days to the next season. It follows the calendar. Between seasons its “happening now” line is empty. Its button lets visitors ask to hear when picking opens. Press a season to see it.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. It says “Happening now: Strawberries” and “Next up: Blueberries & sunflowers”, usually mid-June, with the days to go.',
        summer: 'Summer. It changes to “Happening now: Blueberries & sunflowers” and “Next up: Pumpkins & tomatoes”, usually mid-September.',
        fall: 'Fall. It says “Happening now: Pumpkins & tomatoes” and “Next up: Christmas trees at The GreenHouse”, usually the last weekend in November.',
        winter: 'Winter. It says “Happening now: Christmas trees at The GreenHouse” and “Next up: Strawberries”, usually mid-April. The count of days is the longest of the year.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch3-week', order: 302, chapter: 3, page: 'index', target: '#this-week', skipIfMissing: true,
      title: 'This week at the farm',
      text: 'This box fills itself from the date and lists what is usually in season. Your site builder can add a note and a Spots left table by hand. They hide after 14 days. The page cannot read your booking tool. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. “Strawberries” and “U-cut flowers”, both “In season”. A crop that starts within 21 days shows ‘Usually starts’ and its date. When nothing is near, the box hides.',
        summer: 'Summer. “Blueberries”, “Sunflowers” and “U-cut flowers” are all “In season”.',
        fall: 'Fall. “Pumpkins”, “Tomatoes & basil” and “U-cut flowers” are “In season”. The tomatoes stop on November 8 with the rest of fall, so this list gets shorter after that.',
        winter: 'Winter. Only “Christmas trees” shows, marked “At The GreenHouse” and “In season”. The farm crops are gone.'
      }),
      before: function () {   // the box hides itself when nothing is near: then the season the page is dressed in is shown first, so the step still has a box to light
        return seasonsBegin().then(function () { if (!onScreen('#this-week')) return showSeason(site().seasons.current()); });
      },
      after: seasonsEnd
    },
    {
      id: 'ch3-menu', order: 303, chapter: 3, page: 'index', target: '#nav, #menu-toggle', skipIfMissing: true,   // the lists open below the bar, outside its box: they are lit with it, and can be used
      title: 'The menu at the top',
      text: 'Seven buttons group the whole site: Visit, Things to Do, GreenHouse, Store, Groups & Parties, About Us and Contact. Press one to open its short list. A red dot marks something new or coming soon, like Christmas trees. Try it.',
      after: function () {   // a list the visitor opened is shut again
        var open = document.querySelector('.nav-group.is-open .nav-group-btn');
        if (open) open.click();
      }
    },
    {
      id: 'ch3-reserve', order: 304, chapter: 3, page: 'index', target: '.nav-cta, #action-bar a[href*="bookeo"]', skipIfMissing: true,
      title: 'The Reserve button',
      text: 'The red Reserve button waits in the top bar and stays there as you scroll. On a phone the bar at the bottom has one too, except in winter. A visitor can book from any part of the page.'
    },

    /* ---------------------------------------------------------------- 4. Planning a visit */
    {
      id: 'ch4-places', order: 401, chapter: 4, page: 'index', target: '#visit .choose',
      title: 'Two places, one family',
      text: 'Visitors choose the farm or The GreenHouse next door. The farm is always by reservation, never walk-in. The GreenHouse needs no reservation and is open Friday to Sunday, 10 am to 8 pm. Press a season to see the farm card change.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. The farm card shows a strawberry: “U-pick organic strawberries, plus u-cut flowers”. The button is “Reserve the farm”. The GreenHouse card never changes.',
        summer: 'Summer. A blueberry: “U-pick organic blueberries, plus u-cut sunflowers and flowers”. The button stays “Reserve the farm”.',
        fall: 'Fall. A pumpkin. The card adds wagon rides, the corn pit, a sunn hemp maze and a haunted trail. A “See prices” button joins “Reserve the farm”.',
        winter: 'Winter. A Christmas tree. “Picking is seasonal”, with strawberries next. The button ‘Reserve the farm’ becomes “Tell me when”, and a new line says “Christmas trees are at The GreenHouse”.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch4-steps', order: 402, chapter: 4, page: 'index', target: '#steps',
      title: 'Three steps to a farm day',
      text: 'The page walks a visitor through the day: reserve a time, head to the farm, then pick, play and explore. Each step has a button. The directions button opens Google Maps.'
    },
    {
      id: 'ch4-packages', order: 403, chapter: 4, page: 'index', target: '.packages',
      title: 'Choose your package',
      text: 'The pizza package is $31 and includes 2 Wise Pie pizzas, plus $3 per person ages 3 and up. Farm fun only is $3 per person. Children 2 and younger are free. Pizzas are ready 1 hour after your reservation time.'
    },
    {
      id: 'ch4-addons', order: 404, chapter: 4, page: 'index', target: '.addons',
      title: 'Optional add-ons',
      text: 'Visitors can add u-pick tomatoes and basil, the corn pit, a wagon ride or the barrel train. The page shows each price. On Thursdays the corn pit is buy one, get one free, with a reservation.'
    },
    {
      id: 'ch4-schedule', order: 405, chapter: 4, page: 'index', target: '#schedule', skipIfMissing: true,
      title: 'The pizza weekend schedule',
      text: 'Pizza reservations open every Tuesday at 5 PM. This box lists the weekends. Before each opening it counts down and can add a reminder to a visitor\'s calendar. A new row is added by hand each week.'
    },
    {
      id: 'ch4-map', order: 406, chapter: 4, page: 'index', target: '#farm-map .map-wrap', skipIfMissing: true,
      title: 'The farm map',
      text: 'This is a drawn map of the farm. Visitors tap a picture to see what it is. Parking, check-in and restrooms come first. There are buttons for Google Maps, Apple Maps and Waze.'
    },
    {
      id: 'ch4-guide', order: 407, chapter: 4, page: 'index', target: '#first-visit .section-head',
      title: 'The first-visit guide',
      text: 'New visitors can read what they may need before they arrive: parking, bathrooms, dogs, strollers, what to bring and the rain rules. A button opens the full guide page.'
    },

    /* ---------------------------------------------------------------- 5. What is in season */
    {
      id: 'ch5-tabs', order: 501, chapter: 5, page: 'index', target: '#seasons .season-stage',
      title: 'What\'s in season',
      text: 'Four tabs above this panel show what visitors can pick, cut and do in each season. Today\'s season is marked Happening now, by the calendar. Press a season on this card to see each panel.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. “Strawberry season”, “Usually mid-April to early June”. This is the busiest time, and reservations fill quickly. The button says “Reserve a strawberry visit”.',
        summer: 'Summer. “Blueberries & sunflower season”, “Usually mid- to late June through early July”. The button says “Reserve a summer visit”.',
        fall: 'Fall. “Pumpkin & tomato season”, “Mid-September through early November”. Reservations are Thursday to Sunday. Buttons: “Reserve a fall visit” and “See prices”.',
        winter: 'Winter. “NC Christmas tree season”, “The last weekend in November and the first weekend in December, Saturday and Sunday only”, at The GreenHouse, with no reservation. The button is “Get farm updates”.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch5-cards', order: 502, chapter: 5, page: 'index', target: '#farm-cards',
      title: 'What\'s on the farm',
      text: 'These cards show what is on the farm right now, such as u-pick, animals, playgrounds and rides. In winter, the fun moves next door to The GreenHouse. Press a season on this card to see the cards change.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring, six cards. “U-Pick Strawberries” leads, then “Meet the Animals”, “Playgrounds”, “Shaded Picnic Patch”, “Concessions & Local Goods” and “Wagon Ride & Barrel Train”.',
        summer: 'Summer, six cards. “U-Pick Blueberries” takes the place of the strawberries. The other five stay.',
        fall: 'Fall, eight cards. “U-Pick Pumpkins” takes over. New: “Haunted Trail” and “Sunn Hemp Maze”. The wagon card becomes “Wagon, Corn Pit & Barrel Train”.',
        winter: 'Winter, only three cards, each marked “At The GreenHouse”: “Christmas Trees”, “Playground & Goats” and “Pizza, Ice Cream & Drinks”. The farm cards are gone.'
      }),
      before: seasonsBegin, after: seasonsEnd
    },
    {
      id: 'ch5-tomatoes', order: 503, chapter: 5, page: 'index', target: '.tomato-copy',
      title: 'Tomatoes and basil',
      text: 'New this year: u-pick organic tomatoes and basil, every weekend from mid-September through early November. Tomatoes are $4.50 per pound and basil is $1 per stem. The New labels hide themselves after their end date. This box stays all year.'
    },
    {
      id: 'ch5-flowers', order: 504, chapter: 5, page: 'index', target: '#flowers .flowers-copy',
      title: 'U-cut flowers',
      text: 'Visitors can cut their own flowers from April to July and from September to the first frost. The page links to a flower Instagram account for bloom updates. This box stays all year.'
    },
    {
      id: 'ch5-photos', order: 505, chapter: 5, page: 'index', target: '.passes',
      title: 'Photography passes',
      text: 'Professional photographers need an appointment and a photographer pass. A single session pass is $35 plus $3 per person. A day pass is $70 plus $3 per person. Buying a pass starts with an email to the farm.'
    },

    /* ---------------------------------------------------------------- 11. What we need from you */
    {
      id: 'ch11-prices', order: 1101, chapter: 11, page: 'index', target: null,
      title: 'Prices to confirm',
      text: 'These still say Prices coming soon:\n- Jam and elderberry shrub\n- Trucker cap, bucket hat, T-shirt, sweatshirt, canvas and linen bags\n- Christmas trees\n- U-pick strawberries, blueberries and pumpkins\nPlease also check the pizza prices and the draft corporate event prices.'
    },
    {
      id: 'ch11-photos', order: 1102, chapter: 11, page: 'index', target: null,
      title: 'Photos and dates',
      text: 'Please send:\n- Full-size photos straight from your phone. Many photos we have are tiny, about 200 pixels wide.\n- The right Christmas tree dates. The site and your sign give different dates.'
    },
    {
      id: 'ch11-people', order: 1103, chapter: 11, page: 'index', target: null,
      title: 'Who does what, and when',
      text: 'Please tell us:\n- Who updates This week at the farm, the pizza weekends and closures\n- What your booking tool already offers, like customer logins and changing a booking\n- When the new site should open to visitors\nThank you, Mrs. Cathy and Rob!'
    }
  ];

  // Added to the list that the other steps files share. A step that is already there (this file read twice) is not added again.
  var all = (W.WA_TOUR_STEPS = W.WA_TOUR_STEPS || []);
  var have = {};
  for (var i = 0; i < all.length; i++) have[all[i].id] = true;
  for (var j = 0; j < steps.length; j++) {
    if (!have[steps[j].id]) all.push(steps[j]);
  }
})();
