// ============================================================
// GET /api/artist
// 查询艺术家信息
// ============================================================

export async function onRequest({ env }) {
  const row = await env.DB.prepare(
    `SELECT id, name, name_en, bio, bio_short, avatar, signature, socials,
            contact_email, contact_wechat, updated_at
     FROM artist WHERE id = 1`
  ).first();

  if (!row) {
    return Response.json(
      { ok: false, error: 'artist_not_found' },
      { status: 404 }
    );
  }

  const artist = {
    ...row,
    socials: safeParseJSON(row.socials, {})
  };

  return Response.json({ ok: true, data: artist });
}

function safeParseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
  } catch {
    return fallback;
  }
}
