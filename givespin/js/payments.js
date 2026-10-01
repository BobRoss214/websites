/*
 * The money step. One small adapter so the games never care how a donation is completed.
 *
 *   process(allocations) -> Promise<{ status, receipt, links }>
 *     allocations: [{ charity, cents }]   (already merged, one line per charity)
 *
 *   demo      simulates the send with a believable delay. Nothing is charged.
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
      if (this.mode() === 'redirect') {
        var links = allocations.map(function (a) {
          var url = null;
          try { url = GS.config.checkout.url(a.charity, a.cents); } catch (e) { url = null; }
          // Only ever allow https links out of a config hook.
          if (typeof url !== 'string' || !/^https:\/\//i.test(url)) { url = null; }
          return { charityId: a.charity.id, cents: a.cents, url: url };
        });
        return Promise.resolve({ status: 'checkout', receipt: receipt, links: links });
      }
      var scale = opts.timeScale || 1;
      return wait((650 + allocations.length * 280) * scale).then(function () {
        return { status: 'demo', receipt: receipt, links: [] };
      });
    }
  };
})();
