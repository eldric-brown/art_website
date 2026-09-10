// ============================================================
// GET /api/admin/artworks
// 后台专用：查询所有作品（含未上架）
// 支持 query 参数：
//   ?search=关键词    按标题搜索
//   ?status=published|draft|all
// ============================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search');
  const status = url.searchParams.get('status') || 'all';

  const conditions = [];
  const bindings = [];

  if (status === 'published') conditions.push('published = 1');
  else if (status === 'draft') conditions.push('published = 0');

  if (search) {
    conditions.push('title LIKE ?');
    bindings.push(`%${search}%`);
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  const rows = await env.DB.prepare(
    `SELECT id, title, slug, images, category, year, medium, dimensions,
            published, featured, sort_order, views, created_at, updated_at
     FROM artworks
     ${where}
     ORDER BY updated_at DESC, id DESC
     LIMIT 500`
  ).bind(...bindings).all();

  const artworks = rows.results.map(r => ({
    ...r,
    images: safeParseJSON(r.images, [])
  }));

  return Response.json({ ok: true, data: artworks });
}

function safeParseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
  } catch {
    return fallback;
  }
}
