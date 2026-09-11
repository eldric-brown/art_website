// ============================================================
// main.js - 应用初始化入口
// （window.State / window.T / window.Tf 已在 utils.js 定义，
//   因为 views.js 的 IIFE 在初始化时会立即捕获 T，
//   而 views.js 加载早于 main.js。这里只做初始化逻辑。）
// ============================================================

// 应用站点元信息（<title>、meta description、og:description）
function applySiteMeta(content) {
  const title = content['site.title'];
  if (title) {
    document.title = title;
    const og = document.querySelector('meta[property="og:title"]');
    if (og) og.setAttribute('content', title);
  }
  const desc = content['site.description'];
  if (desc) {
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', desc);
    const og = document.querySelector('meta[property="og:description"]');
    if (og) og.setAttribute('content', content['site.og_description'] || desc);
  }
}

// 应用导航栏与页脚的文案（HTML 里用 data-text="key" 标记，由 JS 注入）
function applyChromeTexts(content) {
  // 通用：所有带 data-text="key" 的元素
  document.querySelectorAll('[data-text]').forEach(function (el) {
    const key = el.getAttribute('data-text');
    if (!key || !content[key]) return;

    // footer.copyright 含 <span id="year"></span>，需要拼接保留年份
    if (key === 'footer.copyright') {
      const tpl = content[key];
      el.textContent = tpl.split('{year}').join(new Date().getFullYear());
      return;
    }

    // 其他元素直接替换文本
    el.textContent = content[key];
  });
}

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

  async function loadSiteContent() {
    try {
      const data = await window.API.getSiteContent();
      window.State.content = data.content || {};
    } catch (e) {
      console.warn('site content load failed, using empty fallback', e);
      window.State.content = {};
    }
    finally {
      window.State.contentReady = true;
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

    // 先加载站点文案，再启动路由；导航/页脚/页面文案统一从 DB 取
    loadSiteContent().then(function () {
      applySiteMeta(window.State.content);
      applyChromeTexts(window.State.content);
      window.Router.navigate();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();