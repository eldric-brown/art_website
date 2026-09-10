import { json, methodNotAllowed, safeParseJSON } from '../_lib/http.js';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT id, name, name_en, bio, bio_short, avatar, signature, socials,
              contact_email, contact_wechat, updated_at
       FROM artist WHERE id = 1`
    ).first();

    if (!row) {
      return json({ ok: false, error: 'artist_not_found' }, 404);
    }

    return json({
      ok: true,
      data: {
        ...row,
        socials: safeParseJSON(row.socials, {})
      }
    });
  } catch (error) {
    console.error('get artist failed:', error);
    return json({
      ok: false,
      error: 'internal_error',
      message: '艺术家信息加载失败'
    }, 500);
  }
}