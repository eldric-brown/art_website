// ============================================================
// utils.js - 通用工具函数
// ============================================================

// 全局状态（放在 utils.js 是因为 T/Tf 依赖 State.content，
// 而 views.js 在 IIFE 初始化时就捕获 T，所以这些必须早于 views.js 加载）
window.State = {
  category: 'all',
  worksSearch: '',
  currentId: null,
  content: {},
  contentReady: null,
  categories: null,        // 栏目列表缓存：[{key, name, image, sort_order}]
  categoriesReady: null    // Promise 缓存，避免并发重复请求
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

    // 富文本二次兜底净化（写入时服务端已白名单过滤，这里再挡一层）
    // 只移除危险结构与协议，不改变正常排版标签。
    sanitizeRichHtml(value) {
      let html = value == null ? '' : String(value);
      if (!html) return '';

      // 1) 整块移除脚本与样式（含其内容）
      html = html.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
                 .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');

      // 2) 移除危险标签（成对或自闭合都清掉）
      const dangerous = [
        'script', 'style', 'iframe', 'object', 'embed', 'form', 'input',
        'button', 'textarea', 'select', 'option', 'link', 'meta', 'base',
        'frame', 'frameset', 'noscript', 'template', 'svg', 'math', 'video',
        'audio', 'source', 'track', 'applet', 'marquee', 'portal'
      ];
      for (let i = 0; i < dangerous.length; i += 1) {
        const pattern = new RegExp('<\\s*/?\\s*' + dangerous[i] + '\\b[^>]*>', 'gi');
        html = html.replace(pattern, '');
      }

      // 3) 移除事件属性与可执行属性
      html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      html = html.replace(
        /\s(?:srcdoc|formaction|xlink:href|hreflang|integrity|crossorigin|fetchdata|onfocus|onload)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
        ''
      );

      // 4) 拦截危险协议
      html = html.replace(
        /(href|src|action)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html|data:application\/html)\s*:[^"']*\2/gi,
        ''
      );

      return html;
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

    // 栏目名：优先取后台配置的 categories 表，取不到再回退 site_content 的 category.<key>
    categoryName(key, items) {
      const list = items || window.State.categories || [];
      for (let i = 0; i < list.length; i++) {
        if (list[i].key === key) {
          return list[i].name || window.T('category.' + key, key);
        }
      }
      return window.T('category.' + key, key);
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

// 内置分类兜底：栏目表为空或 /api/categories 失败时，前台筛选与后台写入仍可用
window.CATEGORIES = [
  'all', 'oil', 'watercolor', 'sketch', 'ink', 'digital', 'photograph', 'other'
];

// 加载栏目列表（带缓存 + 失败兜底）
// 返回 [{ key, name, image, sort_order }]，后台已按 sort_order 降序排好
window.loadCategories = function () {
  if (window.State.categoriesReady) return window.State.categoriesReady;

  window.State.categoriesReady = window.API.listCategories()
    .then(function (data) {
      const raw = (data && data.categories) || [];
      window.State.categories = raw.map(function (item) {
        const key = String(item.key || '');
        return {
          key: key,
          name: item.name || window.T('category.' + key, key),
          image: String(item.image || ''),
          sort_order: Number(item.sort_order) || 0
        };
      });
      return window.State.categories;
    })
    .catch(function (error) {
      console.warn('categories load failed, using built-in fallback:', error);
      window.State.categories = window.CATEGORIES
        .filter(function (key) { return key !== 'all'; })
        .map(function (key) {
          return { key: key, name: window.T('category.' + key, key), image: '', sort_order: 0 };
        });
      return window.State.categories;
    });

  return window.State.categoriesReady;
};
