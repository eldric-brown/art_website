// ============================================================
// router.js - 路由与事件绑定
// ============================================================

window.Router = (function () {
  'use strict';
  const V = window.Views;
  const U = window.Utils;

  const routes = [
    { pattern: /^#\/$/,            handler: function () { return V.home(); } },
    { pattern: /^#\/works$/,       handler: function () { return V.works(); } },
    { pattern: /^#\/works\/(.+)$/, handler: function (m) { return V.artworkDetail(m[1]); } },
    { pattern: /^#\/about$/,       handler: function () { return V.about(); } },
    { pattern: /^#\/contact$/,     handler: function () { return V.contact(); } }
  ];

  return {
    navigate: async function () {
      const hash = location.hash || '#/';
      const app = document.getElementById('app');
      app.innerHTML = V.loading();
      window.scrollTo(0, 0);

      for (const route of routes) {
        const match = hash.match(route.pattern);
        if (match) {
          try {
            const html = await route.handler(match);
            app.innerHTML = html;
            this._afterRender();
          } catch (e) {
            console.error(e);
            app.innerHTML = V.empty('加载失败', e.message);
          }
          return;
        }
      }
      app.innerHTML = V.notFound();
      this._afterRender();
    },

    _afterRender: function () {
      U.observeReveals();
      this._updateNavActive();
      this._bindEvents();
    },

    _updateNavActive: function () {
      const hash = location.hash || '#/';
      document.querySelectorAll('.nav-links a[data-link]').forEach(function (a) {
        const href = a.getAttribute('href');
        a.classList.toggle('active', href === hash);
      });
    },

    _bindEvents: function () {
      // 分类筛选
      document.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.onclick = function () {
          window.State.category = btn.dataset.category;
          window.Router.navigate();
        };
      });

      // 详情页缩略图切换
      document.querySelectorAll('.artwork-detail-thumbnails img').forEach(function (thumb) {
        thumb.onclick = function () {
          const mainImg = document.querySelector('#detail-main-image img');
          if (mainImg && thumb.dataset.full) {
            mainImg.src = thumb.dataset.full;
            mainImg.dataset.orig = thumb.dataset.full;
            document.querySelectorAll('.artwork-detail-thumbnails img').forEach(function (t) {
              t.classList.remove('active');
            });
            thumb.classList.add('active');
          }
        };
      });

      // 主图点击打开灯箱
      const mainImg = document.querySelector('#detail-main-image img');
      if (mainImg) {
        mainImg.onclick = function () {
          window.Lightbox.open({
            src: mainImg.dataset.orig || mainImg.src,
            alt: mainImg.alt
          });
        };
      }

      // 灯箱关闭
      window.Lightbox._bindClose();
    }
  };
})();

// ============================================================
// 灯箱（图片浏览）
// ============================================================

window.Lightbox = (function () {
  'use strict';

  return {
    open: function (opts) {
      this.elements = {
        container: document.getElementById('lightbox'),
        img: document.querySelector('.lightbox-img'),
        caption: document.querySelector('.lightbox-caption')
      };
      this.elements.img.src = opts.src;
      this.elements.img.alt = opts.alt || '';
      this.elements.caption.textContent = opts.alt || '';
      this.elements.container.hidden = false;
      document.body.style.overflow = 'hidden';
      this._bindClose();
      this._bindKeys();
    },

    close: function () {
      const box = document.getElementById('lightbox');
      if (box) box.hidden = true;
      document.body.style.overflow = '';
      document.onkeydown = null;
    },

    _bindClose: function () {
      const box = document.getElementById('lightbox');
      if (!box) return;
      const closeBtn = box.querySelector('.lightbox-close');
      closeBtn.onclick = () => window.Lightbox.close();
      box.onclick = function (e) {
        if (e.target === box) window.Lightbox.close();
      };
    },

    _bindKeys: function () {
      document.onkeydown = function (e) {
        if (e.key === 'Escape') window.Lightbox.close();
      };
    }
  };
})();
