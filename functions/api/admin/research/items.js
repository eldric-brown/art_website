import { json, methodNotAllowed } from '../../../_lib/http.js';
import { validateItemPayload, serializeItem } from '../../../_lib/research.js';

// ============================================================
// POST /api/admin/research/items - 在指定板块下新建富文本条目
// ============================================================
// body: { section_id, title?, body?, sort_order?, enabled? }
// body 会在服务端净化后才落库，落库的永远是白名单 HTML。
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

  const { errors, data } = validateItemPayload(body, { partial: false });
  if (errors.length) {
    return json({ ok: false, error: 'validation_failed', details: errors }, 422);
  }

  try {
    const section = await env.DB.prepare(
      'SELECT id FROM research_sections WHERE id = ?'
    ).bind(data.section_id).first();

    if (!section) {
      return json({
        ok: false,
        error: 'validation_failed',
        details: ['section_id not found: ' + data.section_id]
      }, 422);
    }

    const result = await env.DB.prepare(
      `INSERT INTO research_items (section_id, title, body, sort_order, enabled)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      data.section_id,
      data.title,
      data.body,
      data.sort_order,
      data.enabled === undefined ? 1 : data.enabled
    ).run();

    // 用 last_row_id 精确取回刚插入的那一行。
    // 不要用 ORDER BY id DESC LIMIT 1 反查：并发往同一板块写入时会取到别人的行。
    const row = await env.DB.prepare(
      'SELECT id, section_id, title, body, sort_order, enabled, created_at, updated_at FROM research_items WHERE id = ?'
    ).bind(result.meta.last_row_id).first();

    return json({ ok: true, data: { item: serializeItem(row) } }, 201);
  } catch (error) {
    console.error('create research item failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research item create failed'
    }, 500);
  }
}