/* Wise Acres "Take a tour": the steps of chapters 6 to 9 (written for the two farm owners).
 *   6  The GreenHouse and Wise Pie pizza     7  The Store     8  Groups, story, reviews, photos, questions, contact, sign-up
 *   9  Works for everyone
 * This file only adds steps to window.WA_TOUR_STEPS. The tour engine (js/tour.js) loads it when the tour is first opened and
 * sorts every step by "order" (chapter * 100 + position, so 703 is chapter 7, step 3). The chapter titles are in js/tour-steps.js.
 * A step is { id, order, chapter, page, target, title, text, before, after, allowClicks, skipIfMissing }:
 *   target is one CSS selector (the first visible match is lit) or null for a centred card; skipIfMissing hides the step when the
 *   target is not there (a part that only shows for some visitors).
 * before() and after() change the page for the length of one step and put it back: they work with plain DOM code, may run twice,
 * and each one undoes only what it did itself, so the order the engine calls them in does not matter.
 * Rules for the words: 45 words at most a card, short sentences, "you", no price or fact that is not on the site's own pages,
 * no year, no web or email address (those are checked by the site's tests). Plain ES5 on purpose (old phones read this file too).
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
  // On a phone the columns of The GreenHouse are stacked and the card is a sheet over the lower part: the yellow note is brought just under the top bar, so the green line (tree
  // season) shows above the sheet. On a computer the list, the note and the line are brought into the window together by the engine (also), and nothing is scrolled by hand.
  function placeTreeNote() {
    if ((document.documentElement.clientWidth || window.innerWidth) > 640) return;
    var note = one('#greenhouse .gh-callout'), bar = one('.site-header');
    if (!note) return;
    var dy = note.getBoundingClientRect().top - ((bar ? bar.getBoundingClientRect().height : 80) + 24);
    try { window.scrollTo({ top: window.pageYOffset + dy, behavior: 'instant' }); } catch (e) { window.scrollTo(0, window.pageYOffset + dy); }
  }

  /* ---- the three group tabs: school tours, parties, corporate events (steps 801 to 803) ---- */
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

  /* ---- the sign-up form: hidden until Mailchimp is connected, shown here as a labelled preview (step 810) ---- */
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

  /* ---- the language list under the globe button (step 901) ---- */
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
            'At The GreenHouse (4 to 8 pm), no reservation: first come, first served. Visitors can pick the card that fits.'
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
      text: 'The GreenHouse is next door and needs no reservation, so visitors without a booking still have a place to go. ' +
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
      id: 'ch6-trees', order: 606, chapter: 6, page: 'index',
      target: '#greenhouse .gh-features',
      also: ['#greenhouse .gh-callout', '#greenhouse .gh-trees'],   // the list that names the trees, the yellow note, and the green line when it shows (tree season): all lit
      title: 'Christmas trees at The GreenHouse',
      text: 'The list says “Christmas trees in season” all year. A green line, “Christmas trees are here”, shows only in tree season. It sits under the yellow reservations note. Press a season.',
      choicesLabel: 'See this part in:',
      choices: seasonWalk({
        spring: 'Spring. No green line. Only the list item “Christmas trees in season” is there, with the pizza, ice cream, drinks and goats.',
        summer: 'Summer. The same: no green line, only “Christmas trees in season” in the list.',
        fall: 'Fall. Still no green line. It waits for tree season.',
        winter: 'Winter. A green line appears: “Christmas trees are here.” It says tree season runs from the Friday after Thanksgiving to early December, right at The GreenHouse.'
      }, placeTreeNote),
      before: seasonsBegin, after: seasonsEnd
    },

    /* ============ 7  The Store ============ */
    {
      id: 'ch7-jump', order: 701, chapter: 7, page: 'index',
      target: '#shop .shop-jump',
      title: 'The Store: twelve groups, all in one place',
      text: 'Everything for sale at the farm and The GreenHouse is listed here, in twelve groups. ' +
            'Each product has a name, a price and a small drawing. These buttons jump straight to a group. Visitors can check a price before they ask.'
    },
    {
      id: 'ch7-note', order: 702, chapter: 7, page: 'index',
      target: '#shop .shop-note',
      title: 'The price note',
      text: 'This note says prices are for this fall and can change. ' +
            'It also says anything marked “Prices coming soon” is still being confirmed. ' +
            'Questions go to the farm’s email, so you may hear about a price that looks wrong.'
    },
    {
      id: 'ch7-pizza', order: 703, chapter: 7, page: 'index',
      target: '#shop-greenhouse',
      title: 'Pizza prices came from your older page',
      text: 'Pizza shows $15 to $17, gluten-free crust +$9, vegan cheese +$3, and Friday to Sunday, 10 am to 8 pm. ' +
            'These came from your older page. We need you to confirm them.'
    },
    {
      id: 'ch7-soon-pantry', order: 704, chapter: 7, page: 'index',
      target: '#shop-pantry',
      title: 'Prices coming soon: the pantry',
      text: 'Eleven cards in the Store still say “Prices coming soon” in a red dashed label. Two are here: Jam and Elderberry shrub. ' +
            'The other pantry cards show prices read from your own signs. Please send us each missing price.'
    },
    {
      id: 'ch7-soon-wear', order: 705, chapter: 7, page: 'index',
      target: '#shop-wear',
      title: 'Prices coming soon: Wear Wise Acres',
      text: 'All five items here wait for a price: trucker cap, bucket hat, T-shirt, sweatshirt, and canvas and linen bags. ' +
            'Please send us each price. Visitors can then see every price themselves.'
    },
    {
      id: 'ch7-soon-fall', order: 706, chapter: 7, page: 'index',
      target: '#shop-pumpkins',
      title: 'Prices coming soon: fall, trees and u-pick',
      text: 'U-pick pumpkins and Christmas trees wait for a price. In the farm group below, so do U-pick strawberries and blueberries. ' +
            'The three u-pick cards already said “Prices coming soon” on your older page. Please send us each price. This group shows all year.'
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
      title: 'Corporate events: prices still a draft',
      text: 'Company picnics are $750 for up to 50 guests, and $1,400 for 51 to 100 guests. Larger events get a custom quote. ' +
            'These are draft prices, and the page says so. Please confirm or change them.',
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
      title: 'The photo gallery',
      text: 'Choose a topic to see only those photos, like berries, flowers or pizza. Open a photo to see it larger. ' +
            'Many photos are small, so full-size originals from your phone would look much sharper.'
    },
    {
      id: 'ch8-faq', order: 807, chapter: 8, page: 'index',
      target: '#faq .faq-list',
      title: 'Questions visitors ask most',
      text: 'Fifteen common questions are answered here: seasons, reservations, rain, dogs, parking, payment. ' +
            'Visitors can find an answer without emailing you. When a rule changes, tell your site builder so the answers stay right.'
    },
    {
      id: 'ch8-contact', order: 808, chapter: 8, page: 'index',
      target: '#contact .contact-grid',
      title: 'Directions and who to email',
      text: 'Both addresses have Get directions, Apple Maps and Waze links. ' +
            'A third card says who to email: general questions, pizza, photographers and flowers, school tours. Please check each inbox is read.'
    },
    {
      id: 'ch8-drive', order: 809, chapter: 8, page: 'index',
      target: '#contact .drive',
      title: 'The drive-time box',
      text: 'Six towns show a drive time. A visitor can type an address to get miles and minutes to the farm or The GreenHouse. ' +
            'The site does not keep the address. The six times are our estimates, so please check them.'
    },
    {
      id: 'ch8-signup', order: 810, chapter: 8, page: 'index',
      target: '#follow-signup',
      title: 'The email sign-up',
      text: 'Preview of the sign-up form. It asks for an email and what people want to hear about, like strawberries, pumpkins or pizza. ' +
            'Until Mailchimp is connected, visitors see one button instead. Your site builder needs the form code from your Mailchimp.',
      before: showSignupPreview,
      after: hideSignupPreview
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
            'Special-day lines hide after their day. A few jobs still need a person: closures, the weekly box, new pizza weekends, price changes.'
    }
  );
})();
