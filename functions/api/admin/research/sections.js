import { json, methodNotAllowed } from '../../../_lib/http.js';
import { validateSectionPayload, serializeSection } from '../../../_lib/research.js';

// ============================================================
// POST /api/admin/research/sections - 新建研究方向板块
// ============================================================
// body: { slug, title, subtitle?, sort_order?, enabled? }
// slug 唯一，新建后仍可在编辑时修改。
// ============================================================

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const { errors, data } = validateSectionPayload(body, { partial: false });
  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  try {
    const existing = await env.DB.prepare(
      'SELECT id FROM research_sections WHERE slug = ?'
    ).bind(data.slug).first();

    if (existing) {
      return json({
        ok: false,
        error: 'validation_failed',
        details: ['slug already exists: ' + data.slug]
      }, 422);
    }

    await env.DB.prepare(
      `INSERT INTO research_sections (slug, title, subtitle, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      data.slug,
      data.title,
      data.subtitle,
      data.sort_order,
      data.enabled === undefined ? 1 : data.enabled
    ).run();

    const row = await env.DB.prepare(
      'SELECT id, slug, title, subtitle, sort_order, enabled, created_at, updated_at FROM research_sections WHERE slug = ?'
    ).bind(data.slug).first();

    return json({ ok: true, data: { section: serializeSection(row, []) } }, 201);
  } catch (error) {
    console.error('create research section failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research section create failed'
    }, 500);
  }
}