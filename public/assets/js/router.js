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
    { pattern: /^#\/works\/category\/(.+)$/, handler: function (m) {
      let category = m[1];
      try { category = decodeURIComponent(category); } catch (e) {}
      return V.works(category);
    } },
    { pattern: /^#\/works\/(.+)$/, handler: function (m) { return V.artworkDetail(m[1]); } },
    { pattern: /^#\/about$/,       handler: function () { return V.about(); } },
    { pattern: /^#\/contact$/,     handler: function () { return V.contact(); } },
    { pattern: /^#\/meetup$/,      handler: function () { return V.meetup(); } }
  ];

  return {
    navigate: async function () {
      const hash = location.hash || '#/';
      const app = document.getElementById('app');
      app.innerHTML = V.loading();
      app.scrollTop = 0;
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
        const active = href === hash || (href === '#/works' && hash.indexOf('#/works/') === 0);
        a.classList.toggle('active', active);
      });
    },

    _bindEvents: function () {
      // 作品页即时搜索：只过滤当前分类已加载的作品，不重新请求接口
      const collectionSearch = document.querySelector('#collection-search');
      if (collectionSearch) {
        const cards = Array.from(document.querySelectorAll('[data-collection-card]'));
        const countEl = document.querySelector('#collection-count');
        const update = function () {
          const query = collectionSearch.value.trim().toLowerCase();
          window.State.worksSearch = collectionSearch.value;
          let visible = 0;
          cards.forEach(function (card) {
            const match = !query || String(card.dataset.search || '').indexOf(query) !== -1;
            card.hidden = !match;
            if (match) visible += 1;
          });
          if (countEl) countEl.textContent = visible + (visible === 1 ? ' work' : ' works');
        };
        collectionSearch.oninput = update;
        update();
      }

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

      // 首页 owlcontaine 横向轮播：箭头翻页 + 边界状态
      document.querySelectorAll('[data-carousel]').forEach(function (shell) {
        const track = shell.querySelector('[data-carousel-track]');
        const prev = shell.querySelector('[data-carousel-prev]');
        const next = shell.querySelector('[data-carousel-next]');
        if (!track || !prev || !next) return;

        const update = function () {
          const maxScroll = track.scrollWidth - track.clientWidth;
          prev.disabled = track.scrollLeft <= 1;
          next.disabled = maxScroll <= 1 || track.scrollLeft >= maxScroll - 1;
        };
        const step = function () {
          return Math.max(240, Math.round(track.clientWidth * 0.8));
        };

        prev.onclick = function () {
          track.scrollBy({ left: -step(), behavior: 'smooth' });
        };
        next.onclick = function () {
          track.scrollBy({ left: step(), behavior: 'smooth' });
        };
        track.addEventListener('scroll', update, { passive: true });
        window.requestAnimationFrame(update);
      });

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
