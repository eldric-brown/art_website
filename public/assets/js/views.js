// ============================================================
// views.js - 视图渲染
// 前台所有文案通过 T(key) 从 site_content 表取；无 key 时使用英文兜底
// ============================================================

window.Views = (function () {
  'use strict';
  const U = window.Utils;
  const T = window.T;

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

    // ---------- 首页 ----------
    home: async function () {
      document.body.dataset.view = 'home';
      let artist = null;
      let featured = [];
      try {
        const results = await Promise.all([
          window.API.getArtist().catch(function () { return null; }),
          window.API.listArtworks({ featured: 1, limit: 12 })
        ]);
        artist = results[0];
        featured = results[1].artworks || [];
      } catch (e) { console.warn('home load failed:', e); }

      // 英文站点：优先取 name_en，避免 fallback 中英混合
      const artistName = (artist && (artist.name_en || artist.name)) || 'Tang Yibai';

      let featuredHtml = '';
      if (featured.length) {
        featuredHtml =
          '<section class="section">' +
            '<div class="section-header">' +
              '<h2 class="section-title">' + U.escapeHtml(T('featured.title', 'Featured Works')) + '</h2>' +
              '<p class="section-subtitle">' + U.escapeHtml(T('featured.subtitle', 'A selection of representative pieces · Click for details')) + '</p>' +
            '</div>' +
            '<div class="container">' +
              '<div class="gallery" id="featured-gallery">' +
                Views._renderGallery(featured) +
              '</div>' +
              '<div style="text-align:center;margin-top:48px%;">' +
                '<a href="#/works" class="btn btn-primary">' + U.escapeHtml(T('featured.viewAll', 'View All Works →')) + '</a>' +
              '</div>' +
            '</div>' +
          '</section>';
      }

      return '<section class="hero container reveal">' +
             '<span class="hero-eyebrow">' + U.escapeHtml(T('hero.eyebrow', artistName + ' · Art Portfolio')) + '</span>' +
             '<h1 class="hero-title">' + U.escapeHtml(T('hero.title', artistName)) + '</h1>' +
             '<p class="hero-subtitle">' + U.escapeHtml(T('hero.subtitle', 'Painting as the confession of the soul — stories told through color and line.')) + '</p>' +
             '<div class="hero-cta">' +
               '<a href="#/works" class="btn btn-primary">' + U.escapeHtml(T('hero.cta.primary', 'Browse Works')) + '</a>' +
               '<a href="#/about" class="btn btn-secondary">' + U.escapeHtml(T('hero.cta.secondary', 'Meet the Artist')) + '</a>' +
             '</div>' +
           '</section>' +
           featuredHtml;
    },
    // ---------- 作品列表 ----------
    works: async function () {
      document.body.dataset.view = 'works';
      const category = window.State.category;
      const data = await window.API.listArtworks({ category: category, limit: 100 });
      const artworks = data.artworks || [];

      const filterHtml = window.CATEGORIES.map(function (c) {
        return '<button class="filter-btn ' + (c === category ? 'active' : '') + '"' +
               ' data-category="' + c + '">' + T('category.' + c, c) + '</button>';
      }).join('');

      const galleryHtml = artworks.length
        ? Views._renderGallery(artworks)
        : Views.empty(T('works.empty.title', 'No Works Yet'), T('works.empty.subtitle', 'Tang Yibai has not published any works yet.'));

      return '<section class="section">' +
             '<div class="section-header">' +
               '<h1 class="section-title">' + U.escapeHtml(T('works.title', 'Works')) + '</h1>' +
               '<p class="section-subtitle">' + U.escapeHtml(T('works.subtitle', 'Filter by category, sorted by year.')) + '</p>' +
             '</div>' +
             '<div class="container">' +
               '<div class="filter-bar" id="filter-bar">' + filterHtml + '</div>' +
               '<div class="gallery" id="works-gallery">' + galleryHtml + '</div>' +
             '</div>' +
           '</section>';
    },

    // ---------- 画廊卡片渲染 ----------
    _renderGallery: function (artworks) {
      return artworks.map(function (art) {
        const img = (art.images && art.images[0]) || '';
        return '<a href="#/works/' + U.escapeHtml(String(art.id)) + '" class="gallery-card reveal">' +
              '<div class="gallery-card-image">' +
                (img ? '<img src="' + U.escapeHtml(img) + '" alt="' + U.escapeHtml(art.title) + '" loading="lazy">' : '<div class="gallery-card-placeholder"></div>') +
              '</div>' +
              '<div class="gallery-card-info">' +
                '<h3 class="gallery-card-title">' + U.escapeHtml(art.title) + '</h3>' +
                '<p class="gallery-card-meta">' + U.escapeHtml(U.getCategoryLabel(art.category)) + ' · ' + art.year + '</p>' +
              '</div>' +
            '</a>';
      }).join('');
    },

    // ---------- 作品详情页 ----------
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
                 '<h1 class="artwork-detail-title">' + U.escapeHtml(artwork.title) + '</h1>' +
                 '<dl class="artwork-detail-meta">' +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.category', 'Category')) + '</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.getCategoryLabel(artwork.category)) + '</dd>' +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.year', 'Year')) + '</dt>' +
                   '<dd class="meta-value">' + artwork.year + '</dd>' +
                   mediumHtml + dimsHtml +
                   '<dt class="meta-label">' + U.escapeHtml(T('detail.meta.published', 'Published')) + '</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.formatDate(artwork.created_at)) + '</dd>' +
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

  };
})();


