/* Wise Acres account demo: the data and the rules behind it.
 *
 * THE DEMO IS PRETEND. Nothing here is real except the numbers, and those are copied from the site's own pages (the prices and ages of the visit
 * packages, the Fall Menu, the school-tour price). tests/demo-data.test.mjs checks every one of them against the page, so a changed price makes it fail.
 * The sample family is made up (first names only). Dates are 'YYYY-MM-DD' and times 'HH:MM' (24 hours): the farm's own clock, no time zones.
 *
 * Plain JavaScript, no libraries, no DOM, no storage. It loads in the browser (window.DemoData) and in Node (module.exports), so tests can run it.
 * js/demo-store.js keeps the state; js/demo-ui.js shows it. Used only by the demo pages: see docs/ACCOUNT_DEMO.md. */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Dates and times
   * ------------------------------------------------------------------ */
  // The pizza data and rules (the Fall Menu, the crust and cheese extras, order prices and differences, pick-up times) live in js/demo-pizza-data.js, which every demo page loads first.
  var PD = (typeof module === 'object' && module && module.exports && typeof require === 'function') ? require('./demo-pizza-data.js') : window.DemoPizzaData;

  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function utc(s) { var p = parse(s); return Date.UTC(p.y, p.m - 1, p.d); }
  function fmt(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { return fmt(utc(s) + n * 864e5); }
  function weekday(s) { return new Date(utc(s)).getUTCDay(); }
  function daysBetween(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); }
  function isDate(s) { var p = parse(s); return !!p && fmt(utc(s)) === s; }
  // The next day (after `from`, never `from` itself) that falls on weekday `dow` (0 = Sunday ... 6 = Saturday), and the last one before `from`.
  function nextWeekday(from, dow) { var d = addDays(from, 1); while (weekday(d) !== dow) d = addDays(d, 1); return d; }
  function prevWeekday(from, dow) { var d = addDays(from, -1); while (weekday(d) !== dow) d = addDays(d, -1); return d; }

  function toMin(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t)); return m ? +m[1] * 60 + +m[2] : NaN; }
  function fromMin(n) { n = ((n % 1440) + 1440) % 1440; return pad(Math.floor(n / 60)) + ':' + pad(n % 60); }
  function addMinutes(t, n) { return fromMin(toMin(t) + n); }

  // The farm's clock (Eastern Time) for a moment: { date: 'YYYY-MM-DD', time: 'HH:MM' }. A visitor in another time zone gets the farm's day.
  var etFmt = null;
  function farmParts(d) {
    d = d || new Date();
    try {
      etFmt = etFmt || new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
      var p = {};
      etFmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
      return { date: p.year + '-' + p.month + '-' + p.day, time: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
    } catch (e) {   // no time zone support: the visitor's own clock
      return { date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
    }
  }
  function today(now) { return farmParts(now).date; }

  /* ------------------------------------------------------------------ *
   * Words for dates, times and money ("Saturday, Nov 14", "2:00 pm", "$4.50")
   * ------------------------------------------------------------------ */
  function weekdayName(s) { return DAY_NAMES[weekday(s)]; }
  function dateShort(s) { var p = parse(s); return p ? MONTH_SHORT[p.m - 1] + ' ' + p.d : String(s); }
  function dateLong(s) { return parse(s) ? weekdayName(s) + ', ' + dateShort(s) : String(s); }
  function time12(t) {
    var n = toMin(t);
    if (isNaN(n)) return String(t);
    var h = Math.floor(n / 60) % 24, m = n % 60;
    return (h % 12 === 0 ? 12 : h % 12) + ':' + pad(m) + ' ' + (h < 12 ? 'am' : 'pm');
  }
  function money(n) {
    n = Math.round(n * 100) / 100;
    var neg = n < 0, a = Math.abs(n), whole = Math.floor(a), cents = Math.round((a - whole) * 100);
    return (neg ? '-' : '') + '$' + String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents ? '.' + pad(cents) : '');
  }
  // ['a'] -> 'a'; ['a', 'b'] -> 'a and b'; ['a', 'b', 'c'] -> 'a, b and c'
  function words(list) { return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function cents(x) { return Math.round(x * 100) / 100; }

  /* ------------------------------------------------------------------ *
   * Prices and rules: ALL FROM THE SITE'S OWN PAGES (index.html; the school tour also on school-field-trips.html)
   * ------------------------------------------------------------------ */
  var PRICES = {
    pizzaBase: 31,        // "Yes pizza": $31 base price, includes 2 Wise Pie pizzas
    perPerson: 3,         // field fee, ages 3 and up (both packages): $3 per person
    freeAge: 2,           // children age 2 and younger are free
    wagon: 4.5,           // wagon ride, $4.50 per person
    wagonFreeAge: 3,      // ages 3 and younger ride the wagon free (the site builder, Nov 3 2026; the farm's older page said 2 and younger)
    barrel: 3,            // barrel train, $3 per child
    barrelMaxAge: 12,     // ages 12 and under only
    corn: 4,              // corn pit, $4 per person (on Thursdays buy one, get one free, with a reservation)
    schoolPerStudent: 11, // school tours: $11 per student; parents and siblings ages 3 and older who come pay the same $11
    schoolMinStudents: 100,
    partyPrice: 300,      // parties (Groups section): $300 per party, not per person; the farm entry fee is included
    partyMaxGuests: 50,   // "Up to 50 guests. Children age 2 and younger are free and do not count toward the total."
    pizzasIncluded: PD.PRICES.pizzasIncluded,   // from js/demo-pizza-data.js: the 2 pizzas of the package, the gluten-free crust (+$9) and the vegan cheese (+$3)
    glutenFree: PD.PRICES.glutenFree,
    veganCheese: PD.PRICES.veganCheese
  };

  // The two packages. `days`: 0 = Sunday ... 6 = Saturday. Visit with pizza: Friday, Saturday and Sunday. Farm fun only: Thursday to Sunday.
  var PACKAGES = {
    pizza: { id: 'pizza', name: 'Visit with pizza', days: [5, 6, 0] },
    farm: { id: 'farm', name: 'Farm fun only', days: [4, 5, 6, 0] }
  };

  // Sample time slots: on the hour from 10 am to 2 pm. Pretend: the demo says "sample times" next to them.
  var SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00'];

  // The "Tell me when" switches. `spot` also has one entry per chosen day in the waitlist (see js/demo-store.js).
  var alertKinds = [
    { key: 'strawberries', label: 'Strawberries open', notice: 'Strawberries are open at Wise Acres.' },
    { key: 'blueberries', label: 'Blueberries and sunflowers open', notice: 'Blueberries and sunflowers are open at Wise Acres.' },
    { key: 'pumpkins', label: 'Pumpkins and tomatoes open', notice: 'Pumpkins and tomatoes are open at Wise Acres.' },
    { key: 'trees', label: 'Christmas trees arrive', notice: 'Christmas trees have arrived at Wise Acres.' },
    { key: 'spot', label: 'A spot opens on a full day', notice: 'A spot opened on a day you were waiting for.' }
  ];

  // Links that already exist on the site.
  var LINKS = {
    directions: 'https://www.google.com/maps/dir/?api=1&destination=4701+Hartis+Rd%2C+Indian+Trail%2C+NC+28079',
    whatToBring: 'first-visit.html#checklist',
    firstVisit: 'first-visit.html',
    home: 'index.html',
    address: '4701 Hartis Rd, Indian Trail, NC 28079'
  };
  // The sentences of the site's own "Changes and rain" card (first-visit.html), shown near the buttons that change a visit.
  var RULES = {
    change: 'You can change your reservation at no charge until 11:59 PM the night before your visit',
    weather: 'If severe weather forces us to close, we\u2019ll email you and give a full refund',
    partyTime: '2 hours of party time, plus 15 minutes before for set-up and 15 minutes after for clean-up'   // the Parties card: 2.5 hours in all
  };

  // The two e-mail addresses the pretend account shows, both already on the site (the school tours card and page; the Wise Pie page). The subject lines are the site's own.
  // No phone number and no other contact is shown anywhere in the demo.
  var CONTACTS = {
    vanessa: { name: 'Vanessa', email: 'vanessa@wiseacresorganic.com', href: 'mailto:vanessa@wiseacresorganic.com?subject=School%20tour%20question', text: 'Questions? Email Vanessa' },
    ava: { name: 'Ava', email: 'ava@wiseacresorganic.com', href: 'mailto:ava@wiseacresorganic.com?subject=Wise%20Pie%20question', text: 'Pizza questions? Email Ava' }
  };

  // The standard sample account (the tour and the "Fill in sample details" button use it): the sample family is Alex, Jordan, Riley, Casey and baby Sam,
  // and they said yes to "Do you plan or manage a party, an event or a school trip?" with a school trip, so the ready-made sample has a My event tab.
  var SAMPLE_ACCOUNT = { name: 'Alex', email: 'alex@example.com', eventKind: 'school' };

  // The sign-up question "Do you plan or manage a party, an event or a school trip?" and its four big buttons. `key` is what the account keeps (account.eventKind);
  // `short` names the kind in the "I also plan an event" box of My family. 'none' = no event, and then the My event tab is not shown.
  var EVENT_KINDS = [
    { key: 'none', label: 'No' },
    { key: 'party', label: 'Yes: a party', short: 'A party' },
    { key: 'school', label: 'Yes: a school trip', short: 'A school trip' },
    { key: 'other', label: 'Yes: another event', short: 'Another event' }
  ];
  // An answer (saved or typed) -> one of the four keys. Nothing given at all (undefined) means the ready-made sample, which has the school trip; anything else that is not a kind means no event.
  function eventKindOf(x) {
    if (x === undefined) return 'school';
    var k = String(x === null ? '' : x).toLowerCase();
    for (var i = 0; i < EVENT_KINDS.length; i++) if (EVENT_KINDS[i].key === k) return k;
    return 'none';
  }

  // Who is who in sentences.
  var WHO = { family: 'You', cathy: 'Mrs. Cathy', rob: 'Rob', kitchen: 'The kitchen' };

  /* ------------------------------------------------------------------ *
   * The days a package can be booked on
   * ------------------------------------------------------------------ */
  // The next `n` days (from `from`, which counts if it is one) that the package is offered, not counting the days in `closed`. 'YYYY-MM-DD' in and out.
  function openDays(from, pkg, n, closed) {
    var days = (PACKAGES[pkg] || PACKAGES.farm).days, out = [], d = from, guard = 0;
    closed = closed || [];
    while (out.length < n && guard++ < 800) {
      if (days.indexOf(weekday(d)) >= 0 && closed.indexOf(d) < 0) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Visits: what a visit costs. Every number comes from PRICES.
   * ------------------------------------------------------------------ */
  // visit = { date, package: 'pizza'|'farm', party: { adults: n, kids: [{ name, age }] }, addons: [{ id: 'wagon'|'barrel'|'corn', qty }] }
  // -> { lines: [{ id, label, qty, unit, amount }], total }
  function priceVisit(v) {
    var P = PRICES, party = v.party || {}, kids = party.kids || [], lines = [];
    var paying = (party.adults || 0) + kids.filter(function (k) { return k.age > P.freeAge; }).length;   // ages 3 and up
    if (v.package === 'pizza') lines.push({ id: 'base', label: 'Visit with pizza (includes ' + P.pizzasIncluded + ' Wise Pie pizzas)', qty: 1, unit: 'base price', amount: P.pizzaBase });
    lines.push({ id: 'field', label: 'Field fee, ages 3 and up', qty: paying, unit: 'per person', amount: cents(paying * P.perPerson) });
    (v.addons || []).forEach(function (a) {
      var qty = a.qty || 0;
      if (a.id === 'wagon') lines.push({ id: 'wagon', label: 'Wagon ride', qty: qty, unit: 'per person', amount: cents(qty * P.wagon) });
      else if (a.id === 'barrel') lines.push({ id: 'barrel', label: 'Barrel train', qty: qty, unit: 'per child', amount: cents(qty * P.barrel) });
      else if (a.id === 'corn') {
        var thursday = v.date && isDate(v.date) && weekday(v.date) === 4, charged = thursday ? Math.ceil(qty / 2) : qty;   // Thursdays: buy one, get one free
        lines.push({ id: 'corn', label: thursday ? 'Corn pit (Thursday: buy one, get one free)' : 'Corn pit', qty: charged, unit: 'per person', amount: cents(charged * P.corn) });
      }
    });
    return { lines: lines, total: cents(lines.reduce(function (s, l) { return s + l.amount; }, 0)) };
  }

  /* ------------------------------------------------------------------ *
   * School trips, parties and other events (the Groups section; school-field-trips.html)
   * ------------------------------------------------------------------ */
  // event = { kind, students, guests } -> { lines, total }. No kind means a school trip.
  //   school: $11 per student; parents and siblings ages 3 and older who come pay the same $11.
  //   party:  one price for the whole party ($300), the farm entry fee included; up to 50 guests.
  //   other:  the website names no price for other events (the corporate prices there are a draft), so there are no lines and the total is null: Mrs. Cathy gives a quote.
  function priceEvent(e) {
    var P = PRICES;
    if (e.kind === 'party') return { lines: [{ id: 'party', label: 'Party package, farm entry included', qty: 1, unit: 'per party', amount: P.partyPrice }], total: P.partyPrice };
    if (e.kind === 'other') return { lines: [], total: null };
    var lines = [{ id: 'students', label: 'Students', qty: e.students || 0, unit: 'per student', amount: cents((e.students || 0) * P.schoolPerStudent) }];
    if (e.guests) lines.push({ id: 'guests', label: 'Parents and siblings, ages 3 and up', qty: e.guests, unit: 'each', amount: cents(e.guests * P.schoolPerStudent) });
    return { lines: lines, total: cents(lines.reduce(function (s, l) { return s + l.amount; }, 0)) };
  }
  // '' when the head count is fine, else the page's own rule in plain words
  function eventProblem(e) {
    if (e.kind === 'party') return (e.guests || 0) > PRICES.partyMaxGuests ? 'A party is for up to ' + PRICES.partyMaxGuests + ' guests. For a larger event, ask Mrs. Cathy.' : '';
    if (e.kind === 'other') return '';
    return (e.students || 0) < PRICES.schoolMinStudents ? 'The minimum group size for a school tour is ' + PRICES.schoolMinStudents + ' students.' : '';
  }

  /* ------------------------------------------------------------------ *
   * The sample family and its sample visits: made from the rules above, never typed in
   * ------------------------------------------------------------------ */
  var KIDS = [{ name: 'Riley', age: 8 }, { name: 'Casey', age: 6 }, { name: 'Sam', age: 2 }];   // Sam is the baby
  function visitRecord(o) {
    var rec = { id: o.id, date: o.date, time: o.time, package: o.package, party: { adults: 2, kids: KIDS.map(function (k) { return { name: k.name, age: k.age }; }) }, addons: o.addons, closed: false, closedReason: '' };
    var price = priceVisit(rec);
    rec.paid = { receipt: o.receipt, on: o.paidOn, lines: price.lines, total: price.total };
    return rec;
  }
  // The sample event of one kind ('party', 'school' or 'other') for the day `todayDate`, and the first message of Mrs. Cathy in its thread: { event, welcome }.
  // The event has no id and no thread yet (the store gives them). Only the head counts, the title and the dates are made up; prices and rules come from PRICES.
  // The school trip is two weeks and a few days after the sample visit (a Tuesday); a party or another event is on a Saturday. No start time is made up: the site gives none.
  function sampleEvent(kind, todayDate) {
    var t = todayDate || today(), next = nextWeekday(t, 6);   // the next Saturday: where the sample visit is
    if (kind === 'party') {
      return { event: { kind: 'party', title: 'Sample birthday party', date: addDays(next, 14), guests: 24 },
        welcome: 'Thank you for booking a party! Write to us here if the guest count changes.' };
    }
    if (kind === 'other') {
      return { event: { kind: 'other', title: 'Sample group event', date: addDays(next, 21), guests: 30 },
        welcome: 'Thank you for planning an event with us! Write to us here with your date, group size and any special requests.' };
    }
    return { event: { kind: 'school', title: 'Sample Elementary, 2nd grade', date: addDays(next, 17), students: PRICES.schoolMinStudents, guests: 8, slipsReceived: 72 },
      welcome: 'Thank you for booking a school tour! Write to us here if the head count changes.' };
  }
  // The whole starting state of the demo, for the day `todayDate` ('YYYY-MM-DD'); `nowTime` is only for the timestamps ('HH:MM').
  // `eventKind` is the answer to the sign-up question: 'school' (the ready-made sample, also when nothing is given), 'party', 'other' or 'none' (no event at all).
  function sample(todayDate, nowTime, eventKind) {
    var t = todayDate || today(), at = t + ' ' + (nowTime || '09:00'), kind = eventKindOf(eventKind);
    var next = nextWeekday(t, 6);                          // the next Saturday: the upcoming visit
    var last = prevWeekday(t, 6);                          // the most recent Saturday: a past visit
    var upcoming = visitRecord({ id: 'v1', date: next, time: '14:00', package: 'pizza', addons: [{ id: 'wagon', qty: 4 }, { id: 'barrel', qty: 2 }], receipt: 'DEMO-1003', paidOn: t });
    var recent = visitRecord({ id: 'v2', date: last, time: '10:00', package: 'farm', addons: [{ id: 'corn', qty: 4 }], receipt: 'DEMO-1002', paidOn: addDays(last, -5) });
    var older = visitRecord({ id: 'v3', date: addDays(last, -14), time: '11:00', package: 'pizza', addons: [{ id: 'wagon', qty: 4 }], receipt: 'DEMO-1001', paidOn: addDays(last, -19) });
    var order = {
      id: 'o1', visitId: 'v1', pickup: PD.defaultPickup(upcoming.time), notes: '', status: 'new',
      pizzas: [PD.withDefaults({ type: 'pepperoni', count: 1 }), PD.withDefaults({ type: 'margherita', count: 1 })]
    };
    var made = kind === 'none' ? null : sampleEvent(kind, t), event = null;
    if (made) { event = made.event; event.id = 'e1'; event.thread = 'event-e1'; }
    return {
      family: {
        name: 'Alex', adults: [{ name: 'Alex' }, { name: 'Jordan' }], kids: KIDS.map(function (k) { return { name: k.name, age: k.age }; }),
        allergies: 'Riley: peanut allergy.', glutenFree: false, vegan: false
      },
      visits: [upcoming, recent, older],
      orders: [order],
      events: event ? [event] : [],
      messages: event ? [{ id: 'm1', thread: 'event-e1', from: 'cathy', text: made.welcome, at: at }] : [],
      notices: [{ id: 'n1', to: 'family', text: 'We added a sample visit so you can try the buttons.', link: '#visits', at: at, read: false }],
      requests: [], reviews: [], photos: [], waitlist: [],
      alerts: {}, closedDays: []
    };
  }

  /* ------------------------------------------------------------------ *
   * A calendar file for a visit (the "Add to calendar" button). Eastern Time, like the pizza reminders of js/features.js. No end time is made up.
   * ------------------------------------------------------------------ */
  function icsText(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n'); }
  function icsFold(line) {
    var enc = typeof TextEncoder === 'function' ? new TextEncoder() : null, out = [], cur = '', bytes = 0;
    for (var ch of line) {
      var n = enc ? enc.encode(ch).length : 1;
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join('\r\n ');
  }
  function stamp(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function visitICS(v, order, nowDate) {
    var start = v.date.replace(/-/g, '') + 'T' + v.time.replace(':', '') + '00';
    var desc = 'This is a pretend visit from the Wise Acres account demo. Nothing was booked. ' + (order ? 'Pizza pick-up: ' + time12(order.pickup) + '. ' : '') + 'Address: ' + LINKS.address + '.';
    var L = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wise Acres Organic Farm//Account demo//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VTIMEZONE', 'TZID:America/New_York',
      'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT', 'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST', 'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT', 'UID:wa-demo-' + v.id + '@wiseacresorganic.com', 'DTSTAMP:' + stamp(nowDate || new Date()),
      'DTSTART;TZID=America/New_York:' + start, 'DTEND;TZID=America/New_York:' + start,
      'SUMMARY:' + icsText('Wise Acres farm visit (DEMO, pretend)'), 'DESCRIPTION:' + icsText(desc), 'LOCATION:' + icsText(LINKS.address),
      'END:VEVENT', 'END:VCALENDAR'
    ];
    return L.map(icsFold).join('\r\n') + '\r\n';
  }

  var api = {
    PRICES: PRICES, PACKAGES: PACKAGES, PIZZAS: PD.PIZZAS, SLOTS: SLOTS, alertKinds: alertKinds, LINKS: LINKS, RULES: RULES, WHO: WHO, SAMPLE_ACCOUNT: SAMPLE_ACCOUNT,
    CONTACTS: CONTACTS, EVENT_KINDS: EVENT_KINDS, eventKindOf: eventKindOf,
    FARM_OPENS: PD.FARM_OPENS, FARM_CLOSES: PD.FARM_CLOSES,
    // dates and times
    farmParts: farmParts, today: today, parse: parse, isDate: isDate, addDays: addDays, weekday: weekday, daysBetween: daysBetween, nextWeekday: nextWeekday, prevWeekday: prevWeekday,
    toMin: toMin, fromMin: fromMin, addMinutes: addMinutes,
    // words
    weekdayName: weekdayName, dateShort: dateShort, dateLong: dateLong, time12: time12, money: money, words: words, plural: plural,
    // rules: visits and school trips here, the pizza ones from js/demo-pizza-data.js under the same names
    openDays: openDays, priceVisit: priceVisit, priceEvent: priceEvent, eventProblem: eventProblem, sampleEvent: sampleEvent,
    pizzaById: PD.pizzaById, defaultPickup: PD.defaultPickup, pickupSlots: PD.pickupSlots, pizzaCount: PD.pizzaCount, withDefaults: PD.withDefaults,
    describeOrder: PD.describeOrder, priceOrder: PD.priceOrder, diffOrders: PD.diffOrders,
    sample: sample, visitICS: visitICS
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (typeof window === 'object' && window) window.DemoData = api;
})();
