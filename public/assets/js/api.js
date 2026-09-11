// ============================================================
// api.js - 前台 API 调用层
// ============================================================

window.API = (function () {
  'use strict';

  function request(url, options) {
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
    }).catch(function (error) {
      if (error instanceof TypeError) {
        throw new Error('网络错误，请稍后重试');
      }
      throw error;
    });
  }

  return {
    listArtworks: function (params) {
      params = params || {};
      const entries = Object.entries(params).filter(function (entry) { return entry[1] != null; });
      const query = new URLSearchParams(entries).toString();
      return request('/api/artworks' + (query ? '?' + query : ''));
    },

    getArtwork: function (id) {
      return request('/api/artworks/' + encodeURIComponent(id));
    },

    getArtist: function () {
      return request('/api/artist');
    },

    getSiteContent: function () {
      return request('/api/site-content');
    }
  };
})();