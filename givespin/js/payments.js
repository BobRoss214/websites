/*
 * The money step. One small adapter so the games never care how a donation is completed.
 *
 *   process(allocations, opts) -> Promise<{ status, receipt, links }>
 *     allocations: [{ charity, cents }]   (already merged, one line per charity)
 *     opts: { timeScale, pay: 'credit' | 'card', frequency, dedication }
 *
 *   demo      simulates the send with a believable delay. Nothing is charged. When paying with demo credit the
 *             credit balance goes down (free play money); a "saved card" payment is just labelled.
 *   redirect  builds a checkout link per charity with config.checkout.url. The player finishes on the
 *             provider's own page; GiveSpin never handles card details or funds.
 */
(function () {
  'use strict';
  var GS = (window.GS = window.GS || {});

  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

  GS.payments = {
    mode: function () { return GS.config.mode === 'redirect' ? 'redirect' : 'demo'; },

    process: function (allocations, opts) {
      opts = opts || {};
      var receipt = GS.core.receiptId();
      var total = allocations.reduce(function (s, a) { return s + a.cents; }, 0);

      if (this.mode() === 'redirect') {
        var links = allocations.map(function (a) {
          var url = null;
          try { url = GS.config.checkout.url(a.charity, a.cents, { frequency: opts.frequency || 'once', dedication: opts.dedication || null }); } catch (e) { url = null; }
          // Only ever allow https links out of a config hook.
          if (typeof url !== 'string' || !/^https:\/\//i.test(url)) { url = null; }
          return { charityId: a.charity.id, cents: a.cents, url: url };
        });
        return Promise.resolve({ status: 'checkout', receipt: receipt, links: links, pay: 'checkout' });
      }

      var pay = opts.pay === 'card' ? 'card' : 'credit';
      if (pay === 'credit' && !GS.store.spend(total)) {
        return Promise.reject(new Error('Not enough demo credit.'));
      }
      var scale = opts.timeScale || 1;
      return wait((650 + allocations.length * 280) * scale).then(function () {
        return { status: 'demo', receipt: receipt, links: [], pay: pay };
      });
    }
  };
})();
