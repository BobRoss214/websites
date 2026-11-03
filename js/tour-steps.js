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
 *   allowClicks    true when the owners may click on the page during the step ("Try it")
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

  // Peeking at another season with the buttons on the first screen: remember the real season and put it back when the step is left.
  var heroSeasonAtStart = '';
  function heroSeason() {
    var on = q('#season-switch [aria-checked="true"]');
    return on ? on.getAttribute('data-season') : '';
  }

  // Trying the four tabs of "What's in season": the same.
  var tabAtStart = '';
  function chosenTab() {
    var on = q('#season-tabs [aria-selected="true"]');
    return on ? on.getAttribute('data-season') : '';
  }

  var steps = [

    /* ---------------------------------------------------------------- 1. Welcome */
    {
      id: 'ch1-hello', order: 101, chapter: 1, page: 'index', target: null,
      title: 'Welcome, Mrs. Cathy and Rob',
      text: 'This tour shows your new website one part at a time. You will see what each part is and how it may help you. Where a step says try it, you can click. Nothing you click changes the site for anyone else.'
    },
    {
      id: 'ch1-real', order: 102, chapter: 1, page: 'index', target: null,
      title: 'What is real, and what is pretend',
      text: 'The words, hours and prices come from your own signs, photos and older web page. A few prices are still waiting for you. The account area near the end is a pretend demo. It sends nothing to anyone.'
    },

    /* ---------------------------------------------------------------- 2. The first screen */
    {
      id: 'ch2-strip', order: 201, chapter: 2, page: 'index', target: '.announce',
      title: 'The strip at the very top',
      text: 'This strip is on every page. It says the farm takes reservations only, and The GreenHouse needs none. It also says what is in season, or what comes next, and changes by itself.'
    },
    {
      id: 'ch2-seasons', order: 202, chapter: 2, page: 'index', target: '#season-switch', allowClicks: true, skipIfMissing: true,
      title: 'Peek at the other seasons',
      text: 'The page dresses itself for the real season, using the calendar. These buttons let you peek at the other seasons. Try Winter. Your site builder can switch these buttons off.',
      before: function () { if (!heroSeasonAtStart) heroSeasonAtStart = heroSeason(); },
      after: function () {
        if (heroSeasonAtStart && heroSeason() !== heroSeasonAtStart) {
          var button = q('#season-switch [data-season="' + heroSeasonAtStart + '"]');
          if (button) button.click();
        }
        heroSeasonAtStart = '';
      }
    },
    {
      id: 'ch2-headline', order: 203, chapter: 2, page: 'index', target: '#hero-h',
      title: 'The words follow the season',
      text: 'The line under the headline changes with the season. In fall it talks about pumpkins and tomatoes. In winter the headline changes too, and points to the Christmas trees at The GreenHouse.'
    },
    {
      id: 'ch2-badges', order: 204, chapter: 2, page: 'index', target: '.hero-live', skipIfMissing: true,
      title: 'Open now, or closed today',
      text: 'These badges say if the farm and The GreenHouse are open. They follow your real hours and the clock. For a rain day, your site builder adds the date and the badges show closed. Your booking tool needs its own change.'
    },
    {
      id: 'ch2-reserve', order: 205, chapter: 2, page: 'index', target: '.hero-cta',
      title: 'The big buttons',
      text: 'Reserve opens your booking tool (Bookeo) in a new tab. Nothing is booked on this site. The other buttons lead to The GreenHouse and to what is in season. In winter, when the farm takes a break, the Reserve button hides.'
    },
    {
      id: 'ch2-game', order: 206, chapter: 2, page: 'index', target: '#picker', allowClicks: true,
      title: 'The basket game',
      text: 'Try it: press the yellow button to pick. Kids can also tap fruit, flowers or trees in the picture. Picking 100 of one kind earns a badge, like Pumpkin Champion. It is only for fun, and nothing is saved.'
    },

    /* ---------------------------------------------------------------- 3. This week and the menu */
    {
      id: 'ch3-week', order: 301, chapter: 3, page: 'index', target: '#this-week', skipIfMissing: true,
      title: 'This week at the farm',
      text: 'This box fills itself from today\'s date and lists what is usually in season. Your site builder can type in a note and a Spots left table by hand. They hide themselves after 14 days. The page cannot read your booking tool.'
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
      text: 'Visitors choose the farm or The GreenHouse next door. The farm is always by reservation, never walk-in. The GreenHouse needs no reservation and is open Friday to Sunday, 10 am to 8 pm.'
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
      id: 'ch5-tabs', order: 501, chapter: 5, page: 'index', target: '#season-tabs', allowClicks: true,
      title: 'What\'s in season',
      text: 'Four tabs show what visitors can pick, cut and do in each season. The tab for today\'s season says Happening now. It follows the calendar by itself. Tap a tab to look.',
      before: function () { if (!tabAtStart) tabAtStart = chosenTab(); },
      after: function () {
        if (tabAtStart && chosenTab() !== tabAtStart) {
          var tab = q('#season-tabs [data-season="' + tabAtStart + '"]');
          if (tab) tab.click();
        }
        tabAtStart = '';
      }
    },
    {
      id: 'ch5-cards', order: 502, chapter: 5, page: 'index', target: '#farm-cards',
      title: 'What\'s on the farm',
      text: 'These cards show what is on the farm right now, such as u-pick, animals, playgrounds and rides. Pick another season above the cards and they change. In winter, the fun moves next door to The GreenHouse.'
    },
    {
      id: 'ch5-tomatoes', order: 503, chapter: 5, page: 'index', target: '.tomato-copy',
      title: 'Tomatoes and basil',
      text: 'New this year: u-pick organic tomatoes and basil, every weekend from late September through October. Tomatoes are $4.50 per pound and basil is $1 per stem. The New labels hide themselves after their end date.'
    },
    {
      id: 'ch5-flowers', order: 504, chapter: 5, page: 'index', target: '#flowers .flowers-copy',
      title: 'U-cut flowers',
      text: 'Visitors can cut their own flowers from April to July and from September to the first frost. The page links to a flower Instagram account for bloom updates.'
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
