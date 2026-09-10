// ============================================================
// main.js - 应用初始化入口
// ============================================================

window.State = { category: 'all', currentSlug: null };

(function () {
  'use strict';

  function init() {
    // 当前年份
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Hash 路由变化监听
    window.addEventListener('hashchange', function () {
      window.Router.navigate();
    });

    // 首次加载
    if (!location.hash) {
      history.replaceState(null, '', '#/');
      window.Router.navigate();
    } else {
      window.Router.navigate();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
