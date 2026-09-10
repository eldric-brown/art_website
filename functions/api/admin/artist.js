// ============================================================
// PUT /api/admin/artist
// 更新艺术家资料（后台使用，需要登录）
//
// 请求体：
// {
//   "name": "中文名字",
//   "name_en": "English Name",
//   "bio": "完整简介",
//   "bio_short": "一句话简介",
//   "avatar": "头像 URL",
//   "contact_email": "email@example.com",
//   "contact_wechat": "wechat_id",
//   "socials": { "weibo": "...", "instagram": "..." }
// }
// ============================================================

export async function onRequest({ request, env }) {
  if (request.method !== 'PUT') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();

    // 允许更新的字段白名单
    const allowed = ['name', 'name_en', 'bio', 'bio_short', 'avatar', 'signature', 'contact_email', 'contact_wechat'];

    // 构造 SET 子句
    const sets = [];
    const values = [];

    allowed.forEach((key) => {
      if (key in body) {
        sets.push(`${key} = ?`);
        values.push(String(body[key] || ''));
      }
    });

    // socials 单独处理（对象 → JSON 字符串）
    if (body.socials && typeof body.socials === 'object') {
      sets.push('socials = ?');
      values.push(JSON.stringify(body.socials));
    }

    if (sets.length === 0) {
      return Response.json({ ok: false, error: 'no_fields' }, { status: 400 });
    }

    values.push(1); // id = 1

    await env.DB.prepare(
      `UPDATE artist SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    // 返回更新后的数据
    const row = await env.DB.prepare(
      `SELECT id, name, name_en, bio, bio_short, avatar, signature, socials,
              contact_email, contact_wechat, updated_at
       FROM artist WHERE id = 1`
    ).first();

    const artist = {
      ...row,
      socials: safeParseJSON(row.socials, {})
    };

    return Response.json({ ok: true, data: artist });
  } catch (e) {
    return Response.json({ ok: false, error: 'internal_error', message: e.message }, { status: 500 });
  }
}

function safeParseJSON(str, fallback) {
  try {
    return typeof str === 'string' ? JSON.parse(str) : (str || fallback);
  } catch {
    return fallback;
  }
}
