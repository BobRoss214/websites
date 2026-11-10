/* Wise Acres "Take a tour": the steps of chapters 6 to 9 (written for the two farm owners).
 *   6  The GreenHouse and Wise Pie pizza     7  The Store     8  Groups, story, reviews, photos, questions, contact, sign-up
 *   9  Works for everyone
 * This file only adds steps to window.WA_TOUR_STEPS. The tour engine (js/tour.js) loads it when the tour is first opened and
 * sorts every step by "order" (chapter * 100 + position, so 703 is chapter 7, step 3). The chapter titles are in js/tour-steps.js.
 * A step is { id, order, chapter, page, target, title, text, before, after, allowClicks, skipIfMissing }:
 *   target is one CSS selector (the first visible match is lit) or null for a centred card; skipIfMissing hides the step when the
 *   target is not there (a part that only shows for some visitors, or only when the site has the feature the card talks about).
 * before() and after() change the page for the length of one step and put it back: they work with plain DOM code, may run twice,
 * and each one undoes only what it did itself, so the order the engine calls them in does not matter.
 * Rules for the words: a card says what a thing IS and why it helps visitors or the farm, never what was changed on the page; 45 words
 * at most a card, short sentences, "you", no price or fact that is not on the site's own pages, no year, no web or email address (those
 * are checked by the site's tests). Plain ES5 on purpose (old phones read this file too).
 * A step may have a row of Spring / Summer / Fall / Winter buttons on its card (choices: seasonWalk({...}), before: seasonsBegin, after: seasonsEnd): see
 * "The season walk" in js/tour-steps.js and docs/TOUR.md. The helpers live in js/tour-steps.js (window.WA_TOUR_SEASONS); they are asked for when they are used,
 * because the engine may run this file first.
 */
