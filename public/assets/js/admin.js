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
    contentOriginal: {}
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
  // 前端所有 key 按分组显示，方便批量编辑
  const CONTENT_GROUPS = [
    { title: '导航与站点元信息', keys: [
      'nav.home', 'nav.works', 'nav.about', 'nav.contact',
      'site.title', 'site.description', 'site.og_description', 'site.logo'
    ]},
    { title: '首页 Hero 与 Featured', keys: [
      'hero.title', 'hero.eyebrow', 'hero.subtitle',
      'hero.cta.primary', 'hero.cta.secondary',
      'featured.title', 'featured.subtitle', 'featured.viewAll'
    ]},
    { title: '作品列表与分类', keys: [
      'works.title', 'works.subtitle', 'works.empty.title', 'works.empty.subtitle',
      'category.all', 'category.oil', 'category.watercolor', 'category.sketch',
      'category.ink', 'category.digital', 'category.photograph', 'category.other'
    ]},
    { title: '作品详情页', keys: [
      'detail.back', 'detail.backBottom',
      'detail.meta.category', 'detail.meta.year', 'detail.meta.medium',
      'detail.meta.dimensions', 'detail.meta.published',
      'detail.notFound.title', 'detail.notFound.subtitle', 'detail.noImages'
    ]},
    { title: '关于与联系', keys: [
      'about.unavailable',
      'contact.title', 'contact.subtitle',
      'contact.email.label', 'contact.wechat.label', 'contact.note', 'contact.empty'
    ]},
    { title: '页脚', keys: [
      'footer.brand', 'footer.links.works', 'footer.links.about',
      'footer.links.contact', 'footer.links.admin', 'footer.copyright'
    ]},
    { title: '通用状态', keys: [
      'common.loading', 'common.thumbnail',
      'common.notFound.title', 'common.notFound.subtitle', 'common.backHome'
    ]}
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

      container.innerHTML = CONTENT_GROUPS.map(function (group) {
        const rows = group.keys.map(function (key) {
          const value = content[key] ? content[key].value : '';
          return '<div class="field-group field">' +
            '<label style="font-family:monospace;font-size:12px;color:var(--color-text-secondary);">' +
              escapeHtml(key) +
            '</label>' +
            '<input type="text" data-content-key="' + escapeHtml(key) + '" value="' +
              escapeHtml(value).replace(/"/g, '&quot;') + '">' +
          '</div>';
        }).join('');
        return '<fieldset style="border:1px solid var(--color-border);border-radius:8px;padding:12px 16px;margin-bottom:16px;">' +
               '<legend style="font-weight:600;padding:0 6px;">' + escapeHtml(group.title) + '</legend>' +
               '<div class="field-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' + rows + '</div>' +
             '</fieldset>';
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
      };
    });
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
    $('#btn-reset-artist').onclick = loadArtist;
    $('#btn-save-content').onclick = saveSiteContent;
    $('#btn-reset-content').onclick = loadSiteContent;

    let searchTimer;
    $('#search-input').oninput = function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadArtworks, 300);
    };
    $('#status-filter').onchange = loadArtworks;

    loadArtworks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

