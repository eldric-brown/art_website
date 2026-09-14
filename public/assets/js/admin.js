// ============================================================
// admin.js - 后台管理逻辑
// ============================================================

(function () {
  'use strict';

  // ---------- 工具函数 ----------
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- Toast ----------
  function toast(msg, type) {
    type = type || 'info';
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.textContent = msg;
    container.appendChild(el);
    const duration = type === 'error' ? 7000 : 2500;
    setTimeout(() => {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  // ---------- API ----------
  async function api(url, options) {
    options = options || {};
    const headers = new Headers(options.headers || {});
    const hasBody = options.body != null;
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (hasBody && !isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const opts = {
      headers: headers,
      credentials: 'same-origin'
    };
    if (options.method) opts.method = options.method;
    if (hasBody) opts.body = options.body;

    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      const next = encodeURIComponent(location.pathname + location.search);
      window.location.href = '/admin/login?next=' + next;
      throw new Error('登录已过期');
    }
    if (!res.ok || !data.ok) {
      let msg = data.message || data.error || '请求失败';
      if (Array.isArray(data.details) && data.details.length) {
        msg += '\n' + data.details.map(function (d, i) {
          return (i + 1) + '. ' + d;
        }).join('\n');
      }
      throw new Error(msg);
    }
    return data.data;
  }

  // ---------- 状态 ----------
  const state = {
    artworks: [],
    editingId: null,
    uploadedUrls: [],
    contentOriginal: {},
    categories: [],
    meetups: [],
    homeCards: []
  };

  // ---------- 作品列表 ----------
  async function loadArtworks() {
    const container = document.getElementById('artwork-list-container');
    container.innerHTML = '<div class="admin-empty"><h3>加载中……</h3></div>';

    const search = $('#search-input').value.trim();
    const status = $('#status-filter').value;
    const params = {};
    if (search) params.search = search;
    if (status && status !== 'all') params.status = status;

    try {
      const data = await api('/api/admin/artworks' + (Object.keys(params).length ? '?' + new URLSearchParams(params) : ''));
      state.artworks = data || [];
      renderArtworkList();
    } catch (e) {
      container.innerHTML = '<div class="admin-empty"><h3>加载失败</h3><p>' + escapeHtml(e.message) + '</p></div>';
    }
  }

  function renderArtworkList() {
    const container = document.getElementById('artwork-list-container');
    if (!state.artworks.length) {
      container.innerHTML = '<div class="admin-empty"><h3>暂无作品</h3><p>点击右上角「新建作品」添加</p></div>';
      return;
    }

    const rows = state.artworks.map(function (a) {
      const cover = (a.images && a.images[0]) || '';
      const pubBadge = a.published
        ? '<span class="badge badge-success">已上架</span>'
        : '<span class="badge badge-secondary">未上架</span>';
      const featBadge = a.featured ? '<span class="badge badge-warning">⭐ 精选</span>' : '';

      return '<tr>' +
        '<td>' + (cover ? '<img class="cell-cover" src="' + escapeHtml(cover) + '" alt="">' : '<div style="width:60px;height:60px;background:var(--color-bg-alt);border-radius:6px;"></div>') + '</td>' +
        '<td><strong>' + escapeHtml(a.title) + '</strong><br><span style="font-size:12px;color:var(--color-text-secondary);">#' + a.id + '</span></td>' +
        '<td>' + escapeHtml(a.category) + '</td>' +
        '<td>' + a.year + '</td>' +
        '<td>' + (pubBadge + ' ' + featBadge) + '</td>' +
        '<td><span style="color:var(--color-text-secondary);">' + new Date(a.updated_at).toLocaleDateString('zh-CN') + '</span></td>' +
        '<td>' +
          '<div class="cell-actions">' +
            '<button class="btn btn-sm" data-action="toggle" data-id="' + a.id + '">' +
              (a.published ? '下架' : '上架') +
            '</button>' +
            '<button class="btn btn-sm" data-action="edit" data-id="' + a.id + '">编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-action="delete" data-id="' + a.id + '">删除</button>' +
          '</div>' +
        '</td>' +
      '</tr>';
    }).join('');

    container.innerHTML = '<table class="artwork-table">' +
      '<thead><tr>' +
        '<th></th><th>标题</th><th>分类</th><th>年份</th><th>状态</th><th>更新时间</th><th>操作</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>';

    // 绑定操作按钮
    $$('[data-action]').forEach(function (btn) {
      btn.onclick = function () {
        const id = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        if (action === 'edit') openEditModal(id);
        else if (action === 'toggle') togglePublished(id);
        else if (action === 'delete') confirmDelete(id);
      };
    });
  }

  // ---------- 上架/下架 ----------
  async function togglePublished(id) {
    const artwork = state.artworks.find(a => a.id === id);
    if (!artwork) return;
    const newPublished = artwork.published ? 0 : 1;
    try {
      await api('/api/admin/artworks/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ published: newPublished })
      });
      toast(newPublished ? '已上架' : '已下架', 'success');
      loadArtworks();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 删除 ----------
  function confirmDelete(id) {
    if (!confirm('确定要删除这件作品吗？此操作不可恢复。')) return;
    deleteArtwork(id);
  }

  async function deleteArtwork(id) {
    try {
      await api('/api/admin/artworks/' + id, { method: 'DELETE' });
      toast('删除成功', 'success');
      loadArtworks();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- Modal：新建/编辑 ----------
  function openNewModal() {
    state.editingId = null;
    state.uploadedUrls = [];
    const form = document.getElementById('artwork-form');
    form.reset();
    form.querySelector('[name=year]').value = new Date().getFullYear();
    form.querySelector('[name=published]').value = '1';
    form.querySelector('[name=featured]').value = '0';
    form.querySelector('[name=sold]').value = '0';
    form.querySelector('[name=sort_order]').value = '0';
    document.getElementById('modal-title').textContent = '新建作品';
    document.getElementById('preview-list').innerHTML = '';
    document.getElementById('image-url-input').value='';
    document.getElementById('artwork-modal').hidden = false;
  }

  function openEditModal(id) {
    const artwork = state.artworks.find(a => a.id === id);
    if (!artwork) return;
    state.editingId = id;
    state.uploadedUrls = artwork.images.slice();
    document.getElementById('image-url-input').value='';

    const form = document.getElementById('artwork-form');
    form.reset();
    form.querySelector('[name=title]').value = artwork.title || '';
    form.querySelector('[name=category]').value = artwork.category || 'other';
    form.querySelector('[name=year]').value = artwork.year || new Date().getFullYear();
    form.querySelector('[name=medium]').value = artwork.medium || '';
    form.querySelector('[name=dimensions]').value = artwork.dimensions || '';
    form.querySelector('[name=description]').value = artwork.description || '';
    form.querySelector('[name=published]').value = String(artwork.published || 0);
    form.querySelector('[name=featured]').value = String(artwork.featured || 0);
    form.querySelector('[name=sort_order]').value = artwork.sort_order || '0';
    form.querySelector('[name=price]').value = artwork.price || '';
    form.querySelector('[name=sold]').value = String(artwork.sold || 0);

    document.getElementById('modal-title').textContent = '编辑作品';
    renderPreviewList();
    document.getElementById('artwork-modal').hidden = false;
  }

  function closeModal() {
    document.getElementById('artwork-modal').hidden = true;
    document.getElementById('image-url-input').value='';
    state.uploadedUrls = [];
    document.getElementById('preview-list').innerHTML = '';
    const countEl = document.getElementById('image-count');
    if (countEl) countEl.textContent = '0';
  }

  // ---------- Image URLs (external-link mode, R2 unbound) ----------
  // 图片已改为外链方案（未绑定 R2 等对象存储）：把图片放到自己的图床，
  // 在此粘贴 HTTPS 直链即可。后端仍接受站内 /r2/artworks/ 地址，便于日后恢复 R2。
  const URL_INPUT_ID = 'image-url-input';
  const MAX_IMAGES = 20;
  const VALID_IMAGE_URL = /^(https:\/\/\S+|\/r2\/artworks\/\S+)$/i;

  function setupImageUrls() {
    document.getElementById('btn-add-urls').onclick = addImageUrls;
    document.getElementById(URL_INPUT_ID).onkeydown = function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        addImageUrls();
      }
    };
  }

  function addImageUrls() {
    const input = document.getElementById(URL_INPUT_ID);
    const text = (input.value || '').trim();
    if (!text) return;

    const added = [];
    const invalid = [];

    text.split(/[\r\n,]+/).forEach(function (line) {
      const url = line.trim();
      if (!url) return;
      if (!VALID_IMAGE_URL.test(url)) { invalid.push(url); return; }
      if (state.uploadedUrls.indexOf(url) !== -1) return;
      if (state.uploadedUrls.length >= MAX_IMAGES) return;
      state.uploadedUrls.push(url);
      added.push(url);
    });

    input.value = '';
    if (added.length) renderPreviewList();
    if (invalid.length) {
      toast('无效地址（需以 https:// 开头）：' + invalid.join('、'), 'error');
    } else if (added.length) {
      toast('已添加 ' + added.length + ' 张图片', 'success');
    }
  }
  function renderPreviewList() {
    const list = document.getElementById('preview-list');
    const countEl = document.getElementById('image-count');
    if (countEl) countEl.textContent = state.uploadedUrls.length;
    list.innerHTML = state.uploadedUrls.map(function (url, idx) {
      return '<div class="preview-item">' +
        '<img src="' + escapeHtml(url) + '" alt="预览">' +
        '<button class="preview-item-remove" data-index="' + idx + '" title="移除">×</button>' +
      '</div>';
    }).join('');

    $$('.preview-item-remove', list).forEach(function (btn) {
      btn.onclick = function () {
        const idx = parseInt(btn.dataset.index, 10);
        state.uploadedUrls.splice(idx, 1);
        renderPreviewList();
      };
    });
  }


  // ---------- 保存作品 ----------
  async function saveArtwork(e) {
    e.preventDefault();
    const form = document.getElementById('artwork-form');
    const btn = document.getElementById('btn-save-artwork');
    const fd = new FormData(form);

    if (state.uploadedUrls.length === 0) {
      toast('请至少添加一张图片链接', 'error');
      return;
    }

    const data = {
      title: fd.get('title').trim(),
      category: fd.get('category'),
      year: parseInt(fd.get('year'), 10),
      medium: (fd.get('medium') || '').trim(),
      dimensions: (fd.get('dimensions') || '').trim(),
      description: (fd.get('description') || '').trim(),
      published: parseInt(fd.get('published'), 10),
      featured: parseInt(fd.get('featured'), 10),
      sort_order: parseInt(fd.get('sort_order') || '0', 10),
      price: (fd.get('price') || '').trim(),
      sold: parseInt(fd.get('sold') || '0', 10),
      images: state.uploadedUrls
    };

    btn.disabled = true;
    btn.textContent = '保存中...';

    try {
      if (state.editingId) {
        await api('/api/admin/artworks/' + state.editingId, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
        toast('已更新', 'success');
      } else {
        await api('/api/admin/artworks/new', {
          method: 'POST',
          body: JSON.stringify(data)
        });
        toast('创建成功', 'success');
      }
      closeModal();
      loadArtworks();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '保存';
    }
  }

  // ---------- 艺术家资料 ----------
  async function loadArtist() {
    try {
      const artist = await api('/api/artist');
      const form = document.getElementById('artist-form');
      form.querySelector('[name=name]').value = artist.name || '';
      form.querySelector('[name=name_en]').value = artist.name_en || '';
      form.querySelector('[name=bio_short]').value = artist.bio_short || '';
      form.querySelector('[name=bio]').value = artist.bio || '';
      form.querySelector('[name=avatar]').value = artist.avatar || '';
      form.querySelector('[name=contact_email]').value = artist.contact_email || '';
      form.querySelector('[name=contact_wechat]').value = artist.contact_wechat || '';

      const socials = artist.socials || {};
      const lines = Object.entries(socials).map(kv => kv[0] + ',' + kv[1]);
      form.querySelector('[name=socials_text]').value = lines.join('\n');
    } catch (e) {
      console.warn('load artist failed:', e);
    }
  }

  async function saveArtist(e) {
    e.preventDefault();
    const form = document.getElementById('artist-form');
    const fd = new FormData(form);

    const socials = {};
    (fd.get('socials_text') || '').split('\n').forEach(function (line) {
      const parts = line.split(',').map(s => (s || '').trim());
      if (parts[0] && parts[1]) socials[parts[0]] = parts[1];
    });

    const data = {
      name: fd.get('name'),
      name_en: fd.get('name_en'),
      bio_short: fd.get('bio_short'),
      bio: fd.get('bio'),
      avatar: fd.get('avatar'),
      contact_email: fd.get('contact_email'),
      contact_wechat: fd.get('contact_wechat'),
      socials: socials
    };

    try {
      await api('/api/admin/artist', {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      toast('已保存', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 站点文案 ----------
  // 站点文案按“前台页面 -> 页面位置”组织。专用配置项不在本页重复出现：
  // 首页图片/内容卡见「首页展示」，栏目名称见「栏目管理」，艺术家资料见「艺术家资料」。
  function contentField(key, label, help, options) {
    options = options || {};
    return {
      key: key,
      label: label,
      help: help,
      wide: Boolean(options.wide),
      defaultValue: options.defaultValue || ''
    };
  }

  const CONTENT_GROUPS = [
    {
      title: '全站导航与浏览器信息',
      description: '控制顶部导航名称、首页导航图片条标题、浏览器标题，以及搜索引擎和社交分享摘要。',
      page: '/#/',
      pageLabel: '查看首页',
      fields: [
        contentField('nav.home', '导航：首页', '显示在顶部导航，以及首页第二屏的导航图片条中。'),
        contentField('nav.works', '导航：作品', '显示在顶部导航、首页导航条和作品页入口中。'),
        contentField('nav.about', '导航：关于', '显示在顶部导航和首页导航图片条中。'),
        contentField('nav.meetup', '导航：线下交流', '显示在顶部导航、首页导航条和页脚入口中。'),
        contentField('nav.contact', '导航：联系我们', '显示在顶部导航、首页导航条和页脚入口中。'),
        contentField('site.logo', '左上角站点名称', '显示在前台左上角 Logo 文字位置。'),
        contentField('site.logo_icon_light', '首页横图 Logo（浅色）', '首页顶部透明导航上的 Logo，建议白色 SVG/PNG。默认使用 Artvee 白色 Logo，可在后台随时替换。', { wide: true }),
        contentField('site.logo_icon_dark', '其他页面 Logo（深色）', '作品、关于等其他页面左上角的 Logo，建议深色或彩色图标。默认使用 Artvee 图标。', { wide: true }),
        contentField('site.favicon', '浏览器标签页图标', '显示在浏览器标签页和收藏夹中，建议正方形 PNG。', { wide: true }),
        contentField('site.title', '浏览器页面标题', '显示在浏览器标签页、收藏名称和社交分享标题中。', { wide: true }),
        contentField('site.description', '搜索引擎描述', '用于 HTML description，主要影响搜索结果摘要。', { wide: true }),
        contentField('site.og_description', '分享卡片描述', '用于 Open Graph 描述，在社交平台分享链接时显示。', { wide: true })
      ]
    },
    {
      title: '首页 - 无横图时的文字兜底',
      description: '仅在首页没有设置横图、且没有精选作品首图时显示。正常情况下首页第一屏只显示横图，这些文字不会出现在页面上。',
      page: '/#/',
      pageLabel: '查看首页',
      fields: [
        contentField('hero.eyebrow', '文字首页：上方小标题', '无横图模式下的顶部辅助文字。'),
        contentField('hero.title', '文字首页：主标题', '无横图模式下的最大标题。'),
        contentField('hero.subtitle', '文字首页：说明文字', '显示在主标题下方。', { wide: true }),
        contentField('hero.cta.primary', '文字首页：主按钮文字', '例如“Browse Works”。'),
        contentField('hero.cta.secondary', '文字首页：次按钮文字', '例如“Meet the Artist”。')
      ]
    },
    {
      title: '作品列表页',
      description: '控制作品集合页的大标题、说明、搜索结果数量和空状态。搜索结果中的数字会自动替换。',
      page: '/#/works',
      pageLabel: '查看作品页',
      fields: [
        contentField('works.title', '作品页大标题', '显示在作品页最上方，例如 Works 或 Collection。'),
        contentField('works.subtitle', '作品页说明', '显示在大标题下方。', { wide: true }),
        contentField('works.results', '作品数量文案', '使用 {count} 代表实时作品数量，例如“{count} works”。', { defaultValue: '{count} works' }),
        contentField('works.empty.title', '没有作品时的标题', '当当前筛选没有任何作品时显示。'),
        contentField('works.empty.subtitle', '没有作品时的说明', '显示在空状态标题下方。', { wide: true })
      ]
    },
    {
      title: '作品分类名称（兜底）',
      description: '作品页分类名称优先读取「栏目管理」中的名称。这里只用于栏目被停用、删除或加载失败时的兜底，以及作品详情页的分类显示。',
      page: '/#/works',
      pageLabel: '查看分类页',
      fields: [
        contentField('category.all', '分类兜底：全部'),
        contentField('category.oil', '分类兜底：油画'),
        contentField('category.watercolor', '分类兜底：水彩'),
        contentField('category.sketch', '分类兜底：素描'),
        contentField('category.ink', '分类兜底：中国画'),
        contentField('category.digital', '分类兜底：数字艺术'),
        contentField('category.photograph', '分类兜底：摄影'),
        contentField('category.other', '分类兜底：其他')
      ]
    },
    {
      title: '作品详情页',
      description: '控制单件作品详情页的返回按钮、信息字段名称、价格/售出标签和异常状态。',
      page: '/#/works/1',
      pageLabel: '查看示例详情',
      fields: [
        contentField('detail.back', '详情页：返回作品列表按钮', '显示在详情页左上角。'),
        contentField('detail.backBottom', '详情页：底部返回按钮', '显示在详情信息区域底部。'),
        contentField('detail.meta.category', '详情字段：分类', '作品信息栏中的字段名称。'),
        contentField('detail.meta.year', '详情字段：年份', '作品信息栏中的字段名称。'),
        contentField('detail.meta.medium', '详情字段：媒介', '作品信息栏中的字段名称。'),
        contentField('detail.meta.dimensions', '详情字段：尺寸', '作品信息栏中的字段名称。'),
        contentField('detail.meta.published', '详情字段：发布日期', '作品信息栏中的字段名称。'),
        contentField('work.sold', '详情页：已售标签', '作品标记为已售时显示。'),
        contentField('work.price', '详情页：价格字段名', '作品填写价格时显示。'),
        contentField('detail.notFound.title', '详情不存在：标题', '作品下架、删除或链接错误时显示。'),
        contentField('detail.notFound.subtitle', '详情不存在：说明', '显示在错误标题下方。', { wide: true }),
        contentField('detail.noImages', '详情无图片时的提示', '作品数据没有图片时显示。', { wide: true })
      ]
    },
    {
      title: '关于页面',
      description: '这里只控制关于页加载不到艺术家资料时的提示。姓名、头像、简介和社交链接请使用左侧「艺术家资料」菜单修改。',
      page: '/#/about',
      pageLabel: '查看关于页',
      fields: [
        contentField('about.unavailable', '艺术家资料加载失败提示', '只有艺术家资料接口不可用时才显示。', { wide: true })
      ]
    },
    {
      title: '联系页面',
      description: '控制联系页的标题、说明和 Email / 微信字段名称。Email 和微信的具体内容在「艺术家资料」中修改。',
      page: '/#/contact',
      pageLabel: '查看联系页',
      fields: [
        contentField('contact.title', '联系页标题', '显示在页面顶部。'),
        contentField('contact.subtitle', '联系页说明', '显示在标题下方。', { wide: true }),
        contentField('contact.email.label', '联系字段：Email 标签'),
        contentField('contact.wechat.label', '联系字段：微信标签'),
        contentField('contact.note', '无联系方式时的提示标题'),
        contentField('contact.empty', '无联系方式时的说明', '', { wide: true })
      ]
    },
    {
      title: '线下交流页面',
      description: '控制线下交流页的标题、介绍和每个条目的日期/地点字段名。具体活动内容请使用左侧「线下交流」菜单修改。',
      page: '/#/meetup',
      pageLabel: '查看线下交流页',
      fields: [
        contentField('meetup.title', '页面大标题'),
        contentField('meetup.subtitle', '页面说明', '', { wide: true }),
        contentField('meetup.intro', '列表上方介绍', '可留空。支持普通文字。', { wide: true }),
        contentField('meetup.item.date', '活动字段：日期标签'),
        contentField('meetup.item.location', '活动字段：地点标签'),
        contentField('meetup.empty', '没有活动时的提示', '', { wide: true })
      ]
    },
    {
      title: '全站页脚',
      description: '控制所有页面底部 Footer 的品牌文字、链接名称和版权文字。{year} 会自动替换为当前年份。',
      fields: [
        contentField('footer.brand', '页脚品牌文字'),
        contentField('footer.links.works', '页脚链接：全部作品'),
        contentField('footer.links.about', '页脚链接：关于'),
        contentField('footer.links.contact', '页脚链接：联系'),
        contentField('footer.links.meetup', '页脚链接：线下交流'),
        contentField('footer.links.admin', '页脚链接：后台入口'),
        contentField('footer.copyright', '版权文字', '使用 {year} 自动显示当前年份。', { wide: true })
      ]
    },
    {
      title: '通用状态与错误提示',
      description: '这些文字会在多个页面复用，包括加载、灯箱缩略图、404 页面和返回首页按钮。',
      fields: [
        contentField('common.loading', '加载中提示'),
        contentField('common.thumbnail', '图片缩略图说明'),
        contentField('common.notFound.title', '404 页面标题'),
        contentField('common.notFound.subtitle', '404 页面说明', '', { wide: true }),
        contentField('common.backHome', '返回首页按钮文字')
      ]
    }
  ];

  async function loadSiteContent() {
    const container = document.getElementById('content-groups');
    container.innerHTML = '<div class="admin-empty"><h3>加载中……</h3></div>';
    try {
      const data = await api('/api/admin/site-content');
      const content = data.content || {};

      // 保存原始值，用于判断哪些条目被修改过（只保存 diff）
      state.contentOriginal = {};
      for (const key in content) {
        state.contentOriginal[key] = content[key].value;
      }
      CONTENT_GROUPS.forEach(function (group) {
        group.fields.forEach(function (field) {
          if (!(field.key in state.contentOriginal)) {
            state.contentOriginal[field.key] = field.defaultValue;
          }
        });
      });

      const overview = '<div class="content-overview">' +
        '<h3>配置位置说明</h3>' +
        '<p>本页只管理费用通用文案。以下内容有专用配置菜单：</p>' +
        '<ul>' +
          '<li><strong>首页横图、第二屏导航背景图、内容轮播卡</strong>：请使用左侧「首页展示」。</li>' +
          '<li><strong>作品分类名称、排序和底图</strong>：请使用左侧「栏目管理」。</li>' +
          '<li><strong>艺术家姓名、简介、头像、Email、微信</strong>：请使用左侧「艺术家资料」。</li>' +
          '<li><strong>线下活动内容</strong>：请使用左侧「线下交流」。</li>' +
        '</ul>' +
      '</div>';

      container.innerHTML = overview + CONTENT_GROUPS.map(function (group) {
        const pageLink = group.page
          ? '<a class="content-page-link" href="' + escapeHtml(group.page) + '" target="_blank" rel="noopener">' +
              escapeHtml(group.pageLabel || '查看前台页面') + ' ↗</a>'
          : '';
        const rows = group.fields.map(function (field) {
          const entry = content[field.key];
          const value = entry ? entry.value : field.defaultValue;
          const inputId = 'content-' + field.key.replace(/\./g, '-');

          return '<div class="content-field' + (field.wide ? ' wide' : '') + '">' +
            '<label for="' + escapeHtml(inputId) + '">' +
              '<span class="content-field-title">' + escapeHtml(field.label) + '</span>' +
              '<code class="content-field-key">' + escapeHtml(field.key) + '</code>' +
            '</label>' +
            (field.help ? '<p class="content-field-help">' + escapeHtml(field.help) + '</p>' : '') +
            '<input id="' + escapeHtml(inputId) + '" type="text"' +
              ' data-content-key="' + escapeHtml(field.key) + '"' +
              ' value="' + escapeHtml(value || '').replace(/"/g, '&quot;') + '">' +
          '</div>';
        }).join('');

        return '<section class="content-group">' +
          '<div class="content-group-header">' +
            '<div>' +
              '<h3>' + escapeHtml(group.title) + '</h3>' +
              (group.description ? '<p>' + escapeHtml(group.description) + '</p>' : '') +
            '</div>' +
            pageLink +
          '</div>' +
          '<div class="content-fields">' + rows + '</div>' +
        '</section>';
      }).join('');
    } catch (e) {
      container.innerHTML = '<div class="admin-empty"><h3>加载失败</h3><p>' + escapeHtml(e.message) + '</p></div>';
    }
  }

  async function saveSiteContent() {
    const inputs = document.querySelectorAll('[data-content-key]');
    const payload = {};
    inputs.forEach(function (input) {
      const key = input.dataset.contentKey;
      const original = state.contentOriginal[key] || '';
      if (input.value !== original) {
        payload[key] = input.value;
      }
    });

    if (Object.keys(payload).length === 0) {
      toast('没有改动', 'info');
      return;
    }

    try {
      const data = await api('/api/admin/site-content', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      state.contentOriginal = {};
      for (const key in (data.content || {})) {
        state.contentOriginal[key] = data.content[key].value;
      }
      toast('已保存 ' + Object.keys(payload).length + ' 项', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 栏目管理 ----------
  // 回填作品表单的分类下拉：只列已启用栏目，停用栏目保留但禁用（老作品仍可编辑）
  async function loadCategoryOptions() {
    try {
      const data = await api('/api/admin/categories');
      const select = document.getElementById('category-select');
      if (!select) return;
      const list = (data && data.categories) || [];
      if (!list.length) return;
      select.innerHTML = list.map(function (c) {
        return '<option value="' + escapeHtml(c.key) + '"' + (c.enabled ? '' : ' disabled') + '>' +
          escapeHtml(c.name) + (c.enabled ? '' : '（已停用）') + '</option>';
      }).join('');
    } catch (e) {
      console.warn('load category options failed:', e);
    }
  }

  async function loadCategories() {
    const container = document.getElementById('category-list-container');
    container.innerHTML = '<div class="admin-empty"><h3>加载中……</h3></div>';
    try {
      const data = await api('/api/admin/categories');
      state.categories = (data && data.categories) || [];
      renderCategories();
    } catch (e) {
      container.innerHTML = '<div class="admin-empty"><h3>加载失败</h3><p>' + escapeHtml(e.message) + '</p></div>';
    }
  }

  function renderCategories() {
    const container = document.getElementById('category-list-container');
    const list = state.categories;

    const rows = list.length ? list.map(function (c) {
      const badge = c.enabled
        ? '<span class="badge badge-success">启用</span>'
        : '<span class="badge badge-secondary">停用</span>';
      return '<fieldset style="border:1px solid var(--color-border);border-radius:8px;padding:12px 16px;margin-bottom:14px;">' +
        '<legend style="font-weight:600;padding:0 6px;">' + escapeHtml(c.name) +
          ' · <code style="font-size:12px;">' + escapeHtml(c.key) + '</code> · ' +
          '<span style="font-weight:400;color:var(--color-text-secondary);">' + (c.artwork_count || 0) + ' 件作品</span>' +
        '</legend>' +
        '<div class="field-row" style="display:grid;grid-template-columns:2fr 2fr 1fr 1fr;gap:12px;margin-bottom:10px;">' +
          '<div class="field-group field"><label>名称（英文）</label><input type="text" data-field="name" data-cat-id="' + c.id + '" value="' + escapeHtml(c.name) + '"></div>' +
          '<div class="field-group field"><label>底图 URL</label><input type="text" data-field="image" data-cat-id="' + c.id + '" value="' + escapeHtml(c.image || '') + '" placeholder="https:// 或 /r2/artworks/..."></div>' +
          '<div class="field-group field"><label>排序权重</label><input type="number" data-field="sort_order" data-cat-id="' + c.id + '" value="' + (c.sort_order || 0) + '"></div>' +
          '<div class="field-group field"><label>状态</label><select data-field="enabled" data-cat-id="' + c.id + '"><option value="1"' + (c.enabled ? ' selected' : '') + '>启用</option><option value="0"' + (!c.enabled ? ' selected' : '') + '>停用</option></select></div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' + badge +
          '<button class="btn btn-sm btn-primary" data-action="save-category" data-id="' + c.id + '">保存</button>' +
          '<button class="btn btn-sm" data-action="disable-category" data-id="' + c.id + '">' + (c.enabled ? '停用' : '启用') + '</button>' +
          '<button class="btn btn-sm btn-danger" data-action="del-category" data-id="' + c.id + '">彻底删除</button>' +
        '</div>' +
      '</fieldset>';
    }).join('') : '<div class="admin-empty"><h3>暂无栏目</h3><p>用上方表单新建</p></div>';

    container.innerHTML = newCategoryFieldsetHtml() + rows;

    $$('[data-action]', container).forEach(function (btn) {
      btn.onclick = function () {
        const id = parseInt(btn.dataset.id, 10);
        const action = btn.dataset.action;
        if (action === 'save-category') saveCategory(id);
        else if (action === 'disable-category') toggleCategory(id);
        else if (action === 'del-category') deleteCategory(id);
      };
    });
    $('#btn-create-category').onclick = createCategory;
  }

  function newCategoryFieldsetHtml() {
    return '<fieldset style="border:2px dashed var(--color-border);border-radius:8px;padding:12px 16px;margin-bottom:16px;">' +
      '<legend style="font-weight:600;padding:0 6px;">＋ 新建栏目</legend>' +
      '<div class="field-row" style="display:grid;grid-template-columns:1fr 1fr 1.4fr 0.8fr;gap:12px;margin-bottom:10px;">' +
        '<div class="field-group field"><label>key *（建后不可改）</label><input type="text" id="new-cat-key" placeholder="小写字母/数字/_"></div>' +
        '<div class="field-group field"><label>名称 *（英文）</label><input type="text" id="new-cat-name" placeholder="如：Etching"></div>' +
        '<div class="field-group field"><label>底图 URL</label><input type="text" id="new-cat-image" placeholder="可选"></div>' +
        '<div class="field-group field"><label>排序权重</label><input type="number" id="new-cat-sort" value="0"></div>' +
      '</div>' +
      '<button class="btn btn-primary" id="btn-create-category">创建</button>' +
    '</fieldset>';
  }

  async function createCategory() {
    const key = ($('#new-cat-key').value || '').trim();
    const name = ($('#new-cat-name').value || '').trim();
    const image = ($('#new-cat-image').value || '').trim();
    const sort_order = parseInt($('#new-cat-sort').value || '0', 10);
    if (!key) { toast('请填写 key', 'error'); return; }
    if (!name) { toast('请填写名称', 'error'); return; }
    try {
      await api('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ key: key, name: name, image: image, sort_order: sort_order })
      });
      toast('已创建', 'success');
      await Promise.all([loadCategories(), loadCategoryOptions()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function saveCategory(id) {
    const patch = {};
    $$('[data-cat-id="' + id + '"]').forEach(function (el) {
      const field = el.dataset.field;
      patch[field] = (field === 'sort_order' || field === 'enabled')
        ? parseInt(el.value, 10)
        : el.value.trim();
    });
    if (Object.keys(patch).length === 0) return;
    try {
      await api('/api/admin/categories/' + id, {
        method: 'PATCH',
        body: JSON.stringify(patch)
      });
      toast('已保存', 'success');
      await Promise.all([loadCategories(), loadCategoryOptions()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function toggleCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!cat) return;
    try {
      await api('/api/admin/categories/' + id, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: cat.enabled ? 0 : 1 })
      });
      toast(cat.enabled ? '已停用' : '已启用', 'success');
      await Promise.all([loadCategories(), loadCategoryOptions()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function deleteCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    const count = cat ? (cat.artwork_count || 0) : 0;
    const msg = count > 0
      ? '该栏目下还有 ' + count + ' 件作品引用，后端会拒绝删除。请先把作品改到其他栏目。\n\n仍要尝试吗？'
      : '彻底删除栏目「' + (cat ? cat.name : '') + '」？此操作不可恢复。';
    if (!confirm(msg)) return;
    try {
      await api('/api/admin/categories/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      await Promise.all([loadCategories(), loadCategoryOptions()]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 线下交流 ----------
  // 前端一次性编辑所有条目，PUT 整体替换（后端在单个 batch 事务里删旧插新）
  async function loadMeetups() {
    const container = document.getElementById('meetup-list-container');
    container.innerHTML = '<div class="admin-empty"><h3>加载中……</h3></div>';
    try {
      const data = await api('/api/admin/meetup');
      state.meetups = (data && data.items) || [];
      renderMeetups();
    } catch (e) {
      container.innerHTML = '<div class="admin-empty"><h3>加载失败</h3><p>' + escapeHtml(e.message) + '</p></div>';
    }
  }

  function meetupRowHtml(item, index) {
    item = item || {};
    return '<fieldset style="border:1px solid var(--color-border);border-radius:8px;padding:12px 16px;margin-bottom:14px;">' +
      '<legend style="font-weight:600;padding:0 6px;">第 ' + (index + 1) + ' 条 · ' +
        (item.id ? '#' + item.id : '新增') + '</legend>' +
      '<div class="field-row" style="display:grid;grid-template-columns:1fr 0.7fr 0.7fr;gap:12px;margin-bottom:10px;">' +
        '<div class="field-group field"><label>标题 *</label><input type="text" data-m="title" value="' + escapeHtml(item.title || '') + '" placeholder="如：春季小型个展"></div>' +
        '<div class="field-group field"><label>日期 / 时间</label><input type="text" data-m="date_text" value="' + escapeHtml(item.date_text || '') + '" placeholder="如：2026.05.10 - 05.18"></div>' +
        '<div class="field-group field"><label>地点</label><input type="text" data-m="location" value="' + escapeHtml(item.location || '') + '" placeholder="如：上海 · 徐汇滨江"></div>' +
      '</div>' +
      '<div class="field-row" style="display:grid;grid-template-columns:2fr 0.7fr 90px;gap:12px;">' +
        '<div class="field-group field"><label>图片 URL</label><input type="text" data-m="image" value="' + escapeHtml(item.image || '') + '" placeholder="留空则前台只显示文字"></div>' +
        '<div class="field-group field"><label>排序权重</label><input type="number" data-m="sort_order" value="' + (item.sort_order || 0) + '"></div>' +
        '<div class="field-group field" style="align-self:end;">' +
          '<button type="button" class="btn btn-sm btn-danger" data-action="del-meetup">移除</button>' +
        '</div>' +
      '</div>' +
    '</fieldset>';
  }

  function renderMeetups() {
    const container = document.getElementById('meetup-list-container');
    if (!state.meetups.length) {
      container.innerHTML = '<div class="admin-empty"><h3>暂无条目</h3><p>点上方「＋ 添加条目」新建</p></div>';
      return;
    }
    container.innerHTML = state.meetups.map(meetupRowHtml).join('');
    $$('[data-action="del-meetup"]', container).forEach(function (btn) {
      btn.onclick = function () {
        btn.closest('fieldset').remove();
      };
    });
  }

  function addMeetupRow() {
    state.meetups.push({ title: '', date_text: '', location: '', image: '', sort_order: 0 });
    renderMeetups();
  }

  async function saveMeetups() {
    const container = document.getElementById('meetup-list-container');
    const items = Array.from(container.querySelectorAll('fieldset')).map(function (row) {
      const pick = function (name) {
        const el = row.querySelector('[data-m="' + name + '"]');
        return el ? el.value.trim() : '';
      };
      return {
        title: pick('title'),
        date_text: pick('date_text'),
        location: pick('location'),
        image: pick('image'),
        sort_order: parseInt(pick('sort_order') || '0', 10)
      };
    });

    if (!items.length) { toast('请先添加条目', 'error'); return; }
    if (items.some(function (it) { return !it.title; })) {
      toast('每条都必须填写标题', 'error');
      return;
    }

    try {
      const data = await api('/api/admin/meetup', {
        method: 'PUT',
        body: JSON.stringify({ items: items })
      });
      state.meetups = (data && data.items) || [];
      toast('已保存 ' + items.length + ' 条', 'success');
      renderMeetups();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 首页展示 ----------
  const HOME_NAV_IMAGE_KEYS = [
    { key: 'home', inputId: 'home-nav-home-image' },
    { key: 'works', inputId: 'home-nav-works-image' },
    { key: 'about', inputId: 'home-nav-about-image' },
    { key: 'meetup', inputId: 'home-nav-meetup-image' },
    { key: 'contact', inputId: 'home-nav-contact-image' }
  ];
  const HOME_CARD_FIELDS = ['title', 'text', 'image', 'link'];
  const HOME_CARD_PLACEHOLDERS = {
    title: '如：Studio Notes',
    text: '如：Sketches and process behind the finished pieces.',
    image: 'https://...',
    link: '详情页链接，如：#/works/1'
  };

  function blankHomeCard() {
    return { title: '', text: '', image: '', link: '#/works' };
  }

  function updateHomeNavImagePreview(input) {
    if (!input) return;
    const preview = document.getElementById(input.dataset.homeNavPreview || '');
    if (!preview) return;

    const url = input.value.trim();
    preview.innerHTML = '';
    if (!url) {
      preview.innerHTML = '<span>留空：自动取图</span>';
      return;
    }

    const img = document.createElement('img');
    img.alt = '';
    img.src = url;
    img.onerror = function () {
      preview.innerHTML = '<span>图片无法加载</span>';
    };
    preview.appendChild(img);
  }

  function setupHomeNavImagePreviews() {
    $$('[data-home-nav-image]').forEach(function (input) {
      input.oninput = function () { updateHomeNavImagePreview(input); };
    });
  }

  async function loadHomeConfig() {
    let content = {};
    try {
      const data = await api('/api/admin/site-content');
      content = (data && data.content) || {};
    } catch (e) {
      toast(e.message, 'error');
      return;
    }

    const val = function (key) { return content[key] ? content[key].value : ''; };

    $('#home-hero-image').value = val('home.hero.image');
    $('#home-hero-eyebrow').value = val('home.hero.eyebrow');
    $('#home-hero-title').value = val('home.hero.title');
    $('#home-hero-subtitle').value = val('home.hero.subtitle');
    $('#home-hero-cta').value = val('home.hero.cta');
    $('#home-cards-title').value = val('home.cards.title');
    $('#home-cards-subtitle').value = val('home.cards.subtitle');

    HOME_NAV_IMAGE_KEYS.forEach(function (item) {
      const input = document.getElementById(item.inputId);
      if (!input) return;
      input.value = val('home.nav.' + item.key + '.image');
      updateHomeNavImagePreview(input);
    });

    const count = parseInt(val('home.cards.count') || '0', 10);
    state.homeCards = [];
    for (let i = 1; i <= Math.max(count, 0); i += 1) {
      state.homeCards.push({
        title: val('home.card.' + i + '.title'),
        text: val('home.card.' + i + '.text'),
        image: val('home.card.' + i + '.image'),
        link: val('home.card.' + i + '.link')
      });
    }
    if (!state.homeCards.length) state.homeCards.push(blankHomeCard());
    renderHomeCards();
  }

  function renderHomeCards() {
    const container = $('#home-cards-editor');
    container.innerHTML = state.homeCards.map(function (card, idx) {
      return '<fieldset style="border:1px solid var(--color-border);border-radius:8px;padding:12px 16px;margin-bottom:12px;">' +
        '<legend style="font-weight:600;padding:0 6px;">内容卡 ' + (idx + 1) + '</legend>' +
        '<div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
          '<div class="field-group field"><label>标题</label><input type="text" data-hc="title" value="' + escapeHtml(card.title) + '" placeholder="' + HOME_CARD_PLACEHOLDERS.title + '"></div>' +
          '<div class="field-group field"><label>跳转链接</label><input type="text" data-hc="link" value="' + escapeHtml(card.link) + '" placeholder="' + HOME_CARD_PLACEHOLDERS.link + '"></div>' +
        '</div>' +
        '<div class="field-group field"><label>文字说明</label><input type="text" data-hc="text" value="' + escapeHtml(card.text) + '" placeholder="' + HOME_CARD_PLACEHOLDERS.text + '"></div>' +
        '<div class="field-group field"><label>图片 URL</label><input type="text" data-hc="image" value="' + escapeHtml(card.image) + '" placeholder="' + HOME_CARD_PLACEHOLDERS.image + '"></div>' +
        '<button type="button" class="btn btn-sm btn-danger" data-hc-remove="' + idx + '">移除这张卡</button>' +
      '</fieldset>';
    }).join('');

    $$('[data-hc-remove]', container).forEach(function (btn) {
      btn.onclick = function () {
        const idx = parseInt(btn.dataset.hcRemove, 10);
        state.homeCards.splice(idx, 1);
        if (!state.homeCards.length) state.homeCards.push(blankHomeCard());
        renderHomeCards();
      };
    });
  }

  function addHomeCard() {
    state.homeCards.push(blankHomeCard());
    renderHomeCards();
  }

  async function saveHomeConfig() {
    const rows = $('#home-cards-editor').querySelectorAll('fieldset');
    const cards = [];
    rows.forEach(function (row) {
      const card = {};
      HOME_CARD_FIELDS.forEach(function (field) {
        const input = row.querySelector('[data-hc="' + field + '"]');
        card[field] = input ? input.value.trim() : '';
      });
      cards.push(card);
    });

    // 只保留有标题或有图片的卡；全空则 count = 0
    const kept = cards.filter(function (c) { return c.title || c.image; });

    const payload = {
      'home.hero.image': $('#home-hero-image').value.trim(),
      'home.hero.eyebrow': $('#home-hero-eyebrow').value.trim(),
      'home.hero.title': $('#home-hero-title').value.trim(),
      'home.hero.subtitle': $('#home-hero-subtitle').value.trim(),
      'home.hero.cta': $('#home-hero-cta').value.trim(),
      'home.cards.title': $('#home-cards-title').value.trim(),
      'home.cards.subtitle': $('#home-cards-subtitle').value.trim(),
      'home.cards.count': String(kept.length)
    };

    HOME_NAV_IMAGE_KEYS.forEach(function (item) {
      const input = document.getElementById(item.inputId);
      payload['home.nav.' + item.key + '.image'] = input ? input.value.trim() : '';
    });

    kept.forEach(function (card, i) {
      const n = i + 1;
      payload['home.card.' + n + '.title'] = card.title;
      payload['home.card.' + n + '.text'] = card.text;
      payload['home.card.' + n + '.image'] = card.image;
      payload['home.card.' + n + '.link'] = card.link;
    });

    // 清掉被删掉的多余槽位（最多支持 8 张）
    for (let i = kept.length + 1; i <= 8; i += 1) {
      payload['home.card.' + i + '.title'] = '';
      payload['home.card.' + i + '.text'] = '';
      payload['home.card.' + i + '.image'] = '';
      payload['home.card.' + i + '.link'] = '';
    }

    try {
      await api('/api/admin/site-content', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast('首页配置已保存', 'success');
      loadHomeConfig();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- Tab 切换 ----------
  function setupTabs() {
    $$('.admin-nav-link[data-tab]').forEach(function (link) {
      link.onclick = function (e) {
        e.preventDefault();
        $$('.admin-nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        const tab = link.dataset.tab;
        $$('.admin-main section').forEach(s => s.hidden = true);
        $('#tab-' + tab).hidden = false;
        if (tab === 'about') loadArtist();
        if (tab === 'content') loadSiteContent();
        if (tab === 'categories') loadCategories();
        if (tab === 'meetup') loadMeetups();
        if (tab === 'home') loadHomeConfig();
        if (tab === 'account') loadAccount();
      };
    });
  }

  // ---------- 账号安全 ----------
  let mustChangePassword = false;

  async function loadAccount() {
    const usernameEl = $('#account-username');
    try {
      const data = await api('/api/admin/account');
      if (usernameEl) usernameEl.textContent = data.user.username;
      mustChangePassword = Boolean(data.user.must_change_password);
      if (mustChangePassword) {
        const banner = document.getElementById('force-password-banner');
        if (banner) banner.hidden = false;
        $$('.admin-nav-link[data-tab]').forEach(l => l.classList.remove('active'));
        const accountLink = document.querySelector('.admin-nav-link[data-tab="account"]');
        if (accountLink) accountLink.classList.add('active');
        $$('.admin-main section').forEach(s => s.hidden = true);
        $('#tab-account').hidden = false;
      }
    } catch (e) {
      if (usernameEl) usernameEl.textContent = '加载失败';
      toast(e.message, 'error');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    const form = $('#password-form');
    const fd = new FormData(form);
    const currentPassword = String(fd.get('current_password') || '');
    const newPassword = String(fd.get('new_password') || '');
    const confirmPassword = String(fd.get('confirm_password') || '');

    if (newPassword.length < 8) {
      toast('新密码至少需要 8 位', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('两次输入的新密码不一致', 'error');
      return;
    }

    try {
      await api('/api/admin/password', {
        method: 'PUT',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      form.reset();
      toast('密码修改成功', 'success');
      mustChangePassword = false;
      const banner = document.getElementById('force-password-banner');
      if (banner) banner.hidden = true;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- 退出登录 ----------
  function setupLogout() {
    $('#logout-btn').onclick = function (e) {
      e.preventDefault();
      fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/admin/login';
        });
    };
  }

  // ---------- 初始化 ----------
  function init() {
    setupTabs();
    setupImageUrls();
    setupHomeNavImagePreviews();
    setupLogout();

    $('#btn-new-artwork').onclick = openNewModal;
    $('#btn-refresh').onclick = loadArtworks;
    $('#modal-close').onclick = closeModal;
    $('#btn-cancel-artwork').onclick = closeModal;

    $('#artwork-modal').onclick = function (e) {
      if (e.target.id === 'artwork-modal') closeModal();
    };

    $('#artwork-form').onsubmit = saveArtwork;
    $('#artist-form').onsubmit = saveArtist;
    $('#password-form').onsubmit = savePassword;
    $('#btn-reset-artist').onclick = loadArtist;
    $('#btn-save-content').onclick = saveSiteContent;
    $('#btn-reset-content').onclick = loadSiteContent;
    $('#btn-refresh-categories').onclick = loadCategories;
    $('#btn-add-meetup').onclick = addMeetupRow;
    $('#btn-save-meetup').onclick = saveMeetups;
    $('#btn-refresh-meetup').onclick = loadMeetups;
    $('#btn-save-home').onclick = saveHomeConfig;
    $('#btn-reset-home').onclick = loadHomeConfig;
    $('#btn-add-home-card').onclick = addHomeCard;

    // 作品表单的分类下拉改为读后台栏目表（失败时保留 HTML 里的静态选项）
    loadCategoryOptions();

    let searchTimer;
    $('#search-input').oninput = function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadArtworks, 300);
    };
    $('#status-filter').onchange = loadArtworks;

    loadArtworks();
    loadAccount();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

