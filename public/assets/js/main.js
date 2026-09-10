// ============================================================
// main.js - 应用初始化入口
// ============================================================

window.State = { category: 'all', currentSlug: null };

(function () {
  'use strict';

  function normalizeEntryRoute() {
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const pathMap = {
      '/about': '#/about',
      '/contact': '#/contact'
    };

    if (!location.hash && pathMap[path]) {
      history.replaceState(null, '', pathMap[path]);
    }
  }

  function init() {
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    normalizeEntryRoute();

    window.addEventListener('hashchange', function () {
      window.Router.navigate();
    });

    if (!location.hash) history.replaceState(null, '', '#/');
    window.Router.navigate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();