// ============================================================
// views.js - 视图渲染
// 前台所有文案通过 T(key) 从 site_content 表取；无 key 时使用英文兜底
// ============================================================

window.Views = (function () {
  'use strict';
  const U = window.Utils;
  const T = window.T;

  // ============================================================
  // 内部小工具（模块私有，不挂在 window 上）
  // ============================================================

  function esc(value) {
    return U.escapeHtml(value);
  }

  function firstImage(artwork) {
    const images = artwork && artwork.images;
    return Array.isArray(images) && images.length ? String(images[0]) : '';
  }

  // 作品卡角标：已售只显示 Sold；在售且填了价格才显示价格。
  function badgeHtml(artwork) {
    const sold = Number(artwork.sold) === 1;
    const price = String(artwork.price || '').trim();
    let badge = '';
    if (sold) {
      badge = '<span class="badge badge-sold">' + esc(T('work.sold', 'Sold')) + '</span>';
    } else if (price) {
      badge = '<span class="badge badge-price">' + esc(price) + '</span>';
    }
    return badge ? '<div class="gallery-card-badges">' + badge + '</div>' : '';
  }

  // 栏目瓦片：'all' 恒为首项，其余取后台启用中的栏目（按 sort_order 排好）。
  function categoryTilesHtml(items, activeKey) {
    const all = [{ key: 'all', name: T('category.all', 'All'), image: '' }];
    const list = all.concat(items || []);

    return '<section class="section section-tiles">' +
      '<div class="container">' +
        '<div class="category-tiles">' +
          list.map(function (item) {
            const active = item.key === activeKey ? ' active' : '';
            const image = item.image
              ? '<img class="category-tile-image" src="' + esc(item.image) +
                '" alt="' + esc(item.name) + '" loading="lazy">'
              : '<span class="category-tile-image category-tile-image-empty"></span>';

            return '<button type="button" class="category-tile' + active + '"' +
              ' data-category="' + esc(item.key) + '">' +
              image +
              '<span class="category-tile-shade" aria-hidden="true"></span>' +
              '<span class="category-tile-label">' + esc(item.name) + '</span>' +
            '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // 首页第三屏：入口区（首页 / 作品 / 线下交流 / 联系我们）
  function entryCardsSectionHtml() {
    const cards = [
      { href: '#/',        title: T('nav.home', 'Home'),        desc: '' },
      { href: '#/works',   title: T('nav.works', 'Works'),      desc: T('home.entry.works.desc', 'Browse the full collection, filter by category.') },
      { href: '#/meetup',  title: T('nav.meetup', 'Meet Up'),   desc: T('home.entry.meetup.desc', 'Exhibitions, studio visits and in-person exchange.') },
      { href: '#/contact', title: T('nav.contact', 'Contact'),  desc: T('home.entry.contact.desc', 'Commissions and press inquiries are welcome.') }
    ];

    return '<section class="section section-alt">' +
      '<div class="container">' +
        '<div class="entry-grid">' +
          cards.map(function (card) {
            return '<a href="' + esc(card.href) + '" class="entry-card reveal">' +
              '<div class="entry-card-inner">' +
                '<h3 class="entry-card-title">' + esc(card.title) + '</h3>' +
                (card.desc ? '<p class="entry-card-desc">' + esc(card.desc) + '</p>' : '') +
                '<span class="entry-card-arrow" aria-hidden="true">→</span>' +
              '</div>' +
            '</a>';
          }).join('') +
        '</div>' +
      '</div>' +
    '</section>';
  }

  // 首页第二屏：内容卡（对应 artvee 的「Dive into Books & Wall Charts」）
  // 数据源 site_content：home.cards.{title,subtitle,count} + home.card.N.{title,text,image,link}
  // 后台在「首页展示」里自由增删；title 或 image 为空的卡前台不渲染。
  function contentCardsSectionHtml() {
    const count = parseInt(T('home.cards.count', '0'), 10);
    if (!Number.isInteger(count) || count < 1) return '';

    const cards = [];
    for (let i = 1; i <= count; i += 1) {
      const title = String(T('home.card.' + i + '.title', '') || '').trim();
      const image = String(T('home.card.' + i + '.image', '') || '').trim();
      if (!title || !image) continue;

      cards.push({
        title: title,
        text: String(T('home.card.' + i + '.text', '') || '').trim(),
        image: image,
        link: String(T('home.card.' + i + '.link', '') || '').trim() || '#/works'
      });
    }
    if (!cards.length) return '';

    const sectionTitle = String(T('home.cards.title', '') || '').trim();
    const sectionSubtitle = String(T('home.cards.subtitle', '') || '').trim();
    const header = (sectionTitle || sectionSubtitle)
      ? '<div class="section-header">' +
          (sectionTitle ? '<h2 class="section-title">' + esc(sectionTitle) + '</h2>' : '') +
          (sectionSubtitle ? '<p class="section-subtitle">' + esc(sectionSubtitle) + '</p>' : '') +
        '</div>'
      : '';

    return '<section class="section">' +
        header +
        '<div class="container">' +
          '<div class="content-cards">' +
            cards.map(function (card) {
              return '<a href="' + esc(card.link) + '" class="content-card reveal" tabindex="0">' +
                '<span class="content-card-image">' +
                  '<img src="' + esc(card.image) + '" alt="' + esc(card.title) + '" loading="lazy">' +
                '</span>' +
                '<span class="content-card-overlay">' +
                  '<span class="content-card-title">' + esc(card.title) + '</span>' +
                  (card.text ? '<span class="content-card-text">' + esc(card.text) + '</span>' : '') +
                '</span>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</section>';
  }

  // 首页第一屏：优先 home.hero.image；为空回退到精选作品首图；
  // 两者都没有时退回经典文字 hero，保证首页永不空白。
  function heroSectionHtml(artist, featured) {
    const heroImage = (T('home.hero.image', '') || '').trim();
    const src = heroImage || firstImage(featured[0]);

    if (!src) {
      const artistName = (artist && (artist.name_en || artist.name)) || 'Tang Yibai';
      return '<section class="hero container">' +
        '<span class="hero-eyebrow">' + esc(T('hero.eyebrow', artistName + ' · Art Portfolio')) + '</span>' +
        '<h1 class="hero-title">' + esc(T('hero.title', artistName)) + '</h1>' +
        '<p class="hero-subtitle">' + esc(T('hero.subtitle', 'Painting as the confession of the soul — stories told through color and line.')) + '</p>' +
        '<div class="hero-cta">' +
          '<a href="#/works" class="btn btn-primary">' + esc(T('hero.cta.primary', 'Browse Works')) + '</a>' +
          '<a href="#/about" class="btn btn-secondary">' + esc(T('hero.cta.secondary', 'Meet the Artist')) + '</a>' +
        '</div>' +
      '</section>';
    }

    const title = (T('home.hero.title', '') || '').trim();
    const subtitle = (T('home.hero.subtitle', '') || '').trim();
    const cta = (T('home.hero.cta', '') || '').trim();

    let overlay = '';
    if (title || subtitle || cta) {
      overlay = '<div class="hero-image-overlay">' +
        (title ? '<h1 class="hero-image-title">' + esc(title) + '</h1>' : '') +
        (subtitle ? '<p class="hero-image-subtitle">' + esc(subtitle) + '</p>' : '') +
        (cta ? '<a href="#/works" class="hero-image-cta">' + esc(cta) + ' →</a>' : '') +
      '</div>';
    }

    return '<section class="hero-image-section">' +
      '<figure class="hero-image-frame">' +
        '<img class="hero-image" src="' + esc(src) + '" alt="' + esc(title) + '">' +
        overlay +
      '</figure>' +
    '</section>';
  }

  return {

    loading: function () {
      return '<div class="loading-screen"><div class="spinner"></div>' +
             '<p class="loading-text">' + U.escapeHtml(T('common.loading', 'Loading...')) + '</p></div>';
    },

    empty: function (title, subtitle) {
      return '<div class="empty-state container">' +
             '<div class="empty-state-title">' + U.escapeHtml(title) + '</div>' +
             (subtitle ? '<p>' + U.escapeHtml(subtitle) + '</p>' : '') +
             '</div>';
    },

    notFound: function () {
      return '<section class="empty-state container" style="min-height:60vh;display:flex;flex-direction:column;justify-content:center;">' +
             '<div class="empty-state-title">' + U.escapeHtml(T('common.notFound.title', 'Page Not Found')) + '</div>' +
             '<p>' + U.escapeHtml(T('common.notFound.subtitle', 'The page you are looking for does not exist.')) + '</p>' +
             '<p style="margin-top:24px;"><a href="#/" class="btn btn-primary">' + U.escapeHtml(T('common.backHome', 'Back to Home')) + '</a></p>' +
             '</section>';
    },

    // ---------- 首页（三段式：hero 横图 / 内容卡 / 入口区）----------
    home: async function () {
      document.body.dataset.view = 'home';
      let artist = null;
      let featured = [];
      try {
        const results = await Promise.all([
          window.API.getArtist().catch(function () { return null; }),
          window.API.listArtworks({ featured: 1, limit: 1 })
        ]);
        artist = results[0];
        featured = results[1].artworks || [];
      } catch (e) { console.warn('home load failed:', e); }

      return heroSectionHtml(artist, featured) +
             contentCardsSectionHtml() +
             entryCardsSectionHtml();
    },
    // ---------- 作品列表 ----------
    // ---------- 作品列表：标题 + 栏目瓦片 + 作品网格 ----------
    works: async function () {
      document.body.dataset.view = 'works';
      const category = window.State.category || 'all';

      const params = { limit: 200, offset: 0 };
      if (category && category !== 'all') params.category = category;

      let artworks = [];
      let categories = [];
      try {
        const results = await Promise.all([
          window.API.listArtworks(params),
          window.loadCategories()
        ]);
        artworks = results[0].artworks || [];
        categories = results[1] || [];
      } catch (e) {
        console.warn('works load failed:', e);
        try { artworks = (await window.API.listArtworks(params)).artworks || []; }
        catch (e2) { console.warn('works list retry failed:', e2); }
        try { categories = await window.loadCategories(); }
        catch (e3) { console.warn('categories retry failed:', e3); }
      }

      const activeLabel = category === 'all'
        ? T('works.title', 'Works')
        : U.categoryName(category, categories);

      const gridHtml = artworks.length
        ? '<section class="section">' +
            '<div class="container"><div class="gallery">' +
              Views._renderGallery(artworks) +
            '</div></div>' +
          '</section>'
        : Views.empty(
            T('works.empty.title', 'No Works'),
            category === 'all'
              ? T('works.empty.subtitle', 'No published works yet.')
              : 'No works in this category yet.'
          );

      return '<section class="section">' +
        '<div class="container">' +
          '<div class="section-header">' +
            '<h1 class="section-title">' + esc(activeLabel) + '</h1>' +
            '<p class="section-subtitle">' + esc(T('works.subtitle', 'Browse the collection by category and year.')) + '</p>' +
          '</div>' +
        '</div>' +
      '</section>' +
      categoryTilesHtml(categories, category) +
      gridHtml;
    },
    artworkDetail: async function (id) {
      document.body.dataset.view = 'detail';
      window.State.currentId = id;
      let artwork;
      try {
        artwork = await window.API.getArtwork(id);
      } catch (e) {
        if (e.status === 404) {
          return Views.empty(T('detail.notFound.title', 'Artwork Not Found'), T('detail.notFound.subtitle', 'It may have been unpublished or the link is invalid.'));
        }
        throw e;
      }

      const images = artwork.images || [];
      if (!images.length) return Views.empty(T('detail.noImages', 'This artwork has no images.'));

      const mediumHtml = artwork.medium
        ? '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.medium', 'Medium')) + '</dt><dd class="meta-value">' + U.escapeHtml(artwork.medium) + '</dd>'
        : '';
      const dimsHtml = artwork.dimensions
        ? '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.dimensions', 'Dimensions')) + '</dt><dd class="meta-value">' + U.escapeHtml(artwork.dimensions) + '</dd>'
        : '';
      const descHtml = artwork.description
        ? '<p class="artwork-detail-description">' + U.escapeHtml(artwork.description) + '</p>'
        : '';

      const sold = Number(artwork.sold) === 1;
      const price = String(artwork.price || '').trim();

      const thumbsHtml = images.length > 1
        ? '<div class="artwork-detail-thumbnails">' +
          images.map(function (img, i) {
            return '<img src="' + U.escapeHtml(img) + '"' +
                   ' alt="' + U.escapeHtml(T('common.thumbnail', 'Thumbnail')) + ' ' + (i + 1) + '"' +
                   ' data-img-index="' + i + '"' +
                   ' data-full="' + U.escapeHtml(img) + '"' +
                   ' class="' + (i === 0 ? 'active' : '') + '">';
          }).join('') +
          '</div>'
        : '';

      return '<section class="artwork-detail container">' +
             '<a href="#/works" class="artwork-detail-back reveal">' + U.escapeHtml(T('detail.back', '← Back to Works')) + '</a>' +
             '<div class="artwork-detail-grid">' +
               '<div class="reveal">' +
                 '<div class="artwork-detail-main-image" id="detail-main-image">' +
                   '<img src="' + U.escapeHtml(images[0]) + '"' +
                   ' alt="' + U.escapeHtml(artwork.title) + '"' +
                   ' data-orig="' + U.escapeHtml(images[0]) + '">' +
                 '</div>' +
                 thumbsHtml +
               '</div>' +
               '<aside class="artwork-detail-side reveal">' +
                 '<div class="artwork-detail-head">' +
                  '<h1 class="artwork-detail-title">' + U.escapeHtml(artwork.title) + '</h1>' +
                  (sold ? '<span class="badge badge-sold">' + U.escapeHtml(T('work.sold', 'Sold')) + '</span>' : '') +
                  '</div>' +
                 '<dl class="artwork-detail-meta">' +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.category', 'Category')) + '</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.getCategoryLabel(artwork.category)) + '</dd>' +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.year', 'Year')) + '</dt>' +
                   '<dd class="meta-value">' + artwork.year + '</dd>' +
                   mediumHtml + dimsHtml +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.published', 'Published')) + '</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.formatDate(artwork.created_at)) + '</dd>' +
                    (price ? '<dt class="meta-label">' + U.escapeHtml(T('work.price', 'Price')) + '</dt><dd class="meta-value">' + U.escapeHtml(price) + '</dd>' : '') +
                 '</dl>' +
                 descHtml +
                 '<div style="margin-top:24px;">' +
                   '<a href="#/works" class="btn btn-secondary">' + U.escapeHtml(T('detail.backBottom', '← All Works')) + '</a>' +
                 '</div>' +
               '</aside>' +
             '</div>' +
           '</section>';
    },

    // ---------- 关于页面 ----------
    about: async function () {
      document.body.dataset.view = 'about';
      let artist = null;
      try { artist = await window.API.getArtist(); } catch (e) { console.warn(e); }

      if (!artist) return Views.empty(T('about.unavailable', 'Artist information unavailable'));

      const name = artist.name || 'Tang Yibai';
      const nameEn = artist.name_en || '';
      const bioShort = artist.bio_short || '';
      const bio = artist.bio || '';
      const socials = artist.socials || {};
      const visibleSocials = Object.entries(socials).filter(function (kv) { return kv[1]; });

      const portraitHtml = artist.avatar
        ? '<img src="' + U.escapeHtml(artist.avatar) + '" class="about-intro-portrait" alt="' + U.escapeHtml(name) + '">'
        : '';
      const nameEnHtml = nameEn
        ? '<p style="font-size:14px;color:var(--color-text-secondary);letter-spacing:.1em;margin-bottom:12px;">' + U.escapeHtml(nameEn) + '</p>'
        : '';
      const bioShortHtml = bioShort
        ? '<p class="about-intro-bio-short">' + U.escapeHtml(bioShort) + '</p>'
        : '';
      const bioHtml = bio
        ? '<div class="about-bio reveal">' + U.escapeHtml(bio) + '</div>'
        : '';
      const socialsHtml = visibleSocials.length
        ? '<div class="socials reveal">' +
          visibleSocials.map(function (kv) {
            return '<a href="' + U.escapeHtml(kv[1]) + '" class="social-link" target="_blank" rel="noopener">' +
                   U.escapeHtml(kv[0]) + ' →</a>';
          }).join('') +
          '</div>'
        : '';

      return '<section class="container">' +
             '<div class="about-intro reveal">' +
               portraitHtml +
               '<h1 class="about-intro-name">' + U.escapeHtml(name) + '</h1>' +
               nameEnHtml +
               bioShortHtml +
             '</div>' +
             bioHtml +
             socialsHtml +
           '</section>';
    },

    // ---------- 联系页面 ----------
    contact: async function () {
      document.body.dataset.view = 'contact';
      let artist = null;
      try { artist = await window.API.getArtist(); } catch (e) { console.warn(e); }

      const email = (artist && artist.contact_email) || '';
      const wechat = (artist && artist.contact_wechat) || '';

      let emailHtml = '';
      if (email) {
        emailHtml = '<div class="contact-item">' +
                    '<div class="contact-item-label">' + U.escapeHtml(T('contact.email.label', 'Email')) + '</div>' +
                    '<div class="contact-item-value"><a href="mailto:' + U.escapeHtml(email) + '">' + U.escapeHtml(email) + '</a></div>' +
                    '</div>';
      }
      let wechatHtml = '';
      if (wechat) {
        wechatHtml = '<div class="contact-item">' +
                     '<div class="contact-item-label">' + U.escapeHtml(T('contact.wechat.label', 'WeChat')) + '</div>' +
                     '<div class="contact-item-value">' + U.escapeHtml(wechat) + '</div>' +
                     '</div>';
      }
      const emptyHtml = (!email && !wechat)
        ? '<div class="contact-item">' +
          '<div class="contact-item-label">' + U.escapeHtml(T('contact.note', 'Note')) + '</div>' +
          '<div class="contact-item-value" style="font-size:14px;">' + U.escapeHtml(T('contact.empty', 'Contact details not yet provided.')) + '</div>' +
          '</div>'
        : '';

      return '<section class="container">' +
             '<div class="contact-wrap reveal">' +
               '<h1 class="section-title" style="margin-bottom:12px;">' + U.escapeHtml(T('contact.title', 'Contact')) + '</h1>' +
               '<p class="section-subtitle">' + U.escapeHtml(T('contact.subtitle', 'Commissions, exhibitions, press inquiries — welcome.')) + '</p>' +
               '<div class="contact-info">' + emailHtml + wechatHtml + emptyHtml + '</div>' +
             '</div>' +
           '</section>';
    },

    // 渲染作品网格（供首页精选与作品列表复用）
    _renderGallery(artworks) {
      if (!artworks || !artworks.length) return '';
      return artworks.map(function (art) { return Views._card(art); }).join('');
    },

    // 单张作品卡：角标由 badgeHtml 决定（已售 → Sold；在售且有价 → 价格）
    _card(art) {
      const images = art.images || [];
      const firstImage = Array.isArray(images) && images.length ? String(images[0]) : '';

      return '<a href="#/works/' + esc(art.id) + '" class="gallery-card reveal" tabindex="0">' +
        '<div class="gallery-card-image">' +
          (firstImage
            ? '<img src="' + esc(firstImage) + '" alt="' + esc(art.title) + '" loading="lazy">'
            : '<div class="gallery-card-placeholder"></div>') +
          badgeHtml(art) +
        '</div>' +
        '<div class="gallery-card-info">' +
          '<h3 class="gallery-card-title">' + esc(art.title) + '</h3>' +
          '<p class="gallery-card-meta">' + esc(art.year) + '</p>' +
        '</div>' +
      '</a>';
    },

    // ---------- 线下交流页 ----------
    meetup: async function () {
      document.body.dataset.view = 'meetup';
      let items = [];
      try { items = ((await window.API.listMeetups()).items) || []; }
      catch (e) { console.warn('meetup load failed:', e); }

      const intro = String(T('meetup.intro', '') || '').trim();

      const listHtml = items.length
        ? '<section class="section">' +
            '<div class="container">' +
              '<div class="meetup-list">' +
                items.map(function (item) {
                  const dateText = String(item.date_text || '').trim();
                  const location = String(item.location || '').trim();
                  const metaParts = [];

                  if (dateText) {
                    metaParts.push('<span class="meetup-item-meta-item">' +
                      '<span class="meetup-item-meta-label">' + U.escapeHtml(T('meetup.item.date', 'Date')) + '</span>' +
                      '<span class="meetup-item-meta-value">' + U.escapeHtml(dateText) + '</span></span>');
                  }
                  if (location) {
                    metaParts.push('<span class="meetup-item-meta-item">' +
                      '<span class="meetup-item-meta-label">' + U.escapeHtml(T('meetup.item.location', 'Location')) + '</span>' +
                      '<span class="meetup-item-meta-value">' + U.escapeHtml(location) + '</span></span>');
                  }
                  const metaHtml = metaParts.length
                    ? '<div class="meetup-item-meta">' + metaParts.join('') + '</div>'
                    : '';

                  return '<article class="meetup-item reveal">' +
                    '<div class="meetup-item-image">' +
                      (item.image
                        ? '<img src="' + U.escapeHtml(item.image) + '" alt="' + U.escapeHtml(item.title) + '" loading="lazy">'
                        : '') +
                    '</div>' +
                    '<div class="meetup-item-body">' +
                      '<h3 class="meetup-item-title">' + U.escapeHtml(item.title) + '</h3>' +
                      metaHtml +
                    '</div>' +
                  '</article>';
                }).join('') +
              '</div>' +
            '</div>' +
          '</section>'
        : Views.empty(T('meetup.empty', 'No meetups have been announced yet.'));

      return '<section class="section">' +
        '<div class="container">' +
          '<div class="section-header">' +
            '<h1 class="section-title">' + U.escapeHtml(T('meetup.title', 'Meet Up')) + '</h1>' +
            '<p class="section-subtitle">' + U.escapeHtml(T('meetup.subtitle', 'Exhibitions, studio visits and in-person exchange.')) + '</p>' +
          '</div>' +
          (intro ? '<p class="meetup-intro">' + U.escapeHtml(intro) + '</p>' : '') +
        '</div>' +
      '</section>' +
      listHtml;
    },

  };
})();


