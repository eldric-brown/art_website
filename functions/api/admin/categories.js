import { json, methodNotAllowed } from '../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, key, name, image, sort_order, enabled, created_at, updated_at,
              (SELECT COUNT(*) FROM artworks a WHERE a.category = c.key) AS artwork_count
       FROM categories c
       ORDER BY enabled DESC, sort_order DESC, id ASC`
    ).all();

    return json({ ok: true, data: { categories: results } });
  } catch (error) {
    console.error('list admin categories failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '栏目加载失败'
    }, 500);
  }
}
