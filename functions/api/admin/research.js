import { json, methodNotAllowed } from '../../_lib/http.js';
import { groupItemsBySection, serializeSection } from '../../_lib/research.js';

// ============================================================
// GET /api/admin/research - 后台读取完整研究方向数据
// ============================================================
// 与前台的区别：包含停用（enabled = 0）的板块与条目，且不净化 HTML，
// 方便后台编辑器原样回显正在编辑的内容。
// ============================================================

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const sections = await env.DB.prepare(
      `SELECT id, slug, title, subtitle, sort_order, enabled, created_at, updated_at
       FROM research_sections
       ORDER BY sort_order DESC, id ASC`
    ).all();

    const items = await env.DB.prepare(
      `SELECT id, section_id, title, body, sort_order, enabled, created_at, updated_at
       FROM research_items
       ORDER BY section_id ASC, sort_order DESC, id ASC`
    ).all();

    const itemsBySection = groupItemsBySection(items.results);

    const sectionsOut = [];
    for (const row of sections.results) {
      sectionsOut.push(
        serializeSection(row, itemsBySection[Number(row.id)] || [])
      );
    }

    return json({ ok: true, data: { sections: sectionsOut } });
  } catch (error) {
    console.error('admin research endpoint failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research content unavailable'
    }, 500);
  }
}