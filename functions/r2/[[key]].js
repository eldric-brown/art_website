// ============================================================
// GET /r2/[[key]]
// R2 图片代理路由（multipath 版本）
// 场景：当 R2 bucket 未开启 public 访问时，通过本站代理读取
//
// 用法：/r2/artworks/2025-09-10/xxx.jpg
//       → params.key = "artworks/2025-09-10/xxx.jpg"
// ============================================================

export async function onRequest({ env, params }) {
  const key = decodeURIComponent(params.key);

  if (!key || !key.startsWith('artworks/')) {
    return Response.json({ ok: false, error: 'invalid_key' }, 400);
  }

  if (!env.BUCKET) {
    return Response.json({ ok: false, error: 'bucket_not_configured' }, 500);
  }

  const obj = await env.BUCKET.get(key);
  if (!obj) {
    return Response.json({ ok: false, error: 'not_found' }, 404);
  }

  const contentType = obj.httpMetadata?.contentType || 'application/octet-stream';
  const cacheControl = 'public, max-age=31536000, immutable';

  return new Response(obj.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      'Content-Length': String(obj.size),
      'Access-Control-Allow-Origin': '*'
    }
  });
}
