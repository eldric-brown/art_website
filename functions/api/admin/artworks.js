import { json, methodNotAllowed, safeParseJSON } from '../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  const url = new URL(request.url);
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'all';

  if (search.length > 100) {
    return json({ ok: false, error: 'search_too_long' }, 400);
  }
  if (!['all', 'published', 'draft'].includes(status)) {
    return json({ ok: false, error: 'invalid_status' }, 400);
  }

  const conditions = [];
  const bindings = [];

  if (status === 'published') conditions.push('published = 1');
  if (status === 'draft') conditions.push('published = 0');

  if (search) {
    conditions.push('title LIKE ? ESCAPE \'\\\'');
    bindings.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const rows = await env.DB.prepare(
      `SELECT id, title, slug, description, images, category, year, medium, dimensions,
              published, featured, sort_order, views, created_at, updated_at
       FROM artworks
       ${where}
       ORDER BY updated_at DESC, id DESC
       LIMIT 500`
    ).bind(...bindings).all();

    const artworks = rows.results.map((row) => ({
      ...row,
      images: safeParseJSON(row.images, [])
    }));

    return json({ ok: true, data: artworks });
  } catch (error) {
    console.error('list admin artworks failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品列表加载失败'
    }, 500);
  }
}