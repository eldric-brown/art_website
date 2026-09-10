// ============================================================
// views.js - 视图渲染
// 全局 State 由 main.js 提供，先声明占位
// ============================================================

if (!window.State) window.State = { category: 'all', currentSlug: null };

window.Views = (function () {
  'use strict';
  const U = window.Utils;

  return {

    loading: function () {
      return '<div class="loading-screen"><div class="spinner"></div>' +
             '<p class="loading-text">正在加载...</p></div>';
    },

    empty: function (title, subtitle) {
      return '<div class="empty-state container">' +
             '<div class="empty-state-title">' + U.escapeHtml(title) + '</div>' +
             (subtitle ? '<p>' + U.escapeHtml(subtitle) + '</p>' : '') +
             '</div>';
    },

    notFound: function () {
      return '<section class="empty-state container" style="min-height:60vh;display:flex;flex-direction:column;justify-content:center;">' +
             '<div class="empty-state-title">页面不存在</div>' +
             '<p>你访问的路径似乎不存在</p>' +
             '<p style="margin-top:24px;"><a href="#/" class="btn btn-primary">返回首页</a></p>' +
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

      const artistName = (artist && artist.name) || '汤一白';
      const bioShort = (artist && artist.bio_short) || '用色彩与线条，讲述每一个瞬间的故事';

      let featuredHtml = '';
      if (featured.length) {
        featuredHtml =
          '<section class="section">' +
            '<div class="section-header">' +
              '<h2 class="section-title">精选作品</h2>' +
              '<p class="section-subtitle">部分代表性作品 · 点击查看详情</p>' +
            '</div>' +
            '<div class="container">' +
              '<div class="gallery" id="featured-gallery">' +
                Views._renderGallery(featured) +
              '</div>' +
              '<div style="text-align:center;margin-top:48px;">' +
                '<a href="#/works" class="btn btn-primary">查看全部作品 →</a>' +
              '</div>' +
            '</div>' +
          '</section>';
      }

      return '<section class="hero container reveal">' +
             '<span class="hero-eyebrow">' + U.escapeHtml(artistName) + ' · Art Portfolio</span>' +
             '<h1 class="hero-title">' + U.escapeHtml(bioShort) + '</h1>' +
             '<p class="hero-subtitle">绘画是灵魂的自白，用色彩与线条讲述每一个瞬间的故事。</p>' +
             '<div class="hero-cta">' +
               '<a href="#/works" class="btn btn-primary">浏览作品</a>' +
               '<a href="#/about" class="btn btn-secondary">了解艺术家</a>' +
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
        return '<button class="filter-btn ' + (c.key === category ? 'active' : '') + '"' +
               ' data-category="' + c.key + '">' + c.label + '</button>';
      }).join('');

      const galleryHtml = artworks.length
        ? Views._renderGallery(artworks)
        : Views.empty('暂无作品', '汤一白尚未上传作品');

      return '<section class="section">' +
             '<div class="section-header">' +
               '<h1 class="section-title">作品</h1>' +
               '<p class="section-subtitle">按分类筛选，按时间排序显示。</p>' +
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
        const slug = art.slug || '';
        return '<a href="#/works/' + U.escapeHtml(encodeURIComponent(slug)) + '" class="gallery-card reveal">' +
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
    artworkDetail: async function (slug) {
      document.body.dataset.view = 'detail';
      window.State.currentSlug = slug;
      let artwork;
      try {
        artwork = await window.API.getArtwork(decodeURIComponent(slug));
      } catch (e) {
        if (e.status === 404) {
          return Views.empty('作品不存在', '它可能已被下架或链接无效');
        }
        throw e;
      }

      const images = artwork.images || [];
      if (!images.length) return Views.empty('作品暂无图片');

      const mediumHtml = artwork.medium
        ? '<dt class="meta-label">媒介</dt><dd class="meta-value">' + U.escapeHtml(artwork.medium) + '</dd>'
        : '';
      const dimsHtml = artwork.dimensions
        ? '<dt class="meta-label">尺寸</dt><dd class="meta-value">' + U.escapeHtml(artwork.dimensions) + '</dd>'
        : '';
      const descHtml = artwork.description
        ? '<p class="artwork-detail-description">' + U.escapeHtml(artwork.description) + '</p>'
        : '';

      const thumbsHtml = images.length > 1
        ? '<div class="artwork-detail-thumbnails">' +
          images.map(function (img, i) {
            return '<img src="' + U.escapeHtml(img) + '"' +
                   ' alt="缩略图 ' + (i + 1) + '"' +
                   ' data-img-index="' + i + '"' +
                   ' data-full="' + U.escapeHtml(img) + '"' +
                   ' class="' + (i === 0 ? 'active' : '') + '">';
          }).join('') +
          '</div>'
        : '';

      return '<section class="artwork-detail container">' +
             '<a href="#/works" class="artwork-detail-back reveal">← 返回作品列表</a>' +
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
                   '<dt class="meta-label">分类</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.getCategoryLabel(artwork.category)) + '</dd>' +
                   '<dt class="meta-label">年份</dt>' +
                   '<dd class="meta-value">' + artwork.year + '</dd>' +
                   mediumHtml + dimsHtml +
                   '<dt class="meta-label">上架日期</dt>' +
                   '<dd class="meta-value">' + U.escapeHtml(U.formatDate(artwork.created_at)) + '</dd>' +
                 '</dl>' +
                 descHtml +
                 '<div style="margin-top:24px;">' +
                   '<a href="#/works" class="btn btn-secondary">← 全部作品</a>' +
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

      if (!artist) return Views.empty('艺术家信息暂不可用');

      const name = artist.name || '汤一白';
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
                    '<div class="contact-item-label">Email</div>' +
                    '<div class="contact-item-value"><a href="mailto:' + U.escapeHtml(email) + '">' + U.escapeHtml(email) + '</a></div>' +
                    '</div>';
      }
      let wechatHtml = '';
      if (wechat) {
        wechatHtml = '<div class="contact-item">' +
                     '<div class="contact-item-label">WeChat</div>' +
                     '<div class="contact-item-value">' + U.escapeHtml(wechat) + '</div>' +
                     '</div>';
      }
      const emptyHtml = (!email && !wechat)
        ? '<div class="contact-item">' +
          '<div class="contact-item-label">说明</div>' +
          '<div class="contact-item-value" style="font-size:14px;">汤一白尚未填写联系方式</div>' +
          '</div>'
        : '';

      return '<section class="container">' +
             '<div class="contact-wrap reveal">' +
               '<h1 class="section-title" style="margin-bottom:12px;">联系我们</h1>' +
               '<p class="section-subtitle">合作、委托、展览、媒体采访——欢迎联系</p>' +
               '<div class="contact-info">' + emailHtml + wechatHtml + emptyHtml + '</div>' +
             '</div>' +
           '</section>';
    },

  };
})();


