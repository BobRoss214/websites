/*
 * GiveSpin settings. This is the file to edit when you customise or launch the site.
 *
 * MODE
 *   'demo'     Nothing is charged and no money moves. Rounds are simulated end to end so the whole
 *              experience can be played, demoed and streamed. Players get free "demo credit" to give, a
 *              "Demo mode" banner shows, and every receipt is stamped DEMO. This is the default on purpose.
 *   'redirect' After the game picks a charity, the receipt shows a "Complete your donation" button that
 *              opens a real checkout page for that charity (see `checkout.url` below). GiveSpin never
 *              touches card details or funds: the payment happens on the provider's own page.
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

    // How many times a gift can be split across rounds (every game except slots, which always has 3 reels).
    roundOptions: [1, 3, 5, 10],

    // No single round may be smaller than this (whole dollars). Payment providers have minimums, and tiny
    // gifts are mostly eaten by processing, so a $5 gift can be split in 3 or 5 but not 10.
    minPerRound: 1,

    // The fewest charities a game needs in play.
    minPool: 2,

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
