import { json, methodNotAllowed } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, date_text, location, image, sort_order, created_at
       FROM meetup_items
       ORDER BY sort_order DESC, id DESC`
    ).all();

    return json({ ok: true, data: { items: results } });
  } catch (error) {
    console.error('list meetup items failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '活动加载失败'
    }, 500);
  }
}
