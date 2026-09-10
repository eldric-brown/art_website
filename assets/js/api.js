// ============================================================
// api.js - API 调用层
// ============================================================

window.API = (function () {
  'use strict';

  function request(url, options) {
    options = options || {};
    const opts = {
      headers: Object.assign({ 'Content-Type': 'application/json' }, options.headers || {}),
      credentials: 'same-origin'
    };
    if (options.method) opts.method = options.method;
    if (options.body) opts.body = options.body;

    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return {}; })
        .then(function (data) {
          if (!res.ok || !data.ok) {
            const err = new Error(data.message || data.error || '请求失败');
            err.status = res.status;
            err.data = data;
            throw err;
          }
          return data.data;
        });
    }).catch(function (e) {
      if (e instanceof TypeError) {
        throw new Error('网络错误，请稍后重试');
      }
      throw e;
    });
  }

  return {
    listArtworks: function (params) {
      params = params || {};
      const entries = Object.entries(params).filter(function (kv) { return kv[1] != null; });
      const qs = new URLSearchParams(entries).toString();
      return request('/api/artworks' + (qs ? '?' + qs : ''));
    },

    getArtwork: function (slug) {
      return request('/api/artworks/' + encodeURIComponent(slug));
    },

    getArtist: function () {
      return request('/api/artist');
    }
  };
})();
