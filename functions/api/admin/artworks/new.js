import { json, methodNotAllowed, validateArtworkPayload } from '../../../_lib/http.js';

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return methodNotAllowed(['POST']);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const { errors, data } = validateArtworkPayload(body);
  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO artworks
         (title, description, images, category, year, medium, dimensions,
          published, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      data.title,
      data.description,
      JSON.stringify(data.images),
      data.category,
      data.year,
      data.medium,
      data.dimensions,
      data.published,
      data.featured,
      data.sort_order
    ).run();

    const row = await env.DB.prepare(
      `SELECT id, title, description, images, category, year, medium, dimensions,
              published, featured, sort_order, views, created_at, updated_at
       FROM artworks WHERE id = ?`
    ).bind(result.meta.last_row_id).first();

    return json({
      ok: true,
      data: { ...row, images: JSON.parse(row.images) },
      message: '作品创建成功'
    }, 201);
  } catch (error) {
    console.error('create artwork failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '作品创建失败'
    }, 500);
  }
}