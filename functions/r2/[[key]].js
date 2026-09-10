import { json, methodNotAllowed } from '../_lib/http.js';

export async function onRequest({ request, env, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  let key;
  try {
    key = decodeURIComponent(params.key || '');
  } catch {
    return json({ ok: false, error: 'invalid_key' }, 400);
  }

  if (!key || !key.startsWith('artworks/') || key.includes('..') || key.includes('\\') || key.includes('\0')) {
    return json({ ok: false, error: 'invalid_key' }, 400);
  }

  if (!env.BUCKET) {
    return json({ ok: false, error: 'bucket_not_configured' }, 500);
  }

  try {
    const object = await env.BUCKET.get(key);
    if (!object) return json({ ok: false, error: 'not_found' }, 404);

    const headers = new Headers({
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(object.size),
      'ETag': object.etag || '',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*'
    });

    if (object.etag && request.headers.get('If-None-Match') === object.etag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(request.method === 'HEAD' ? null : object.body, { headers });
  } catch (error) {
    console.error('read R2 object failed:', error);
    return json({ ok: false, error: 'storage_error' }, 500);
  }
}