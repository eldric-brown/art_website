// ============================================================
// PATCH /api/admin/artworks/[id]  - 更新作品（含上架/下架）
// DELETE /api/admin/artworks/[id] - 删除作品
// ============================================================

export async function onRequest({ request, env, params }) {
  const id = parseInt(params.id, 10);
  if (!id || isNaN(id)) {
    return json({ ok: false, error: 'invalid_id' }, 400);
  }

  if (request.method === 'PATCH') {
    return handlePatch(id, request, env);
  }

  if (request.method === 'DELETE') {
    return handleDelete(id, env);
  }

  return json({ ok: false, error: 'method_not_allowed' }, 405);
}

// ---------- PATCH ----------
async function handlePatch(id, request, env) {
  try {
    const body = await request.json();
    const allowed = ['title', 'slug', 'description', 'category', 'year', 'medium', 'dimensions', 'published', 'featured', 'sort_order', 'images'];

    const setClauses = [];
    const bindValues = [];

    for (const key of allowed) {
      if (key in body) {
        let value = body[key];
        if (key === 'images' && Array.isArray(value)) {
          value = JSON.stringify(value);
        }
        if (key === 'published' || key === 'featured') {
          value = value ? 1 : 0;
        }
        setClauses.push(`${key} = ?`);
        bindValues.push(value);
      }
    }

    if (setClauses.length === 0) {
      return json({ ok: false, error: 'no_fields_to_update' }, 400);
    }

    bindValues.push(id);
    const result = await env.DB.prepare(
      `UPDATE artworks SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...bindValues).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const row = await env.DB.prepare(
      'SELECT id, title, slug, images, category, year, medium, dimensions, published, featured, sort_order, views, created_at, updated_at FROM artworks WHERE id = ?'
    ).bind(id).first();

    return Response.json({
      ok: true,
      data: { ...row, images: JSON.parse(row.images) },
      message: '更新成功'
    });
  } catch (e) {
    console.error('patch failed:', e);
    return json({ ok: false, error: 'internal_error', message: e.message }, 500);
  }
}

// ---------- DELETE ----------
async function handleDelete(id, env) {
  try {
    const result = await env.DB.prepare('DELETE FROM artworks WHERE id = ?')
      .bind(id).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    // 同时清理浏览量记录
    await env.DB.prepare('DELETE FROM view_logs WHERE artwork_id = ?').bind(id).run();

    return Response.json({ ok: true, message: '删除成功' });
  } catch (e) {
    console.error('delete failed:', e);
    return json({ ok: false, error: 'internal_error', message: e.message }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
