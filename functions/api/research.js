import { json, methodNotAllowed } from '../_lib/http.js';
import { sanitizeRichHtml, MAX_BODY_LENGTH } from '../_lib/html.js';

// ============================================================
// GET /api/research - 前台读取研究方向（板块 + 条目）
// ============================================================
// 只返回 enabled = 1 的板块与条目；body 已在写入时净化过，这里再走一遍兜底。
// 没有任何条目内容的板块不返回，避免前台出现空板块。
// ============================================================

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const sections = await env.DB.prepare(
      `SELECT id, slug, title, subtitle, sort_order, created_at, updated_at
       FROM research_sections
       WHERE enabled = 1
       ORDER BY sort_order DESC, id ASC`
    ).all();

    const items = await env.DB.prepare(
      `SELECT id, section_id, title, body, sort_order, created_at, updated_at
       FROM research_items
       WHERE enabled = 1
       ORDER BY section_id ASC, sort_order DESC, id ASC`
    ).all();

    const itemsBySection = {};
    for (const row of items.results) {
      const key = Number(row.section_id);
      if (!itemsBySection[key]) itemsBySection[key] = [];
      itemsBySection[key].push({
        id: Number(row.id),
        title: String(row.title == null ? '' : row.title),
        body: sanitizeRichHtml(row.body, MAX_BODY_LENGTH),
        sort_order: Number(row.sort_order) || 0,
        updated_at: row.updated_at
      });
    }

    const sectionsOut = [];
    for (const row of sections.results) {
      const sectionItems = itemsBySection[Number(row.id)] || [];
      if (!sectionItems.length) continue;
      sectionsOut.push({
        id: Number(row.id),
        slug: String(row.slug == null ? '' : row.slug),
        title: String(row.title == null ? '' : row.title),
        subtitle: String(row.subtitle == null ? '' : row.subtitle),
        sort_order: Number(row.sort_order) || 0,
        items: sectionItems
      });
    }

    return json({ ok: true, data: { sections: sectionsOut } });
  } catch (error) {
    console.error('research endpoint failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'research content unavailable'
    }, 500);
  }
}