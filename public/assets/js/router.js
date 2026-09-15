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
    { pattern: /^#\/research$/,    handler: function () { return V.research(); } },
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
      // 详情页图集：主图 + 缩略图统一收集，供灯箱左右翻页
      const detailImages = Array.from(document.querySelectorAll('.artwork-detail-thumbnails img'))
        .map(function (thumb) {
          return { src: thumb.dataset.full || thumb.src, alt: thumb.alt || '' };
        });

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
          const src = mainImg.dataset.orig || mainImg.src;
          let index = 0;
          if (detailImages.length) {
            const found = detailImages.findIndex(function (item) { return item.src === src; });
            index = found >= 0 ? found : 0;
          }
          window.Lightbox.open({
            items: detailImages.length ? detailImages : [{ src: src, alt: mainImg.alt }],
            index: index
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

      // 研究方向页：顶部目录平滑跳转（用 button 而不是 <a href="#...">，避免触发 hash 路由）
      document.querySelectorAll('[data-research-target]').forEach(function (button) {
        button.onclick = function (event) {
          event.preventDefault();
          const target = document.getElementById(button.getAttribute('data-research-target'));
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });

      // 研究方向页：富文本里的图片点击放大
      // 研究方向页：富文本里的图片点击放大（同一段正文内的图片可以左右翻页）
      document.querySelectorAll('[data-research-body]').forEach(function (body) {
        const images = Array.from(body.querySelectorAll('img')).map(function (img) {
          return { src: img.src, alt: img.getAttribute('alt') || '' };
        });
        if (!images.length) return;

        Array.from(body.querySelectorAll('img')).forEach(function (img, index) {
          img.style.cursor = 'zoom-in';
          img.onclick = function () {
            window.Lightbox.open({ items: images, index: index });
          };
        });
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

  // 当前图集与下标。单图时 items 只有一个元素，左右箭头会自动隐藏。
  const view = { items: [], index: 0 };

  function box() {
    return document.getElementById('lightbox');
  }

  function render() {
    const container = box();
    const item = view.items[view.index];
    if (!container || !item) return;

    const img = container.querySelector('.lightbox-img');
    const caption = container.querySelector('.lightbox-caption');
    img.src = item.src;
    img.alt = item.alt || '';
    caption.textContent = item.alt || '';

    const multiple = view.items.length > 1;
    const prev = container.querySelector('.lightbox-prev');
    const next = container.querySelector('.lightbox-next');
    if (prev) prev.hidden = !multiple;
    if (next) next.hidden = !multiple;
  }

  return {
    // opts: { src, alt } 单图；或 { items: [{src, alt}], index } 图集
    open: function (opts) {
      opts = opts || {};
      const list = Array.isArray(opts.items) && opts.items.length
        ? opts.items
        : (opts.src ? [{ src: opts.src, alt: opts.alt || '' }] : []);
      if (!list.length) return;

      view.items = list;
      const start = Number(opts.index);
      view.index = Number.isInteger(start) && start >= 0 && start < list.length ? start : 0;

      const container = box();
      if (!container) return;
      container.hidden = false;
      document.body.style.overflow = 'hidden';

      render();
      this._bindClose();
      this._bindNav();
      this._bindKeys();
    },

    close: function () {
      const container = box();
      if (container) container.hidden = true;
      document.body.style.overflow = '';
      document.onkeydown = null;
      view.items = [];
      view.index = 0;
    },

    next: function () {
      if (view.items.length < 2) return;
      view.index = (view.index + 1) % view.items.length;
      render();
    },

    prev: function () {
      if (view.items.length < 2) return;
      view.index = (view.index - 1 + view.items.length) % view.items.length;
      render();
    },

    _bindClose: function () {
      const container = box();
      if (!container) return;
      const closeBtn = container.querySelector('.lightbox-close');
      if (closeBtn) closeBtn.onclick = function () { window.Lightbox.close(); };
      container.onclick = function (event) {
        if (event.target === container) window.Lightbox.close();
      };
    },

    _bindNav: function () {
      const container = box();
      if (!container) return;
      const prev = container.querySelector('.lightbox-prev');
      const next = container.querySelector('.lightbox-next');
      if (prev) prev.onclick = function (event) { event.stopPropagation(); window.Lightbox.prev(); };
      if (next) next.onclick = function (event) { event.stopPropagation(); window.Lightbox.next(); };
    },

    _bindKeys: function () {
      document.onkeydown = function (event) {
        if (event.key === 'Escape') window.Lightbox.close();
        else if (event.key === 'ArrowRight') window.Lightbox.next();
        else if (event.key === 'ArrowLeft') window.Lightbox.prev();
      };
    }
  };
})();
