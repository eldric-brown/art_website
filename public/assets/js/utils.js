// ============================================================
// utils.js - 通用工具函数
// ============================================================

// 全局状态（放在 utils.js 是因为 T/Tf 依赖 State.content，
// 而 views.js 在 IIFE 初始化时就捕获 T，所以这些必须早于 views.js 加载）
window.State = {
  category: 'all',
  currentId: null,
  content: {},
  contentReady: null
};

// T(key, fallback)：优先从 State.content 取；无 key 时返回 fallback 或空串
window.T = function (key, fallback) {
  const value = window.State.content[key];
  if (value != null && value !== '') return value;
  return fallback != null ? fallback : '';
};

// 把 value 里的占位符 {year} 等替换
window.Tf = function (key, vars, fallback) {
  let value = window.T(key, fallback);
  if (vars) {
    for (const name of Object.keys(vars)) {
      value = value.split('{' + name + '}').join(vars[name]);
    }
  }
  return value;
};

window.Utils = (function () {
  'use strict';

  return {
    escapeHtml(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    placeholderImage(text) {
      text = text || 'Loading...';
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000">' +
        '<rect width="800" height="1000" fill="#f5f5f7"/>' +
        '<text x="400" y="500" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#86868b">' + text + '</text>' +
        '</svg>';
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    },

    formatDate(iso) {
      if (!iso) return '';
      try {
        return new Date(iso).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch (e) { return iso; }
    },

    getCategoryLabel(key) {
      if (typeof key === 'string' && key) return window.T('category.' + key, key);
      return key;
    },

    toast(message, type, duration) {
      type = type || 'info';
      duration = duration || 2500;
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText =
          'position:fixed;top:60px;right:20px;z-index:300;' +
          'display:flex;flex-direction:column;gap:8px;pointer-events:none;';
        document.body.appendChild(container);
      }
      const el = document.createElement('div');
      const color = type === 'error' ? '#ff3b30' : type === 'success' ? '#34c759' : '#1d1d1f';
      el.style.cssText =
        'background:' + color + ';color:white;padding:12px 20px;border-radius:12px;' +
        'font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.15);max-width:360px;' +
        'animation:slideIn .3s ease;';
      el.textContent = message;
      container.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s, transform .3s';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(function () { el.remove(); }, 300);
      }, duration);
    },

    observeReveals(root) {
      const els = (root || document).querySelectorAll('.reveal:not(.visible)');
      if (!('IntersectionObserver' in window)) {
        els.forEach(e => e.classList.add('visible'));
        return;
      }
      const observer = new IntersectionObserver(function (entries) {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target);
          }
        }
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
      els.forEach(el => observer.observe(el));
    }
  };
})();

// 分类字典（label 由 T('category.' + key) 动态取，见 site_content 表）
window.CATEGORIES = [
  'all', 'oil', 'watercolor', 'sketch', 'ink', 'digital', 'photograph', 'other'
];
