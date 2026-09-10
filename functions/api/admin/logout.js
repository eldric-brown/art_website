// ============================================================
// POST /api/admin/logout
// 登出：清除 art_session Cookie
// ============================================================

export async function onRequest({ request }) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  return Response.json({ ok: true }, {
    headers: {
      'Content-Type': 'application/json',
      // 清除 Cookie（Max-Age=0 让浏览器删除）
      'Set-Cookie': 'art_session=; Path=/; Max-Age=0; SameSite=Lax',
      'Cache-Control': 'no-store'
    }
  });
}
