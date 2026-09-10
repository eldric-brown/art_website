// ============================================================
// POST /api/admin/artworks
// 新建作品
//
// 请求体：{
//   title, slug, description, images: [url1, url2],
//   category, year, medium, dimensions,
//   published: 0|1, featured: 0|1, sort_order: number
// }
// ============================================================

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  try {
    const body = await request.json();

    // 基础校验
    const errors = validate(body);
    if (errors.length) {
      return json({ ok: false, error: 'validation_failed', details: errors }, 422);
    }

    // 检查 slug 唯一性
    const exists = await env.DB.prepare(
      'SELECT id FROM artworks WHERE slug = ?'
    ).bind(body.slug).first();
    if (exists) {
      return json(
        { ok: false, error: 'slug_exists', message: `slug "${body.slug}" 已存在` },
        409
      );
    }

    const images = JSON.stringify(body.images || []);

    const result = await env.DB.prepare(
      `INSERT INTO artworks
         (title, slug, description, images, category, year, medium, dimensions,
          published, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.title,
      body.slug,
      body.description || '',
      images,
      body.category || 'other',
      body.year,
      body.medium || '',
      body.dimensions || '',
      body.published ? 1 : 0,
      body.featured ? 1 : 0,
      body.sort_order || 0
    ).run();

    // 读取刚创建的作品返回给前端
    const row = await env.DB.prepare(
      'SELECT id, title, slug, images, category, year, medium, dimensions, published, featured, sort_order, created_at, updated_at FROM artworks WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return Response.json({
      ok: true,
      data: { ...row, images: JSON.parse(row.images) },
      message: '作品创建成功'
    }, { status: 201 });
  } catch (e) {
    console.error('create artwork failed:', e);
    return json({ ok: false, error: 'internal_error', message: e.message }, 500);
  }
}

function validate(body) {
  const errors = [];
  if (!body.title || !String(body.title).trim()) errors.push('title 不能为空');
  if (!body.slug || !String(body.slug).trim()) errors.push('slug 不能为空');
  else if (!/^[a-z0-9-]+$/.test(body.slug)) errors.push('slug 只能包含小写字母、数字和连字符');
  if (!body.images || !Array.isArray(body.images) || body.images.length === 0) {
    errors.push('至少需要一张图片');
  }
  if (!body.year || isNaN(body.year) || body.year < 1900 || body.year > 2100) {
    errors.push('year 必须是 1900-2100 的整数');
  }
  return errors;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
