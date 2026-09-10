// ============================================================
// GET /api/artworks/[slug].js
// 查询单件作品详情
// ============================================================

export async function onRequest({ env, params }) {
  const slug = params.slug;
  if (!slug) {
    return Response.json({ ok: false, error: 'slug required' }, { status: 400 });
  }

  const row = await env.DB.prepare(
    `SELECT id, title, slug, description, images, category, year, medium, dimensions,
            published, featured, sort_order, views, created_at, updated_at
     FROM artworks
     WHERE slug = ? AND published = 1`
  ).bind(slug).first();

  if (!row) {
    return Response.json(
      { ok: false, error: 'not_found', message: '作品不存在或未上架' },
      { status: 404 }
    );
  }

  // 解析 JSON
  const artwork = {
    ...row,
    images: safeParseJSON(row.images, [])
  };

  // 浏览量 +1（异步，不阻塞响应）
  env.DB.prepare('UPDATE artworks SET views = views + 1 WHERE id = ?')
    .bind(artwork.id)
    .run()
    .catch(() => {});

  return Response.json({ ok: true, data: artwork });
}

function safeParseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
  } catch {
    return fallback;
  }
}