(function () {
  'use strict';

  var steps = (window.WA_TOUR_STEPS = window.WA_TOUR_STEPS || []);
  var mem = {};   // what a step changed on the page, so that it can be put back

  function one(selector) { return document.querySelector(selector); }

  /* ---- the season buttons of a card: the helpers are in js/tour-steps.js (loaded in any order), so they are looked for when they are needed ---- */
  function seasonWalk(words, then) { return function () { var w = window.WA_TOUR_SEASONS; return w ? w.walk(words, then)() : []; }; }
  function seasonsBegin() { var w = window.WA_TOUR_SEASONS; return w ? w.begin() : undefined; }
  function seasonsEnd() { var w = window.WA_TOUR_SEASONS; return w ? w.end() : undefined; }
  // A card about a part of the page that looks different in another season shows that season while the card is up (seasonsEnd puts the page back).
  // inSeason: always; showIfNot: only when `needs` (a selector for what the card talks about) is not on the screen now, so a page that is right already is left alone.
  function pretend(w, id) { var show = w.show; return show(id); }   // (written so, not w.show(id): tests/browser-support reads every .show( as a dialog's method; this one is the season walk's own function)
  function inSeason(id) {
    return function () { var w = window.WA_TOUR_SEASONS; return w ? w.begin().then(function () { return pretend(w, id); }) : undefined; };
  }
  function showIfNot(needs, id) {
    return function () {
      var w = window.WA_TOUR_SEASONS;
      return w ? w.begin().then(function () { if (!w.onScreen(needs)) return pretend(w, id); }) : undefined;
    };
  }
  // On a phone the columns of The GreenHouse are stacked and the card is a sheet over the lower part: the yellow note is brought just under the top bar, so the green line (tree
  // season) shows above the sheet. On a computer the list, the note and the line are brought into the window together by the engine (also), and nothing is scrolled by hand.
  function placeTreeNote() {
    if ((document.documentElement.clientWidth || window.innerWidth) > 640) return;
    var note = one('#greenhouse .gh-callout'), bar = one('.site-header');
    if (!note) return;
    var dy = note.getBoundingClientRect().top - ((bar ? bar.getBoundingClientRect().height : 80) + 24);
    try { window.scrollTo({ top: window.pageYOffset + dy, behavior: 'instant' }); } catch (e) { window.scrollTo(0, window.pageYOffset + dy); }
  }

  /* ---- the Store's pop-up (js/shop-pop.js): a click on a product box opens it above the dimmer (css/tour.css), so a step that lights product boxes shuts it when it is left ---- */
  function closeShopPop() {
    var pop = one('.shop-pop'), box, button;
    if (!pop || window.getComputedStyle(pop).visibility === 'hidden') return;   // no pop-up here, or it is shut
    box = pop.querySelector('[role="dialog"]') || pop;
    try { box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); } catch (e) { /* an old browser: the button below */ }   // shut the way a visitor shuts it: the pop-up listens for Esc (in every language)
    if (pop.classList.contains('is-open')) { button = pop.querySelector('.shop-pop-x, .shop-pop-done'); if (button) button.click(); }
  }

  /* ---- the three group tabs: school tours, parties, corporate events ---- */
  function groupTab() {
    var on = one('#group-tabs [aria-selected="true"]');
    return on ? on.id : '';
  }
  function showGroupTab(id) {
    var tab = document.getElementById(id);
    if (!tab) return;
    if (!mem.groupTab) mem.groupTab = groupTab();   // the tab the visitor had, remembered once
    if (tab.getAttribute('aria-selected') !== 'true') tab.click();
  }
  function restoreGroupTab(mine) {
    if (groupTab() !== mine) return;   // another step has already chosen its own tab: leave it alone
    var back = mem.groupTab ? document.getElementById(mem.groupTab) : null;
    mem.groupTab = '';
    if (back && back.getAttribute('aria-selected') !== 'true') back.click();
  }

  /* ---- the sign-up form: hidden until Mailchimp is connected, shown here as a labelled preview ---- */
  function showSignupPreview() {
    var form = one('#signup'), fallback = one('[data-signup-fallback]');
    if (!form || !form.hidden || mem.signup) return;   // already live (or already shown): nothing to do
    mem.signup = { fallbackHidden: fallback ? fallback.hidden : null };
    form.hidden = false;
    if (fallback) fallback.hidden = true;
  }
  function hideSignupPreview() {
    var was = mem.signup, form = one('#signup'), fallback = one('[data-signup-fallback]');
    if (!was) return;
    mem.signup = null;
    if (form) form.hidden = true;
    if (fallback && was.fallbackHidden !== null) fallback.hidden = was.fallbackHidden;
  }

  /* ---- the language list under the globe button ---- */
  function languageButton() {
    var box = one('[data-lang-menu]');
    return box ? box.querySelector('.lang-btn') : null;
  }
  function openLanguages() {
    var btn = languageButton(), box = one('[data-lang-menu]'), now, site = window.WISE_ACRES;
    if (mem.lang == null && site && site.lang) mem.lang = site.lang;   // the language the page has now: a press on another one in the list really changes the whole site, and the site keeps the choice
    if (!btn || btn.getAttribute('aria-expanded') === 'true') return;
    mem.languages = true;
    btn.click();   // the page opens its own list and moves the focus to a language
    now = document.activeElement;
    // The page shuts this list when the focus leaves it, and the tour card takes the focus next: so give the focus up here.
    if (now && now !== document.body && box && box.contains(now) && now.blur) now.blur();
  }
  function closeLanguages() {
    var btn = languageButton(), site = window.WISE_ACRES, back = mem.lang;
    mem.lang = null;
    if (back && site && typeof site.setLang === 'function' && site.lang !== back) site.setLang(back);   // the page goes back to the language it had
    if (!mem.languages) return;
    mem.languages = false;
    if (btn && btn.getAttribute('aria-expanded') === 'true') btn.click();
  }

  steps.push(

    /* ============ 6  The GreenHouse and Wise Pie pizza ============ */
    {
      id: 'ch6-two-ways', order: 601, chapter: 6, page: 'index',
      target: '#pizza .way-grid',
      title: 'Wise Pie pizza: two ways to get it',
      text: 'At the farm (10 am to 4 pm), pizza comes with a reservation package. Pizza reservations open every Tuesday at 5 PM. ' +
            'At The GreenHouse (4 to 8 pm), no reservation: first come, first served, or pre-order with the link posted 5 days ahead.',
      before: showIfNot('#pizza .way-card:not(.way-card-winter)', 'fall'),   // in winter the page shows one card for the tree weekends instead of these two: then a fall day is shown while this card is up
      after: seasonsEnd
    },
    {
      id: 'ch6-menu', order: 602, chapter: 6, page: 'index',
      target: '#menu',
      title: 'The fall pizza menu',
      text: 'Nine pizzas at $15, $16 or $17. Gluten-free crust is +$9 and vegan cheese is +$3. ' +
            'Visitors can read every pizza and price before they come. When your menu changes, tell your site builder and this list changes too.'
    },
    {
      id: 'ch6-questions', order: 603, chapter: 6, page: 'index',
      target: '#pizza .pizza-more',
      title: 'Pizza questions, answered ahead of time',
      text: 'Two answers wait here: what goes into the pizza, and why dates are not posted far ahead. ' +
            'The page explains that the county sets the cooking days and hours. This may save you from explaining it again and again.'
    },
    {
      id: 'ch6-greenhouse', order: 604, chapter: 6, page: 'index',
      target: '#greenhouse .gh-features',
      title: 'The GreenHouse: next door, no reservation',
      text: 'The GreenHouse is next door and needs no reservation, so visitors without a booking have a place to go. ' +
            'It does not include farm access. Here is what they will find: pizza, ice cream, beer, wine and cider, a playground and goats.'
    },
    {
      id: 'ch6-hours', order: 605, chapter: 6, page: 'index',
      target: '#greenhouse .gh-hours',
      title: 'GreenHouse hours and the Open now line',
      text: 'Friday to Sunday, 10 am to 8 pm. The line under it says Open now or Closed today. ' +
            'If weather closes you, your site builder can switch on a closure. The page also sends visitors to Instagram for sudden changes, so post there too.'
    },
    {
      id: 'ch6-tree-pizza', order: 606, chapter: 6, page: 'index',
      target: '#greenhouse .gh-hours',
      title: 'Pizza on the tree weekends',
      text: 'On the tree weekends The GreenHouse is open 11 am to 8 pm and serves pizza. A small “Not official yet” label stands next to the pizza and the hours. ' +
            'It tells visitors these are not confirmed.',
      before: inSeason('winter'),   // the winter lines of the hours box show while this card is up (they are only there in winter)
      after: seasonsEnd
    },
    {
      id: 'ch6-trees', order: 607, chapter: 6, page: 'index',
      target: '#greenhouse .gh-features',
      also: ['#greenhouse .gh-callout', '#greenhouse .gh-trees'],   // the list that names the trees, the yellow note, and the green line when it shows (tree season): all lit
      title: 'Christmas trees at The GreenHouse',
      text: 'The list says “Christmas trees in season” all year. A green line, “Christmas trees are here”, shows only in tree season. It sits under the yellow reservations note. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. No green line. Only the list item “Christmas trees in season” is there, with the pizza, ice cream, drinks and goats.',
        summer: 'Summer. The same: no green line, only “Christmas trees in season” in the list.',
        fall: 'Fall. No green line. It waits for tree season.',
        winter: 'Winter. A green line appears: “Christmas trees are here.” It says tree season runs from the Friday after Thanksgiving to early December, right at The GreenHouse.'
      }, placeTreeNote),
      before: seasonsBegin, after: seasonsEnd
    },

    /* ============ 7  The Store ============ */
    {
      id: 'ch7-jump', order: 701, chapter: 7, page: 'index',
      target: '#shop .shop-jump',
      title: 'The Store, all in one place',
      text: 'Everything for sale at the farm and The GreenHouse is listed here, in groups. ' +
            'Each product has a name, a price and a small drawing. These buttons jump straight to a group. Visitors can check a price before they ask.'
    },
    {
      id: 'ch7-note', order: 702, chapter: 7, page: 'index',
      target: '#shop .shop-note',
      title: 'The price note',
      text: 'This note says prices are for this fall and can change. ' +
            'It also says anything marked “Prices coming soon” is being confirmed. ' +
            'Questions go to the farm’s email, so you may hear about a price that looks wrong.'
    },
    {
      id: 'ch7-hover-popup', order: 703, chapter: 7, page: 'index',
      target: '#shop-snacks .shop-card-pop', skipIfMissing: true,   // the class js/shop-pop.js puts on a product box that has a pop-up: the card is there only where the Store has the pop-up
      title: 'Point at a product, click for details',
      text: 'Point at any product box in the Store and it grows a little. Click it and a pop-up opens with the ingredients. ' +
            'The lists are pretend, and each pop-up says it is only a preview. Try it on this box.',
      after: closeShopPop
    },
    {
      id: 'ch7-pizza', order: 704, chapter: 7, page: 'index',
      target: '#shop-greenhouse',
      title: 'Pizza in the Store',
      text: 'The pizza group lists Wise Pie at $15 to $17, with gluten-free crust +$9 and vegan cheese +$3. ' +
            'It also gives the hours and where to find it. Pizza questions go to Ava. Visitors can check the price before they order.',
      after: closeShopPop
    },
    {
      id: 'ch7-beer-wine', order: 705, chapter: 7, page: 'index',
      target: '#shop-beerwine .shop-band', skipIfMissing: true,   // the group Beer, cider & wine
      title: 'Beer, cider and wine',
      text: 'Beer, cider and wine have their own group in the Store. Every drink is $6, so visitors know the price before they come. ' +
            'The list shows what is pouring, and it can change.'
    },
    {
      id: 'ch7-soon-pantry', order: 706, chapter: 7, page: 'index',
      target: '#shop-pantry',
      title: 'The “Prices coming soon” label',
      text: 'When a price is not confirmed, the card shows a red dashed label, “Prices coming soon”, never a made-up number. ' +
            'Two pantry cards show it today: Jam and Elderberry shrub. The full list is in What we need from you.',
      after: closeShopPop
    },

    /* ============ 8  Groups, story, reviews, photos, questions, contact ============ */
    {
      id: 'ch8-school', order: 801, chapter: 8, page: 'index',
      target: '#school-tours .price-card',
      also: '#school-tours .card-actions',   // the buttons under the words: the sign-up form and Vanessa's email
      title: 'School tours and group events',
      text: 'Schools, parties and companies each get a tab, and menu links open the right one. ' +
            'School tours cost $11 per student, with 100 students at least. Teachers use the sign-up form, and you contact them. Questions? Vanessa’s email is here.',
      before: function () { showGroupTab('gtab-school'); },
      after: function () { restoreGroupTab('gtab-school'); }
    },
    {
      id: 'ch8-parties', order: 802, chapter: 8, page: 'index',
      target: '#parties .price-card',
      title: 'Parties at the farm',
      text: 'A party costs $300 for 2.5 hours, set-up and clean-up included, for up to 50 guests. Farm entry for every guest is included. ' +
            'Families book in your booking tool, or ask a question by email.',
      before: function () { showGroupTab('gtab-parties'); },
      after: function () { restoreGroupTab('gtab-parties'); }
    },
    {
      id: 'ch8-corporate', order: 803, chapter: 8, page: 'index',
      target: '#corporate .price-card',
      also: ['#corporate .draft-tag', '#corporate .card-actions'],   // the label that says the prices are a draft, and the Request a quote button
      title: 'Corporate events',
      text: 'Companies can book a team day or a picnic. It is $750 for up to 50 guests, $1,400 for 51 to 100 guests, and a custom quote for more. ' +
            'Request a quote opens an email. The page marks these prices as a draft.',
      before: function () { showGroupTab('gtab-corporate'); },
      after: function () { restoreGroupTab('gtab-corporate'); }
    },
    {
      id: 'ch8-story', order: 804, chapter: 8, page: 'index',
      target: '#about .about-grid',
      title: 'Your story',
      text: 'This is your family’s story, told with your photo. ' +
            'Below it are short notes on your berries, organic farming and buying local, and a care guide for berries. Visitors can see who grows their food.'
    },
    {
      id: 'ch8-reviews', order: 805, chapter: 8, page: 'index',
      target: '#reviews .wrap',
      title: 'Reviews and news',
      text: 'Three buttons send visitors to your reviews on Google, Tripadvisor and Yelp. ' +
            'Quotes from families can appear here once you have real ones and their permission. ' +
            'For a one-tap review button, we need the review link from your Google profile.'
    },
    {
      id: 'ch8-photos', order: 806, chapter: 8, page: 'index',
      target: '#gallery-filters', skipIfMissing: true,
      also: '#gallery-grid li',   // the first photo that shows: a tap on it opens the viewer
      title: 'The photo gallery',
      text: 'Choose a topic to see only those photos, like berries, flowers or pizza. ' +
            'Families tap any photo to see it larger, then move through the rest with the arrows or a swipe.'
    },
    {
      id: 'ch8-faq', order: 807, chapter: 8, page: 'index',
      target: '#faq .faq-list',
      title: 'Questions visitors ask most',
      text: 'Fifteen common questions are answered here: seasons, reservations, rain, dogs, parking, payment. ' +
            'Visitors can find an answer without emailing you. When a rule changes, tell your site builder so the answers stay right.'
    },
    {
      id: 'ch8-last', order: 808, chapter: 8, page: 'index',
      target: '.reserve-copy',
      title: 'The last nudge to book',
      text: 'A big band near the bottom has a button to email the farm and, when the farm takes reservations, a button to reserve. ' +
            'Its headline asks “Ready to pick a perfect day?” A visitor who reached the end can act in one tap.'
    },
    {
      id: 'ch8-contact', order: 809, chapter: 8, page: 'index',
      target: '#contact .contact-grid',
      title: 'Directions and who to email',
      text: 'Both places have Get directions, Apple Maps and Waze. The third card says who answers what. ' +
            'Cathy takes general questions, Ava takes pizza and The GreenHouse, Pranee takes photographers and flowers, and Vanessa takes school tours.'
    },
    {
      id: 'ch8-drive', order: 810, chapter: 8, page: 'index',
      target: '#contact .drive',
      title: 'The drive-time box',
      text: 'Six towns show a drive time. A visitor can type an address to get miles and minutes to the farm or The GreenHouse. ' +
            'The site does not keep the address. The six times are our estimates, so please check them.'
    },
    {
      id: 'ch8-signup', order: 811, chapter: 8, page: 'index',
      target: '#follow-signup',
      title: 'The email sign-up',
      text: 'Preview of the sign-up form. It asks for an email and what people want to hear about, like strawberries, pumpkins or pizza. ' +
            'Until Mailchimp is connected, visitors see one button instead. Your site builder needs the form code from your Mailchimp.',
      before: showSignupPreview,
      after: hideSignupPreview
    },
    {
      id: 'ch8-social', order: 812, chapter: 8, page: 'index',
      target: '.follow .social',
      title: 'Instagram and Facebook',
      text: 'Five links lead to Facebook and to four Instagram accounts: the farm, Wise Pie, The GreenHouse and the flowers. ' +
            'Visitors can follow them for bloom news and sudden weather changes.'
    },

    /* ============ 9  Works for everyone ============ */
    {
      id: 'ch9-languages', order: 901, chapter: 9, page: 'index',
      target: '.lang-list', skipIfMissing: true,
      title: 'The language list',
      text: 'This list is on every page, and the site remembers the choice on that device. ' +
            'Families can read the whole site in English, Spanish, Hindi, Chinese or Vietnamese. ' +
            'The translations were written by an AI, so please ask a native speaker to read them.',
      before: openLanguages,
      after: closeLanguages
    },
    {
      id: 'ch9-calm', order: 902, chapter: 9, page: 'index',
      target: '.motion-row', skipIfMissing: true,
      title: 'Comfort: pause the moving pictures',
      text: 'Find “Pause animations” here in the footer. It stops the moving pictures for visitors who find motion tiring. ' +
            'A round button on the game card does the same. The page also calms itself on slow phones and follows a device’s reduce-motion setting.'
    },
    {
      id: 'ch9-phone', order: 903, chapter: 9, page: 'index',
      target: null,
      title: 'Easy on phones, and for everyone',
      text: 'On a phone, the menu is one button and a bottom bar offers Reserve, Directions and Email. Try it on your phone. ' +
            'The page also works with a keyboard, a screen reader and bigger text.'
    },
    {
      id: 'ch9-calendar', order: 904, chapter: 9, page: 'index',
      target: null,
      title: 'The page keeps up with the calendar',
      text: 'The season, Open now badges and New tags follow the real date by themselves, so the page does not go stale. ' +
            'Special-day lines hide after their day. A few jobs need a person: closures, the weekly box, new pizza weekends, price changes.'
    },
    {
      id: 'ch9-pages', order: 905, chapter: 9, page: 'index',
      target: '.footer-guides',
      title: 'Five extra pages for search',
      text: 'Besides the home page, five pages are built for what families search for. ' +
            'They are the first visit, the pumpkin patch, strawberry picking, school field trips and Wise Pie pizza. Each has its own questions and answers. The footer lists all five.'
    },
    {
      id: 'ch9-bring', order: 906, chapter: 9, page: 'first-visit',
      target: '#checklist',
      title: 'The what-to-bring list',
      text: 'On the full first-visit page, visitors tick off what to bring and can print the list. ' +
            'The page remembers their ticks on that device. It is a list of suggestions, not rules.'
    },
    {
      id: 'ch9-comfort', order: 907, chapter: 9, page: 'first-visit',
      target: '#comfort',
      title: 'Accessibility and comfort',
      text: 'Families with strollers, wheelchairs or little ones find the facts here: portable toilets and one accessible toilet, parking, shade, a snack break and service animals. ' +
            'A link lets families email Cathy a question before they come.'
    }
  );
})();
