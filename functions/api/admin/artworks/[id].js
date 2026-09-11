import {
  json,
  methodNotAllowed,
  safeParseJSON,
  validateArtworkPayload
} from '../../../_lib/http.js';

export async function onRequest({ request, env, params }) {
  const id = Number(params.id);
  if (!/^\d+$/.test(String(params.id || '')) || !Number.isSafeInteger(id) || id <= 0) {
    return json({ ok: false, error: 'invalid_id' }, 400);
  }

  if (request.method === 'PATCH') return handlePatch(id, request, env);
  if (request.method === 'DELETE') return handleDelete(id, env);
  return methodNotAllowed(['PATCH', 'DELETE']);
}

async function handlePatch(id, request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const { errors, data } = validateArtworkPayload(body, { partial: true });
  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  if (Object.keys(data).length === 0) {
    return json({ ok: false, error: 'no_fields_to_update' }, 400);
  }

  try {
    const keys = Object.keys(data);
    const setClauses = keys.map((key) => `${key} = ?`);
    const bindValues = keys.map((key) => key === 'images' ? JSON.stringify(data[key]) : data[key]);
    bindValues.push(id);

    const result = await env.DB.prepare(
      `UPDATE artworks SET ${setClauses.join(', ')} WHERE id = ?`
    ).bind(...bindValues).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    const row = await env.DB.prepare(
      `SELECT id, title, description, images, category, year, medium, dimensions,
              published, featured, sort_order, views, created_at, updated_at
       FROM artworks WHERE id = ?`
    ).bind(id).first();

    return json({
      ok: true,
      data: { ...row, images: safeParseJSON(row.images, []) },
      message: '更新成功'
    });
  } catch (error) {
    console.error('patch artwork failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品更新失败'
    }, 500);
  }
}

async function handleDelete(id, env) {
  try {
    const result = await env.DB.prepare('DELETE FROM artworks WHERE id = ?')
      .bind(id).run();

    if (result.meta.changes === 0) {
      return json({ ok: false, error: 'not_found' }, 404);
    }

    await env.DB.prepare('DELETE FROM view_logs WHERE artwork_id = ?').bind(id).run();
    return json({ ok: true, message: '删除成功' });
  } catch (error) {
    console.error('delete artwork failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品删除失败'
    }, 500);
  }
}