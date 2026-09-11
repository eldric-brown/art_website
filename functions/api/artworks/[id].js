import { json, methodNotAllowed, safeParseJSON } from '../../_lib/http.js';

export async function onRequest({ request, env, params, waitUntil }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  const id = Number(params.id);
  if (!/^\d+$/.test(String(params.id || '')) || !Number.isSafeInteger(id) || id <= 0) {
    return json({ ok: false, error: 'invalid_id' }, 400);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT id, title, description, images, category, year, medium, dimensions,
              published, featured, sort_order, views, created_at, updated_at
       FROM artworks
       WHERE id = ? AND published = 1`
    ).bind(id).first();

    if (!row) {
      return json({
        ok: false,
        error: 'not_found',
        message: '作品不存在或未上架'
      }, 404);
    }

    const artwork = {
      ...row,
      images: safeParseJSON(row.images, [])
    };

    if (request.method === 'GET') {
      const increment = env.DB.prepare(
        'UPDATE artworks SET views = views + 1 WHERE id = ?'
      ).bind(artwork.id).run().catch((error) => {
        console.error('increment artwork views failed:', error);
      });

      if (typeof waitUntil === 'function') waitUntil(increment);
      else await increment;
    }

    return json({ ok: true, data: artwork });
  } catch (error) {
    console.error('get artwork failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品加载失败'
    }, 500);
  }
}