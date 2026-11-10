/* Wise Acres: "What to buy", the pop-up with an ingredient list (js/shop-pop-box.js, css/shop-pop.css). This small file only asks for the pop-up's code, and only when the
 * sample data (js/shop-sample.js, PREVIEW lists) is on the page: on a site without it nothing is asked for and nothing is added. */
(function () {
  'use strict';
  const W = (window.WISE_ACRES = window.WISE_ACRES || {}), doc = document, me = doc.currentScript;
  const where = me && me.src ? /^(.*)js\/shop-pop\.js(?:[?#].*)?$/.exec(me.src) : null;
  function go() {
    if (!W.shopSample || W.shopPop || !doc.getElementById('shop')) return;   // no sample data, or the pop-up's code is in the page already (the preview)
    const s = doc.createElement('script');
    s.src = (where ? where[1] : '') + 'js/shop-pop-box.js';
    (doc.head || doc.documentElement).appendChild(s);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', go); else go();
})();
