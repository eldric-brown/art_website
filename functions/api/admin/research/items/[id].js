import { json, methodNotAllowed } from '../../../../_lib/http.js';
import { validateItemPayload, serializeItem } from '../../../../_lib/research.js';

// ============================================================
// PATCH  /api/admin/research/items/:id - 更新富文本条目（部分字段）
// DELETE /api/admin/research/items/:id - 删除富文本条目
// ============================================================
// 允许把 section_id 改到别的板块（等价于移动条目）。
// ============================================================

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
      'SELECT ' + ITEM_COLUMNS + ' FROM research_items WHERE id = ?'
    ).bind(id).first();

    if (!row) {
      return json({
        ok: false,
        error: 'not_found',
        message: 'research item not found'
      }, 404);
    }

    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM research_items WHERE id = ?').bind(id).run();
      return json({ ok: true, data: { deleted: id } });
    }

    // PATCH
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400);
    }

    const { errors, data } = validateItemPayload(body, { partial: true });
    if (errors.length) {
      return json({ ok: false, error: 'validation_failed', details: errors }, 422);
    }
    if (!Object.keys(data).length) {
      return json({ ok: false, error: 'validation_failed', details: ['no fields to update'] }, 422);
    }

    if (data.section_id && data.section_id !== Number(row.section_id)) {
      const target = await env.DB.prepare(
        'SELECT id FROM research_sections WHERE id = ?'
      ).bind(data.section_id).first();
      if (!target) {
        return json({
          ok: false,
          error: 'validation_failed',
          details: ['section_id not found: ' + data.section_id]
        }, 422);
      }
    }

    const sets = Object.keys(data).map(function (key) { return key + ' = ?'; }).join(', ');
    await env.DB.prepare(
      'UPDATE research_items SET ' + sets + ' WHERE id = ?'
    ).bind(...Object.values(data), id).run();

    const updated = await env.DB.prepare(
      'SELECT ' + ITEM_COLUMNS + ' FROM research_items WHERE id = ?'
    ).bind(id).first();

    return json({ ok: true, data: { item: serializeItem(updated) } });
  } catch (error) {
    console.error('update research item failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research item save failed'
    }, 500);
  }
}