import { json, methodNotAllowed } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const rows = await env.DB.prepare(
      `SELECT key, value FROM site_content ORDER BY key`
    ).all();

    const content = {};
    for (const row of rows.results) {
      content[row.key] = row.value;
    }

    return json({ ok: true, data: { content } });
  } catch (error) {
    console.error('get site content failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: 'site content unavailable'
    }, 500);
  }
}
