// ============================================================
// GET /api/artworks
// 查询上架作品列表（前端使用）
// 支持 query 参数：
//   ?category=oil         按分类筛选
//   ?featured=1           只取精选
//   ?limit=20             限制返回数量
//   ?offset=0             分页偏移
// ============================================================

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const featured = url.searchParams.get('featured');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  // 构建查询
  const conditions = ["published = 1"];
  const bindings = {};

  if (category && category !== 'all') {
    conditions.push('category = ?');
    bindings.category = category;
  }
  if (featured === '1') {
    conditions.push('featured = 1');
  }

  const whereClause = 'WHERE ' + conditions.join(' AND ');
  const bindValues = Object.values(bindings);

  // 查询总数
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM artworks ${whereClause}`
  ).bind(...bindValues).first();
  const total = countResult?.total || 0;

  // 查询作品列表（images 字段是 JSON 字符串，需要解析）
  const rows = await env.DB.prepare(
    `SELECT id, title, slug, description, images, category, year, medium, dimensions, featured, sort_order, created_at
     FROM artworks
     ${whereClause}
     ORDER BY sort_order DESC, year DESC, id DESC
     LIMIT ? OFFSET ?`
  ).bind(...bindValues, limit, offset).all();

  // 解析 JSON 字段
  const artworks = rows.results.map(row => ({
    ...row,
    images: safeParseJSON(row.images, [])
  }));

  return Response.json({
    ok: true,
    data: {
      artworks,
      total,
      limit,
      offset
    }
  });
}

function safeParseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
  } catch {
    return fallback;
  }
}
