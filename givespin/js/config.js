/*
 * GiveSpin settings. This is the file to edit when you customise or launch the site.
 *
 * MODE
 *   'demo'     Nothing is charged and no money moves. Rounds are simulated end to end so the whole
 *              experience can be played, demoed and streamed. Players get free "demo credit" to give, a
 *              "Demo mode" banner shows, and every receipt is stamped DEMO. This is the default on purpose.
 *   'redirect' After the game picks a charity, the receipt shows a "Donate $X to <charity>" button that
 *              opens a real checkout page for that charity (see `checkout.url` below). GiveSpin never
 *              touches card details or funds: the payment happens on the provider's own page.
 *
 * WHAT 'redirect' DOES AND DOES NOT DO (read before changing `mode`; the plain-words version is the Make it real page,
 * `#make-it-real`, and the owner's checklist is docs/make-it-real.md)
 *   - It takes nothing here. The only thing it does is show a link; the payment, the receipt and the money belong to
 *     whoever runs the checkout page.
 *   - Only https links are accepted (js/payments.js drops any other link), and `checkout.url` below returns null until
 *     someone fills it in, so with the shipped file a charity shows "no checkout link set up" and there is no button.
 *   - The site cannot tell whether a visitor finished checkout, so a round is recorded as "sent to checkout", not as a
 *     completed gift.
 *   - The demo credit, the DEMO stamp, the live tables, the bots and the ticker of simulated players are switched off.
 *   - Nothing else about real money exists here: no payment provider, no keys, no accounts that work. Do not add them to this
 *     file. Real payments need a provider, receipts from it, agreements with each charity, a legal and tax review, a privacy
 *     policy and refund handling first (see the checklist).
 *
 * The shape of the settings (every key below is read somewhere; nothing else in this file is):
 *   brand           string                     the name in titles and share text
 *   mode            'demo' | 'redirect'        see above; anything else is treated as 'demo' (js/payments.js)
 *   minAmount, maxAmount, defaultAmount, presets   whole dollars
 *   roundOptions    number[]                   how many rounds a gift can be split into
 *   minPerRound, minPool                       whole dollars; the fewest charities a game needs
 *   logos           boolean                    show charity logos where there is one
 *   demoCredit, creditTopUps                   demo mode only
 *   checkout.url    (charity, cents, opts) => https URL string | null     redirect mode only
 *                   opts = { frequency: 'once'|'weekly'|'monthly', dedication: { kind, name, note } | null }
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  GS.config = {
    brand: 'GiveSpin',
    mode: 'demo', // 'demo' | 'redirect'

    // Amount limits per round, in whole dollars.
    minAmount: 1,
    maxAmount: 1000,
    defaultAmount: 25,
    presets: [5, 10, 25, 50, 100],

    // How many times a gift can be split across rounds. This list is for every game except the five slot machines:
    // there, each reel is one round, so the player chooses 3 to 12 reels instead (see js/games/slots.js).
    roundOptions: [1, 3, 5, 10],

    // No single round may be smaller than this (whole dollars). Payment providers have minimums, and tiny
    // gifts are mostly eaten by processing, so a $5 gift can be split in 3 or 5 but not 10.
    minPerRound: 1,

    // The fewest charities a game needs in play.
    minPool: 2,

    // Show a charity's logo instead of its monogram circle when one has been added (see tools/fetch-logos.mjs).
    // Logos are the charities' trademarks: read the note in that file before adding any. Set false to turn them off.
    logos: true,

    // Demo credit (demo mode only): what a new player starts with, and the amounts offered in "Add credit".
    demoCredit: 1000,
    creditTopUps: [100, 500, 1000],

    /*
     * Checkout link builder, used only when mode === 'redirect'.
     * Return a full https:// URL for donating `cents` to `charity`, or null when that charity has no link.
     * `opts` = { frequency: 'once' | 'weekly' | 'monthly', dedication: { kind, name, note } | null }.
     *
     * Example for a provider that accepts links like https://example-checkout.org/<slug>?amount=25.00 :
     *
     *   url: function (charity, cents, opts) {
     *     return charity.slug
     *       ? 'https://example-checkout.org/' + encodeURIComponent(charity.slug) + '?amount=' + (cents / 100).toFixed(2) +
     *         (opts.frequency !== 'once' ? '&frequency=' + opts.frequency : '')
     *       : null;
     *   }
     *
     * Check your provider's documentation for the exact link format, then add a `slug` (or whatever
     * your builder needs) to each charity in js/data.js.
     */
    checkout: {
      url: function (charity, cents, opts) { return null; }
    }
  };
})();
