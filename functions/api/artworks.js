import { json, methodNotAllowed, safeParseJSON } from '../_lib/http.js';

function parseBoundedInt(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const featured = url.searchParams.get('featured');
  const limit = parseBoundedInt(url.searchParams.get('limit'), 50, 1, 200);
  const offset = parseBoundedInt(url.searchParams.get('offset'), 0, 0, 1000000);

  const conditions = ['published = 1'];
  const bindValues = [];

  if (category && category !== 'all') {
    if (category.length > 50) {
      return json({ ok: false, error: 'invalid_category' }, 400);
    }
    conditions.push('category = ?');
    bindValues.push(category);
  }
  if (featured === '1') conditions.push('featured = 1');

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  try {
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM artworks ${whereClause}`
    ).bind(...bindValues).first();
    const total = Number(countResult?.total || 0);

    const rows = await env.DB.prepare(
      `SELECT id, title, slug, description, images, category, year, medium, dimensions,
              featured, sort_order, created_at
       FROM artworks
       ${whereClause}
       ORDER BY sort_order DESC, year DESC, id DESC
       LIMIT ? OFFSET ?`
    ).bind(...bindValues, limit, offset).all();

    const artworks = rows.results.map((row) => ({
      ...row,
      images: safeParseJSON(row.images, [])
    }));

    return json({
      ok: true,
      data: { artworks, total, limit, offset }
    });
  } catch (error) {
    console.error('list artworks failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品加载失败'
    }, 500);
  }
}