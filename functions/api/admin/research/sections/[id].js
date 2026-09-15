import { json, methodNotAllowed } from '../../../../_lib/http.js';
import { validateSectionPayload, serializeSection, groupItemsBySection } from '../../../../_lib/research.js';

// ============================================================
// PATCH  /api/admin/research/sections/:id - 更新板块（部分字段）
// DELETE /api/admin/research/sections/:id - 删除板块（连同其下全部条目）
// ============================================================
// 板块下没有数据库外键级联（D1 默认不启用 FK），所以 DELETE 要显式清条目。
// ============================================================

const SECTION_COLUMNS = 'id, slug, title, subtitle, sort_order, enabled, created_at, updated_at';
const ITEM_COLUMNS = 'id, section_id, title, body, sort_order, enabled, created_at, updated_at';

function isValidId(rawId) {
  const id = Number(rawId);
  return /^\d+$/.test(String(rawId == null ? '' : rawId)) && Number.isSafeInteger(id) && id > 0;
}

export async function onRequest({ request, env, params }) {
  if (!['PATCH', 'DELETE'].includes(request.method)) {
    return methodNotAllowed(['PATCH', 'DELETE']);
  }

  const id = Number(params.id);
  if (!isValidId(params.id)) {
    return json({ ok: false, error: 'invalid_id' }, 400);
  }

  try {
    const row = await env.DB.prepare(
      'SELECT ' + SECTION_COLUMNS + ' FROM research_sections WHERE id = ?'
    ).bind(id).first();

    if (!row) {
      return json({
        ok: false,
        error: 'not_found',
        message: 'research section not found'
      }, 404);
    }

    if (request.method === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM research_items WHERE section_id = ?').bind(id),
        env.DB.prepare('DELETE FROM research_sections WHERE id = ?').bind(id)
      ]);
      return json({ ok: true, data: { deleted: id } });
    }

    // PATCH
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { errors, data } = validateSectionPayload(body, { partial: true });
    if (errors.length) {
      return json({ ok: false, error: 'validation_failed', details: errors }, 422);
    }
    if (!Object.keys(data).length) {
      return json({ ok: false, error: 'validation_failed', details: ['no fields to update'] }, 422);
    }

    if (data.slug && data.slug !== row.slug) {
      const conflict = await env.DB.prepare(
        'SELECT id FROM research_sections WHERE slug = ? AND id != ?'
      ).bind(data.slug, id).first();
      if (conflict) {
        return json({
          ok: false,
          error: 'validation_failed',
          details: ['slug already exists: ' + data.slug]
        }, 422);
      }
    }

    const sets = Object.keys(data).map(function (key) { return key + ' = ?'; }).join(', ');
    await env.DB.prepare(
      'UPDATE research_sections SET ' + sets + ' WHERE id = ?'
    ).bind(...Object.values(data), id).run();

    const updated = await env.DB.prepare(
      'SELECT ' + SECTION_COLUMNS + ' FROM research_sections WHERE id = ?'
    ).bind(id).first();

    const items = await env.DB.prepare(
      'SELECT ' + ITEM_COLUMNS + ' FROM research_items WHERE section_id = ? ORDER BY sort_order DESC, id ASC'
    ).bind(id).all();

    return json({ ok: true, data: { section: serializeSection(updated, groupItemsBySection(items.results)[id]) } });
  } catch (error) {
    console.error('update research section failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research section save failed'
    }, 500);
  }
}